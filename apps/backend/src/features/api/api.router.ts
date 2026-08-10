import { Hono } from 'hono';
import { eq, inArray } from 'drizzle-orm';
import type { Bindings } from '../../index';
import { createDbClient } from '../../core/db';
import { telegramInitDataAuth } from '../../core/middleware/telegram-init-data.middleware';
import { subscriptions, members, paymentCards } from '../../core/db/schema';

export const apiRouter = new Hono<{ Bindings: Bindings }>();

// Apply Telegram initData auth to all /api/v1 routes
apiRouter.use('*', telegramInitDataAuth());

/**
 * GET /subscriptions — List all subscriptions with subscriber & card info
 */
apiRouter.get('/subscriptions', async (c) => {
  const db = createDbClient(c.env.DB);

  const allSubs = await db.select().from(subscriptions);
  const allMembers = await db.select().from(members);
  const allCards = await db.select().from(paymentCards);

  // Build lookup maps
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));
  const cardMap = new Map(allCards.map((card) => [card.id, card]));

  const enriched = allSubs.map((sub) => {
    const subscriber = memberMap.get(sub.subscriberId);
    const card = sub.paymentCardId ? cardMap.get(sub.paymentCardId) : null;

    return {
      id: sub.id,
      merchantName: sub.merchantName,
      amount: sub.amount,
      currency: sub.currency,
      subscriberId: sub.subscriberId,
      subscriberName: subscriber?.displayName || 'Unknown',
      subscriberRole: subscriber?.role || 'SUBSCRIBER',
      paymentCardId: sub.paymentCardId,
      cardLabel: card?.cardLabel || null,
      cardLastFour: card?.lastFour || null,
      cardOwnerName: card ? memberMap.get(card.cardOwnerId)?.displayName || null : null,
      status: sub.status,
      billingCycle: sub.billingCycle,
      nextBillingDate: sub.nextBillingDate,
      confidenceScore: sub.confidenceScore,
      directKillLink: sub.directKillLink,
      isMustKeep: Boolean(sub.isMustKeep),
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    };
  });

  return c.json({ success: true, data: enriched });
});

/**
 * GET /subscriptions/:id — Detail of one subscription
 */
apiRouter.get('/subscriptions/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid subscription ID' } },
      400
    );
  }

  const db = createDbClient(c.env.DB);
  const rows = await db.select().from(subscriptions).where(eq(subscriptions.id, id));

  if (!rows || rows.length === 0) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } },
      404
    );
  }

  const sub = rows[0];

  // Enrich with subscriber and card info
  const memberRows = await db.select().from(members).where(eq(members.id, sub.subscriberId));
  const subscriber = memberRows[0] || null;

  let card = null;
  let cardOwner = null;
  if (sub.paymentCardId) {
    const cardRows = await db
      .select()
      .from(paymentCards)
      .where(eq(paymentCards.id, sub.paymentCardId));
    card = cardRows[0] || null;
    if (card) {
      const ownerRows = await db.select().from(members).where(eq(members.id, card.cardOwnerId));
      cardOwner = ownerRows[0] || null;
    }
  }

  return c.json({
    success: true,
    data: {
      id: sub.id,
      merchantName: sub.merchantName,
      amount: sub.amount,
      currency: sub.currency,
      subscriberId: sub.subscriberId,
      subscriberName: subscriber?.displayName || 'Unknown',
      subscriberRole: subscriber?.role || 'SUBSCRIBER',
      paymentCardId: sub.paymentCardId,
      cardLabel: card?.cardLabel || null,
      cardLastFour: card?.lastFour || null,
      cardOwnerName: cardOwner?.displayName || null,
      status: sub.status,
      billingCycle: sub.billingCycle,
      nextBillingDate: sub.nextBillingDate,
      confidenceScore: sub.confidenceScore,
      directKillLink: sub.directKillLink,
      isMustKeep: Boolean(sub.isMustKeep),
      createdAt: sub.createdAt,
      updatedAt: sub.updatedAt,
    },
  });
});

/**
 * PATCH /subscriptions/:id — Quick edit subscription fields
 * Allowed fields: amount, nextBillingDate, isMustKeep, paymentCardId
 */
