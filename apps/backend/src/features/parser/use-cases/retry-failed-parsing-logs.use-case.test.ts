import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RetryFailedParsingLogsUseCase } from '@/features/parser/use-cases/retry-failed-parsing-logs.use-case';
import type { IParserService } from '@/features/parser/domain/parser-service.interface';
import type { SubscriptionExtraction } from '@/core/types/extraction';

interface MockDb {
  select: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

describe('Task 3.4 — RetryFailedParsingLogsUseCase', () => {
  let mockParserService: IParserService;
  let mockDb: MockDb;
  let useCase: RetryFailedParsingLogsUseCase;

  beforeEach(() => {
    mockParserService = {
      parse: vi.fn(),
    };

    mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    useCase = new RetryFailedParsingLogsUseCase(mockParserService, mockDb);
  });

  it('3.4.4 — Quét và bóc tách lại thành công các bản ghi FAILED trong đêm', async () => {
    const mockFailedLogs = [
      {
        id: 1,
        source: 'EMAIL',
        senderId: 'user1@family.com',
        rawContent: 'Biên lai Netflix 260.000 VND',
        status: 'FAILED',
      },
    ];

    const mockExtraction: SubscriptionExtraction = {
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      billingCycle: 'MONTHLY',
      isTrial: false,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.95,
    };

    mockDb.where.mockResolvedValueOnce(mockFailedLogs);
    vi.mocked(mockParserService.parse).mockResolvedValueOnce(mockExtraction);

    const result = await useCase.execute();

    expect(result.totalProcessed).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(result.failed).toBe(0);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
    expect(mockDb.update).toHaveBeenCalledTimes(1);
  });
});
