import { createDbClient } from '@/core/db';
import { OpenAIParserAdapter } from '@/features/parser/adapters/openai-parser.adapter';
import { ParseReceiptUseCase } from '@/features/parser/use-cases/parse-receipt.use-case';
import {
  TelegramClientAdapter,
  type ITelegramClient,
} from '@/features/telegram/adapters/telegram-client.adapter';
import { PostalMimeEmailAdapter, type IEmailParserAdapter } from './adapters/email-parser.adapter';
import { ProcessEmailUseCase, type ProcessEmailResult } from './use-cases/process-email.use-case';
import type { CloudflareForwardableEmailMessage } from './domain/email-message.interface';

export type EmailHandlerBindings = {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  ALLOWED_EMAIL_TO?: string;
  [key: string]: unknown;
};

export type EmailHandlerOverrides = {
  emailParserAdapterOverride?: IEmailParserAdapter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parserServiceOverride?: any;
  telegramClientOverride?: ITelegramClient;
};

export async function handleEmailEvent(
  message: CloudflareForwardableEmailMessage,
  env: EmailHandlerBindings,
  overrides?: EmailHandlerOverrides
): Promise<ProcessEmailResult> {
  const db = createDbClient(env.DB);

  const emailParserAdapter = overrides?.emailParserAdapterOverride || new PostalMimeEmailAdapter();

  const parserService =
    overrides?.parserServiceOverride ||
    new OpenAIParserAdapter(
      (env.OPENAI_API_KEY as string) || process.env.OPENAI_API_KEY || 'mock-api-key'
    );

  const parseReceiptUseCase = new ParseReceiptUseCase(parserService, db);

  const telegramClient =
    overrides?.telegramClientOverride ||
    (env.TELEGRAM_BOT_TOKEN ? new TelegramClientAdapter(env.TELEGRAM_BOT_TOKEN) : undefined);

  const processEmailUseCase = new ProcessEmailUseCase(
    emailParserAdapter,
    parseReceiptUseCase,
    db,
    telegramClient
  );

  return await processEmailUseCase.execute({
    message,
    allowedToAddress: env.ALLOWED_EMAIL_TO,
  });
}