apiRouter.patch('/subscriptions/:id', async (c) => {
  const id = parseInt(c.req.param('id'), 10);
  if (isNaN(id)) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid subscription ID' } },
      400
    );
  }

  const body = await c.req.json();
  const allowedFields = ['amount', 'nextBillingDate', 'isMustKeep', 'paymentCardId'];

  // Input validation
  if (body.amount !== undefined) {
    if (typeof body.amount !== 'number' || body.amount < 0 || isNaN(body.amount)) {
      return c.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid amount' } },
        400
      );
    }
  }

  if (body.nextBillingDate !== undefined) {
    if (
      typeof body.nextBillingDate !== 'string' ||
      isNaN(new Date(body.nextBillingDate).getTime())
    ) {
      return c.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid nextBillingDate' } },
        400
      );
    }
  }

  // Build update payload with only allowed fields
  const updatePayload: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };

  let hasUpdate = false;
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // Map camelCase to snake_case for Drizzle
      const columnMap: Record<string, string> = {
        amount: 'amount',
        nextBillingDate: 'next_billing_date',
        isMustKeep: 'is_must_keep',
        paymentCardId: 'payment_card_id',
      };
      updatePayload[columnMap[field]] = body[field];
      hasUpdate = true;
    }
  }

  if (!hasUpdate) {
    return c.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'No valid fields to update' } },
      400
    );
  }

  const db = createDbClient(c.env.DB);

  // Verify subscription exists
  const existing = await db.select().from(subscriptions).where(eq(subscriptions.id, id));
  if (!existing || existing.length === 0) {
    return c.json(
      { success: false, error: { code: 'NOT_FOUND', message: 'Subscription not found' } },
      404
    );
  }

  // Verify paymentCardId if provided
  if (body.paymentCardId !== undefined && body.paymentCardId !== null) {
    const cardRows = await db
      .select()
      .from(paymentCards)
      .where(eq(paymentCards.id, body.paymentCardId as number));
    if (!cardRows || cardRows.length === 0) {
      return c.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Payment card not found' } },
        400
      );
    }
  }

  // Use Drizzle's typed update for safety
  const drizzleUpdate: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (body.amount !== undefined) drizzleUpdate.amount = body.amount;
  if (body.nextBillingDate !== undefined) drizzleUpdate.nextBillingDate = body.nextBillingDate;
  if (body.isMustKeep !== undefined) drizzleUpdate.isMustKeep = body.isMustKeep;
  if (body.paymentCardId !== undefined) drizzleUpdate.paymentCardId = body.paymentCardId;

  const [updated] = await db
    .update(subscriptions)
    .set(drizzleUpdate)
    .where(eq(subscriptions.id, id))
    .returning();

  return c.json({ success: true, data: updated });
});

/**
 * GET /members — List all family members
 */
apiRouter.get('/members', async (c) => {
  const db = createDbClient(c.env.DB);
  const allMembers = await db.select().from(members);

  const data = allMembers.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    role: m.role,
    telegramChatId: m.telegramChatId,
    email: m.email,
    createdAt: m.createdAt,
  }));

  return c.json({ success: true, data });
});

/**
 * GET /payment-cards — List all payment cards with owner info
 */
apiRouter.get('/payment-cards', async (c) => {
  const db = createDbClient(c.env.DB);
  const allCards = await db.select().from(paymentCards);
  const allMembers = await db.select().from(members);

  const memberMap = new Map(allMembers.map((m) => [m.id, m]));

  const data = allCards.map((card) => ({
    id: card.id,
    cardLabel: card.cardLabel,
    lastFour: card.lastFour,
    cardOwnerId: card.cardOwnerId,
    cardOwnerName: memberMap.get(card.cardOwnerId)?.displayName || 'Unknown',
    isActive: Boolean(card.isActive),
    createdAt: card.createdAt,
  }));

  return c.json({ success: true, data });
});

/**
 * GET /stats/spending — Spending breakdown for pie chart
 * Groups active subscriptions by merchant and subscriber
 */
apiRouter.get('/stats/spending', async (c) => {
  const db = createDbClient(c.env.DB);

  const activeSubs = await db
    .select()
    .from(subscriptions)
    .where(inArray(subscriptions.status, ['TRIAL', 'ACTIVE']));

  const allMembers = await db.select().from(members);
  const memberMap = new Map(allMembers.map((m) => [m.id, m]));

  // Group by merchant
  const byMerchant: Record<string, number> = {};
  // Group by subscriber
  const bySubscriber: Record<string, number> = {};

  let totalMonthly = 0;
  let trialCount = 0;
  let activeCount = 0;

  for (const sub of activeSubs) {
    // Normalize to monthly amount for comparison
    let monthlyAmount = sub.amount;
    if (sub.billingCycle === 'YEARLY') monthlyAmount = sub.amount / 12;
    if (sub.billingCycle === 'WEEKLY') monthlyAmount = sub.amount * 4;

    totalMonthly += monthlyAmount;

    byMerchant[sub.merchantName] = (byMerchant[sub.merchantName] || 0) + monthlyAmount;

    const subscriberName = memberMap.get(sub.subscriberId)?.displayName || 'Unknown';
    bySubscriber[subscriberName] = (bySubscriber[subscriberName] || 0) + monthlyAmount;

    if (sub.status === 'TRIAL') trialCount++;
    if (sub.status === 'ACTIVE') activeCount++;
  }

  // Find next billing subscription (earliest upcoming)
  const now = new Date().toISOString().split('T')[0];
  const upcoming = activeSubs
    .filter((s) => s.nextBillingDate >= now)
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));

  const nextBilling = upcoming[0]
    ? {
        merchantName: upcoming[0].merchantName,
        nextBillingDate: upcoming[0].nextBillingDate,
        amount: upcoming[0].amount,
        currency: upcoming[0].currency,
      }
    : null;

  return c.json({
    success: true,
    data: {
      totalMonthly: Math.round(totalMonthly),
      activeCount,
      trialCount,
      currency: 'VND',
      byMerchant: Object.entries(byMerchant).map(([name, amount]) => ({
        name,
        amount: Math.round(amount),
      })),
      bySubscriber: Object.entries(bySubscriber).map(([name, amount]) => ({
        name,
        amount: Math.round(amount),
      })),
      nextBilling,
    },
  });
});
