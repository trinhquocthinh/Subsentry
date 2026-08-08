import type { Context, Next } from 'hono';

/**
 * Perform constant-time string comparison to prevent timing attacks.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Hono Middleware for Telegram Webhook secret token verification (sdd.md §4.2).
 */
export async function telegramSignatureMiddleware(c: Context, next: Next) {
  const secret = c.env?.TELEGRAM_WEBHOOK_SECRET as string | undefined;

  // If secret is not configured in environment, deny for security
  if (!secret) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Missing TELEGRAM_WEBHOOK_SECRET in server environment',
        },
      },
      401
    );
  }

  const headerToken = c.req.header('X-Telegram-Bot-Api-Secret-Token');
  const rawBody = await c.req.text();

  if (!headerToken || !timingSafeEqual(headerToken, secret)) {
    return c.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid X-Telegram-Bot-Api-Secret-Token header',
        },
      },
      401
    );
  }

  // Store rawBody in c.var để tránh đọc lại req.text() đã bị consume
  c.set('rawBody', rawBody);
  await next();
}
