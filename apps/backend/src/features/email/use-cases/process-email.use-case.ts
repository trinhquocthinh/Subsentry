import { eq } from 'drizzle-orm';
import { members } from '@/core/db/schema';
import type {
  ParseReceiptUseCase,
  ParseReceiptResult,
} from '@/features/parser/use-cases/parse-receipt.use-case';
import type { IEmailParserAdapter } from '../adapters/email-parser.adapter';
import type {
  CloudflareForwardableEmailMessage,
  ParsedEmailPayload,
} from '../domain/email-message.interface';
import type { ITelegramClient } from '@/features/telegram/adapters/telegram-client.adapter';

export interface ProcessEmailInput {
  message?: CloudflareForwardableEmailMessage;
  parsedPayload?: ParsedEmailPayload;
  allowedToAddress?: string;
  onAsyncWork?: (promise: Promise<void>) => void;
}

export interface ProcessEmailResult {
  status: 'PROCESSED' | 'REJECTED' | 'FAILED';
  reason?: string;
  parseResult?: ParseReceiptResult;
}

export class ProcessEmailUseCase {
  constructor(
    private emailParserAdapter: IEmailParserAdapter,
    private parseReceiptUseCase: ParseReceiptUseCase,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private db: any,
    private telegramClient?: ITelegramClient
  ) {}

  private extractEmailAddress(rawFrom: string): string {
    const match = rawFrom.match(/<([^>]+)>/);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }
    return rawFrom.trim().toLowerCase();
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async execute(input: ProcessEmailInput): Promise<ProcessEmailResult> {
    let payload: ParsedEmailPayload;

    try {
      if (input.parsedPayload) {
        payload = input.parsedPayload;
      } else if (input.message) {
        payload = await this.emailParserAdapter.parseRawEmail(
          input.message.raw,
          input.message.from,
          input.message.to
        );
      } else {
        return {
          status: 'FAILED',
          reason: 'No email message or parsed payload provided',
        };
      }

      const toAddress = (payload.to || input.message?.to || '').toLowerCase();
      const allowedTo = input.allowedToAddress ? input.allowedToAddress.toLowerCase() : '';

      // Task 8.1.2: Check relay & address matching (strict exact or domain match)
      if (allowedTo) {
        const cleanAllowedTo = allowedTo.trim();
        const cleanTo = toAddress.trim();
        const isMatch =
          cleanTo === cleanAllowedTo || cleanTo.endsWith(`@${cleanAllowedTo.replace(/^@/, '')}`);
        if (!isMatch) {
          if (input.message && typeof input.message.setReject === 'function') {
            input.message.setReject(`Address ${toAddress} not accepted by Subsentry Email Routing`);
          }
          return {
            status: 'REJECTED',
            reason: `Recipient email '${toAddress}' does not match allowed destination '${allowedTo}'`,
          };
        }
      }

      const rawFrom = payload.from || input.message?.from || 'unknown@sender.com';
      const cleanFromEmail = this.extractEmailAddress(rawFrom);

      const rawTo = payload.to || input.message?.to || 'unknown@receiver.com';
      const cleanToEmail = this.extractEmailAddress(rawTo);

      // Lookup subscriber by the recipient's email (payload.to - family member's email)
      let subscriberId: number | undefined;
      let telegramChatId: string | undefined;

      try {
        const matchingMembers = await this.db
          .select()
          .from(members)
          .where(eq(members.email, cleanToEmail))
          .limit(1);

        if (matchingMembers.length > 0) {
          subscriberId = matchingMembers[0].id;
          telegramChatId = matchingMembers[0].telegramChatId || undefined;
        }
        // Notice: We no longer auto-create members here to avoid cluttering DB with unrecognized addresses.
        // If not found, subscriberId remains undefined and ParseReceiptUseCase handles the fallback safely.
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ProcessEmailUseCase] Member lookup failed:', err);
      }

      // Extract body text & truncate to max 3000 chars (Review Point D)
      let bodyText = payload.text;
      if (!bodyText && payload.html) {
        bodyText = this.stripHtml(payload.html);
      }
      if (!bodyText) {
        bodyText = payload.subject || 'Receipt Email';
      }

      const MAX_EMAIL_BODY_LENGTH = 3000;
      if (bodyText.length > MAX_EMAIL_BODY_LENGTH) {
        bodyText =
          bodyText.slice(0, MAX_EMAIL_BODY_LENGTH) +
          '\n...[Nội dung email quá dài đã được tự động cắt bớt]';
      }

      const fullContent = `From: ${rawFrom}\nSubject: ${payload.subject}\n\n${bodyText}`.trim();

      // Call ParseReceiptUseCase (Epic 3)
      const parseResult = await this.parseReceiptUseCase.execute({
        source: 'EMAIL',
        senderId: cleanFromEmail,
        content: fullContent,
        contentType: 'TEXT',
        subscriberId,
        onAsyncWork: input.onAsyncWork,
      });

      // Notification strategy: Send Telegram message if member linked
      if (telegramChatId && this.telegramClient) {
        try {
          const notifyMsg = `📧 [Email Routing Forwarded]\n${parseResult.message || 'Xử lý email thành công'}`;
          await this.telegramClient.sendMessage(telegramChatId, notifyMsg);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[ProcessEmailUseCase] Failed to send Telegram email notification:', err);
        }
      }

      return {
        status: 'PROCESSED',
        parseResult,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown email processing error';
      return {
        status: 'FAILED',
        reason: errorMsg,
      };
    }
  }
}
