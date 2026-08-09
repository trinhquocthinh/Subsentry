import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';

vi.mock('./use-cases/process-email.use-case', () => ({
  ProcessEmailUseCase: class {
    async execute(input: { onAsyncWork?: (p: Promise<void>) => void }) {
      if (input.onAsyncWork) {
        input.onAsyncWork(Promise.resolve());
      }
      return { status: 'PROCESSED' };
    }
  },
}));

import { emailRouter } from './email.router';

describe('email.router.ts', () => {
  it('should collect onAsyncWork promises and pass them to ctx.waitUntil', async () => {
    const app = new Hono();
    app.route('/email', emailRouter);

    const waitUntilMock = vi.fn();
    const ctx = {
      waitUntil: waitUntilMock,
      passThroughOnException: vi.fn(),
    };

    const res = await app.fetch(
      new Request('http://localhost/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gmail-webhook-secret': 'test_secret',
        },
        body: JSON.stringify({
          subject: 'Test',
          text: 'Receipt text',
          from: 'sender@example.com',
          to: 'me@example.com',
        }),
      }),
      { DB: {}, GMAIL_WEBHOOK_SECRET: 'test_secret' },
      ctx
    );

    const text = await res.text();
    expect(res.status).toBe(200);
    expect(text).toContain('true');
    expect(waitUntilMock).toHaveBeenCalled();
  });
});
