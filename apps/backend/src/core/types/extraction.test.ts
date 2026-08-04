import { describe, expect, it } from 'vitest';
import { BillingCycle, MemberRole, SubscriptionStatus } from './enums';
import { SubscriptionExtraction } from './extraction';

describe('Epic 2 - Shared Kernel: Types & DTOs Validation', () => {
  it('Phải định nghĩa đúng Enums cơ bản', () => {
    expect(MemberRole.ADMIN).toBe('ADMIN');
    expect(SubscriptionStatus.ACTIVE).toBe('ACTIVE');
    expect(BillingCycle.MONTHLY).toBe('MONTHLY');
  });

  it('Phải khởi tạo DTO SubscriptionExtraction đúng cấu trúc sdd.md §3.1', () => {
    const mockExtraction: SubscriptionExtraction = {
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      isTrial: false,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-02',
      confidenceScore: 0.95,
      directKillLink: 'https://netflix.com/youraccount',
    };

    expect(mockExtraction.merchantName).toBe('Netflix');
    expect(mockExtraction.confidenceScore).toBeGreaterThanOrEqual(0.85);
  });
});
