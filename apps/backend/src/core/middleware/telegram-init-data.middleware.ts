import { eq } from 'drizzle-orm';
import type { Context, Next } from 'hono';
import type { Bindings } from '../../index';
import { createDbClient } from '../db';
import { members } from '../db/schema';

/**
 * Telegram Mini App initData validation middleware.
 *
 * NOTE: This is DISTINCT from `telegramSignatureMiddleware`.
 * - `telegramSignatureMiddleware` is used for incoming Webhooks from Telegram Server (verified via bot secret token).
 * - `telegramInitDataAuth` is used for the frontend Mini App (verified via HMAC-SHA256 of initData).
 *
 * Validates the `initData` string sent by the Telegram Web App SDK
 * using HMAC-SHA256 per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Flow:
 * 1. Extract initData from header `X-Telegram-Init-Data`
 * 2. Parse initData as URLSearchParams
 * 3. Compute HMAC-SHA256(data_check_string, secret_key) where
 *    secret_key = HMAC-SHA256("WebAppData", bot_token)
 * 4. Compare computed hash with `hash` param from initData
 * 5. Optionally validate auth_date freshness (< 1 hour)
 * 6. Set user info on context for downstream handlers
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramInitDataPayload {
  user: TelegramUser;
  authDate: number;
  hash: string;
  queryId?: string;
}

// Maximum age of initData in seconds (1 hour)
const MAX_AUTH_AGE_SECONDS = 3600;

/**
 * Compute HMAC-SHA256 using Web Crypto API (Cloudflare Workers compatible).
 */
async function hmacSHA256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    key as any,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

/**
 * Convert ArrayBuffer to hex string.
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate Telegram Web App initData.
 * Returns parsed payload if valid, null if invalid.
 */
export async function validateInitData(
  initData: string,
  botToken: string
): Promise<TelegramInitDataPayload | null> {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');

    if (!hash) return null;

    // Build data_check_string: sort all params except "hash" alphabetically,
    // format as "key=value" lines joined by "\n"
    const checkParams: string[] = [];
    params.forEach((value, key) => {
      if (key !== 'hash') {
        checkParams.push(`${key}=${value}`);
      }
    });
    checkParams.sort();
    const dataCheckString = checkParams.join('\n');

    // secret_key = HMAC-SHA256("WebAppData", bot_token)
    const secretKey = await hmacSHA256(new TextEncoder().encode('WebAppData'), botToken);

    // computed_hash = HMAC-SHA256(data_check_string, secret_key)
    const computedHash = await hmacSHA256(secretKey, dataCheckString);
    const computedHex = bufferToHex(computedHash);

    // Constant-time comparison
    if (computedHex.length !== hash.length) return null;
    let mismatch = 0;
    for (let i = 0; i < computedHex.length; i++) {
      mismatch |= computedHex.charCodeAt(i) ^ hash.charCodeAt(i);
    }
    if (mismatch !== 0) return null;

    // Parse user JSON
    const userStr = params.get('user');
    if (!userStr) return null;

    const user: TelegramUser = JSON.parse(userStr);
    const authDate = parseInt(params.get('auth_date') || '0', 10);

    // Validate auth_date freshness
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > MAX_AUTH_AGE_SECONDS) return null;

    return {
      user,
      authDate,
      hash,
      queryId: params.get('query_id') || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Hono middleware for Telegram Mini App authentication.
 *
 * Reads `X-Telegram-Init-Data` header, validates HMAC signature,
 * and attaches user info to context via `c.set('telegramUser', ...)`.
 */
export interface TelegramVariables {
  telegramUser: TelegramUser;
  familyMember: typeof members.$inferSelect;
}

export function telegramInitDataAuth() {
  return async (c: Context<{ Bindings: Bindings; Variables: TelegramVariables }>, next: Next) => {
    const botToken = c.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      return c.json(
        {
          success: false,
          error: { code: 'SERVER_MISCONFIGURED', message: 'Bot token not configured' },
        },
        500
      );
    }

    const initData = c.req.header('X-Telegram-Init-Data');

    if (!initData) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Missing Telegram initData' },
        },
        401
      );
    }

    // Support local development bypass
    if (initData === 'mock-dev-data') {
      const host = c.req.header('host');
      // Only allow mock data if running locally
      if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
        const db = createDbClient(c.env.DB);
        const firstMemberQuery = await db.select().from(members).limit(1);
        if (!firstMemberQuery || firstMemberQuery.length === 0) {
          return c.json(
            {
              success: false,
              error: { code: 'FORBIDDEN', message: 'No family members exist for local dev' },
            },
            403
          );
        }
        c.set('telegramUser', {
          id: parseInt(firstMemberQuery[0].telegramChatId || '0', 10),
          first_name: 'Dev',
        });
        c.set('familyMember', firstMemberQuery[0]);
        return next();
      }
    }

    const payload = await validateInitData(initData, botToken);

    if (!payload) {
      return c.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid or expired Telegram initData' },
        },
        401
      );
    }

    // Verify user is a registered family member
    const db = createDbClient(c.env.DB);
    const familyMemberQuery = await db
      .select()
      .from(members)
      .where(eq(members.telegramChatId, payload.user.id.toString()));

    if (!familyMemberQuery || familyMemberQuery.length === 0) {
      // Bootstrap: if the members table is completely empty, auto-register this user as ADMIN
      const anyMembers = await db.select().from(members).limit(1);
      if (!anyMembers || anyMembers.length === 0) {
        const [newMember] = await db
          .insert(members)
          .values({
            telegramChatId: payload.user.id.toString(),
            displayName:
              payload.user.first_name +
              (payload.user.last_name ? ` ${payload.user.last_name}` : ''),
            role: 'ADMIN',
          })
          .returning();
        c.set('telegramUser', payload.user);
        c.set('familyMember', newMember);
        return next();
      }

      return c.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'User is not a registered family member' },
        },
        403
      );
    }

    // Store validated user and member data for downstream handlers
    c.set('telegramUser', payload.user);
    c.set('familyMember', familyMemberQuery[0]);

    return next();
  };
}
