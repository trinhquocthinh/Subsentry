import { eq } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import worker from './index';
import { alerts, members, paymentCards, subscriptions } from './core/db/schema';
import { createTestDatabase } from './test/d1-test-bridge';

describe('Epic 2 - Refactored Hono Kernel Test', () => {
  it('GET /health-check trả về 200 OK khi DB sẵn sàng', async () => {
    // Mock D1 Database env
    const mockD1 = {
      prepare: () => ({
        bind: () => ({
          run: async () => ({ success: true }),
        }),
      }),
    } as unknown as D1Database;

    const res = await worker.fetch(new Request('http://localhost/health-check'), { DB: mockD1 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { database: string };
    expect(body.database).toBe('connected');
  });

  it('Lỗi 404 phải trả về JSON đúng chuẩn hệ thống', async () => {
    const res = await worker.fetch(new Request('http://localhost/non-existent-route'));
    expect(res.status).toBe(404);

    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: "Route 'GET /non-existent-route' not found",
      },
    });
  });

  it('scheduled() end-to-end: khởi tạo D1 thực tế, gọi ProcessTieredAlertsUseCase & RetryFailedParsingLogsUseCase và tạo bản ghi alerts thành công', async () => {
    const { sqlite, db, d1: mockD1 } = await createTestDatabase();
    sqlite.pragma('foreign_keys = ON');

    // Seed data
    const [subscriber] = await db
      .insert(members)
      .values({ displayName: 'Con Cả', role: 'SUBSCRIBER', zaloUserId: 'zalo_sub_scheduled' })
      .returning();

    const [cardOwner] = await db
      .insert(members)
      .values({ displayName: 'Bố', role: 'CARD_OWNER', zaloUserId: 'zalo_owner_scheduled' })
      .returning();

    const [card] = await db
      .insert(paymentCards)
      .values({ cardLabel: 'Techcombank - Bố', cardOwnerId: cardOwner.id, lastFour: '9999' })
      .returning();

    // Tính ngày cố định để 1 subscription khớp T-3
    const today = new Date();
    const t3Date = new Date(today);
    t3Date.setDate(t3Date.getDate() + 3);
    const t3DateStr = t3Date.toISOString().split('T')[0];

    const [subT3] = await db
      .insert(subscriptions)
      .values({
        merchantName: 'Canva Pro',
        amount: 149000,
        currency: 'VND',
        subscriberId: subscriber.id,
        paymentCardId: card.id,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        nextBillingDate: t3DateStr,
        confidenceScore: 0.95,
        isMustKeep: false,
      })
      .returning();

    const waitUntil = vi.fn((promise: Promise<unknown>) => promise);
    const mockCtx = {
      waitUntil,
    } as unknown as ExecutionContext;

    const mockEvent = {
      cron: '0 1 * * *',
      scheduledTime: Date.now(),
    } as unknown as ScheduledEvent;

    const env = {
      DB: mockD1,
      OPENAI_API_KEY: 'test-key',
    };

    await worker.scheduled(mockEvent, env, mockCtx);

    expect(waitUntil).toHaveBeenCalled();
    const waitUntilPromise = waitUntil.mock.calls[0][0];
    await waitUntilPromise;

    // Verify D1 Database state: alert Record must be inserted for Canva Pro (SOFT_T3)
    const createdAlerts = await db.select().from(alerts).where(eq(alerts.subscriptionId, subT3.id));
    expect(createdAlerts.length).toBeGreaterThan(0);
    expect(createdAlerts[0].alertType).toBe('SOFT_T3');
    expect(createdAlerts[0].status).toBe('SENT');
  });
});

