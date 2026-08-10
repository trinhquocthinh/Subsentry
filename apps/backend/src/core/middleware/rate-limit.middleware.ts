import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '../../index';

export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

type RateLimiterBindingKey = 'RATE_LIMITER_WEBHOOK' | 'RATE_LIMITER_ADMIN';

function getClientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown-ip'
  );
}

/**
 * Task 12.2: Rate limiting cơ bản dựa trên Cloudflare Workers Rate Limiting binding.
 * Fail-open nếu binding chưa được cấu hình vì đây là lớp phòng thủ bổ sung,
 * không thay thế cơ chế xác thực chữ ký/token vốn đã fail-closed.
 */
export function rateLimiter(bindingKey: RateLimiterBindingKey): MiddlewareHandler<{
  Bindings: Bindings;
}> {
  return async (c, next) => {
    const limiter = c.env[bindingKey] as RateLimiterBinding | undefined;

    if (!limiter) {
      // eslint-disable-next-line no-console
      console.warn(`[RATE_LIMIT] Binding "${bindingKey}" chưa được cấu hình — fail-open`);
      return next();
    }

    const ip = getClientIp(c);
    const { success } = await limiter.limit({ key: `${bindingKey}:${ip}` });

    if (!success) {
      // eslint-disable-next-line no-console
      console.warn(
        `[RATE_LIMIT] Blocked | Binding: ${bindingKey} | IP: ${ip} | ${c.req.method} ${c.req.path}`
      );
      return c.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later',
          },
        },
        429
      );
    }

    return next();
  };
}
