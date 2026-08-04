import { ParsingLogStatus } from '@/core/types/enums';
import { parsingLogs, subscriptions } from '@/core/db/schema';
import type { IParserService, ParseInput } from '@/features/parser/domain/parser-service.interface';
import type { SubscriptionExtraction } from '@/core/types/extraction';
import {
  sanitizeRawContent,
  mapExtractionToSubscriptionInsertValues,
} from '@/features/parser/utils';

export interface ParseReceiptInput extends ParseInput {
  subscriberId?: number;
  googleSheetsUrl?: string;
}

export interface ParseReceiptResult {
  status: 'AUTO_SAVED' | 'NEEDS_CONFIRMATION' | 'FAILED';
  extraction?: SubscriptionExtraction;
  parsingLogId?: number;
  subscriptionId?: number;
  message?: string;
}

export class ParseReceiptUseCase {
  constructor(
    private parserService: IParserService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private db: any
  ) {}

  private async recordParsingLog(
    input: ParseReceiptInput,
    rawContent: string,
    extraction: SubscriptionExtraction,
    status: ParsingLogStatus
  ) {
    const [log] = await this.db
      .insert(parsingLogs)
      .values({
        source: input.source,
        senderId: input.senderId,
        rawContent,
        parsedJson: JSON.stringify(extraction),
        confidenceScore: extraction.confidenceScore,
        status,
      })
      .returning();
    return log;
  }

  async execute(input: ParseReceiptInput): Promise<ParseReceiptResult> {
    // Task 3.3.3: Sanitize nội dung thô Chống Prompt Injection
    const sanitizedContent =
      input.contentType === 'TEXT' ? sanitizeRawContent(input.content) : input.content;

    const fallbackUrl =
      input.googleSheetsUrl ||
      process.env.GOOGLE_SHEETS_URL ||
      'https://docs.google.com/spreadsheets';

    try {
      // Task 3.4.1: Gọi OpenAI Engine
      const extraction = await this.parserService.parse({
        ...input,
        content: sanitizedContent,
      });

      const isHighConfidence = extraction.confidenceScore >= 0.85;

      if (isHighConfidence) {
        // Task 3.3.1: High Confidence >= 0.85 -> Lưu thẳng vào subscriptions
        const [newSub] = await this.db
          .insert(subscriptions)
          .values(mapExtractionToSubscriptionInsertValues(extraction, input.subscriberId ?? null))
          .returning();

        const log = await this.recordParsingLog(
          input,
          sanitizedContent,
          extraction,
          ParsingLogStatus.SUCCESS
        );

        return {
          status: 'AUTO_SAVED',
          extraction,
          parsingLogId: log?.id,
          subscriptionId: newSub?.id,
          message: `✅ Đã ghi nhận tự động dịch vụ ${extraction.merchantName} thành công!`,
        };
      } else {
        // Task 3.3.2: Low Confidence < 0.85 -> Ghi parsing_logs LOW_CONFIDENCE
        const log = await this.recordParsingLog(
          input,
          sanitizedContent,
          extraction,
          ParsingLogStatus.LOW_CONFIDENCE
        );

        const message =
          `⚠️ Hệ thống chưa chắc chắn 100% về thông tin hóa đơn (Độ tin cậy: ${Math.round(
            extraction.confidenceScore * 100
          )}%).\n\n` +
          `Vui lòng kiểm tra và xác nhận:\n` +
          `• Dịch vụ: ${extraction.merchantName}\n` +
          `• Số tiền: ${extraction.amount.toLocaleString('vi-VN')} ${extraction.currency}\n` +
          `• Ngày gia hạn: ${extraction.nextBillingDate}\n` +
          `• Chu kỳ: ${extraction.billingCycle}`;

        return {
          status: 'NEEDS_CONFIRMATION',
          extraction,
          parsingLogId: log?.id,
          message,
        };
      }
    } catch {
      // Task 3.4.1 & 3.4.2: Bắt lỗi OpenAI Outage / API Error -> Lưu status = FAILED
      const [log] = await this.db
        .insert(parsingLogs)
        .values({
          source: input.source,
          senderId: input.senderId,
          rawContent: sanitizedContent,
          parsedJson: null,
          confidenceScore: 0,
          status: ParsingLogStatus.FAILED,
        })
        .returning();

      // Task 3.4.3: Tạo tin nhắn thân thiện hướng dẫn nhập tay qua Google Sheets
      const friendlyErrorMessage =
        `🤖 Trí tuệ nhân tạo (AI) hiện đang bận hoặc gặp sự cố tạm thời.\n\n` +
        `📥 Hệ thống đã lưu lại nội dung hóa đơn thô của bạn (Mã tra cứu: #${log?.id || 'LOG'}). ` +
        `AI sẽ tự động thử bóc tách lại vào ban đêm.\n\n` +
        `📝 Nếu cần cập nhật ngay, bạn có thể nhập thủ công vào Google Sheets gia đình tại đây:\n` +
        `${fallbackUrl}`;

      return {
        status: 'FAILED',
        parsingLogId: log?.id,
        message: friendlyErrorMessage,
      };
    }
  }
}
