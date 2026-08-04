import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { members } from '@/core/db/schema';
import { DrizzleSubscriptionRepository } from '@/features/subscription/adapters/drizzle-subscription.repository';
import {
  SubscriptionStatus,
  BillingCycle,
} from '@/features/subscription/domain/subscription.entity';
import { DrizzleAlertRepository } from '../adapters/drizzle-alert.repository';
import { MockNotificationService } from '../adapters/mock-notification.adapter';
import { ProcessTieredAlertsUseCase } from './process-tiered-alerts.use-case';

const migrationsFolder = path.resolve(__dirname, '../../../../drizzle');

import { DrizzleMemberRepository } from '@/features/subscription/adapters/drizzle-member.repository';
import { DrizzlePaymentCardRepository } from '@/features/subscription/adapters/drizzle-payment-card.repository';
import { paymentCards } from '@/core/db/schema';

describe('ProcessTieredAlertsUseCase Tests', () => {
  let sqlite: InstanceType<typeof Database>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let subRepo: DrizzleSubscriptionRepository;
  let alertRepo: DrizzleAlertRepository;
  let memberRepo: DrizzleMemberRepository;
  let paymentCardRepo: DrizzlePaymentCardRepository;
  let notificationService: MockNotificationService;
  let useCase: ProcessTieredAlertsUseCase;
  let memberId: number;
  let cardOwnerId: number;
  let paymentCardId: number;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder });

    subRepo = new DrizzleSubscriptionRepository(db);
    alertRepo = new DrizzleAlertRepository(db);
    memberRepo = new DrizzleMemberRepository(db);
    paymentCardRepo = new DrizzlePaymentCardRepository(db);
    notificationService = new MockNotificationService();
    useCase = new ProcessTieredAlertsUseCase(
      subRepo,
      alertRepo,
      notificationService,
      memberRepo,
      paymentCardRepo
    );

    const [member] = await db
      .insert(members)
      .values({ displayName: 'Con Cả', role: 'SUBSCRIBER', zaloUserId: 'zalo_sub_a' })
      .returning();
    memberId = member.id;

    const [owner] = await db
      .insert(members)
      .values({ displayName: 'Bố', role: 'CARD_OWNER', zaloUserId: 'zalo_owner_bo' })
      .returning();
    cardOwnerId = owner.id;

    const [card] = await db
      .insert(paymentCards)
      .values({ cardLabel: 'Techcombank - Bố', cardOwnerId: owner.id, lastFour: '1234' })
      .returning();
    paymentCardId = card.id;
  });

  it('Gửi Soft Alert ở mốc T-3 ngày khi còn đúng 3 ngày nữa đến hạn gia hạn', async () => {
    const sub = await subRepo.create({
      merchantName: 'Canva',
      amount: 149000,
      currency: 'VND',
      subscriberId: memberId,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-07', // 2026-08-07 - 2026-08-04 = 3 ngày
      confidenceScore: 0.95,
      isMustKeep: false,
    });

    const result = await useCase.execute('2026-08-04');

    expect(result.processedCount).toBe(1);
    expect(result.softAlertsSent).toBe(1);
    expect(result.redAlertsSent).toBe(0);

    expect(notificationService.sentSoftAlerts.length).toBe(1);
    expect(notificationService.sentSoftAlerts[0].subscriptionId).toBe(sub.id);
    expect(notificationService.sentSoftAlerts[0].merchantName).toBe('Canva');

    const createdAlert = await alertRepo.findLatestAlertForCycle(sub.id, 'SOFT_T3');
    expect(createdAlert).not.toBeNull();
    expect(createdAlert?.status).toBe('SENT');
  });

  it('Gửi Red Alert khẩn cấp kèm đầy đủ thông tin tag Card Owner và Subscriber (BR-04)', async () => {
    const sub = await subRepo.create({
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      subscriberId: memberId,
      paymentCardId,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-05', // 2026-08-05 - 2026-08-04 = 1 ngày
      confidenceScore: 0.98,
      isMustKeep: false,
    });

    // Giả lập trước đó ở T-3 đã tạo Soft Alert nhưng response vẫn là PENDING
    await alertRepo.create({
      subscriptionId: sub.id,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-08-02T08:00:00.000Z',
      status: 'SENT',
      response: 'PENDING',
    });

    const result = await useCase.execute('2026-08-04');

    expect(result.redAlertsSent).toBe(1);
    expect(notificationService.sentRedAlerts.length).toBe(1);

    const redPayload = notificationService.sentRedAlerts[0];
    expect(redPayload.merchantName).toBe('Netflix');
    expect(redPayload.subscriberName).toBe('Con Cả');
    expect(redPayload.cardLabel).toBe('Techcombank - Bố');
    expect(redPayload.cardOwnerName).toBe('Bố');
    expect(redPayload.cardOwnerId).toBe(cardOwnerId);

    const redAlertRecord = await alertRepo.findLatestAlertForCycle(sub.id, 'RED_T24');
    expect(redAlertRecord).not.toBeNull();
    expect(redAlertRecord?.status).toBe('SENT');
  });

  it('TC-08 & BR-05: Gói cước isMustKeep = true ghi log Spend Report và không kích hoạt Red Alert', async () => {
    const sub = await subRepo.create({
      merchantName: 'YouTube Premium Family',
      amount: 149000,
      currency: 'VND',
      subscriberId: memberId,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-05', // 1 ngày nữa gia hạn
      confidenceScore: 0.99,
      isMustKeep: true, // Must Keep exemption!
    });

    // Soft alert đã gửi nhưng PENDING
    await alertRepo.create({
      subscriptionId: sub.id,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-08-02T08:00:00.000Z',
      status: 'SENT',
      response: 'PENDING',
    });

    const result = await useCase.execute('2026-08-04');

    expect(result.redAlertsSent).toBe(0);
    expect(result.exemptedCount).toBe(1);
    expect(result.exemptedSpendReports.length).toBe(1);
    expect(result.exemptedSpendReports[0].merchantName).toBe('YouTube Premium Family');
    expect(notificationService.sentRedAlerts.length).toBe(0);

    const redAlertRecord = await alertRepo.findLatestAlertForCycle(sub.id, 'RED_T24');
    expect(redAlertRecord).toBeNull();
  });

  it('Không gửi Red Alert ở T-1 ngày nếu Subscriber đã phản hồi KEEP ở Soft Alert', async () => {
    const sub = await subRepo.create({
      merchantName: 'Spotify',
      amount: 59000,
      currency: 'VND',
      subscriberId: memberId,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-05',
      confidenceScore: 0.95,
      isMustKeep: false,
    });

    // Soft alert đã được phản hồi KEEP
    await alertRepo.create({
      subscriptionId: sub.id,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-08-02T08:00:00.000Z',
      status: 'SENT',
      response: 'KEEP',
    });

    const result = await useCase.execute('2026-08-04');

    expect(result.redAlertsSent).toBe(0);
    expect(notificationService.sentRedAlerts.length).toBe(0);

    notificationService.clear();
    expect(notificationService.sentSoftAlerts.length).toBe(0);
    expect(notificationService.sentRedAlerts.length).toBe(0);
  });
});
