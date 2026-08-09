import { Hono } from 'hono';
import { createDbClient } from '@/core/db';
import { OpenAIParserAdapter } from '@/features/parser/adapters/openai-parser.adapter';
import { ParseReceiptUseCase } from '@/features/parser/use-cases/parse-receipt.use-case';
import {
  TelegramClientAdapter,
  type ITelegramClient,
} from '@/features/telegram/adapters/telegram-client.adapter';
import { PostalMimeEmailAdapter, type IEmailParserAdapter } from './adapters/email-parser.adapter';
import { ProcessEmailUseCase } from './use-cases/process-email.use-case';
import type { ParsedEmailPayload } from './domain/email-message.interface';
import { GoogleSheetsClientAdapter } from '@/features/sheets/adapters/google-sheets-client.adapter';
import type { IGoogleSheetsClient } from '@/features/sheets/domain/google-sheets-client.interface';
import { SyncD1ToSheetsUseCase } from '@/features/sheets/use-cases/sync-d1-to-sheets.use-case';
import { DrizzleMemberRepository } from '@/features/subscription/adapters/drizzle-member.repository';

export type EmailRouterEnv = {
  Bindings: {
    DB: D1Database;
    OPENAI_API_KEY?: string;
    TELEGRAM_BOT_TOKEN?: string;
    GMAIL_WEBHOOK_SECRET?: string;
    GOOGLE_SHEET_ID?: string;
    GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
    [key: string]: unknown;
  };
  Variables: {
    emailParserAdapterOverride?: IEmailParserAdapter;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parserServiceOverride?: any;
    telegramClientOverride?: ITelegramClient;
    sheetsClientOverride?: IGoogleSheetsClient;
    syncD1ToSheetsUseCaseOverride?: SyncD1ToSheetsUseCase;
  };
};

const emailRouter = new Hono<EmailRouterEnv>();

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

emailRouter.post('/', async (c) => {
  const secretHeader = c.req.header('X-Gmail-Webhook-Secret');
  const expectedSecret = c.env.GMAIL_WEBHOOK_SECRET;

  // Review Point A: Fail-Closed Security Check - reject 500 if server secret is missing
  if (!expectedSecret) {
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVER_MISCONFIGURED',
          message: 'GMAIL_WEBHOOK_SECRET is not configured on server',
        },
      },
      500
    );
  }

  let body: (ParsedEmailPayload & { secret?: string }) | null = null;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' },
      },
      400
    );
  }

  // Review Point B: Timing-safe comparison for secret validation
  const isHeaderValid = secretHeader ? timingSafeEqualStr(secretHeader, expectedSecret) : false;
  const isBodyValid = body?.secret ? timingSafeEqualStr(body.secret, expectedSecret) : false;

  if (!isHeaderValid && !isBodyValid) {
    return c.json(
      {
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Invalid Gmail Webhook Secret token' },
      },
      401
    );
  }

  if (!body || !body.from) {
    return c.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: 'Missing required field: from' },
      },
      400
    );
  }

  const db = createDbClient(c.env.DB);
  const emailParserAdapter = c.var.emailParserAdapterOverride || new PostalMimeEmailAdapter();
  const parserService =
    c.var.parserServiceOverride ||
    new OpenAIParserAdapter(
      (c.env.OPENAI_API_KEY as string) || process.env.OPENAI_API_KEY || 'mock-api-key'
    );

  let syncD1ToSheetsUseCase = c.var.syncD1ToSheetsUseCaseOverride;
  if (
    !syncD1ToSheetsUseCase &&
    c.env.GOOGLE_SHEET_ID &&
    c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    const sheetsClient =
      c.var.sheetsClientOverride ||
      new GoogleSheetsClientAdapter(
        c.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        c.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
        c.env.GOOGLE_SHEET_ID
      );
    const memberRepo = new DrizzleMemberRepository(db);
    syncD1ToSheetsUseCase = new SyncD1ToSheetsUseCase(sheetsClient, memberRepo);
  }

  const parseReceiptUseCase = new ParseReceiptUseCase(parserService, db, syncD1ToSheetsUseCase);
  const telegramClient =
    c.var.telegramClientOverride ||
    (c.env.TELEGRAM_BOT_TOKEN ? new TelegramClientAdapter(c.env.TELEGRAM_BOT_TOKEN) : undefined);

  const processEmailUseCase = new ProcessEmailUseCase(
    emailParserAdapter,
    parseReceiptUseCase,
    db,
    telegramClient
  );

  const asyncPromises: Promise<void>[] = [];
  const onAsyncWork = (p: Promise<void>) => asyncPromises.push(p);

  const result = await processEmailUseCase.execute({
    parsedPayload: body,
    onAsyncWork,
  });

  if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
    for (const p of asyncPromises) {
      c.executionCtx.waitUntil(p);
    }
  } else if (asyncPromises.length > 0) {
    await Promise.allSettled(asyncPromises);
  }

  return c.json({
    success: true,
    result,
  });
});

export { emailRouter };
