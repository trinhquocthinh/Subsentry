import { describe, it, expect } from 'vitest';
import type { ParsingLog } from './parsing-log.entity';
import type { ParseInput, IParserService } from './parser-service.interface';
import type { SubscriptionExtraction } from '@/core/types/extraction';

describe('Parser Domain Layer', () => {
  it('nên tạo đúng cấu trúc Entity ParsingLog', () => {
    const log: ParsingLog = {
      source: 'CHAT_TG',
      senderId: '123456789',
      rawContent: 'Đã thanh toán Netflix 260.000 VND',
      confidenceScore: 0.95,
      status: 'SUCCESS',
    };

    expect(log.source).toBe('CHAT_TG');
    expect(log.confidenceScore).toBe(0.95);
    expect(log.status).toBe('SUCCESS');
  });

  it('nên mô phỏng thành công IParserService implementation', async () => {
    // Mock implementation đại diện cho adapter OpenAI sắp làm ở Task 3.2
    class MockParserAdapter implements IParserService {
      async parse(_input: ParseInput): Promise<SubscriptionExtraction> {
        return {
          merchantName: 'Netflix',
          amount: 260000,
          currency: 'VND',
          isTrial: false,
          nextBillingDate: '2026-09-01',
          confidenceScore: 0.95,
          billingCycle: 'MONTHLY',
        };
      }
    }

    const adapter = new MockParserAdapter();
    const result = await adapter.parse({
      source: 'EMAIL',
      senderId: '1',
      content: 'Biên lai Netflix',
      contentType: 'TEXT',
    });

    expect(result.merchantName).toBe('Netflix');
    expect(result.amount).toBe(260000);
    expect(result.confidenceScore).toBeGreaterThanOrEqual(0.85);
  });
});
