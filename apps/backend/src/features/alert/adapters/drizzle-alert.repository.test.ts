import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { members, subscriptions } from '@/core/db/schema';
import { DrizzleAlertRepository } from './drizzle-alert.repository';

const migrationsFolder = path.resolve(__dirname, '../../../../drizzle');

describe('DrizzleAlertRepository Integration Tests', () => {
  let sqlite: InstanceType<typeof Database>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let alertRepo: DrizzleAlertRepository;
  let subscriptionId: number;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder });

    alertRepo = new DrizzleAlertRepository(db);

    const [member] = await db
      .insert(members)
      .values({ displayName: 'Alert Member Test', role: 'SUBSCRIBER', zaloUserId: 'zalo_alert_1' })
      .returning();

    const [sub] = await db
      .insert(subscriptions)
      .values({
        merchantName: 'Netflix',
        amount: 260000,
        currency: 'VND',
        subscriberId: member.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        nextBillingDate: '2026-08-07',
        confidenceScore: 0.95,
      })
      .returning();

    subscriptionId = sub.id;
  });

  it('Tạo mới alert và tìm kiếm theo ID', async () => {
    const created = await alertRepo.create({
      subscriptionId,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-08-04T08:00:00.000Z',
      status: 'SCHEDULED',
      response: 'PENDING',
    });

    expect(created.id).toBeDefined();
    expect(created.alertType).toBe('SOFT_T3');
    expect(created.status).toBe('SCHEDULED');

    const found = await alertRepo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.subscriptionId).toBe(subscriptionId);
  });

  it('Cập nhật trạng thái và phản hồi người dùng cho alert', async () => {
    const created = await alertRepo.create({
      subscriptionId,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-08-04T08:00:00.000Z',
      status: 'SCHEDULED',
      response: 'PENDING',
    });

    const updated = await alertRepo.update(created.id, {
      status: 'SENT',
      response: 'KEEP',
      triggeredAt: '2026-08-04T08:01:00.000Z',
    });

    expect(updated.status).toBe('SENT');
    expect(updated.response).toBe('KEEP');
    expect(updated.triggeredAt).toBe('2026-08-04T08:01:00.000Z');
  });

  it('Tìm kiếm alert mới nhất cho một chu kỳ bằng findLatestAlertForCycle', async () => {
    await alertRepo.create({
      subscriptionId,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-07-04T08:00:00.000Z',
      status: 'SENT',
      response: 'KEEP',
    });

    const latest = await alertRepo.create({
      subscriptionId,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-08-04T08:00:00.000Z',
      status: 'SCHEDULED',
      response: 'PENDING',
    });

    const foundLatest = await alertRepo.findLatestAlertForCycle(subscriptionId, 'SOFT_T3');
    expect(foundLatest).not.toBeNull();
    expect(foundLatest?.id).toBe(latest.id);
    expect(foundLatest?.scheduledAt).toBe('2026-08-04T08:00:00.000Z');
  });

  it('Trả về null khi không tìm thấy alert theo ID', async () => {
    const notFound = await alertRepo.findById(999999);
    expect(notFound).toBeNull();
  });

  it('Tìm tất cả alerts của subscription qua findAlertsBySubscriptionId', async () => {
    await alertRepo.create({
      subscriptionId,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-08-04T08:00:00.000Z',
      status: 'SENT',
      response: 'PENDING',
    });
    await alertRepo.create({
      subscriptionId,
      alertType: 'RED_T24',
      scheduledAt: '2026-08-06T08:00:00.000Z',
      status: 'SENT',
      response: 'PENDING',
    });

    const allAlerts = await alertRepo.findAlertsBySubscriptionId(subscriptionId);
    expect(allAlerts.length).toBe(2);
  });
});
