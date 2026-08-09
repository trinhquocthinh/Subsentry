import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncD1ToSheetsUseCase } from './sync-d1-to-sheets.use-case';
import type { IGoogleSheetsClient, SheetRow } from '../domain/google-sheets-client.interface';
import type { IMemberRepository } from '../../subscription/domain/member-repository.interface';
import {
  SubscriptionStatus,
  BillingCycle,
  type SubscriptionEntity,
} from '../../subscription/domain/subscription.entity';

describe('SyncD1ToSheetsUseCase', () => {
  let mockSheetsClient: Record<keyof IGoogleSheetsClient, ReturnType<typeof vi.fn>>;
  let mockMemberRepo: Record<keyof IMemberRepository, ReturnType<typeof vi.fn>>;
  let useCase: SyncD1ToSheetsUseCase;

  const mockSub: SubscriptionEntity = {
    id: 1,
    merchantName: 'Netflix',
    amount: 260000,
    currency: 'VND',
    subscriberId: 2,
    status: SubscriptionStatus.ACTIVE,
    billingCycle: BillingCycle.MONTHLY,
    nextBillingDate: '2026-09-02',
    isMustKeep: false,
    confidenceScore: 0.95,
  };

  beforeEach(() => {
    mockSheetsClient = {
      appendRow: vi.fn(),
      updateRow: vi.fn(),
      readAllRows: vi.fn(),
      readColumnA: vi.fn(),
      findRowIndexBySubscriptionId: vi.fn(),
    };

    mockMemberRepo = {
      findById: vi.fn().mockResolvedValue({ displayName: 'Con Cả' }),
    };

    useCase = new SyncD1ToSheetsUseCase(
      mockSheetsClient as unknown as IGoogleSheetsClient,
      mockMemberRepo as unknown as IMemberRepository
    );

    // Suppress console logs for tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should append a new row if subscription is not found in sheets', async () => {
    mockSheetsClient.findRowIndexBySubscriptionId.mockResolvedValueOnce(null);

    await useCase.execute(mockSub);

    expect(mockMemberRepo.findById).toHaveBeenCalledWith(2);
    expect(mockSheetsClient.findRowIndexBySubscriptionId).toHaveBeenCalledWith(1);
    expect(mockSheetsClient.appendRow).toHaveBeenCalledTimes(1);
    expect(mockSheetsClient.updateRow).not.toHaveBeenCalled();

    const appendArg = mockSheetsClient.appendRow.mock.calls[0][0] as SheetRow;
    expect(appendArg.id).toBe(1);
    expect(appendArg.subscriberName).toBe('Con Cả');
    expect(appendArg.merchantName).toBe('Netflix');
  });

  it('should update an existing row if subscription is found in sheets', async () => {
    mockSheetsClient.findRowIndexBySubscriptionId.mockResolvedValueOnce(5);

    await useCase.execute(mockSub);

    expect(mockSheetsClient.appendRow).not.toHaveBeenCalled();
    expect(mockSheetsClient.updateRow).toHaveBeenCalledTimes(1);

    const updateArgs = mockSheetsClient.updateRow.mock.calls[0];
    expect(updateArgs[0]).toBe(5); // rowIndex
    expect(updateArgs[1].id).toBe(1);
    expect(updateArgs[1].subscriberName).toBe('Con Cả');
  });

  it('should gracefully handle and log errors without throwing', async () => {
    mockSheetsClient.findRowIndexBySubscriptionId.mockRejectedValueOnce(new Error('Network error'));

    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(useCase.execute(mockSub)).resolves.not.toThrow();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
