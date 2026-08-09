import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import * as schema from '@/core/db/schema';
import { handleEmailEvent } from './email.handler';
import { ProcessEmailUseCase } from './use-cases/process-email.use-case';
import type {
  CloudflareForwardableEmailMessage,
  ParsedEmailPayload,
} from './domain/email-message.interface';
import type { IEmailParserAdapter } from './adapters/email-parser.adapter';
import type { SubscriptionExtraction } from '@/core/types/extraction';
import { BillingCycle, ParsingLogStatus } from '@/core/types/enums';

const migrationsFolder = path.resolve(__dirname, '../../../drizzle');

function createBetterSqliteD1Bridge(sqlite: InstanceType<typeof Database>): D1Database {
  return {
    prepare(query: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async all() {
              const stmt = sqlite.prepare(query);
              const results = stmt.all(...params);
              return { results, success: true, meta: {} };
            },
            async first(colName?: string) {
              const stmt = sqlite.prepare(query);
              const row = stmt.get(...params) as Record<string, unknown> | undefined;
              if (!row) return null;
              return colName ? row[colName] : row;
            },
            async run() {
              const stmt = sqlite.prepare(query);
              const info = stmt.run(...params);
              return {
                success: true,
                meta: { changes: info.changes, last_row_id: info.lastInsertRowid },
              };
            },
            async raw() {
              const stmt = sqlite.prepare(query);
              return stmt.raw().all(...params);
            },
          };
        },
      };
    },
    async batch(statements: unknown[]) {
      const results = [];
      for (const stmt of statements as Array<{ run: () => Promise<unknown> }>) {
        results.push(await stmt.run());
      }
      return results;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
}

function setupTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder });
  const mockD1 = createBetterSqliteD1Bridge(sqlite);
  return { db, mockD1 };
}

