import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import worker from './index';
import { alerts, members, paymentCards, subscriptions } from './core/db/schema';

const migrationsFolder = path.resolve(__dirname, '../drizzle');

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
              const row = stmt.get(...params) as Record<string, unknown> | undefined;
              if (!row) return null;
              return colName ? row[colName] : row;
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
    async batch(statements: unknown[]) {
      const results = [];
      for (const stmt of statements as Array<{ run: () => Promise<unknown> }>) {
        results.push(await stmt.run());
      }
      return results;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
}

describe('Epic 2 - Refactored Hono Kernel Test', () => {
  it('GET /health-check trả về 200 OK khi DB sẵn sàng', async () => {
    // Mock D1 Database env
    const mockD1 = {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true }),
        }),
      }),
    } as unknown as D1Database;

    const res = await worker.fetch(new Request('http://localhost/health-check'), { DB: mockD1 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { database: string };
    expect(body.database).toBe('connected');
  });

  it('Lỗi 404 phải trả về JSON đúng chuẩn hệ thống', async () => {
    const res = await worker.fetch(new Request('http://localhost/non-existent-route'));
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: "Route 'GET /non-existent-route' not found",
      },
    });
  });

  it('scheduled() end-to-end: khởi tạo D1 thực tế, gọi ProcessTieredAlertsUseCase & RetryFailedParsingLogsUseCase và tạo bản ghi alerts thành công', async () => {
    const sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    const db = drizzle(sqlite);
    migrate(db, { migrationsFolder });

    // Seed data
    const [subscriber] = await db
      .insert(members)
      .values({ displayName: 'Con Cả', role: 'SUBSCRIBER', zaloUserId: 'zalo_sub_scheduled' })
      .returning();

    const [cardOwner] = await db
      .insert(members)
      .values({ displayName: 'Bố', role: 'CARD_OWNER', zaloUserId: 'zalo_owner_scheduled' })
      .returning();

    const [card] = await db
      .insert(paymentCards)
      .values({ cardLabel: 'Techcombank - Bố', cardOwnerId: cardOwner.id, lastFour: '9999' })
      .returning();

    // Tính ngày cố định để 1 subscription khớp T-3
    const today = new Date();
    const t3Date = new Date(today);
    t3Date.setDate(t3Date.getDate() + 3);
    const t3DateStr = t3Date.toISOString().split('T')[0];

    const [subT3] = await db
      .insert(subscriptions)
      .values({
        merchantName: 'Canva Pro',
        amount: 149000,
        currency: 'VND',
        subscriberId: subscriber.id,
        paymentCardId: card.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        nextBillingDate: t3DateStr,
        confidenceScore: 0.95,
        isMustKeep: false,
      })
      .returning();

    const mockD1 = createBetterSqliteD1Bridge(sqlite);

    const waitUntil = vi.fn((promise: Promise<unknown>) => promise);
    const mockCtx = {
      waitUntil,
    } as unknown as ExecutionContext;

    const mockEvent = {
      cron: '0 1 * * *',
      scheduledTime: Date.now(),
    } as unknown as ScheduledEvent;

    const env = {
      DB: mockD1,
      OPENAI_API_KEY: 'test-key',
    };

    await worker.scheduled(mockEvent, env, mockCtx);

    expect(waitUntil).toHaveBeenCalled();
    const waitUntilPromise = waitUntil.mock.calls[0][0];
    await waitUntilPromise;

    // Verify D1 Database state: alert Record must be inserted for Canva Pro (SOFT_T3)
    const createdAlerts = await db.select().from(alerts).where(eq(alerts.subscriptionId, subT3.id));
    expect(createdAlerts.length).toBeGreaterThan(0);
    expect(createdAlerts[0].alertType).toBe('SOFT_T3');
    expect(createdAlerts[0].status).toBe('SENT');
  });
});
