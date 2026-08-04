import { describe, it, expect, vi } from 'vitest';
import { DetectRedundancyUseCase } from './detect-redundancy.use-case';
import {
  SubscriptionStatus,
  BillingCycle,
  type SubscriptionEntity,
} from '../domain/subscription.entity';
import type { ISubscriptionRepository } from '../domain/subscription-repository.interface';

describe('DetectRedundancyUseCase', () => {
  it('TC-11: Phát hiện trùng lặp Spotify của 2 thành viên khác nhau và tính số tiền tiết kiệm', async () => {
    const subMemberA: SubscriptionEntity = {
      id: 1,
      merchantName: 'Spotify',
      amount: 59000,
      currency: 'VND',
      subscriberId: 10,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.95,
      isMustKeep: false,
    };

    const subMemberB: SubscriptionEntity = {
      id: 2,
      merchantName: 'Spotify',
      amount: 59000,
      currency: 'VND',
      subscriberId: 11,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-05',
      confidenceScore: 0.92,
      isMustKeep: false,
    };

    const groupedMap = new Map<string, SubscriptionEntity[]>();
    groupedMap.set('spotify', [subMemberA, subMemberB]);

    const repo: ISubscriptionRepository = {
      findAllActiveGroupedByMerchant: vi.fn().mockResolvedValue(groupedMap),
      findById: vi.fn(),
      findByMerchantAndSubscriber: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new DetectRedundancyUseCase(repo);
    const alerts = await useCase.execute();

    expect(alerts.length).toBe(1);
    const alert = alerts[0];
    expect(alert.merchantName).toBe('Spotify');
    expect(alert.count).toBe(2);
    expect(alert.totalMonthlyCost).toBe(118000);
    expect(alert.estimatedFamilyPlanCost).toBe(99000);
    expect(alert.estimatedMonthlySavings).toBe(19000);
    expect(alert.recommendationMessage).toContain(
      'Phát hiện gia đình đang sử dụng 2 gói Spotify cá nhân'
    );
    expect(alert.recommendationMessage).toContain('19.000 VND/tháng');
  });

  it('Không tạo cảnh báo nếu trùng merchant nhưng cùng 1 subscriber', async () => {
    const sub1: SubscriptionEntity = {
      id: 1,
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      subscriberId: 10,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.95,
      isMustKeep: false,
    };

    const sub2: SubscriptionEntity = {
      id: 2,
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      subscriberId: 10, // Cùng subscriber
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.95,
      isMustKeep: false,
    };

    const groupedMap = new Map<string, SubscriptionEntity[]>();
    groupedMap.set('netflix', [sub1, sub2]);

    const repo: ISubscriptionRepository = {
      findAllActiveGroupedByMerchant: vi.fn().mockResolvedValue(groupedMap),
      findById: vi.fn(),
      findByMerchantAndSubscriber: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new DetectRedundancyUseCase(repo);
    const alerts = await useCase.execute();

    expect(alerts.length).toBe(0);
  });

  it('Sử dụng công thức fallback 65% tổng chi phí khi merchant không nằm trong danh mục KNOWN_FAMILY_PLANS', async () => {
    const sub1: SubscriptionEntity = {
      id: 1,
      merchantName: 'Notion Pro',
      amount: 200000,
      currency: 'VND',
      subscriberId: 10,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.95,
      isMustKeep: false,
    };

    const sub2: SubscriptionEntity = {
      id: 2,
      merchantName: 'Notion Pro',
      amount: 200000,
      currency: 'VND',
      subscriberId: 11,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.95,
      isMustKeep: false,
    };

    const groupedMap = new Map<string, SubscriptionEntity[]>();
    groupedMap.set('notion pro', [sub1, sub2]);

    const repo: ISubscriptionRepository = {
      findAllActiveGroupedByMerchant: vi.fn().mockResolvedValue(groupedMap),
      findById: vi.fn(),
      findByMerchantAndSubscriber: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new DetectRedundancyUseCase(repo);
    const alerts = await useCase.execute();

    expect(alerts.length).toBe(1);
    const alert = alerts[0];
    expect(alert.merchantName).toBe('Notion Pro');
    expect(alert.totalMonthlyCost).toBe(400000);
    // 400,000 * 0.65 = 260,000
    expect(alert.estimatedFamilyPlanCost).toBe(260000);
    expect(alert.estimatedMonthlySavings).toBe(140000);
    expect(alert.recommendationMessage).toContain('Notion Pro Family');
    expect(alert.recommendationMessage).toContain('140.000 VND/tháng');
  });
});
