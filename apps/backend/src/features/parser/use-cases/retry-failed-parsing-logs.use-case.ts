import { eq } from 'drizzle-orm';
import { ParsingLogStatus } from '@/core/types/enums';
import { parsingLogs, subscriptions } from '@/core/db/schema';
import type { IParserService } from '@/features/parser/domain/parser-service.interface';
import { mapExtractionToSubscriptionInsertValues } from '@/features/parser/utils';

export interface RetryResult {
  totalProcessed: number;
  succeeded: number;
  failed: number;
}

export class RetryFailedParsingLogsUseCase {
  constructor(
    private parserService: IParserService,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private db: any
  ) {}

  async execute(): Promise<RetryResult> {
    // Quét toàn bộ các nhật ký bóc tách bị FAILED trước đó
    const failedLogs = await this.db
      .select()
      .from(parsingLogs)
      .where(eq(parsingLogs.status, ParsingLogStatus.FAILED));

    let succeeded = 0;
    let failed = 0;

    for (const log of failedLogs) {
      try {
        const extraction = await this.parserService.parse({
          source: log.source,
          senderId: log.senderId,
          content: log.rawContent,
          contentType: 'TEXT',
        });

        const isHighConfidence = extraction.confidenceScore >= 0.85;

        if (isHighConfidence) {
          await this.db
            .insert(subscriptions)
            .values(mapExtractionToSubscriptionInsertValues(extraction));
        }

        // Cập nhật lại nhật ký bóc tách sau khi retry thành công
        await this.db
          .update(parsingLogs)
          .set({
            parsedJson: JSON.stringify(extraction),
            confidenceScore: extraction.confidenceScore,
            status: isHighConfidence ? ParsingLogStatus.SUCCESS : ParsingLogStatus.LOW_CONFIDENCE,
          })
          .where(eq(parsingLogs.id, log.id));

        succeeded++;
      } catch {
        failed++;
      }
    }

    return {
      totalProcessed: failedLogs.length,
      succeeded,
      failed,
    };
  }
}