describe('Epic 12 - Rate Limit Wiring Integration', () => {
  it('POST /webhook/telegram bị chặn 429 khi RATE_LIMITER_WEBHOOK báo vượt ngưỡng', async () => {
    const env = {
      RATE_LIMITER_WEBHOOK: { limit: vi.fn().mockResolvedValue({ success: false }) },
    };

    const res = await worker.fetch(
      new Request('http://localhost/webhook/telegram', { method: 'POST' }),
      env
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });
  });

  it('POST /api/admin/reconcile-sync bị chặn 429 khi RATE_LIMITER_ADMIN báo vượt ngưỡng', async () => {
    const env = {
      RATE_LIMITER_ADMIN: { limit: vi.fn().mockResolvedValue({ success: false }) },
    };

    const res = await worker.fetch(
      new Request('http://localhost/api/admin/reconcile-sync', { method: 'POST' }),
      env
    );

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });
  });

  it('binding của group này không được dùng để chặn nhầm group khác (RATE_LIMITER_ADMIN không ảnh hưởng /webhook/*)', async () => {
    const env = {
      RATE_LIMITER_ADMIN: { limit: vi.fn().mockResolvedValue({ success: false }) },
      // RATE_LIMITER_WEBHOOK không cấu hình -> fail-open, request phải đi tới telegramSignatureMiddleware
    };

    const res = await worker.fetch(
      new Request('http://localhost/webhook/telegram', { method: 'POST' }),
      env
    );

    // Không bị chặn bởi rate limiter (không phải 429) — bị telegramSignatureMiddleware từ chối vì thiếu secret
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('binding của group này không được dùng để chặn nhầm group khác (RATE_LIMITER_WEBHOOK không ảnh hưởng /api/admin/*)', async () => {
    const env = {
      RATE_LIMITER_WEBHOOK: { limit: vi.fn().mockResolvedValue({ success: false }) },
      // RATE_LIMITER_ADMIN không cấu hình -> fail-open, request phải đi tới admin auth middleware
    };

    const res = await worker.fetch(
      new Request('http://localhost/api/admin/reconcile-sync', { method: 'POST' }),
      env
    );

    // Không bị chặn bởi rate limiter (không phải 429) — bị admin auth middleware từ chối vì thiếu ADMIN_API_TOKEN
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: 'SERVER_MISCONFIGURED' } });
  });
});

describe('Worker kernel — route gốc & health-check', () => {
  it('GET / trả về banner của API kernel', async () => {
    const res = await worker.fetch(new Request('http://localhost/'));

    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe('Subsentry API Kernel Active');
  });

  it('GET /health-check trả 500 disconnected khi query D1 ném lỗi', async () => {
    const fail = async () => {
      throw new Error('D1_ERROR: no such table');
    };
    const brokenD1 = {
      prepare: () => ({ bind: () => ({ run: fail }), run: fail }),
    } as unknown as D1Database;

    const res = await worker.fetch(new Request('http://localhost/health-check'), { DB: brokenD1 });
    const body = (await res.json()) as { database: string; error: string };

    expect(res.status).toBe(500);
    expect(body.database).toBe('disconnected');
    // Drizzle bọc lại lỗi gốc, nhưng thông điệp thật vẫn phải được truyền ra ngoài
    expect(body.error).toContain('SELECT 1');
  });
});

