import { describe, it, expect, vi } from 'vitest';
import {
  TransitionSubscriptionStateUseCase,
  SubscriptionNotFoundError,
} from './transition-subscription-state.use-case';
import {
  SubscriptionStatus,
  SubscriptionAction,
  BillingCycle,
  type SubscriptionEntity,
} from '../domain/subscription.entity';
import type { ISubscriptionRepository } from '../domain/subscription-repository.interface';

describe('TransitionSubscriptionStateUseCase', () => {
  const mockSub: SubscriptionEntity = {
    id: 1,
    merchantName: 'Spotify',
    amount: 59000,
    currency: 'VND',
    subscriberId: 10,
    status: SubscriptionStatus.TRIAL,
    billingCycle: BillingCycle.MONTHLY,
    nextBillingDate: '2026-09-01',
    confidenceScore: 0.95,
    isMustKeep: false,
    directKillLink: null,
  };

  it('Ném SubscriptionNotFoundError nếu không tìm thấy subscription', async () => {
    const repo: ISubscriptionRepository = {
      findById: vi.fn().mockResolvedValue(null),
      findByMerchantAndSubscriber: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      findAllActiveGroupedByMerchant: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new TransitionSubscriptionStateUseCase(repo);
    await expect(
      useCase.execute({ subscriptionId: 999, action: SubscriptionAction.KEEP })
    ).rejects.toThrow(SubscriptionNotFoundError);
  });

  it('Chuyển TRIAL -> ACTIVE khi nhận action KEEP', async () => {
    const repo: ISubscriptionRepository = {
      findById: vi.fn().mockResolvedValue({ ...mockSub }),
      update: vi.fn().mockImplementation((id, data) => Promise.resolve({ ...mockSub, ...data })),
      findByMerchantAndSubscriber: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      findAllActiveGroupedByMerchant: vi.fn(),
      create: vi.fn(),
    };

    const useCase = new TransitionSubscriptionStateUseCase(repo);
    const result = await useCase.execute({
      subscriptionId: 1,
      action: SubscriptionAction.KEEP,
    });

    expect(result.status).toBe(SubscriptionStatus.ACTIVE);
    expect(repo.update).toHaveBeenCalledWith(1, { status: SubscriptionStatus.ACTIVE });
  });

  it('Chuyển ACTIVE -> PENDING_KILL và tự động sinh directKillLink khi nhận action KILL', async () => {
    const activeSub: SubscriptionEntity = {
      ...mockSub,
      status: SubscriptionStatus.ACTIVE,
      directKillLink: null,
    };

    const repo: ISubscriptionRepository = {
      findById: vi.fn().mockResolvedValue(activeSub),
      update: vi.fn().mockImplementation((id, data) => Promise.resolve({ ...activeSub, ...data })),
      findByMerchantAndSubscriber: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      findAllActiveGroupedByMerchant: vi.fn(),
      create: vi.fn(),
    };

    const useCase = new TransitionSubscriptionStateUseCase(repo);
    const result = await useCase.execute({
      subscriptionId: 1,
      action: SubscriptionAction.KILL,
    });

    expect(result.status).toBe(SubscriptionStatus.PENDING_KILL);
    expect(result.directKillLink).toBe('https://www.spotify.com/account/overview/');
  });

  it('Không tạo lại directKillLink nếu đã tồn tại link trước đó khi chuyển sang PENDING_KILL', async () => {
    const existingCustomLink = 'https://custom-cancel.spotify.com/user/123';
    const subWithLink: SubscriptionEntity = {
      ...mockSub,
      status: SubscriptionStatus.ACTIVE,
      directKillLink: existingCustomLink,
    };

    const repo: ISubscriptionRepository = {
      findById: vi.fn().mockResolvedValue(subWithLink),
      update: vi
        .fn()
        .mockImplementation((id, data) => Promise.resolve({ ...subWithLink, ...data })),
      findByMerchantAndSubscriber: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      findAllActiveGroupedByMerchant: vi.fn(),
      create: vi.fn(),
    };

    const useCase = new TransitionSubscriptionStateUseCase(repo);
    await useCase.execute({
      subscriptionId: 1,
      action: SubscriptionAction.KILL,
    });

    // repo.update only called with { status: PENDING_KILL }, directKillLink is NOT set in update payload
    expect(repo.update).toHaveBeenCalledWith(1, {
      status: SubscriptionStatus.PENDING_KILL,
    });
  });
});
