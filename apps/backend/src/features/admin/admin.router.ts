import { Hono, type Context } from 'hono';
import type { Bindings } from '../../index';
import { createDbClient } from '../../core/db';
import { timingSafeEqualStr } from '../../core/utils/security';
import { DrizzleSubscriptionRepository } from '../subscription/adapters/drizzle-subscription.repository';
import { DrizzleMemberRepository } from '../subscription/adapters/drizzle-member.repository';
import { GoogleSheetsClientAdapter } from '../sheets/adapters/google-sheets-client.adapter';
import { SyncD1ToSheetsUseCase } from '../sheets/use-cases/sync-d1-to-sheets.use-case';
import { SyncSheetsToD1UseCase } from '../sheets/use-cases/sync-sheets-to-d1.use-case';
import { TelegramClientAdapter } from '../telegram/adapters/telegram-client.adapter';

export const adminRouter = new Hono<{ Bindings: Bindings }>();

// Audit logging helper
function logAdminAudit(
  c: Context<{ Bindings: Bindings }>,
  status: number,
  action: string,
  details?: string
) {
  const timestamp = new Date().toISOString();
  const ip =
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown-ip';
  const userAgent = c.req.header('user-agent') || 'unknown-ua';
  const method = c.req.method;
  const path = c.req.path;

  // eslint-disable-next-line no-console
  console.log(
    `[ADMIN AUDIT LOG] ${timestamp} | IP: ${ip} | ${method} ${path} | Status: ${status} | Action: ${action}${
      details ? ` | Details: ${details}` : ''
    } | UA: ${userAgent}`
  );
}

// Auth & Audit Middleware for all admin routes (Task 10.3.1)
adminRouter.use('*', async (c, next) => {
  const expectedToken = c.env.ADMIN_API_TOKEN;

  if (!expectedToken) {
    logAdminAudit(c, 500, 'AUTH_FAILED', 'ADMIN_API_TOKEN missing on server');
    return c.json(
      {
        success: false,
        error: {
          code: 'SERVER_MISCONFIGURED',
          message: 'ADMIN_API_TOKEN is not configured on server',
        },
      },
      500
    );
  }

  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logAdminAudit(c, 401, 'AUTH_FAILED', 'Missing or malformed Authorization header');
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing or malformed Authorization header',
        },
      },
      401
    );
  }

  const providedToken = authHeader.substring(7);
  if (!timingSafeEqualStr(providedToken, expectedToken)) {
    logAdminAudit(c, 401, 'AUTH_FAILED', 'Invalid ADMIN_API_TOKEN provided');
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid Admin API token',
        },
      },
      401
    );
  }

  return next();
});

adminRouter.post('/reconcile-sync', async (c) => {
  const { env } = c;

  // Check if Sheets is configured
  if (
    !env.GOOGLE_SHEET_ID ||
    !env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  ) {
    logAdminAudit(c, 400, 'RECONCILE_FAILED', 'Google Sheets configuration incomplete');
    return c.json(
      {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Google Sheets integration is not fully configured',
        },
      },
      400
    );
  }

  try {
    const db = createDbClient(env.DB);
    const subscriptionRepo = new DrizzleSubscriptionRepository(db);
    const memberRepo = new DrizzleMemberRepository(db);
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

    const result = await syncSheetsToD1UseCase.execute();

    // Audit Log for Success (Task 10.3.1)
    logAdminAudit(
      c,
      200,
      'RECONCILE_SUCCESS',
      `Scanned: ${result.scanned}, Updated: ${result.updated}, Backfilled: ${result.backfilled}, Errors: ${result.errors}`
    );

    // Send Telegram Notification
    if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_FAMILY_GROUP_CHAT_ID) {
      const telegramClient = new TelegramClientAdapter(env.TELEGRAM_BOT_TOKEN);
      const message =
        `✅ *[SYSTEM]* Đồng bộ dữ liệu hòa giải (Reconcile) thành công!\n\n` +
        `📊 Báo cáo kết quả:\n` +
        `- Đã quét: ${result.scanned} dòng trên Sheets.\n` +
        `- Cập nhật về D1: ${result.updated} bản ghi.\n` +
        `- Backfill lên Sheets: ${result.backfilled} bản ghi.\n` +
        `- Lỗi: ${result.errors}`;

      c.executionCtx?.waitUntil?.(
        telegramClient.sendMessage(env.TELEGRAM_FAMILY_GROUP_CHAT_ID, message).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[Admin Audit] Failed to send Telegram notification', err);
        })
      );
    }

    return c.json({
      success: true,
      message: 'Reconciliation completed',
      result,
    });
  } catch (error) {
    // Log sensitive error stack/details internally, do NOT expose to client (OWASP A05)
    // eslint-disable-next-line no-console
    console.error(`[Admin Internal Error] /reconcile-sync failed:`, error);
    logAdminAudit(
      c,
      500,
      'RECONCILE_EXECUTION_ERROR',
      error instanceof Error ? error.message : 'Unknown internal error'
    );

    return c.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Reconciliation sync failed, please check server logs',
        },
      },
      500
    );
  }
});
