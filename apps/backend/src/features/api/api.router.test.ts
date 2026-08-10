import { describe, expect, it, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { Hono } from 'hono';
import { apiRouter } from './api.router';
import { members, subscriptions, paymentCards } from '@/core/db/schema';
import type { Bindings } from '@/index';

const migrationsFolder = path.resolve(__dirname, '../../../drizzle');

function createBetterSqliteD1Bridge(sqlite: InstanceType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all() {
              const stmt = sqlite.prepare(query);
              const results = stmt.all(...params);
              return { results, success: true, meta: {} };
            },
            async first(colName?: string) {
              const stmt = sqlite.prepare(query);
              const result = stmt.get(...params);
              if (!result) return null;
              if (colName) return (result as Record<string, unknown>)[colName] ?? null;
              return result;
            },
            async run() {
              const stmt = sqlite.prepare(query);
              const info = stmt.run(...params);
              return {
                success: true,
                meta: { changes: info.changes, last_row_id: info.lastInsertRowid },
              };
            },
            async raw() {
              const stmt = sqlite.prepare(query);
              return stmt.raw().all(...params);
            },
          };
        },
      };
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async batch(_statements: any[]) {
      throw new Error('Batch not implemented in mock');
    },
    async dump() {
      throw new Error('Dump not implemented in mock');
    },
  } as unknown as D1Database;
}

// Mock the middleware so we don't have to generate real Telegram initData signatures in tests
vi.mock('@/core/middleware/telegram-init-data.middleware', () => {
  return {
    telegramInitDataAuth: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return async (c: any, next: any) => {
        // Just mock setting the context variables
        c.set('telegramUser', { id: 12345, first_name: 'Test' });
        c.set('familyMember', { id: 1, displayName: 'Test Member', role: 'ADMIN' });
        return next();
      };
    },
  };
});

describe('API Router (/api/v1)', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let d1Mock: D1Database;
  let sqlite: InstanceType<typeof Database>;
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    await migrate(db, { migrationsFolder });
    d1Mock = createBetterSqliteD1Bridge(sqlite);

    // Setup Hono app with the router
    app = new Hono<{ Bindings: Bindings }>();
    app.route('/api/v1', apiRouter);

    // Insert dummy family member (ID: 1)
    await db.insert(members).values({
      id: 1,
      displayName: 'Test Member',
      role: 'ADMIN',
      telegramChatId: '12345',
    });
  });

  describe('GET /subscriptions', () => {
    it('should return enriched subscriptions', async () => {
      await db.insert(paymentCards).values({
        id: 1,
        cardLabel: 'Techcombank',
        lastFour: '1234',
        cardOwnerId: 1,
        isActive: true,
      });

      await db.insert(subscriptions).values({
        merchantName: 'Netflix',
        amount: 260000,
        currency: 'VND',
        subscriberId: 1,
        paymentCardId: 1,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        nextBillingDate: '2024-05-15',
        confidenceScore: 0.95,
      });

      const res = await app.request(
        '/api/v1/subscriptions',
        {
          headers: { 'X-Telegram-Init-Data': 'mock-data' },
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].merchantName).toBe('Netflix');
      expect(json.data[0].subscriberName).toBe('Test Member');
      expect(json.data[0].cardLabel).toBe('Techcombank');
    });
  });

  describe('PATCH /subscriptions/:id', () => {
    let subId: number;

    beforeEach(async () => {
      const inserted = await db
        .insert(subscriptions)
        .values({
          merchantName: 'Spotify',
          amount: 59000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2024-06-01',
          confidenceScore: 0.99,
        })
        .returning();
      subId = inserted[0].id;

      await db.insert(paymentCards).values({
        id: 99,
        cardLabel: 'VPBank',
        cardOwnerId: 1,
        isActive: true,
      });
    });

    it('should reject invalid amount', async () => {
      const res = await app.request(
        `/api/v1/subscriptions/${subId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ amount: -100 }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(400);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.error.message).toBe('Invalid amount');
    });

    it('should reject invalid nextBillingDate', async () => {
      const res = await app.request(
        `/api/v1/subscriptions/${subId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ nextBillingDate: 'invalid-date' }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(400);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.error.message).toBe('Invalid nextBillingDate');
    });

    it('should reject non-existent paymentCardId', async () => {
      const res = await app.request(
        `/api/v1/subscriptions/${subId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ paymentCardId: 9999 }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(400);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.error.message).toBe('Payment card not found');
    });

    it('should successfully update valid fields', async () => {
      const res = await app.request(
        `/api/v1/subscriptions/${subId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({
            amount: 65000,
            nextBillingDate: '2099-07-01',
            isMustKeep: true,
            paymentCardId: 99,
          }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.success).toBe(true);

      const updated = await db.select().from(subscriptions).where(eq(subscriptions.id, subId));
      expect(updated[0].amount).toBe(65000);
      expect(updated[0].nextBillingDate).toBe('2099-07-01');
      expect(updated[0].isMustKeep).toBe(true);
      expect(updated[0].paymentCardId).toBe(99);
    });
  });

  describe('GET /stats/spending', () => {
    it('should return aggregated spending stats', async () => {
      await db.insert(subscriptions).values([
        {
          merchantName: 'Netflix',
          amount: 260000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-05-15',
          confidenceScore: 0.95,
        },
        {
          merchantName: 'Spotify',
          amount: 59000,
          currency: 'VND',
          subscriberId: 1,
          status: 'TRIAL',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-06-01',
          confidenceScore: 0.99,
        },
      ]);

      const res = await app.request(
        '/api/v1/stats/spending',
        {
          headers: { 'X-Telegram-Init-Data': 'mock-data' },
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.success).toBe(true);

      expect(json.data.totalMonthly).toBe(319000);
      expect(json.data.activeCount).toBe(1);
      expect(json.data.trialCount).toBe(1);
      expect(json.data.byMerchant).toHaveLength(2);
      expect(json.data.bySubscriber).toHaveLength(1);
      expect(json.data.bySubscriber[0].amount).toBe(319000);
      expect(json.data.nextBilling.merchantName).toBe('Netflix');
    });
  });
});
