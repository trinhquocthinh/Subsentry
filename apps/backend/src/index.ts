import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { RetryFailedParsingLogsUseCase } from './features/parser/use-cases/retry-failed-parsing-logs.use-case';
import { OpenAIParserAdapter } from './features/parser/adapters/openai-parser.adapter';
import { ProcessTieredAlertsUseCase } from './features/alert/use-cases/process-tiered-alerts.use-case';
import { DrizzleAlertRepository } from './features/alert/adapters/drizzle-alert.repository';
import { MockNotificationService } from './features/alert/adapters/mock-notification.adapter';
import { DrizzleSubscriptionRepository } from './features/subscription/adapters/drizzle-subscription.repository';
import { DrizzleMemberRepository } from './features/subscription/adapters/drizzle-member.repository';
import { DrizzlePaymentCardRepository } from './features/subscription/adapters/drizzle-payment-card.repository';
import { GoogleSheetsClientAdapter } from './features/sheets/adapters/google-sheets-client.adapter';
import { SyncSheetsToD1UseCase } from './features/sheets/use-cases/sync-sheets-to-d1.use-case';
import { SyncD1ToSheetsUseCase } from './features/sheets/use-cases/sync-d1-to-sheets.use-case';
import { createDbClient } from './core/db';
import { globalErrorHandler, notFoundHandler } from './core/errors/error-handler';
import { requestLogger } from './core/middleware/logger';

import { telegramRouter } from './features/telegram/telegram.router';
import {
  TelegramClientAdapter,
  TelegramNotificationAdapter,
} from './features/telegram/adapters/telegram-client.adapter';
import { handleEmailEvent } from './features/email/email.handler';
import { emailRouter } from './features/email/email.router';
import type { CloudflareForwardableEmailMessage } from './features/email/domain/email-message.interface';
import { adminRouter } from './features/admin/admin.router';
import { apiRouter } from './features/api/api.router';

export type Bindings = {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  TELEGRAM_FAMILY_GROUP_CHAT_ID?: string;
  OPENAI_API_KEY?: string;
  ALLOWED_EMAIL_TO?: string;
  GMAIL_WEBHOOK_SECRET?: string;
  ADMIN_API_TOKEN?: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  [key: string]: unknown;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middlewares
app.use('*', requestLogger);
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      // Allow localhost for dev, and Cloudflare Pages domains for prod
      if (!origin) return '*';
      if (origin.startsWith('http://localhost') || origin.endsWith('.pages.dev')) {
        return origin;
      }
      return 'https://subsentry.pages.dev'; // Default fallback or exact custom domain if known
    },
    allowHeaders: ['Content-Type', 'X-Telegram-Init-Data'],
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    maxAge: 86400,
  })
);

// Mount feature routers
app.route('/webhook/telegram', telegramRouter);
app.route('/webhook/email', emailRouter);
app.route('/api/v1', apiRouter);
app.route('/api/admin', adminRouter);

// Global Error & 404 Handler
app.onError(globalErrorHandler);
app.notFound(notFoundHandler);

// Health Check có thực hiện Query D1 thực tế
app.get('/health-check', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    // Thực thi query thật xuống SQLite D1
    await db.run(sql`SELECT 1`);

    return c.json({
      status: 'ok',
      service: '@subsentry/backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        status: 'error',
        service: '@subsentry/backend',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'D1 Query Failed',
      },
      500
    );
  }
});

app.get('/', (c) => c.text('Subsentry API Kernel Active'));

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) => {
    const db = createDbClient(env.DB);
    const parserService = new OpenAIParserAdapter(env.OPENAI_API_KEY as string);
    const retryUseCase = new RetryFailedParsingLogsUseCase(parserService, db);

    const subscriptionRepo = new DrizzleSubscriptionRepository(db);
    const alertRepo = new DrizzleAlertRepository(db);
    const memberRepo = new DrizzleMemberRepository(db);
    const paymentCardRepo = new DrizzlePaymentCardRepository(db);

    const notificationService = env.TELEGRAM_BOT_TOKEN
      ? new TelegramNotificationAdapter(
          new TelegramClientAdapter(env.TELEGRAM_BOT_TOKEN as string),
          db,
          env.TELEGRAM_FAMILY_GROUP_CHAT_ID as string | undefined
        )
      : new MockNotificationService();

    const alertUseCase = new ProcessTieredAlertsUseCase(
      subscriptionRepo,
      alertRepo,
      notificationService,
      memberRepo,
      paymentCardRepo
    );

    const promises: Promise<unknown>[] = [retryUseCase.execute(), alertUseCase.execute()];

    if (
      env.GOOGLE_SHEET_ID &&
      env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    ) {
      const sheetsClient = new GoogleSheetsClientAdapter(
        env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
        env.GOOGLE_SHEET_ID
      );
      const syncD1ToSheetsUseCase = new SyncD1ToSheetsUseCase(sheetsClient, memberRepo);
      const syncSheetsToD1UseCase = new SyncSheetsToD1UseCase(
        sheetsClient,
        subscriptionRepo,
        syncD1ToSheetsUseCase
      );
      promises.push(
        syncSheetsToD1UseCase
          .execute()
          .then(() => {})
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error(err);
          })
      );
    }

    ctx.waitUntil(Promise.all(promises));
  },
  email: async (
    message: CloudflareForwardableEmailMessage,
    env: Bindings,
    ctx: ExecutionContext
  ) => {
    const promise = handleEmailEvent(message, env);
    if (ctx && typeof ctx.waitUntil === 'function') {
      ctx.waitUntil(promise);
    } else {
      await promise;
    }
  },
};
