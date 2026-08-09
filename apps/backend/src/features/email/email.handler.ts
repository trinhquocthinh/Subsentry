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
import { GoogleSheetsClientAdapter } from '@/features/sheets/adapters/google-sheets-client.adapter';
import type { IGoogleSheetsClient } from '@/features/sheets/domain/google-sheets-client.interface';
import { SyncD1ToSheetsUseCase } from '@/features/sheets/use-cases/sync-d1-to-sheets.use-case';
import { DrizzleMemberRepository } from '@/features/subscription/adapters/drizzle-member.repository';

export type EmailHandlerBindings = {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  ALLOWED_EMAIL_TO?: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  [key: string]: unknown;
};

export type EmailHandlerOverrides = {
  emailParserAdapterOverride?: IEmailParserAdapter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parserServiceOverride?: any;
  telegramClientOverride?: ITelegramClient;
  sheetsClientOverride?: IGoogleSheetsClient;
  syncD1ToSheetsUseCaseOverride?: SyncD1ToSheetsUseCase;
};

export async function handleEmailEvent(
  message: CloudflareForwardableEmailMessage,
  env: EmailHandlerBindings,
  overrides?: EmailHandlerOverrides,
  onAsyncWork?: (promise: Promise<void>) => void
): Promise<ProcessEmailResult> {
  const db = createDbClient(env.DB);

  const emailParserAdapter = overrides?.emailParserAdapterOverride || new PostalMimeEmailAdapter();

  const parserService =
    overrides?.parserServiceOverride ||
    new OpenAIParserAdapter(
      (env.OPENAI_API_KEY as string) || process.env.OPENAI_API_KEY || 'mock-api-key'
    );

  let syncD1ToSheetsUseCase = overrides?.syncD1ToSheetsUseCaseOverride;
  if (
    !syncD1ToSheetsUseCase &&
    env.GOOGLE_SHEET_ID &&
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    const sheetsClient =
      overrides?.sheetsClientOverride ||
      new GoogleSheetsClientAdapter(
        env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
        env.GOOGLE_SHEET_ID
      );
    const memberRepo = new DrizzleMemberRepository(db);
    syncD1ToSheetsUseCase = new SyncD1ToSheetsUseCase(sheetsClient, memberRepo);
  }

  const parseReceiptUseCase = new ParseReceiptUseCase(parserService, db, syncD1ToSheetsUseCase);

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
    onAsyncWork,
  });
}
