import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminRouter } from './admin.router';
import { SyncSheetsToD1UseCase } from '../sheets/use-cases/sync-sheets-to-d1.use-case';
import { TelegramClientAdapter } from '../telegram/adapters/telegram-client.adapter';

interface AdminApiResponse {
  success: boolean;
  message?: string;
  result?: {
    scanned: number;
    updated: number;
    skipped: number;
    errors: number;
    backfilled: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

// Mock the dependencies
const mockExecute = vi.fn();
vi.mock('../sheets/use-cases/sync-sheets-to-d1.use-case', () => {
  return {
    SyncSheetsToD1UseCase: vi.fn().mockImplementation(function () {
      return {
        execute: mockExecute,
      };
    }),
  };
});

const mockSendMessage = vi.fn().mockResolvedValue(true);
vi.mock('../telegram/adapters/telegram-client.adapter', () => {
  return {
    TelegramClientAdapter: vi.fn().mockImplementation(function () {
      return {
        sendMessage: mockSendMessage,
      };
    }),
  };
});

describe('Admin Router', () => {
  let mockEnv: Record<string, unknown>;
  let mockCtx: ExecutionContext & { waitUntil: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({
      scanned: 10,
      updated: 2,
      skipped: 8,
      errors: 0,
      backfilled: 1,
    });
    mockSendMessage.mockResolvedValue(true);

    mockEnv = {
      ADMIN_API_TOKEN: 'secret_admin_token',
      GOOGLE_SHEET_ID: 'test_sheet_id',
      GOOGLE_SERVICE_ACCOUNT_EMAIL: 'test@gserviceaccount.com',
      GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: 'test_key',
      TELEGRAM_BOT_TOKEN: 'test_bot_token',
      TELEGRAM_FAMILY_GROUP_CHAT_ID: 'test_group_id',
      DB: {},
    };
    mockCtx = {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn(),
      props: {},
    } as unknown as ExecutionContext & { waitUntil: ReturnType<typeof vi.fn> };
  });

  const makeRequest = async (token?: string, overrideEnv: Record<string, unknown> = {}) => {
    const req = new Request('http://localhost/reconcile-sync', {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'cf-connecting-ip': '203.0.113.195',
      },
    });
    return adminRouter.fetch(req, { ...mockEnv, ...overrideEnv }, mockCtx);
  };

  it('should return 500 if ADMIN_API_TOKEN is not configured', async () => {
    const res = await makeRequest('any_token', { ADMIN_API_TOKEN: undefined });
    expect(res.status).toBe(500);
    const body = (await res.json()) as AdminApiResponse;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('SERVER_MISCONFIGURED');
  });

  it('should return 401 if Authorization header is missing', async () => {
    const res = await makeRequest();
    expect(res.status).toBe(401);
    const body = (await res.json()) as AdminApiResponse;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  it('should return 401 if Authorization token is incorrect', async () => {
    const res = await makeRequest('wrong_token');
    expect(res.status).toBe(401);
    const body = (await res.json()) as AdminApiResponse;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 if Google Sheets integration is not configured', async () => {
    const res = await makeRequest('secret_admin_token', { GOOGLE_SHEET_ID: undefined });
    expect(res.status).toBe(400);
    const body = (await res.json()) as AdminApiResponse;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('BAD_REQUEST');
  });

  it('should return 200 and trigger sync logic if token is correct', async () => {
    const res = await makeRequest('secret_admin_token');
    expect(res.status).toBe(200);

    const body = (await res.json()) as AdminApiResponse;
    expect(body.success).toBe(true);
    expect(body.result?.scanned).toBe(10);

    expect(SyncSheetsToD1UseCase).toHaveBeenCalled();
    expect(mockCtx.waitUntil).toHaveBeenCalled();
  });

  // Improvement #3: Test 500 internal error handling (OWASP A05 - sanitized response)
  it('should return 500 with sanitized message when reconciliation logic throws internal error', async () => {
    mockExecute.mockRejectedValueOnce(new Error('Sensitive D1/SQL connection error'));

    const res = await makeRequest('secret_admin_token');
    expect(res.status).toBe(500);

    const body = (await res.json()) as AdminApiResponse;
    expect(body.success).toBe(false);
    expect(body.error?.code).toBe('INTERNAL_SERVER_ERROR');
    // Ensure sensitive internal message is NOT exposed to client
    expect(body.error?.message).toBe('Reconciliation sync failed, please check server logs');
    expect(body.error?.message).not.toContain('Sensitive D1/SQL');
  });

  // Improvement #4: Test behavior when Telegram bot token is missing
  it('should return 200 OK even when Telegram configuration is missing', async () => {
    const res = await makeRequest('secret_admin_token', {
      TELEGRAM_BOT_TOKEN: undefined,
      TELEGRAM_FAMILY_GROUP_CHAT_ID: undefined,
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as AdminApiResponse;
    expect(body.success).toBe(true);
    expect(TelegramClientAdapter).not.toHaveBeenCalled();
  });
});
