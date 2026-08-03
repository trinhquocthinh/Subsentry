import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { members, paymentCards, subscriptions } from './schema';
import { eq } from 'drizzle-orm';
import path from 'node:path';

// Dùng path.resolve để trỏ chính xác về apps/backend/drizzle độc lập với Working Directory
const migrationsFolder = path.resolve(__dirname, '../../../drizzle');

describe('Epic 1 - Task 1.4: Strict Schema & Constraint Validation', () => {
  let sqlite: InstanceType<typeof Database>;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON'); // BẮT BUỘC bật Foreign Key cho SQLite
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder });
  });

  it('1.2.4 - Verify Migration Idempotency (Chạy migrate 2 lần liên tiếp không phát sinh lỗi)', () => {
    expect(() => migrate(db, { migrationsFolder })).not.toThrow();
  });

  it('1.4.1 - Test Foreign Key NOT NULL & Non-existent subscriber_id Constraint', () => {
    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO subscriptions (
            merchant_name, amount, subscriber_id, status, billing_cycle, next_billing_date, confidence_score
          ) VALUES ('Netflix', 260000, 99999, 'ACTIVE', 'MONTHLY', '2026-09-01', 0.95)`
        )
        .run()
    ).toThrow(/FOREIGN KEY constraint failed/);

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO subscriptions (
            merchant_name, amount, status, billing_cycle, next_billing_date, confidence_score
          ) VALUES ('Netflix', 260000, 'ACTIVE', 'MONTHLY', '2026-09-01', 0.95)`
        )
        .run()
    ).toThrow(/NOT NULL constraint failed/);
  });

  it('1.4.2 - Test ON DELETE CASCADE khi xóa member chứa payment_cards và subscriptions', async () => {
    const [member] = await db
      .insert(members)
      .values({ displayName: 'Bố', role: 'ADMIN', telegramChatId: 'tg_12345' })
      .returning();

    const [card] = await db
      .insert(paymentCards)
      .values({ cardLabel: 'Visa Bố', cardOwnerId: member.id, lastFour: '1234' })
      .returning();

    await db.delete(members).where(eq(members.id, member.id));

    const remainingCards = await db.select().from(paymentCards).where(eq(paymentCards.id, card.id));
    expect(remainingCards.length).toBe(0);
  });

  it('1.4.3 - Test default values (is_must_keep = false, currency = "VND")', async () => {
    const [member] = await db
      .insert(members)
      .values({ displayName: 'Mẹ', role: 'CARD_OWNER' })
      .returning();

    const [insertedSub] = await db
      .insert(subscriptions)
      .values({
        merchantName: 'iCloud',
        amount: 19000,
        subscriberId: member.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        nextBillingDate: '2026-09-01',
        confidenceScore: 0.99,
      })
      .returning();

    expect(insertedSub.currency).toBe('VND');
    expect(insertedSub.isMustKeep).toBe(false);
  });

  it('1.4.4 - Phải chặn Raw SQL Insert nếu vi phạm SQL CHECK Constraint (invalid enum)', () => {
    sqlite
      .prepare("INSERT INTO members (id, display_name, role) VALUES (10, 'Test User', 'ADMIN')")
      .run();

    expect(() =>
      sqlite
        .prepare(
          `INSERT INTO subscriptions (
            merchant_name, amount, subscriber_id, status, billing_cycle, next_billing_date, confidence_score
          ) VALUES ('Test Service', 10000, 10, 'INVALID_STATUS', 'MONTHLY', '2026-09-01', 0.9)`
        )
        .run()
    ).toThrow(/CHECK constraint failed/);
  });
});
