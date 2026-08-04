import OpenAI from 'openai';
import type { IParserService, ParseInput } from '@/features/parser/domain/parser-service.interface';
import type { SubscriptionExtraction } from '@/core/types/extraction';
import type { BillingCycle } from '@/core/types/enums';

// Bảng ánh ánh tên Merchant thông dụng về chuẩn hiển thị
const MERCHANT_CANONICAL_MAP: Record<string, string> = {
  'NETFLIX.COM': 'Netflix',
  NETFLIX: 'Netflix',
  'APPLE COM/BILL': 'Apple Services',
  'APPLE BILLING': 'Apple Services',
  'ITUNES.COM': 'Apple Services',
  'SPOTIFY AB': 'Spotify',
  SPOTIFY: 'Spotify',
  'GOOGLE *SERVICES': 'Google',
  'GOOGLE PLAY': 'Google',
  'YOUTUBE PREMIUM': 'YouTube',
  'CHATGPT SUBSCRIPTION': 'OpenAI',
  OPENAI: 'OpenAI',
};

// Response JSON Schema nghiêm ngặt theo sdd.md §3.1
const EXTRACTION_JSON_SCHEMA = {
  name: 'subscription_extraction',
  strict: true,
  schema: {
    type: 'object',
    properties: {
      merchant: {
        type: 'string',
        description: 'Tên đơn vị cung cấp dịch vụ (vd: Netflix, Spotify, Apple)',
      },
      amount: {
        type: 'number',
        description: 'Số tiền thanh toán (chỉ chứa giá trị số)',
      },
      currency: {
        type: 'string',
        description: 'Mã tiền tệ ISO 4217 (vd: VND, USD)',
      },
      billing_cycle: {
        type: 'string',
        enum: ['WEEKLY', 'MONTHLY', 'YEARLY'],
        description: 'Chu kỳ gia hạn thanh toán',
      },
      is_trial: {
        type: 'boolean',
        description: 'Cờ xác định đây có phải gói dùng thử (Trial) hay không',
      },
      next_billing_date: {
        type: 'string',
        description: 'Ngày gia hạn tiếp theo. Chuẩn ISO YYYY-MM-DD hoặc MM-DD nếu thiếu năm',
      },
      confidence_score: {
        type: 'number',
        description: 'Điểm tin cậy bóc tách của AI từ 0.00 đến 1.00',
      },
    },
    required: [
      'merchant',
      'amount',
      'currency',
      'billing_cycle',
      'is_trial',
      'next_billing_date',
      'confidence_score',
    ],
    additionalProperties: false,
  },
} as const;

export class OpenAIParserAdapter implements IParserService {
  private openai: OpenAI;

  constructor(apiKey?: string) {
    this.openai = new OpenAI({
      apiKey: apiKey || process.env.OPENAI_API_KEY,
    });
  }

  async parse(input: ParseInput): Promise<SubscriptionExtraction> {
    const systemPrompt = `Bạn là chuyên gia bóc tách hóa đơn gia hạn dịch vụ (Subscription Parser) cho ứng dụng Subsentry.
Nhiệm vụ: Bóc tách thông tin giao dịch từ email/tin nhắn/ảnh biên lai và trả về đúng JSON Schema quy định.

Quy tắc quan trọng:
1. 'merchant': Bóc tách tên nhà cung cấp.
2. 'amount': Giá trị số nguyên hoặc thập phân của giao dịch.
3. 'currency': Đơn vị tiền tệ (mặc định VND nếu không ghi rõ).
4. 'billing_cycle': 'WEEKLY', 'MONTHLY', hoặc 'YEARLY'.
5. 'is_trial': true nếu có từ khóa "Dùng thử", "Free trial", "0đ".
6. 'next_billing_date': Định dạng YYYY-MM-DD. Nếu hóa đơn chỉ có ngày tháng (vd: 15/09), trả về "MM-DD".
7. 'confidence_score': Trả về điểm tin cậy từ 0.00 đến 1.00 đánh giá độ chính xác của dữ liệu bóc tách.`;

    const userContent =
      input.contentType === 'IMAGE_URL'
        ? [
            { type: 'text' as const, text: 'Hãy bóc tách hóa đơn trong ảnh sau:' },
            { type: 'image_url' as const, image_url: { url: input.content } },
          ]
        : input.content;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: EXTRACTION_JSON_SCHEMA,
      },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('OpenAI không trả về dữ liệu kết quả bóc tách.');
    }

    const rawJson = JSON.parse(content);

    return {
      merchantName: this.normalizeMerchant(rawJson.merchant),
      amount: Number(rawJson.amount ?? 0),
      currency: rawJson.currency || 'VND',
      billingCycle: (rawJson.billing_cycle as BillingCycle) || 'MONTHLY',
      isTrial: Boolean(rawJson.is_trial),
      nextBillingDate: this.resolveBillingDate(
        rawJson.next_billing_date,
        new Date(),
        Boolean(rawJson.is_trial)
      ),
      confidenceScore: Number(rawJson.confidence_score ?? 0),
      rawText: input.contentType === 'TEXT' ? input.content : undefined,
    };
  }

  /**
   * Task 3.2.3: Chuẩn hóa tên Merchant (An toàn dữ liệu null/undefined)
   */
  public normalizeMerchant(rawMerchant?: string | null): string {
    if (!rawMerchant || typeof rawMerchant !== 'string') {
      return 'Unknown Merchant';
    }

    const cleaned = rawMerchant.trim().toUpperCase();
    if (MERCHANT_CANONICAL_MAP[cleaned]) {
      return MERCHANT_CANONICAL_MAP[cleaned];
    }

    for (const [key, canonical] of Object.entries(MERCHANT_CANONICAL_MAP)) {
      if (cleaned.includes(key)) {
        return canonical;
      }
    }

    return rawMerchant
      .trim()
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Task 3.2.4: Suy luận năm nếu ngày thanh toán thiếu năm (TC-10) (An toàn dữ liệu null/undefined)
   */
  public resolveBillingDate(
    dateStr?: string | null,
    referenceDate: Date = new Date(),
    isTrial: boolean = false
  ): string {
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.trim()) {
      const nextDate = new Date(referenceDate);
      nextDate.setDate(nextDate.getDate() + (isTrial ? 7 : 30));
      return nextDate.toISOString().split('T')[0];
    }

    const trimmed = dateStr.trim();

    // Trường hợp đã đầy đủ YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const currentYear = referenceDate.getFullYear();
    let month = 0;
    let day = 0;

    // Định dạng MM-DD hoặc MM/DD
    const mmDdMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})$/);
    if (mmDdMatch) {
      month = parseInt(mmDdMatch[1], 10);
      day = parseInt(mmDdMatch[2], 10);
    } else {
      // Định dạng DD/MM hoặc DD-MM
      const ddMmMatch = trimmed.match(/^(\d{1,2})[./](\d{1,2})$/);
      if (ddMmMatch) {
        day = parseInt(ddMmMatch[1], 10);
        month = parseInt(ddMmMatch[2], 10);
      }
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const formattedMonth = String(month).padStart(2, '0');
      const formattedDay = String(day).padStart(2, '0');

      let inferredYear = currentYear;
      const candidateDate = new Date(inferredYear, month - 1, day);

      if (candidateDate < referenceDate) {
        inferredYear += 1;
      }

      return `${inferredYear}-${formattedMonth}-${formattedDay}`;
    }

    return trimmed;
  }
}
