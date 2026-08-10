import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { rateLimiter, type RateLimiterBinding } from './rate-limit.middleware';

function buildApp(binding?: RateLimiterBinding) {
  const app = new Hono<{ Bindings: { RATE_LIMITER_WEBHOOK?: RateLimiterBinding } }>();
  app.use('*', rateLimiter('RATE_LIMITER_WEBHOOK'));
  app.get('/ping', (c) => c.json({ ok: true }));

  const env = binding ? { RATE_LIMITER_WEBHOOK: binding } : {};
  return { app, env };
}

describe('Task 12.2 — Rate Limit Middleware', () => {
  it('cho phép request đi qua khi limiter trả success:true', async () => {
    const limitFn = vi.fn().mockResolvedValue({ success: true });
    const { app, env } = buildApp({ limit: limitFn });

    const res = await app.request('/ping', {}, env);

    expect(res.status).toBe(200);
    expect(limitFn).toHaveBeenCalledTimes(1);
  });

  it('trả 429 với code RATE_LIMITED khi limiter trả success:false', async () => {
    const limitFn = vi.fn().mockResolvedValue({ success: false });
    const { app, env } = buildApp({ limit: limitFn });

    const res = await app.request('/ping', {}, env);
    const body = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(429);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
  });

  it('fail-open (request đi tiếp) khi binding chưa được cấu hình', async () => {
    const { app, env } = buildApp(undefined);

    const res = await app.request('/ping', {}, env);

    expect(res.status).toBe(200);
  });

  it('dùng IP từ cf-connecting-ip trong key gọi limit()', async () => {
    const limitFn = vi.fn().mockResolvedValue({ success: true });
    const { app, env } = buildApp({ limit: limitFn });

    await app.request('/ping', { headers: { 'cf-connecting-ip': '1.2.3.4' } }, env);

    expect(limitFn).toHaveBeenCalledWith({ key: 'RATE_LIMITER_WEBHOOK:1.2.3.4' });
  });

  it('fallback sang x-forwarded-for khi thiếu cf-connecting-ip', async () => {
    const limitFn = vi.fn().mockResolvedValue({ success: true });
    const { app, env } = buildApp({ limit: limitFn });

    await app.request('/ping', { headers: { 'x-forwarded-for': '5.6.7.8, 9.9.9.9' } }, env);

    expect(limitFn).toHaveBeenCalledWith({ key: 'RATE_LIMITER_WEBHOOK:5.6.7.8' });
  });

  it('fallback sang unknown-ip khi thiếu cả 2 header', async () => {
    const limitFn = vi.fn().mockResolvedValue({ success: true });
    const { app, env } = buildApp({ limit: limitFn });

    await app.request('/ping', {}, env);

    expect(limitFn).toHaveBeenCalledWith({ key: 'RATE_LIMITER_WEBHOOK:unknown-ip' });
  });
});
