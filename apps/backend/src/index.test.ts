import { describe, expect, it } from 'vitest';
import app from './index';

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

    const res = await app.request('/health-check', {}, { DB: mockD1 });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { database: string };
    expect(body.database).toBe('connected');
  });

  it('Lỗi 404 phải trả về JSON đúng chuẩn hệ thống', async () => {
    const res = await app.request('/non-existent-route');
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
});
