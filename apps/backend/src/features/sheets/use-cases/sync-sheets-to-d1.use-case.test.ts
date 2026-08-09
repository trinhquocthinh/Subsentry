import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncSheetsToD1UseCase } from './sync-sheets-to-d1.use-case';
import type { IGoogleSheetsClient, SheetRow } from '../domain/google-sheets-client.interface';
import type { ISubscriptionRepository } from '../../subscription/domain/subscription-repository.interface';
import {
  SubscriptionStatus,
  BillingCycle,
  type SubscriptionEntity,
} from '../../subscription/domain/subscription.entity';

describe('SyncSheetsToD1UseCase', () => {
  let mockSheetsClient: Record<keyof IGoogleSheetsClient, ReturnType<typeof vi.fn>>;
  let mockSubRepo: Record<keyof ISubscriptionRepository, ReturnType<typeof vi.fn>>;
  let useCase: SyncSheetsToD1UseCase;

  const mockDbSub: SubscriptionEntity = {
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
      findRowIndexBySubscriptionId: vi.fn(),
      readColumnA: vi.fn(),
    } as unknown as Record<keyof IGoogleSheetsClient, ReturnType<typeof vi.fn>>;

    mockSubRepo = {
      findById: vi.fn().mockResolvedValue(mockDbSub),
      update: vi.fn().mockResolvedValue({}),
      findByMerchantAndSubscriber: vi.fn(),
      findActiveSubscriptions: vi.fn(),
      findByNextBillingDateRange: vi.fn(),
      findAllActiveGroupedByMerchant: vi.fn(),
      create: vi.fn(),
      findAll: vi.fn(),
    } as unknown as Record<keyof ISubscriptionRepository, ReturnType<typeof vi.fn>>;

    useCase = new SyncSheetsToD1UseCase(
      mockSheetsClient as unknown as IGoogleSheetsClient,
      mockSubRepo as unknown as ISubscriptionRepository
    );

    // Suppress console logs for tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should skip rows without valid ID', async () => {
    mockSheetsClient.readAllRows.mockResolvedValue([
      { id: NaN, merchantName: 'Test' } as unknown as SheetRow,
    ]);

    const result = await useCase.execute();

    expect(result.scanned).toBe(0);
    expect(mockSubRepo.findById).not.toHaveBeenCalled();
  });

  it('should skip when subscription not found in D1', async () => {
    mockSheetsClient.readAllRows.mockResolvedValue([{ id: 99, amount: 100 } as SheetRow]);
    mockSubRepo.findById.mockResolvedValue(null);

    const result = await useCase.execute();

    expect(result.scanned).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockSubRepo.update).not.toHaveBeenCalled();
  });

  it('should update D1 when allowed fields differ (amount, nextBillingDate)', async () => {
    mockSheetsClient.readAllRows.mockResolvedValue([
      {
        id: 1,
        amount: 300000, // changed
        nextBillingDate: '2026-10-02', // changed
        isMustKeep: false,
        billingCycle: 'MONTHLY',
        directKillLink: null,
      } as SheetRow,
    ]);

    const result = await useCase.execute();

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(1);
    expect(mockSubRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        amount: 300000,
        nextBillingDate: '2026-10-02',
      })
    );
  });

  it('should skip if no allowed fields differ', async () => {
    mockSheetsClient.readAllRows.mockResolvedValue([
      {
        id: 1,
        amount: 260000, // same
        nextBillingDate: '2026-09-02', // same
        isMustKeep: false, // same
        billingCycle: 'MONTHLY', // same
        directKillLink: null, // same
      } as SheetRow,
    ]);

    const result = await useCase.execute();

    expect(result.scanned).toBe(1);
    expect(result.updated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(mockSubRepo.update).not.toHaveBeenCalled();
  });

  describe('Phase 2: Backfill (D1 -> Sheets)', () => {
    it('should backfill subscription missing on Sheets', async () => {
      const mockSyncD1 = { execute: vi.fn() };
      const useCaseWithBackfill = new SyncSheetsToD1UseCase(
        mockSheetsClient as unknown as IGoogleSheetsClient,
        mockSubRepo as unknown as ISubscriptionRepository,
        mockSyncD1 as unknown as import('./sync-d1-to-sheets.use-case').SyncD1ToSheetsUseCase
      );

      mockSheetsClient.readAllRows.mockResolvedValue([
        { id: 99 } as SheetRow, // Sheets has ID 99
      ]);
      mockSubRepo.findAll.mockResolvedValue([
        { id: 99 } as SubscriptionEntity,
        { id: 100 } as SubscriptionEntity, // Missing on sheets
      ]);

      const result = await useCaseWithBackfill.execute();

      expect(mockSyncD1.execute).toHaveBeenCalledTimes(1);
      expect(mockSyncD1.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 100 }));
      expect(result.backfilled).toBe(1);
    });

    it('should not throw if backfill fails', async () => {
      const mockSyncD1 = { execute: vi.fn().mockRejectedValue(new Error('API quota')) };
      const useCaseWithBackfill = new SyncSheetsToD1UseCase(
        mockSheetsClient as unknown as IGoogleSheetsClient,
        mockSubRepo as unknown as ISubscriptionRepository,
        mockSyncD1 as unknown as import('./sync-d1-to-sheets.use-case').SyncD1ToSheetsUseCase
      );

      mockSheetsClient.readAllRows.mockResolvedValue([]);
      mockSubRepo.findAll.mockResolvedValue([{ id: 1 } as SubscriptionEntity]);

      await expect(useCaseWithBackfill.execute()).resolves.not.toThrow();
      expect(mockSyncD1.execute).toHaveBeenCalled();
    });
  });
});
