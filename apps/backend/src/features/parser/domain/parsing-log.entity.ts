import type { ParsingLogStatus, ParserSource } from '@/core/types/enums';

export interface ParsingLog {
  id?: number;
  source: ParserSource; // 'EMAIL' | 'CHAT_ZALO' | 'CHAT_TG'
  senderId: string;
  rawContent: string;
  parsedJson?: string | null;
  confidenceScore: number;
  status: ParsingLogStatus; // 'SUCCESS' | 'LOW_CONFIDENCE' | 'FAILED'
  createdAt?: Date;
}
