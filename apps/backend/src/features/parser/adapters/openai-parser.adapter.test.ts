import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAIParserAdapter } from './openai-parser.adapter';

const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: mockCreate,
        },
      };
    },
  };
});

describe('OpenAIParserAdapter', () => {
  let adapter: OpenAIParserAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenAIParserAdapter('mock-api-key');
  });

  describe('3.2.3 — Chuẩn hóa tên Merchant', () => {
    it('nên map NETFLIX.COM thành Netflix', () => {
      expect(adapter.normalizeMerchant('NETFLIX.COM')).toBe('Netflix');
      expect(adapter.normalizeMerchant('NETFLIX')).toBe('Netflix');
    });

    it('nên map APPLE COM/BILL và APPLE BILLING thành Apple Services', () => {
      expect(adapter.normalizeMerchant('APPLE COM/BILL')).toBe('Apple Services');
      expect(adapter.normalizeMerchant('APPLE BILLING')).toBe('Apple Services');
    });

    it('nên chuẩn hóa chữ cái đầu cho tên merchant chưa có trong map', () => {
      expect(adapter.normalizeMerchant('adobe photoshop')).toBe('Adobe Photoshop');
    });

    it('xử lý an toàn khi merchant bị null hoặc undefined', () => {
      expect(adapter.normalizeMerchant(undefined)).toBe('Unknown Merchant');
      expect(adapter.normalizeMerchant(null)).toBe('Unknown Merchant');
    });
  });

  describe('3.2.4 — Xử lý ngày thiếu năm (TC-10)', () => {
    const mockNow = new Date('2026-08-01T00:00:00Z');

    it('giữ nguyên nếu đã có format YYYY-MM-DD', () => {
      expect(adapter.resolveBillingDate('2026-09-15', mockNow)).toBe('2026-09-15');
    });

    it('suy luận đúng năm hiện tại nếu ngày tháng chưa qua (09-15 -> 2026-09-15)', () => {
      expect(adapter.resolveBillingDate('09-15', mockNow)).toBe('2026-09-15');
    });

    it('tự động chuyển sang năm tiếp theo nếu ngày tháng đã qua trong năm nay (03-15 -> 2027-03-15)', () => {
      expect(adapter.resolveBillingDate('03-15', mockNow)).toBe('2027-03-15');
    });

    it('xử lý an toàn khi dateStr bị undefined hoặc null, cộng thêm 30 ngày nếu không phải trial', () => {
      expect(adapter.resolveBillingDate(undefined, mockNow, false)).toBe('2026-08-31'); // mockNow is 2026-08-01, +30 days = 2026-08-31
      expect(adapter.resolveBillingDate(null, mockNow, false)).toBe('2026-08-31');
    });

    it('cộng thêm 7 ngày nếu là gói dùng thử (trial) và thiếu ngày', () => {
      expect(adapter.resolveBillingDate(undefined, mockNow, true)).toBe('2026-08-08'); // +7 days = 2026-08-08
      expect(adapter.resolveBillingDate(null, mockNow, true)).toBe('2026-08-08');
    });
  });

  describe('3.2.1 & 3.2.2 — Gọi OpenAI Chat Completion & Strict JSON Parsing', () => {
    it('bóc tách thành công dữ liệu văn bản từ OpenAI GPT-4o-mini', async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                merchant: 'NETFLIX.COM',
                amount: 260000,
                currency: 'VND',
                billing_cycle: 'MONTHLY',
                is_trial: false,
                next_billing_date: '2026-09-01',
                confidence_score: 0.98,
              }),
            },
          },
        ],
      };

      mockCreate.mockResolvedValue(mockResponse);

      const result = await adapter.parse({
        source: 'EMAIL',
        senderId: 'user_123',
        content: 'Biên lai gia hạn Netflix 260.000 VND ngày 01/09/2026',
        contentType: 'TEXT',
      });

      expect(result.merchantName).toBe('Netflix');
      expect(result.amount).toBe(260000);
      expect(result.currency).toBe('VND');
      expect(result.billingCycle).toBe('MONTHLY');
      expect(result.isTrial).toBe(false);
      expect(result.nextBillingDate).toBe('2026-09-01');
      expect(result.confidenceScore).toBe(0.98);
    });

    it('ném ra ngoại lệ nếu OpenAI không phản hồi dữ liệu', async () => {
      const mockEmptyResponse = { choices: [] };
      mockCreate.mockResolvedValue(mockEmptyResponse);

      await expect(
        adapter.parse({
          source: 'CHAT_TG',
          senderId: 'tg_999',
          content: 'x',
          contentType: 'TEXT',
        })
      ).rejects.toThrow('OpenAI không trả về dữ liệu kết quả bóc tách.');
    });
  });
});
