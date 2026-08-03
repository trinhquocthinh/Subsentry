import { MiddlewareHandler } from 'hono';

const SENSITIVE_KEYS = [
  'authorization',
  'token',
  'secret',
  'api_key',
  'apikey',
  'password',
  'pan',
  'cvv',
  'card_number',
  'last_four',
];

/**
 * Mặt nạ hóa dữ liệu nhạy cảm từ Query string hoặc Payload
 */
export const sanitizeUrl = (urlString: string): string => {
  try {
    const url = new URL(urlString);
    url.searchParams.forEach((_, key) => {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
        url.searchParams.set(key, '[REDACTED]');
      }
    });
    return `${url.pathname}${url.search}`;
  } catch {
    return urlString;
  }
};

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const { method, url } = c.req;
  const cleanUrl = sanitizeUrl(url);

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  // eslint-disable-next-line no-console
  console.log(`[HTTP] ${method} ${cleanUrl} - ${status} (${duration}ms)`);
};
