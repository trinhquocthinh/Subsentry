import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../../index';
import { members } from '../db/schema';
import { createTestDatabase } from '../../test/d1-test-bridge';
import {
  validateInitData,
  telegramInitDataAuth,
  type TelegramVariables,
} from './telegram-init-data.middleware';

const BOT_TOKEN = 'test-bot-token:AAH0000';

/**
 * Build a genuinely signed initData string the same way the Telegram Web App
 * SDK does, so the middleware's real HMAC path is exercised (not stubbed).
 */
async function signInitData(params: Record<string, string>, botToken = BOT_TOKEN): Promise<string> {
  const dataCheckString = Object.entries(params)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const hmac = async (key: ArrayBuffer | Uint8Array, data: string) => {
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
  };

  const secretKey = await hmac(new TextEncoder().encode('WebAppData'), botToken);
  const hash = [...new Uint8Array(await hmac(secretKey, dataCheckString))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const search = new URLSearchParams(params);
  search.set('hash', hash);
  return search.toString();
}

function freshAuthDate() {
  return Math.floor(Date.now() / 1000).toString();
}

const TEST_USER = { id: 224466, first_name: 'Con Cả' };

describe('validateInitData — HMAC-SHA256 (Telegram Mini App)', () => {
  it('trả payload hợp lệ khi chữ ký và auth_date đều đúng', async () => {
    const initData = await signInitData({
      user: JSON.stringify(TEST_USER),
      auth_date: freshAuthDate(),
      query_id: 'AAH-query-1',
    });

    const payload = await validateInitData(initData, BOT_TOKEN);

    expect(payload).not.toBeNull();
    expect(payload?.user.id).toBe(TEST_USER.id);
    expect(payload?.user.first_name).toBe('Con Cả');
    expect(payload?.queryId).toBe('AAH-query-1');
  });

  it('trả queryId undefined khi initData không có query_id', async () => {
    const initData = await signInitData({
      user: JSON.stringify(TEST_USER),
      auth_date: freshAuthDate(),
    });

    const payload = await validateInitData(initData, BOT_TOKEN);

    expect(payload?.queryId).toBeUndefined();
  });

  it('trả null khi thiếu tham số hash', async () => {
    const initData = new URLSearchParams({
      user: JSON.stringify(TEST_USER),
      auth_date: freshAuthDate(),
    }).toString();

    expect(await validateInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it('trả null khi hash sai độ dài (chặn sớm trước so sánh)', async () => {
    const initData = new URLSearchParams({
      user: JSON.stringify(TEST_USER),
      auth_date: freshAuthDate(),
      hash: 'deadbeef',
    }).toString();

    expect(await validateInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it('trả null khi hash đúng độ dài nhưng sai giá trị', async () => {
    const signed = await signInitData({
      user: JSON.stringify(TEST_USER),
      auth_date: freshAuthDate(),
    });
    const params = new URLSearchParams(signed);
    const tampered = params.get('hash')!.replace(/^./, (ch) => (ch === 'a' ? 'b' : 'a'));
    params.set('hash', tampered);

    expect(await validateInitData(params.toString(), BOT_TOKEN)).toBeNull();
  });

  it('trả null khi initData bị sửa nội dung sau khi ký (chống giả mạo)', async () => {
    const signed = await signInitData({
      user: JSON.stringify(TEST_USER),
      auth_date: freshAuthDate(),
    });
    const params = new URLSearchParams(signed);
    params.set('user', JSON.stringify({ id: 999999, first_name: 'Kẻ Giả Mạo' }));

    expect(await validateInitData(params.toString(), BOT_TOKEN)).toBeNull();
  });

  it('trả null khi ký bằng bot token khác', async () => {
    const initData = await signInitData(
      { user: JSON.stringify(TEST_USER), auth_date: freshAuthDate() },
      'another-bot-token'
    );

    expect(await validateInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it('trả null khi thiếu tham số user dù chữ ký hợp lệ', async () => {
    const initData = await signInitData({ auth_date: freshAuthDate() });

    expect(await validateInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it('trả null khi user JSON hỏng (nhánh catch)', async () => {
    const initData = await signInitData({
      user: 'không-phải-json',
      auth_date: freshAuthDate(),
    });

    expect(await validateInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it('trả null khi auth_date quá 1 giờ (hết hạn)', async () => {
    const stale = (Math.floor(Date.now() / 1000) - 3601).toString();
    const initData = await signInitData({
      user: JSON.stringify(TEST_USER),
      auth_date: stale,
    });

    expect(await validateInitData(initData, BOT_TOKEN)).toBeNull();
  });

  it('trả null khi thiếu auth_date (mặc định 0 → quá hạn)', async () => {
    const initData = await signInitData({ user: JSON.stringify(TEST_USER) });

    expect(await validateInitData(initData, BOT_TOKEN)).toBeNull();
  });
});

describe('telegramInitDataAuth — Hono middleware', () => {
  let sqlite: Awaited<ReturnType<typeof createTestDatabase>>['sqlite'];
  let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
  let d1: D1Database;
  let app: Hono<{ Bindings: Bindings; Variables: TelegramVariables }>;

  beforeEach(async () => {
    ({ sqlite, db, d1 } = await createTestDatabase());

    app = new Hono<{ Bindings: Bindings; Variables: TelegramVariables }>();
    app.use('*', telegramInitDataAuth());
    app.get('/me', (c) =>
      c.json({
        success: true,
        user: c.get('telegramUser'),
        member: c.get('familyMember'),
      })
    );
  });

  afterEach(() => sqlite.close());

  const env = (overrides: Record<string, unknown> = {}) =>
    ({ DB: d1, TELEGRAM_BOT_TOKEN: BOT_TOKEN, ...overrides }) as unknown as Bindings;

  it('trả 500 SERVER_MISCONFIGURED khi thiếu TELEGRAM_BOT_TOKEN', async () => {
    const res = await app.request('/me', {}, { DB: d1 } as unknown as Bindings);
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(500);
    expect(body.error.code).toBe('SERVER_MISCONFIGURED');
  });

  it('trả 401 UNAUTHORIZED khi thiếu header X-Telegram-Init-Data', async () => {
    const res = await app.request('/me', {}, env());
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('trả 401 khi initData có chữ ký không hợp lệ', async () => {
    const res = await app.request(
      '/me',
      { headers: { 'X-Telegram-Init-Data': 'user=%7B%7D&auth_date=1&hash=bad' } },
      env()
    );
    const body = (await res.json()) as { error: { message: string } };

    expect(res.status).toBe(401);
    expect(body.error.message).toContain('Invalid or expired');
  });

  it('cho qua và gắn familyMember khi user đã là thành viên', async () => {
    await db.insert(members).values({
      id: 1,
      displayName: 'Con Cả',
      role: 'SUBSCRIBER',
      telegramChatId: String(TEST_USER.id),
    });

    const initData = await signInitData({
      user: JSON.stringify(TEST_USER),
      auth_date: freshAuthDate(),
    });

    const res = await app.request('/me', { headers: { 'X-Telegram-Init-Data': initData } }, env());
    const body = (await res.json()) as {
      user: { id: number };
      member: { displayName: string; role: string };
    };

    expect(res.status).toBe(200);
    expect(body.user.id).toBe(TEST_USER.id);
    expect(body.member.displayName).toBe('Con Cả');
    expect(body.member.role).toBe('SUBSCRIBER');
  });

  it('bootstrap: tự đăng ký ADMIN đầu tiên khi bảng members trống', async () => {
    const initData = await signInitData({
      user: JSON.stringify({ id: 777, first_name: 'Bố', last_name: 'Trưởng' }),
      auth_date: freshAuthDate(),
    });

    const res = await app.request('/me', { headers: { 'X-Telegram-Init-Data': initData } }, env());
    const body = (await res.json()) as { member: { displayName: string; role: string } };

    expect(res.status).toBe(200);
    expect(body.member.role).toBe('ADMIN');
    expect(body.member.displayName).toBe('Bố Trưởng');

    const stored = await db.select().from(members);
    expect(stored).toHaveLength(1);
    expect(stored[0].telegramChatId).toBe('777');
  });

  it('bootstrap: bỏ qua last_name khi user không có last_name', async () => {
    const initData = await signInitData({
      user: JSON.stringify({ id: 888, first_name: 'Mẹ' }),
      auth_date: freshAuthDate(),
    });

    const res = await app.request('/me', { headers: { 'X-Telegram-Init-Data': initData } }, env());
    const body = (await res.json()) as { member: { displayName: string } };

    expect(body.member.displayName).toBe('Mẹ');
  });

  it('trả 403 FORBIDDEN khi đã có thành viên khác nhưng user chưa đăng ký', async () => {
    await db.insert(members).values({
      id: 1,
      displayName: 'Người Khác',
      role: 'ADMIN',
      telegramChatId: '111111',
    });

    const initData = await signInitData({
      user: JSON.stringify({ id: 222222, first_name: 'Người Lạ' }),
      auth_date: freshAuthDate(),
    });

    const res = await app.request('/me', { headers: { 'X-Telegram-Init-Data': initData } }, env());
    const body = (await res.json()) as { error: { code: string } };

    expect(res.status).toBe(403);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  describe('bypass mock-dev-data cho môi trường local', () => {
    it('cho qua với thành viên đầu tiên khi host là localhost', async () => {
      await db.insert(members).values({
        id: 1,
        displayName: 'Dev Member',
        role: 'ADMIN',
        telegramChatId: '4242',
      });

      const res = await app.request(
        '/me',
        { headers: { 'X-Telegram-Init-Data': 'mock-dev-data', host: 'localhost:8787' } },
        env()
      );
      const body = (await res.json()) as {
        user: { id: number; first_name: string };
        member: { displayName: string };
      };

      expect(res.status).toBe(200);
      expect(body.user.first_name).toBe('Dev');
      expect(body.user.id).toBe(4242);
      expect(body.member.displayName).toBe('Dev Member');
    });

    it('cho qua khi host là 127.0.0.1', async () => {
      await db.insert(members).values({
        id: 1,
        displayName: 'Dev Member',
        role: 'ADMIN',
        telegramChatId: '4242',
      });

      const res = await app.request(
        '/me',
        { headers: { 'X-Telegram-Init-Data': 'mock-dev-data', host: '127.0.0.1:8787' } },
        env()
      );

      expect(res.status).toBe(200);
    });

    it('trả 403 khi local nhưng chưa có thành viên nào', async () => {
      const res = await app.request(
        '/me',
        { headers: { 'X-Telegram-Init-Data': 'mock-dev-data', host: 'localhost:8787' } },
        env()
      );
      const body = (await res.json()) as { error: { code: string; message: string } };

      expect(res.status).toBe(403);
      expect(body.error.message).toContain('local dev');
    });

    it('id = 0 khi thành viên dev chưa có telegramChatId', async () => {
      await db.insert(members).values({ id: 1, displayName: 'No Chat', role: 'ADMIN' });

      const res = await app.request(
        '/me',
        { headers: { 'X-Telegram-Init-Data': 'mock-dev-data', host: 'localhost' } },
        env()
      );
      const body = (await res.json()) as { user: { id: number } };

      expect(body.user.id).toBe(0);
    });

    it('KHÔNG bypass khi host là production (rơi xuống xác thực HMAC → 401)', async () => {
      const res = await app.request(
        '/me',
        { headers: { 'X-Telegram-Init-Data': 'mock-dev-data', host: 'subsentry.example.com' } },
        env()
      );

      expect(res.status).toBe(401);
    });
  });
});
