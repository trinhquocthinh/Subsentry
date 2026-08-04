import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { subscriptions } from '@/core/db/schema';
import type {
  ISubscriptionRepository,
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
} from '../domain/subscription-repository.interface';
import {
  type SubscriptionEntity,
  SubscriptionStatus,
  type BillingCycle,
} from '../domain/subscription.entity';

export class DrizzleSubscriptionRepository implements ISubscriptionRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  // Helper to map DB row to SubscriptionEntity
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToEntity(row: any): SubscriptionEntity {
    return {
      id: row.id,
      merchantName: row.merchantName,
      amount: row.amount,
      currency: row.currency,
      subscriberId: row.subscriberId,
      paymentCardId: row.paymentCardId ?? null,
      status: row.status as SubscriptionStatus,
      billingCycle: row.billingCycle as BillingCycle,
      nextBillingDate: row.nextBillingDate,
      confidenceScore: row.confidenceScore,
      directKillLink: row.directKillLink ?? null,
      isMustKeep: Boolean(row.isMustKeep),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async findById(id: number): Promise<SubscriptionEntity | null> {
    const rows = await this.db.select().from(subscriptions).where(eq(subscriptions.id, id));
    if (!rows || rows.length === 0) return null;
    return this.mapToEntity(rows[0]);
  }

  async findByMerchantAndSubscriber(
    merchantName: string,
    subscriberId: number
  ): Promise<SubscriptionEntity | null> {
    const normalizedMerchant = merchantName.trim().toLowerCase();

    // Query rows for subscriberId
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.subscriberId, subscriberId));

    // Case-insensitive match on merchantName
    const match = rows.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (r: any) => r.merchantName.trim().toLowerCase() === normalizedMerchant
    );

    if (!match) return null;
    return this.mapToEntity(match);
  }

  async findActiveSubscriptions(): Promise<SubscriptionEntity[]> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(inArray(subscriptions.status, [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE]));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async findByNextBillingDateRange(
    startDate: string,
    endDate: string
  ): Promise<SubscriptionEntity[]> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(
        and(
          gte(subscriptions.nextBillingDate, startDate),
          lte(subscriptions.nextBillingDate, endDate)
        )
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async findAllActiveGroupedByMerchant(): Promise<Map<string, SubscriptionEntity[]>> {
    const activeSubs = await this.findActiveSubscriptions();
    const map = new Map<string, SubscriptionEntity[]>();

    for (const sub of activeSubs) {
      const normalizedMerchant = sub.merchantName.trim().toLowerCase();
      const existing = map.get(normalizedMerchant) || [];
      existing.push(sub);
      map.set(normalizedMerchant, existing);
    }

    return map;
  }

  async create(data: CreateSubscriptionInput): Promise<SubscriptionEntity> {
    const [inserted] = await this.db
      .insert(subscriptions)
      .values({
        merchantName: data.merchantName,
        amount: data.amount,
        currency: data.currency || 'VND',
        subscriberId: data.subscriberId,
        paymentCardId: data.paymentCardId ?? null,
        status: data.status,
        billingCycle: data.billingCycle,
        nextBillingDate: data.nextBillingDate,
        confidenceScore: data.confidenceScore,
        directKillLink: data.directKillLink ?? null,
        isMustKeep: data.isMustKeep ?? false,
      })
      .returning();

    return this.mapToEntity(inserted);
  }

  async update(id: number, data: UpdateSubscriptionInput): Promise<SubscriptionEntity> {
    const now = new Date().toISOString();
    const updatePayload: Record<string, unknown> = {
      updatedAt: now,
    };

    if (data.merchantName !== undefined) updatePayload.merchantName = data.merchantName;
    if (data.amount !== undefined) updatePayload.amount = data.amount;
    if (data.currency !== undefined) updatePayload.currency = data.currency;
    if (data.subscriberId !== undefined) updatePayload.subscriberId = data.subscriberId;
    if (data.paymentCardId !== undefined) updatePayload.paymentCardId = data.paymentCardId;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.billingCycle !== undefined) updatePayload.billingCycle = data.billingCycle;
    if (data.nextBillingDate !== undefined) updatePayload.nextBillingDate = data.nextBillingDate;
    if (data.confidenceScore !== undefined) updatePayload.confidenceScore = data.confidenceScore;
    if (data.directKillLink !== undefined) updatePayload.directKillLink = data.directKillLink;
    if (data.isMustKeep !== undefined) updatePayload.isMustKeep = data.isMustKeep;

    const [updated] = await this.db
      .update(subscriptions)
      .set(updatePayload)
      .where(eq(subscriptions.id, id))
      .returning();

    return this.mapToEntity(updated);
  }
}
