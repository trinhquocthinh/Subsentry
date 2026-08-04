// apps/backend/src/features/parser/domain/parser-service.interface.ts
import type { SubscriptionExtraction } from '@/core/types/extraction';
import type { ParserSource } from '@/core/types/enums';

export interface ParseInput {
  source: ParserSource;
  senderId: string;
  content: string; // Nội dung email thô, SMS text, hoặc URL ảnh biên lai
  contentType: 'TEXT' | 'IMAGE_URL';
}

export interface IParserService {
  /**
   * Bóc tách thông tin hóa đơn từ dữ liệu đầu vào (Text hoặc Ảnh)
   * @param input Thông tin giao dịch thô
   * @returns Kết quả chuẩn hóa SubscriptionExtraction
   */
  parse(input: ParseInput): Promise<SubscriptionExtraction>;
}
