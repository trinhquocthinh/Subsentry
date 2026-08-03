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
      merchant_name: 'Netflix',
      amount: 260000,
      currency: 'VND',
      is_trial: false,
      billing_cycle: BillingCycle.MONTHLY,
      next_billing_date: '2026-09-02',
      confidence_score: 0.95,
      direct_kill_link: 'https://netflix.com/youraccount',
    };

    expect(mockExtraction.merchant_name).toBe('Netflix');
    expect(mockExtraction.confidence_score).toBeGreaterThanOrEqual(0.85);
  });
});
