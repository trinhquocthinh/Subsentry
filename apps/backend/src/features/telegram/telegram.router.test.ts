import { describe, expect, it, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import worker from '@/index';
import { createTestDatabase } from '@/test/d1-test-bridge';
import { processTelegramUpdate } from './telegram.router';
import { members, subscriptions, alerts } from '@/core/db/schema';
import {
  TelegramClientAdapter,
  TelegramNotificationAdapter,
} from './adapters/telegram-client.adapter';
import type { SubscriptionExtraction } from '@/core/types/extraction';
import type { TelegramUpdate } from './domain/telegram-payload.interface';

const TELEGRAM_SECRET = 'test_telegram_webhook_secret_123';

describe('Epic 7 — Telegram Bot Integration Tests', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
  let mockD1: D1Database;

  beforeEach(async () => {
    const testDb = await createTestDatabase();
    testDb.sqlite.pragma('foreign_keys = ON');
    db = testDb.db;
    mockD1 = testDb.d1;
  });

  describe('Task 7.2 — Xác thực X-Telegram-Bot-Api-Secret-Token', () => {
    it('Trả về 401 nếu không có header secret token', async () => {
      const res = await worker.fetch(
        new Request('http://localhost/webhook/telegram', {
          method: 'POST',
          body: JSON.stringify({ update_id: 1 }),
        }),
        { DB: mockD1, TELEGRAM_WEBHOOK_SECRET: TELEGRAM_SECRET }
      );

      expect(res.status).toBe(401);
      const json = (await res.json()) as { error: { code: string } };
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('Trả về 401 nếu header secret token sai', async () => {
      const res = await worker.fetch(
        new Request('http://localhost/webhook/telegram', {
          method: 'POST',
          headers: { 'X-Telegram-Bot-Api-Secret-Token': 'wrong_secret' },
          body: JSON.stringify({ update_id: 1 }),
        }),
        { DB: mockD1, TELEGRAM_WEBHOOK_SECRET: TELEGRAM_SECRET }
      );

      expect(res.status).toBe(401);
    });

    it('Trả về 200 OK nếu header secret token chính xác', async () => {
      const res = await worker.fetch(
        new Request('http://localhost/webhook/telegram', {
          method: 'POST',
          headers: { 'X-Telegram-Bot-Api-Secret-Token': TELEGRAM_SECRET },
          body: JSON.stringify({ update_id: 1 }),
        }),
        { DB: mockD1, TELEGRAM_WEBHOOK_SECRET: TELEGRAM_SECRET }
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('gom onAsyncWork vào ctx.waitUntil khi xử lý message', async () => {
      const waitUntilMock = vi.fn();
      const mockCtx = {
        waitUntil: waitUntilMock,
        passThroughOnException: vi.fn(),
        props: {},
      } as unknown as ExecutionContext;

      const res = await worker.fetch(
        new Request('http://localhost/webhook/telegram', {
          method: 'POST',
          headers: { 'X-Telegram-Bot-Api-Secret-Token': TELEGRAM_SECRET },
          body: JSON.stringify({
            update_id: 12345,
            message: {
              chat: { id: 112233, type: 'private' },
              text: 'A random message that triggers background work',
            },
          }),
        }),
        { DB: mockD1, TELEGRAM_WEBHOOK_SECRET: TELEGRAM_SECRET },
        mockCtx
      );

      expect(res.status).toBe(200);
      // Wait until the background work promise resolves since it's not awaited
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(waitUntilMock).toHaveBeenCalled();
    });
  });

  describe('Task 7.3 — Xử lý Message/Callback Query', () => {
    it('Xử lý message.text: bóc tách SMS biên lai thành công và lưu vào D1', async () => {
      const [member] = await db
        .insert(members)
        .values({ displayName: 'Con Cả', role: 'SUBSCRIBER', telegramChatId: '887766' })
        .returning();

      const updateObj = {
        update_id: 900112233,
        message: {
          message_id: 456,
          from: { id: 887766, is_bot: false, first_name: 'Con' },
          chat: { id: 887766, type: 'private' },
          date: 1785635043,
          text: 'TK 1903xxx123 bi tru 250,000 VND vao 02/09/2026. ND: CANVA.COM',
        },
      };

      const mockExtraction: SubscriptionExtraction = {
        merchantName: 'Canva',
        amount: 250000,
        currency: 'VND',
        billingCycle: 'MONTHLY',
        nextBillingDate: '2026-09-02',
        confidenceScore: 0.95,
        isTrial: false,
      };

      const mockParserService = { parse: vi.fn().mockResolvedValue(mockExtraction) };
      const sendMessageSpy = vi.fn().mockResolvedValue(true);

      const { processTelegramUpdate } = await import('./telegram.router');
      await processTelegramUpdate(updateObj as unknown as TelegramUpdate, db, {
        telegramClientOverride: {
          sendMessage: sendMessageSpy,
          answerCallbackQuery: vi.fn().mockResolvedValue(true),
          getFileAsDataUrl: vi.fn(),
        },
        parserServiceOverride: mockParserService,
      });

      expect(mockParserService.parse).toHaveBeenCalled();
      expect(sendMessageSpy).toHaveBeenCalledWith(887766, expect.stringContaining('Canva'));

      const createdSubs = await db.select().from(subscriptions);
      expect(createdSubs.length).toBe(1);
      expect(createdSubs[0].merchantName).toBe('Canva');
      expect(createdSubs[0].subscriberId).toBe(member.id);
    });

    it('Xử lý message.photo: tải file qua getFile + download rồi gửi sang Parser dạng Base64 Data URL', async () => {
      await db
        .insert(members)
        .values({ displayName: 'Test User Img', role: 'SUBSCRIBER', telegramChatId: '998877' });

      const updateObj = {
        update_id: 900112234,
        message: {
          message_id: 457,
          from: { id: 998877, is_bot: false, first_name: 'Con' },
          chat: { id: 998877, type: 'private' },
          date: 1785635045,
          photo: [
            { file_id: 'small_id', file_unique_id: 'u1', width: 100, height: 100 },
            { file_id: 'large_id', file_unique_id: 'u2', width: 1080, height: 1920 },
          ],
        },
      };

      const mockExtraction: SubscriptionExtraction = {
        merchantName: 'Netflix',
        amount: 260000,
        currency: 'VND',
        billingCycle: 'MONTHLY',
        nextBillingDate: '2026-09-01',
        confidenceScore: 0.9,
        isTrial: false,
      };

      const mockParserService = { parse: vi.fn().mockResolvedValue(mockExtraction) };
      const getFileAsDataUrlSpy = vi.fn().mockResolvedValue('data:image/jpeg;base64,ZmFrZQ==');
      const sendMessageSpy = vi.fn().mockResolvedValue(true);

      const { processTelegramUpdate } = await import('./telegram.router');
      await processTelegramUpdate(updateObj as unknown as TelegramUpdate, db, {
        telegramClientOverride: {
          sendMessage: sendMessageSpy,
          answerCallbackQuery: vi.fn().mockResolvedValue(true),
          getFileAsDataUrl: getFileAsDataUrlSpy,
        },
        parserServiceOverride: mockParserService,
      });

      expect(getFileAsDataUrlSpy).toHaveBeenCalledWith('large_id');
      expect(mockParserService.parse).toHaveBeenCalledWith(
        expect.objectContaining({
          contentType: 'IMAGE_URL',
          content: 'data:image/jpeg;base64,ZmFrZQ==',
        })
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(998877, expect.stringContaining('Netflix'));
    });

    it('Xử lý callback_query ACTION_KILL_SUB_ID_<id>_ALERT_<id>: chuyển trạng thái + cập nhật alert response', async () => {
      const [member] = await db
        .insert(members)
        .values({ displayName: 'Test User', role: 'SUBSCRIBER', telegramChatId: '224466' })
        .returning();

      const [sub] = await db
        .insert(subscriptions)
        .values({
          merchantName: 'ChatGPT Plus',
          amount: 500000,
          currency: 'VND',
          subscriberId: member.id,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2026-09-01',
          confidenceScore: 0.9,
        })
        .returning();

      const [alertRecord] = await db
        .insert(alerts)
        .values({
          subscriptionId: sub.id,
          alertType: 'SOFT_T3',
          scheduledAt: '2026-08-29',
          status: 'SENT',
        })
        .returning();

      const updateObj = {
        update_id: 900112235,
        callback_query: {
          id: 'cbq_998877',
          from: { id: 224466, is_bot: false, first_name: 'Con Cả' },
          message: { message_id: 458, chat: { id: 224466, type: 'private' } },
          data: `ACTION_KILL_SUB_ID_${sub.id}_ALERT_${alertRecord.id}`,
        },
      };

      const sendMessageSpy = vi.fn().mockResolvedValue(true);
      const answerCallbackQuerySpy = vi.fn().mockResolvedValue(true);

      const { processTelegramUpdate } = await import('./telegram.router');
      await processTelegramUpdate(updateObj as unknown as TelegramUpdate, db, {
        telegramClientOverride: {
          sendMessage: sendMessageSpy,
          answerCallbackQuery: answerCallbackQuerySpy,
          getFileAsDataUrl: vi.fn(),
        },
      });

      const updatedSub = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
      expect(updatedSub[0].status).toBe('PENDING_KILL');
      expect(updatedSub[0].directKillLink).toBeDefined();

      const updatedAlert = await db.select().from(alerts).where(eq(alerts.id, alertRecord.id));
      expect(updatedAlert[0].response).toBe('KILL');

      expect(answerCallbackQuerySpy).toHaveBeenCalledWith(
        'cbq_998877',
        expect.stringContaining('HỦY')
      );
      expect(sendMessageSpy).toHaveBeenCalledWith(224466, expect.stringContaining('PENDING_KILL'));
    });
  });

  describe('Task 7.3 — TelegramClientAdapter & TelegramNotificationAdapter', () => {
    it('TelegramClientAdapter trả về true ở mock mode (khi không có botToken)', async () => {
      const client = new TelegramClientAdapter();
      const res = await client.sendMessage('123', 'Hello Telegram');
      expect(res).toBe(true);
    });

    it('TelegramClientAdapter thực hiện HTTP POST sendMessage khi có botToken', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      const client = new TelegramClientAdapter('test_bot_token');
      const res = await client.sendMessage('123', 'Hello API');

      expect(res).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.telegram.org/bottest_bot_token/sendMessage',
        expect.objectContaining({ method: 'POST' })
      );

      fetchSpy.mockRestore();
    });

    it('TelegramNotificationAdapter gửi SoftAlert kèm inline keyboard buttons', async () => {
      const mockTelegramClient = {
        sendMessage: vi.fn().mockResolvedValue(true),
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        getFileAsDataUrl: vi.fn(),
      };
      const adapter = new TelegramNotificationAdapter(mockTelegramClient, db);

      const softRes = await adapter.sendSoftAlert({
        alertId: 1,
        subscriptionId: 10,
        merchantName: 'Canva',
        amount: 250000,
        currency: 'VND',
        nextBillingDate: '2026-09-02',
        subscriberId: 100,
      });

      expect(softRes).toBe(true);
      expect(mockTelegramClient.sendMessage).toHaveBeenCalledWith(
        '100',
        expect.stringContaining('Canva'),
        expect.arrayContaining([
          expect.arrayContaining([
            expect.objectContaining({
              text: '✅ Giữ dịch vụ (KEEP)',
              callback_data: 'ACTION_KEEP_SUB_ID_10_ALERT_1',
            }),
          ]),
        ])
      );
    });

    it('sendRedAlert gửi vào Family Group Chat khi có cấu hình TELEGRAM_FAMILY_GROUP_CHAT_ID', async () => {
      const mockTelegramClient = {
        sendMessage: vi.fn().mockResolvedValue(true),
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        getFileAsDataUrl: vi.fn(),
      };
      const adapter = new TelegramNotificationAdapter(
        mockTelegramClient,
        db,
        'family_group_chat_id'
      );

      const redRes = await adapter.sendRedAlert({
        alertId: 2,
        subscriptionId: 10,
        merchantName: 'Canva',
        amount: 250000,
        currency: 'VND',
        nextBillingDate: '2026-09-02',
        subscriberId: 100,
        cardOwnerId: 200,
        cardLabel: 'Techcombank - Bố',
      });

      expect(redRes).toBe(true);
      expect(mockTelegramClient.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockTelegramClient.sendMessage).toHaveBeenCalledWith(
        'family_group_chat_id',
        expect.stringContaining('RED ALERT')
      );
    });

    it('sendRedAlert fallback gửi riêng cho cả Subscriber và Card Owner khi không có group', async () => {
      const [subUser] = await db
        .insert(members)
        .values({ displayName: 'Sub Member', role: 'SUBSCRIBER', telegramChatId: 'tg_sub_1' })
        .returning();
      const [ownerUser] = await db
        .insert(members)
        .values({
          displayName: 'Card Owner Member',
          role: 'CARD_OWNER',
          telegramChatId: 'tg_owner_2',
        })
        .returning();

      const mockTelegramClient = {
        sendMessage: vi.fn().mockResolvedValue(true),
        answerCallbackQuery: vi.fn().mockResolvedValue(true),
        getFileAsDataUrl: vi.fn(),
      };
      const adapter = new TelegramNotificationAdapter(mockTelegramClient, db);

      const redRes = await adapter.sendRedAlert({
        alertId: 2,
        subscriptionId: 10,
        merchantName: 'Canva',
        amount: 250000,
        currency: 'VND',
        nextBillingDate: '2026-09-02',
        subscriberId: subUser.id,
        cardOwnerId: ownerUser.id,
        cardLabel: 'Techcombank - Bố',
      });

      expect(redRes).toBe(true);
      expect(mockTelegramClient.sendMessage).toHaveBeenCalledTimes(2);
      expect(mockTelegramClient.sendMessage).toHaveBeenCalledWith(
        'tg_sub_1',
        expect.stringContaining('RED ALERT')
      );
      expect(mockTelegramClient.sendMessage).toHaveBeenCalledWith(
        'tg_owner_2',
        expect.stringContaining('RED ALERT')
      );
    });
  });

  describe('POST /webhook/telegram — validate payload', () => {
    it('trả 400 khi body không phải JSON hợp lệ', async () => {
      const res = await worker.fetch(
        new Request('http://localhost/webhook/telegram', {
          method: 'POST',
          headers: { 'X-Telegram-Bot-Api-Secret-Token': TELEGRAM_SECRET },
          body: 'đây-không-phải-json',
        }),
        { DB: mockD1, TELEGRAM_WEBHOOK_SECRET: TELEGRAM_SECRET }
      );
      const json = (await res.json()) as { error: { code: string; message: string } };

      expect(res.status).toBe(400);
      expect(json.error.message).toContain('Invalid JSON');
    });

    it('trả 400 khi body rỗng (thiếu raw body)', async () => {
      const res = await worker.fetch(
        new Request('http://localhost/webhook/telegram', {
          method: 'POST',
          headers: { 'X-Telegram-Bot-Api-Secret-Token': TELEGRAM_SECRET },
          body: '',
        }),
        { DB: mockD1, TELEGRAM_WEBHOOK_SECRET: TELEGRAM_SECRET }
      );
      const json = (await res.json()) as { error: { message: string } };

      expect(res.status).toBe(400);
      expect(json.error.message).toContain('Missing raw request body');
    });
  });

  describe('processTelegramUpdate — nhánh biên', () => {
    const fakeClient = () => ({
      sendMessage: vi.fn().mockResolvedValue(true),
      answerCallbackQuery: vi.fn().mockResolvedValue(true),
      getFileAsDataUrl: vi.fn().mockResolvedValue(null),
    });

    const run = (
      update: TelegramUpdate,
      client: ReturnType<typeof fakeClient>,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parserOverride?: any
    ) =>
      processTelegramUpdate(update, db, {
        telegramClientOverride: client,
        parserServiceOverride: parserOverride ?? {
          extractSubscriptionData: vi.fn().mockResolvedValue(null),
        },
      });

    it('bỏ qua update không có message lẫn callback_query', async () => {
      const client = fakeClient();

      await run({ update_id: 1 } as TelegramUpdate, client);

      expect(client.sendMessage).not.toHaveBeenCalled();
      expect(client.answerCallbackQuery).not.toHaveBeenCalled();
    });

    it('bỏ qua message thiếu chat.id', async () => {
      const client = fakeClient();

      await run({ update_id: 1, message: { text: 'hello' } } as TelegramUpdate, client);

      expect(client.sendMessage).not.toHaveBeenCalled();
    });

    it('chỉ answerCallbackQuery khi callback_data sai định dạng', async () => {
      const client = fakeClient();

      await run(
        {
          update_id: 1,
          callback_query: { id: 'cbq-1', from: { id: 123 }, data: 'DATA_KHONG_HOP_LE' },
        } as TelegramUpdate,
        client
      );

      expect(client.answerCallbackQuery).toHaveBeenCalledWith('cbq-1');
      expect(client.sendMessage).not.toHaveBeenCalled();
    });

    it('chỉ answerCallbackQuery khi callback_query thiếu from.id', async () => {
      const client = fakeClient();

      await run(
        {
          update_id: 1,
          callback_query: { id: 'cbq-2', data: 'ACTION_KEEP_SUB_ID_1' },
        } as TelegramUpdate,
        client
      );

      expect(client.answerCallbackQuery).toHaveBeenCalledWith('cbq-2');
    });

    it('báo lỗi về Telegram khi subscription không tồn tại (nhánh catch)', async () => {
      const client = fakeClient();

      await run(
        {
          update_id: 1,
          callback_query: { id: 'cbq-3', from: { id: 123 }, data: 'ACTION_KILL_SUB_ID_9999' },
        } as TelegramUpdate,
        client
      );

      expect(client.answerCallbackQuery).toHaveBeenCalledWith('cbq-3', 'Lỗi xử lý yêu cầu');
      expect(client.sendMessage.mock.calls[0][1]).toContain('Không tìm thấy subscription #9999');
    });

    it('xử lý ACTION_KEEP (không kèm ALERT) và phản hồi trạng thái ACTIVE', async () => {
      const [member] = await db
        .insert(members)
        .values({ displayName: 'Con Cả', role: 'SUBSCRIBER', telegramChatId: '123' })
        .returning();
      const [sub] = await db
        .insert(subscriptions)
        .values({
          merchantName: 'Netflix',
          amount: 260000,
          currency: 'VND',
          subscriberId: member.id,
          status: 'TRIAL',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-01-01',
          confidenceScore: 0.9,
        })
        .returning();
      const client = fakeClient();

      await run(
        {
          update_id: 1,
          callback_query: {
            id: 'cbq-4',
            from: { id: 123 },
            data: `ACTION_KEEP_SUB_ID_${sub.id}`,
          },
        } as TelegramUpdate,
        client
      );

      expect(client.answerCallbackQuery).toHaveBeenCalledWith('cbq-4', 'Đã xác nhận GIỮ');
      expect(client.sendMessage.mock.calls[0][1]).toContain('GIỮ dịch vụ Netflix');

      const [updated] = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
      expect(updated.status).toBe('ACTIVE');
    });

    it('cảnh báo khi không tải được ảnh đính kèm', async () => {
      const client = fakeClient();
      client.getFileAsDataUrl.mockResolvedValue(null);

      await run(
        {
          update_id: 1,
          message: {
            chat: { id: 445566, type: 'private' },
            photo: [{ file_id: 'small' }, { file_id: 'large' }],
          },
        } as TelegramUpdate,
        client
      );

      expect(client.getFileAsDataUrl).toHaveBeenCalledWith('large');
      expect(client.sendMessage.mock.calls[0][1]).toContain('Không thể tải ảnh đính kèm');
    });

    it('tự tạo member mới khi telegramChatId chưa tồn tại', async () => {
      const client = fakeClient();

      await run(
        {
          update_id: 1,
          message: { chat: { id: 998877, type: 'private' }, text: 'tin nhắn bất kỳ' },
        } as TelegramUpdate,
        client
      );

      const created = await db.select().from(members).where(eq(members.telegramChatId, '998877'));
      expect(created).toHaveLength(1);
      expect(created[0].displayName).toContain('998877');
      expect(created[0].role).toBe('SUBSCRIBER');
    });
  });
});
