import { describe, expect, it, vi } from 'vitest';
import worker from './index';

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

  it('scheduled() handler thực thi cron retry thành công', async () => {
    const mockD1 = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };

    const mockCtx = {
      waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    } as unknown as ExecutionContext;

    const mockEvent = {
      cron: '0 1 * * *',
      scheduledTime: Date.now(),
    } as unknown as ScheduledEvent;

    const env = {
      DB: mockD1 as unknown as D1Database,
      OPENAI_API_KEY: 'test-key',
    };

    await expect(worker.scheduled(mockEvent, env, mockCtx)).resolves.not.toThrow();
    expect(mockCtx.waitUntil).toHaveBeenCalled();
  });
});