describe('Epic 8 — Cloudflare Email Routing Integration', () => {
  let db: ReturnType<typeof setupTestDb>['db'];
  let mockD1: D1Database;

  beforeEach(() => {
    const res = setupTestDb();
    db = res.db;
    mockD1 = res.mockD1;
  });

  function createMockMessage(
    from = 'forwarding-filter@gmail.com',
    to = 'subs@yourfamily.com'
  ): CloudflareForwardableEmailMessage & { setRejectCalled?: boolean; rejectedReason?: string } {
    const mockMessage = {
      from,
      to,
      headers: new Headers(),
      raw: new ArrayBuffer(0),
      rawSize: 0,
      setRejectCalled: false,
      rejectedReason: '',
      setReject(reason: string) {
        mockMessage.setRejectCalled = true;
        mockMessage.rejectedReason = reason;
      },
      async forward() {},
    };
    return mockMessage;
  }

  it('TC-8.1: Successful Email Processing & Subscription Creation (High Confidence)', async () => {
    // Seed member with email
    const [member] = await db
      .insert(schema.members)
      .values({
        displayName: 'Member Test',
        role: 'SUBSCRIBER',
        email: 'subs@yourfamily.com',
        telegramChatId: '12345678',
      })
      .returning();

    const mockExtraction: SubscriptionExtraction = {
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-09-02',
      isTrial: false,
      confidenceScore: 0.95,
      directKillLink: 'https://netflix.com/cancel',
    };

    const mockParserService = {
      parse: vi.fn().mockResolvedValue(mockExtraction),
    };

    const mockEmailAdapter: IEmailParserAdapter = {
      async parseRawEmail(): Promise<ParsedEmailPayload> {
        return {
          from: 'forwarding-filter@gmail.com',
          to: 'subs@yourfamily.com',
          subject: 'Fwd: Your Netflix Invoice - Subscription Renewal',
          text: 'Your Netflix Premium package has been renewed successfully on Aug 2, 2026. Amount: 260,000 VND.',
        };
      },
    };

    const mockTelegramClient = {
      sendMessage: vi.fn().mockResolvedValue({ message_id: 1 }),
      getFileAsDataUrl: vi.fn(),
      answerCallbackQuery: vi.fn(),
    };

    const msg = createMockMessage('forwarding-filter@gmail.com', 'subs@yourfamily.com');

    const result = await handleEmailEvent(
      msg,
      { DB: mockD1, ALLOWED_EMAIL_TO: 'subs@yourfamily.com' },
      {
        emailParserAdapterOverride: mockEmailAdapter,
        parserServiceOverride: mockParserService,
        telegramClientOverride: mockTelegramClient,
      }
    );

    expect(result.status).toBe('PROCESSED');
    expect(result.parseResult?.status).toBe('AUTO_SAVED');
    expect(result.parseResult?.extraction?.merchantName).toBe('Netflix');

    // Verify subscription created in DB
    const subs = await db.select().from(schema.subscriptions);
    expect(subs.length).toBe(1);
    expect(subs[0].merchantName).toBe('Netflix');
    expect(subs[0].amount).toBe(260000);
    expect(subs[0].subscriberId).toBe(member.id);

    // Verify parsing log recorded
    const logs = await db.select().from(schema.parsingLogs);
    expect(logs.length).toBe(1);
    expect(logs[0].source).toBe('EMAIL');
    expect(logs[0].status).toBe(ParsingLogStatus.SUCCESS);

    // Verify Telegram notification sent to subscriber
    expect(mockTelegramClient.sendMessage).toHaveBeenCalledWith(
      '12345678',
      expect.stringContaining('Netflix')
    );
  });

  it('TC-8.2: Address verification rejects email sent to unauthorized destination (Task 8.1.2)', async () => {
    const mockEmailAdapter: IEmailParserAdapter = {
      async parseRawEmail(): Promise<ParsedEmailPayload> {
        return {
          from: 'spammer@random.com',
          to: 'spam@unauthorized.com',
          subject: 'Spam Mail',
          text: 'Spam content',
        };
      },
    };

    const mockParserService = {
      parse: vi.fn(),
    };

    const msg = createMockMessage('spammer@random.com', 'spam@unauthorized.com');

    const result = await handleEmailEvent(
      msg,
      { DB: mockD1, ALLOWED_EMAIL_TO: 'subs@yourfamily.com' },
      {
        emailParserAdapterOverride: mockEmailAdapter,
        parserServiceOverride: mockParserService,
      }
    );

    expect(result.status).toBe('REJECTED');
    expect(msg.setRejectCalled).toBe(true);
    expect(msg.rejectedReason).toContain('not accepted');
    expect(mockParserService.parse).not.toHaveBeenCalled();
  });

  it('TC-8.3: Low Confidence Email parsing returns NEEDS_CONFIRMATION', async () => {
    const mockExtraction: SubscriptionExtraction = {
      merchantName: 'Unknown Merchant',
      amount: 150000,
      currency: 'VND',
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-15',
      isTrial: false,
      confidenceScore: 0.6,
    };

    const mockParserService = {
      parse: vi.fn().mockResolvedValue(mockExtraction),
    };

    const mockEmailAdapter: IEmailParserAdapter = {
      async parseRawEmail(): Promise<ParsedEmailPayload> {
        return {
          from: 'user@gmail.com',
          to: 'subs@yourfamily.com',
          subject: 'Invoice Receipt',
          text: 'Vague receipt text',
        };
      },
    };

    const msg = createMockMessage('user@gmail.com', 'subs@yourfamily.com');

    const result = await handleEmailEvent(
      msg,
      { DB: mockD1, ALLOWED_EMAIL_TO: 'subs@yourfamily.com' },
      {
        emailParserAdapterOverride: mockEmailAdapter,
        parserServiceOverride: mockParserService,
      }
    );

    expect(result.status).toBe('PROCESSED');
    expect(result.parseResult?.status).toBe('NEEDS_CONFIRMATION');

    // Verify DB does not contain auto-saved subscription
    const subs = await db.select().from(schema.subscriptions);
    expect(subs.length).toBe(0);

    // Verify parsing log status is LOW_CONFIDENCE
    const logs = await db.select().from(schema.parsingLogs);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(ParsingLogStatus.LOW_CONFIDENCE);
  });

  it('TC-8.4: Graceful handling of Parser service failures (AI Outage Fallback)', async () => {
    const mockParserService = {
      parse: vi.fn().mockRejectedValue(new Error('OpenAI API Rate Limit')),
    };

    const mockEmailAdapter: IEmailParserAdapter = {
      async parseRawEmail(): Promise<ParsedEmailPayload> {
        return {
          from: 'user@gmail.com',
          to: 'subs@yourfamily.com',
          subject: 'Receipt Subject',
          text: 'Receipt Content',
        };
      },
    };

    const msg = createMockMessage('user@gmail.com', 'subs@yourfamily.com');

    const result = await handleEmailEvent(
      msg,
      { DB: mockD1, ALLOWED_EMAIL_TO: 'subs@yourfamily.com' },
      {
        emailParserAdapterOverride: mockEmailAdapter,
        parserServiceOverride: mockParserService,
      }
    );

    expect(result.status).toBe('PROCESSED');
    expect(result.parseResult?.status).toBe('FAILED');

    // Verify log created with FAILED status
    const logs = await db.select().from(schema.parsingLogs);
    expect(logs.length).toBe(1);
    expect(logs[0].status).toBe(ParsingLogStatus.FAILED);
  });

  it('TC-8.5: HTML Email body fallback stripping HTML tags', async () => {
    const mockEmailAdapter: IEmailParserAdapter = {
      async parseRawEmail(): Promise<ParsedEmailPayload> {
        return {
          from: 'user@gmail.com',
          to: 'subs@yourfamily.com',
          subject: 'Spotify Premium Invoice',
          html: '<html><body><h1>Spotify Receipt</h1><p>Amount: 59,000 VND</p></body></html>',
        };
      },
    };

    const msg = createMockMessage('user@gmail.com', 'subs@yourfamily.com');

    const mockParseReceiptUseCase = {
      execute: vi.fn().mockResolvedValue({ status: 'AUTO_SAVED' }),
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const useCase = new ProcessEmailUseCase(mockEmailAdapter, mockParseReceiptUseCase as any, db);

    const res = await useCase.execute({
      message: msg,
      allowedToAddress: 'subs@yourfamily.com',
    });

    expect(res.status).toBe('PROCESSED');
    expect(mockParseReceiptUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Spotify Receipt Amount: 59,000 VND'),
      })
    );
  });

  describe('Google Apps Script HTTP Webhook Endpoint (POST /webhook/email)', () => {
    it('TC-8.6: POST /webhook/email with valid secret & payload processes successfully', async () => {
      const mockExtraction: SubscriptionExtraction = {
        merchantName: 'Canva',
        amount: 250000,
        currency: 'VND',
        billingCycle: BillingCycle.MONTHLY,
        nextBillingDate: '2026-09-10',
        isTrial: false,
        confidenceScore: 0.9,
      };

      const mockParserService = {
        parse: vi.fn().mockResolvedValue(mockExtraction),
      };

      const { emailRouter } = await import('./email.router');

      const req = new Request('http://localhost/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gmail-Webhook-Secret': 'my-secret-123',
        },
        body: JSON.stringify({
          from: 'member@gmail.com',
          to: 'myfamily@gmail.com',
          subject: 'Fwd: Canva Invoice',
          text: 'Thank you for your payment of 250,000 VND for Canva Pro',
        }),
      });

      const env = {
        DB: mockD1,
        GMAIL_WEBHOOK_SECRET: 'my-secret-123',
      };

      // Mock dependencies in router
      const app = emailRouter;
      const res = await app.fetch(req, env, {
        parserServiceOverride: mockParserService,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      expect(res.status).toBe(200);
      const json = (await res.json()) as { success: boolean; result: { status: string } };
      expect(json.success).toBe(true);
      expect(json.result.status).toBe('PROCESSED');
    });

    it('TC-8.7: POST /webhook/email with invalid secret returns 401 Unauthorized', async () => {
      const { emailRouter } = await import('./email.router');

      const req = new Request('http://localhost/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gmail-Webhook-Secret': 'wrong-secret',
        },
        body: JSON.stringify({
          from: 'hacker@gmail.com',
          subject: 'Fake Invoice',
          text: 'Fake text',
        }),
      });

      const env = {
        DB: mockD1,
        GMAIL_WEBHOOK_SECRET: 'correct-secret',
      };

      const res = await emailRouter.fetch(req, env);

      expect(res.status).toBe(401);
      const json = (await res.json()) as { success: boolean; error: { code: string } };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('TC-8.8: POST /webhook/email when GMAIL_WEBHOOK_SECRET is unconfigured returns 500 Fail-Closed', async () => {
      const { emailRouter } = await import('./email.router');

      const req = new Request('http://localhost/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gmail-Webhook-Secret': 'some-secret',
        },
        body: JSON.stringify({
          from: 'someone@gmail.com',
          subject: 'Invoice',
          text: 'Body text',
        }),
      });

      const env = {
        DB: mockD1,
        // GMAIL_WEBHOOK_SECRET is deliberately omitted / undefined
      };

      const res = await emailRouter.fetch(req, env);

      expect(res.status).toBe(500);
      const json = (await res.json()) as { success: boolean; error: { code: string } };
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('SERVER_MISCONFIGURED');
    });
  });
});
