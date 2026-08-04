import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ParseReceiptUseCase } from './parse-receipt.use-case';
import type { IParserService } from '@/features/parser/domain/parser-service.interface';
import type { SubscriptionExtraction } from '@/core/types/extraction';
import { SubscriptionStatus, ParsingLogStatus } from '@/core/types/enums';

interface MockDb {
  insert: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
}

describe('Task 3.5 — Feature AI Parser Unit Tests (Test Cases Specification)', () => {
  let mockParserService: IParserService;
  let mockDb: MockDb;
  let useCase: ParseReceiptUseCase;

  beforeEach(() => {
    mockParserService = {
      parse: vi.fn(),
    };

    mockDb = {
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      returning: vi.fn(),
    };

    useCase = new ParseReceiptUseCase(mockParserService, mockDb);
  });

  // --------------------------------------------------------------------------
  // Subtask 3.5.1: TC-06 — Confidence >= 0.85 -> Tự động lưu vào Subscriptions
  // --------------------------------------------------------------------------
  it('3.5.1 (TC-06) — Confidence Score >= 0.85: Tự động ghi vào subscriptions và parsing_logs SUCCESS', async () => {
    const mockExtraction: SubscriptionExtraction = {
      merchantName: 'Spotify',
      amount: 59000,
      currency: 'VND',
      billingCycle: 'MONTHLY',
      isTrial: false,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.95,
    };

    vi.mocked(mockParserService.parse).mockResolvedValue(mockExtraction);
    mockDb.returning
      .mockResolvedValueOnce([{ id: 101 }]) // subscriptions insert return
      .mockResolvedValueOnce([{ id: 201 }]); // parsingLogs insert return

    const result = await useCase.execute({
      source: 'EMAIL',
      senderId: 'user_1',
      content: 'Biên lai gia hạn Spotify 59.000 VND',
      contentType: 'TEXT',
      subscriberId: 1,
    });

    expect(result.status).toBe('AUTO_SAVED');
    expect(result.subscriptionId).toBe(101);
    expect(result.parsingLogId).toBe(201);
    expect(result.message).toContain('Spotify');

    // Kiểm tra đúng giá trị truyền vào DB
    expect(mockDb.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        merchantName: 'Spotify',
        amount: 59000,
        currency: 'VND',
        status: SubscriptionStatus.ACTIVE,
      })
    );
    expect(mockDb.values).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: ParsingLogStatus.SUCCESS,
        confidenceScore: 0.95,
      })
    );
  });

  // --------------------------------------------------------------------------
  // Subtask 3.5.2: TC-07 — Confidence < 0.85 -> Yêu cầu người dùng xác nhận
  // --------------------------------------------------------------------------
  it('3.5.2 (TC-07) — Confidence Score < 0.85: Ghi parsing_logs LOW_CONFIDENCE và trả message xác nhận thủ công', async () => {
    const mockLowConfidenceExtraction: SubscriptionExtraction = {
      merchantName: 'App la 123',
      amount: 100000,
      currency: 'VND',
      billingCycle: 'MONTHLY',
      isTrial: false,
      nextBillingDate: '2026-09-01',
      confidenceScore: 0.65,
    };

    vi.mocked(mockParserService.parse).mockResolvedValue(mockLowConfidenceExtraction);
    mockDb.returning.mockResolvedValueOnce([{ id: 301 }]); // parsingLogs insert return

    const result = await useCase.execute({
      source: 'CHAT_ZALO',
      senderId: 'zalo_99',
      content: 'Chuyển tiền ứng dụng lạ',
      contentType: 'TEXT',
    });

    expect(result.status).toBe('NEEDS_CONFIRMATION');
    expect(result.parsingLogId).toBe(301);
    expect(result.message).toContain('Độ tin cậy: 65%');
    expect(result.subscriptionId).toBeUndefined(); // KHÔNG tự động lưu vào bảng subscriptions

    expect(mockDb.insert).toHaveBeenCalledTimes(1); // Chỉ insert parsing_logs
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ParsingLogStatus.LOW_CONFIDENCE,
        confidenceScore: 0.65,
      })
    );
  });

  // --------------------------------------------------------------------------
  // Subtask 3.5.3: TC-09 — Hóa đơn 0đ (Free Trial) -> amount = 0, status = TRIAL
  // --------------------------------------------------------------------------
  it('3.5.3 (TC-09) — Hóa đơn 0đ (Free Trial): Bóc tách amount = 0, gán isTrial = true và lưu status = TRIAL', async () => {
    const mockFreeTrialExtraction: SubscriptionExtraction = {
      merchantName: 'Canva Pro',
      amount: 0,
      currency: 'VND',
      billingCycle: 'MONTHLY',
      isTrial: true,
      nextBillingDate: '2026-08-15',
      confidenceScore: 0.92,
    };

    vi.mocked(mockParserService.parse).mockResolvedValue(mockFreeTrialExtraction);
    mockDb.returning.mockResolvedValueOnce([{ id: 102 }]).mockResolvedValueOnce([{ id: 202 }]);

    const result = await useCase.execute({
      source: 'EMAIL',
      senderId: 'user_free_trial',
      content: 'Xác nhận đăng ký dùng thử 0đ Canva Pro 30 ngày',
      contentType: 'TEXT',
      subscriberId: 2,
    });

    expect(result.status).toBe('AUTO_SAVED');
    expect(result.extraction?.amount).toBe(0);
    expect(result.extraction?.isTrial).toBe(true);

    // Kiểm tra bản ghi lưu vào subscriptions phải có status = 'TRIAL'
    expect(mockDb.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        merchantName: 'Canva Pro',
        amount: 0,
        status: SubscriptionStatus.TRIAL,
      })
    );
  });

  // --------------------------------------------------------------------------
  // Subtask 3.5.4: TC-10 — Ngày thiếu năm -> Suy luận năm theo ngày hệ thống
  // --------------------------------------------------------------------------
  it('3.5.4 (TC-10) — Ngày thiếu năm: Tự động suy luận đúng năm theo thời điểm hệ thống hiện tại', async () => {
    // Giả lập ngày hệ thống đang chạy là 01/08/2026
    const mockExtractionInferredDate: SubscriptionExtraction = {
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      billingCycle: 'MONTHLY',
      isTrial: false,
      nextBillingDate: '2026-09-05', // OpenAI Adapter đã suy luận "05/09" -> "2026-09-05"
      confidenceScore: 0.9,
    };

    vi.mocked(mockParserService.parse).mockResolvedValue(mockExtractionInferredDate);
    mockDb.returning.mockResolvedValueOnce([{ id: 103 }]).mockResolvedValueOnce([{ id: 203 }]);

    const result = await useCase.execute({
      source: 'CHAT_TG',
      senderId: 'tg_100',
      content: 'Netflix hết hạn vào ngày 05/09',
      contentType: 'TEXT',
    });

    expect(result.status).toBe('AUTO_SAVED');
    expect(result.extraction?.nextBillingDate).toBe('2026-09-05');
    expect(mockDb.values).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        nextBillingDate: '2026-09-05',
      })
    );
  });
});