describe('CORS cho /api/* (Task 11 — Telegram Mini App)', () => {
  const preflight = (origin?: string) =>
    worker.fetch(
      new Request('http://localhost/api/v1/subscriptions', {
        method: 'OPTIONS',
        headers: {
          ...(origin ? { Origin: origin } : {}),
          'Access-Control-Request-Method': 'GET',
        },
      }),
      {}
    );

  it('phản chiếu origin localhost khi phát triển cục bộ', async () => {
    const res = await preflight('http://localhost:5173');

    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('phản chiếu origin *.pages.dev của Cloudflare Pages', async () => {
    const res = await preflight('https://subsentry.pages.dev');

    expect(res.headers.get('access-control-allow-origin')).toBe('https://subsentry.pages.dev');
  });

  it('ép về domain mặc định khi origin lạ (chặn cross-origin tuỳ tiện)', async () => {
    const res = await preflight('https://ke-tan-cong.example.com');

    expect(res.headers.get('access-control-allow-origin')).toBe('https://subsentry.pages.dev');
  });

  it('cho phép * khi request không kèm header Origin', async () => {
    const res = await preflight(undefined);

    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});

describe('Worker email() handler — Cloudflare Email Routing', () => {
  const buildMessage = () =>
    ({
      from: 'billing@netflix.com',
      to: 'subs@yourfamily.com',
      headers: new Headers(),
      raw: new Response('From: a@b.com\r\n\r\nhi').body as ReadableStream<Uint8Array>,
      rawSize: 20,
      setReject: vi.fn(),
      forward: vi.fn(),
    }) as unknown as Parameters<typeof worker.email>[0];

  it('đẩy việc xử lý vào ctx.waitUntil khi có execution context', async () => {
    const { d1 } = await createTestDatabase();
    const waitUntil = vi.fn((p: Promise<unknown>) => p);
    const ctx = { waitUntil } as unknown as ExecutionContext;

    await worker.email(buildMessage(), { DB: d1, ALLOWED_EMAIL_TO: 'subs@yourfamily.com' }, ctx);

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
  });

  it('await trực tiếp khi không có ctx.waitUntil (fallback)', async () => {
    const { d1 } = await createTestDatabase();

    await expect(
      worker.email(
        buildMessage(),
        { DB: d1, ALLOWED_EMAIL_TO: 'subs@yourfamily.com' },
        undefined as unknown as ExecutionContext
      )
    ).resolves.toBeUndefined();
  });
});

describe('Worker scheduled() — nhánh đồng bộ Google Sheets', () => {
  it('bỏ qua đồng bộ Sheets khi thiếu cấu hình service account', async () => {
    const { d1 } = await createTestDatabase();
    const waitUntil = vi.fn((p: Promise<unknown>) => p);

    await worker.scheduled(
      { cron: '0 1 * * *', scheduledTime: Date.now() } as unknown as ScheduledEvent,
      { DB: d1, OPENAI_API_KEY: 'test-key', GOOGLE_SHEET_ID: 'sheet-1' }, // thiếu email + private key
      { waitUntil } as unknown as ExecutionContext
    );

    await waitUntil.mock.calls[0][0];
    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('nuốt lỗi đồng bộ Sheets để không làm hỏng cron (nhánh catch)', async () => {
    const { d1 } = await createTestDatabase();
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Không mock fetch -> lượt xin OAuth token sẽ thất bại và rơi vào .catch()
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new Error('network unreachable'));
    const waitUntil = vi.fn((p: Promise<unknown>) => p);

    await worker.scheduled(
      { cron: '0 1 * * *', scheduledTime: Date.now() } as unknown as ScheduledEvent,
      {
        DB: d1,
        OPENAI_API_KEY: 'test-key',
        GOOGLE_SHEET_ID: 'sheet-1',
        GOOGLE_SERVICE_ACCOUNT_EMAIL: 'svc@example.com',
        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:
          '-----BEGIN PRIVATE KEY-----\ndGVzdA==\n-----END PRIVATE KEY-----',
      },
      { waitUntil } as unknown as ExecutionContext
    );

    // Promise.all không được reject — lỗi Sheets đã bị .catch() nuốt
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeDefined();

    fetchSpy.mockRestore();
    consoleError.mockRestore();
  });

  it('dùng TelegramNotificationAdapter thay cho mock khi có TELEGRAM_BOT_TOKEN', async () => {
    const { d1 } = await createTestDatabase();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
    const waitUntil = vi.fn((p: Promise<unknown>) => p);

    await worker.scheduled(
      { cron: '0 1 * * *', scheduledTime: Date.now() } as unknown as ScheduledEvent,
      {
        DB: d1,
        OPENAI_API_KEY: 'test-key',
        TELEGRAM_BOT_TOKEN: 'bot-token',
        TELEGRAM_FAMILY_GROUP_CHAT_ID: 'group-1',
      },
      { waitUntil } as unknown as ExecutionContext
    );

    await expect(waitUntil.mock.calls[0][0]).resolves.toBeDefined();
    fetchSpy.mockRestore();
  });
});
