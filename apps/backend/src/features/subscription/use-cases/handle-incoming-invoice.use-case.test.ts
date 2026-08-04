import { describe, it, expect, vi } from 'vitest';
import { HandleIncomingInvoiceUseCase } from './handle-incoming-invoice.use-case';
import {
  SubscriptionStatus,
  BillingCycle,
  type SubscriptionEntity,
} from '../domain/subscription.entity';
import type { ISubscriptionRepository } from '../domain/subscription-repository.interface';
import type { SubscriptionExtraction } from '@/core/types/extraction';

describe('HandleIncomingInvoiceUseCase', () => {
  const mockExtraction: SubscriptionExtraction = {
    merchantName: 'Netflix',
    amount: 260000,
    currency: 'VND',
    billingCycle: 'MONTHLY',
    nextBillingDate: '2026-09-02',
    confidenceScore: 0.98,
    isTrial: false,
  };

  it('Tạo subscription mới với status ACTIVE khi nhận hóa đơn trả phí mới', async () => {
    const repo: ISubscriptionRepository = {
      findByMerchantAndSubscriber: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) =>
        Promise.resolve({
          id: 100,
          ...data,
        })
      ),
      findById: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      findAllActiveGroupedByMerchant: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new HandleIncomingInvoiceUseCase(repo);
    const result = await useCase.execute({
      subscriberId: 1,
      extraction: mockExtraction,
    });

    expect(result.isNew).toBe(true);
    expect(result.isReopened).toBe(false);
    expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(result.subscription.amount).toBe(260000);
  });

  it('Tạo subscription mới với status TRIAL khi hóa đơn có số tiền 0đ hoặc là bản ghi dùng thử (TC-09)', async () => {
    const trialExtraction: SubscriptionExtraction = {
      ...mockExtraction,
      amount: 0,
      isTrial: true,
    };

    const repo: ISubscriptionRepository = {
      findByMerchantAndSubscriber: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) =>
        Promise.resolve({
          id: 101,
          ...data,
        })
      ),
      findById: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      findAllActiveGroupedByMerchant: vi.fn(),
      update: vi.fn(),
    };

    const useCase = new HandleIncomingInvoiceUseCase(repo);
    const result = await useCase.execute({
      subscriberId: 1,
      extraction: trialExtraction,
    });

    expect(result.isNew).toBe(true);
    expect(result.subscription.status).toBe(SubscriptionStatus.TRIAL);
  });

  it('TC-05: Reopen subscription đã bị KILLED quay về ACTIVE khi nhận hóa đơn trả phí mới', async () => {
    const killedSub: SubscriptionEntity = {
      id: 50,
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      subscriberId: 1,
      status: SubscriptionStatus.KILLED,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-02',
      confidenceScore: 0.95,
      isMustKeep: false,
    };

    const repo: ISubscriptionRepository = {
      findByMerchantAndSubscriber: vi.fn().mockResolvedValue(killedSub),
      update: vi.fn().mockImplementation((id, data) =>
        Promise.resolve({
          ...killedSub,
          ...data,
        })
      ),
      findById: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      findAllActiveGroupedByMerchant: vi.fn(),
      create: vi.fn(),
    };

    const useCase = new HandleIncomingInvoiceUseCase(repo);
    const result = await useCase.execute({
      subscriberId: 1,
      extraction: mockExtraction,
    });

    expect(result.isNew).toBe(false);
    expect(result.isReopened).toBe(true);
    expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(result.subscription.nextBillingDate).toBe('2026-09-02');
  });

  it('Cập nhật chu kỳ thanh toán cho subscription đang ACTIVE khi có hóa đơn mới gia hạn (isReopened: false)', async () => {
    const activeSub: SubscriptionEntity = {
      id: 50,
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      subscriberId: 1,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-02',
      confidenceScore: 0.95,
      isMustKeep: false,
    };

    const repo: ISubscriptionRepository = {
      findByMerchantAndSubscriber: vi.fn().mockResolvedValue(activeSub),
      update: vi.fn().mockImplementation((id, data) =>
        Promise.resolve({
          ...activeSub,
          ...data,
        })
      ),
      findById: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      findAllActiveGroupedByMerchant: vi.fn(),
      create: vi.fn(),
    };

    const useCase = new HandleIncomingInvoiceUseCase(repo);
    const result = await useCase.execute({
      subscriberId: 1,
      extraction: {
        ...mockExtraction,
        currency: '', // Test fallback currency
        billingCycle: undefined as unknown as BillingCycle, // Test fallback billingCycle
      },
    });

    expect(result.isNew).toBe(false);
    expect(result.isReopened).toBe(false);
    expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
    expect(repo.update).toHaveBeenCalledWith(
      50,
      expect.objectContaining({
        currency: 'VND',
        billingCycle: BillingCycle.MONTHLY,
      })
    );
  });
});
