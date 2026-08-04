import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { members } from '@/core/db/schema';
import { DrizzleSubscriptionRepository } from './drizzle-subscription.repository';
import { SubscriptionStatus, BillingCycle } from '../domain/subscription.entity';

const migrationsFolder = path.resolve(__dirname, '../../../../drizzle');

describe('DrizzleSubscriptionRepository Integration Tests', () => {
  let sqlite: InstanceType<typeof Database>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let repo: DrizzleSubscriptionRepository;
  let memberId: number;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder });

    repo = new DrizzleSubscriptionRepository(db);

    const [member] = await db
      .insert(members)
      .values({ displayName: 'Thành viên Test', role: 'SUBSCRIBER', zaloUserId: 'zalo_sub_1' })
      .returning();
    memberId = member.id;
  });

  it('Tạo mới và tìm kiếm subscription theo ID', async () => {
    const created = await repo.create({
      merchantName: 'Spotify',
      amount: 59000,
      currency: 'VND',
      subscriberId: memberId,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.95,
      isMustKeep: false,
      directKillLink: null,
      paymentCardId: null,
    });

    expect(created.id).toBeDefined();
    expect(created.merchantName).toBe('Spotify');

    const found = await repo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.merchantName).toBe('Spotify');
    expect(found?.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('Tìm kiếm subscription theo merchantName (case-insensitive) và subscriberId', async () => {
    await repo.create({
      merchantName: 'Netflix Premium',
      amount: 260000,
      currency: 'VND',
      subscriberId: memberId,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-02',
      confidenceScore: 0.98,
      isMustKeep: false,
    });

    const found = await repo.findByMerchantAndSubscriber('netflix premium', memberId);
    expect(found).not.toBeNull();
    expect(found?.merchantName).toBe('Netflix Premium');
  });

  it('Cập nhật trạng thái và thông tin subscription', async () => {
    const created = await repo.create({
      merchantName: 'Canva',
      amount: 149000,
      currency: 'VND',
      subscriberId: memberId,
      status: SubscriptionStatus.TRIAL,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-15',
      confidenceScore: 0.9,
      isMustKeep: false,
    });

    const updated = await repo.update(created.id, {
      status: SubscriptionStatus.PENDING_KILL,
      directKillLink: 'https://www.canva.com/settings/billing-and-teams',
    });

    expect(updated.status).toBe(SubscriptionStatus.PENDING_KILL);
    expect(updated.directKillLink).toBe('https://www.canva.com/settings/billing-and-teams');
  });

  it('Gom nhóm tất cả active subscriptions theo merchant (dùng cho Redundancy Detection)', async () => {
    const [member2] = await db
      .insert(members)
      .values({ displayName: 'Thành viên 2', role: 'SUBSCRIBER', zaloUserId: 'zalo_sub_2' })
      .returning();

    await repo.create({
      merchantName: 'Spotify',
      amount: 59000,
      currency: 'VND',
      subscriberId: memberId,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.95,
      isMustKeep: false,
    });

    await repo.create({
      merchantName: 'Spotify',
      amount: 59000,
      currency: 'VND',
      subscriberId: member2.id,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-05',
      confidenceScore: 0.9,
      isMustKeep: false,
    });

    const grouped = await repo.findAllActiveGroupedByMerchant();
    expect(grouped.has('spotify')).toBe(true);
    expect(grouped.get('spotify')?.length).toBe(2);
  });

  it('Tìm kiếm subscriptions theo khoảng ngày nextBillingDateRange', async () => {
    await repo.create({
      merchantName: 'YouTube Premium',
      amount: 79000,
      currency: 'VND',
      subscriberId: memberId,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-10',
      confidenceScore: 0.95,
      isMustKeep: true,
    });

    const results = await repo.findByNextBillingDateRange('2026-08-01', '2026-08-15');
    expect(results.length).toBe(1);
    expect(results[0].merchantName).toBe('YouTube Premium');
  });

  it('Trả về null khi không tìm thấy subscription theo ID hoặc theo merchant/subscriber', async () => {
    const notFoundId = await repo.findById(99999);
    expect(notFoundId).toBeNull();

    const notFoundMerchant = await repo.findByMerchantAndSubscriber(
      'NonExistentMerchant',
      memberId
    );
    expect(notFoundMerchant).toBeNull();
  });

  it('Cập nhật đầy đủ tất cả các trường tùy chọn trong updatePayload', async () => {
    const created = await repo.create({
      merchantName: 'Old Name',
      amount: 100000,
      currency: 'USD',
      subscriberId: memberId,
      status: SubscriptionStatus.TRIAL,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-01',
      confidenceScore: 0.8,
      isMustKeep: false,
    });

    const updated = await repo.update(created.id, {
      merchantName: 'New Name',
      amount: 150000,
      currency: 'VND',
      subscriberId: memberId,
      paymentCardId: null,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.YEARLY,
      nextBillingDate: '2027-08-01',
      confidenceScore: 0.99,
      isMustKeep: true,
    });

    expect(updated.merchantName).toBe('New Name');
    expect(updated.amount).toBe(150000);
    expect(updated.currency).toBe('VND');
    expect(updated.status).toBe(SubscriptionStatus.ACTIVE);
    expect(updated.billingCycle).toBe(BillingCycle.YEARLY);
    expect(updated.isMustKeep).toBe(true);
  });
});
