import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  TelegramClientAdapter,
  TelegramNotificationAdapter,
  type ITelegramClient,
} from './telegram-client.adapter';
import type { RedAlertInput, SoftAlertInput } from '@/features/alert/domain/notification.interface';

const BOT_TOKEN = 'bot-token-123';

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('TelegramClientAdapter', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  describe('sendMessage', () => {
    it('chạy chế độ mock (không gọi mạng) khi thiếu bot token', async () => {
      const client = new TelegramClientAdapter(undefined);

      await expect(client.sendMessage(123, 'xin chào')).resolves.toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('POST tới sendMessage với parse_mode Markdown', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.sendMessage(123, 'xin chào')).resolves.toBe(true);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`);
      const body = JSON.parse(init.body as string);
      expect(body).toMatchObject({ chat_id: 123, text: 'xin chào', parse_mode: 'Markdown' });
      expect(body.reply_markup).toBeUndefined();
    });

    it('gắn inline_keyboard khi truyền buttons', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await client.sendMessage(123, 'chọn đi', [[{ text: 'OK', callback_data: 'ACTION_OK' }]]);

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.reply_markup.inline_keyboard[0][0].text).toBe('OK');
    });

    it('bỏ qua reply_markup khi mảng buttons rỗng', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await client.sendMessage(123, 'không nút', []);

      const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
      expect(body.reply_markup).toBeUndefined();
    });

    it('trả false khi Telegram trả ok:false', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ ok: false, description: 'chat not found' }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.sendMessage(123, 'x')).resolves.toBe(false);
    });

    it('trả false khi HTTP status lỗi', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ ok: false }, { status: 403 }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.sendMessage(123, 'x')).resolves.toBe(false);
    });

    it('trả false khi lỗi mạng (nhánh catch)', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNRESET'));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.sendMessage(123, 'x')).resolves.toBe(false);
    });
  });

  describe('answerCallbackQuery', () => {
    it('chạy chế độ mock khi thiếu bot token', async () => {
      const client = new TelegramClientAdapter(undefined);

      await expect(client.answerCallbackQuery('cbq-1', 'đã ghi nhận')).resolves.toBe(true);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('chạy chế độ mock kể cả khi không truyền text', async () => {
      const client = new TelegramClientAdapter(undefined);

      await expect(client.answerCallbackQuery('cbq-1')).resolves.toBe(true);
    });

    it('POST callback_query_id và trả true khi thành công', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ ok: true }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.answerCallbackQuery('cbq-998877', 'OK')).resolves.toBe(true);

      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/answerCallbackQuery');
      expect(JSON.parse(init.body as string).callback_query_id).toBe('cbq-998877');
    });

    it('trả false khi HTTP status lỗi', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({ ok: false }, { status: 400 }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.answerCallbackQuery('cbq-1')).resolves.toBe(false);
    });

    it('trả false khi lỗi mạng (nhánh catch)', async () => {
      fetchSpy.mockRejectedValue(new Error('timeout'));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.answerCallbackQuery('cbq-1')).resolves.toBe(false);
    });
  });

  describe('getFileAsDataUrl — Task 7.3.1', () => {
    it('trả null khi thiếu bot token', async () => {
      const client = new TelegramClientAdapter(undefined);

      await expect(client.getFileAsDataUrl('file-1')).resolves.toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('tải ảnh và trả về Base64 Data URL', async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: { file_path: 'photos/a.jpg' } }))
        .mockResolvedValueOnce(
          new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { 'content-type': 'image/png' },
          })
        );
      const client = new TelegramClientAdapter(BOT_TOKEN);

      const result = await client.getFileAsDataUrl('file-1');

      expect(result).toBe(`data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`);
      expect(fetchSpy.mock.calls[1][0]).toBe(
        `https://api.telegram.org/file/bot${BOT_TOKEN}/photos/a.jpg`
      );
    });

    it('mặc định content-type image/jpeg khi response không khai báo', async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: { file_path: 'photos/a.jpg' } }))
        .mockResolvedValueOnce(new Response(new Uint8Array([9]), { status: 200 }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      const result = await client.getFileAsDataUrl('file-1');

      expect(result).toContain('data:image/jpeg;base64,');
    });

    it('trả null khi getFile trả HTTP lỗi', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({}, { status: 404 }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.getFileAsDataUrl('file-1')).resolves.toBeNull();
    });

    it('trả null khi getFile trả ok:false', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: false }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.getFileAsDataUrl('file-1')).resolves.toBeNull();
    });

    it('trả null khi thiếu file_path trong kết quả', async () => {
      fetchSpy.mockResolvedValueOnce(jsonResponse({ ok: true, result: {} }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.getFileAsDataUrl('file-1')).resolves.toBeNull();
    });

    it('trả null khi bước tải file thất bại', async () => {
      fetchSpy
        .mockResolvedValueOnce(jsonResponse({ ok: true, result: { file_path: 'photos/a.jpg' } }))
        .mockResolvedValueOnce(new Response('nope', { status: 500 }));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.getFileAsDataUrl('file-1')).resolves.toBeNull();
    });

    it('trả null khi lỗi mạng (nhánh catch)', async () => {
      fetchSpy.mockRejectedValue(new Error('DNS fail'));
      const client = new TelegramClientAdapter(BOT_TOKEN);

      await expect(client.getFileAsDataUrl('file-1')).resolves.toBeNull();
    });
  });
});

describe('TelegramNotificationAdapter', () => {
  let sendMessage: ReturnType<typeof vi.fn>;
  let client: ITelegramClient;

  /** Minimal Drizzle-shaped stub: db.select().from().where().limit() -> rows */
  const stubDb = (rows: unknown[] | Error) => ({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => (rows instanceof Error ? Promise.reject(rows) : Promise.resolve(rows)),
        }),
      }),
    }),
  });

  const softInput: SoftAlertInput = {
    alertId: 10,
    subscriptionId: 456,
    merchantName: 'Netflix',
    amount: 260000,
    currency: 'VND',
    nextBillingDate: '2026-09-02',
    subscriberId: 1,
  };

  const redInput: RedAlertInput = {
    ...softInput,
    cardOwnerId: 2,
    cardLabel: 'Techcombank',
    subscriberName: 'Con Cả',
    cardOwnerName: 'Bố',
  };

  beforeEach(() => {
    sendMessage = vi.fn().mockResolvedValue(true);
    client = {
      sendMessage,
      answerCallbackQuery: vi.fn(),
      getFileAsDataUrl: vi.fn(),
    };
  });

  describe('sendSoftAlert', () => {
    it('gửi vào chat riêng đã resolve kèm 2 nút KEEP/KILL', async () => {
      const adapter = new TelegramNotificationAdapter(
        client,
        stubDb([{ telegramChatId: '99999' }])
      );

      await expect(adapter.sendSoftAlert(softInput)).resolves.toBe(true);

      const [chatId, message, buttons] = sendMessage.mock.calls[0];
      expect(chatId).toBe('99999');
      expect(message).toContain('[SOFT ALERT]');
      expect(message).toContain('260.000 VND');
      expect(buttons[0][0].callback_data).toBe('ACTION_KEEP_SUB_ID_456_ALERT_10');
      expect(buttons[0][1].callback_data).toBe('ACTION_KILL_SUB_ID_456_ALERT_10');
    });

    it('fallback dùng subscriberId khi không có db', async () => {
      const adapter = new TelegramNotificationAdapter(client);

      await adapter.sendSoftAlert(softInput);

      expect(sendMessage.mock.calls[0][0]).toBe('1');
    });

    it('fallback dùng subscriberId khi thành viên không có telegramChatId', async () => {
      const adapter = new TelegramNotificationAdapter(client, stubDb([{ telegramChatId: null }]));

      await adapter.sendSoftAlert(softInput);

      expect(sendMessage.mock.calls[0][0]).toBe('1');
    });

    it('fallback dùng subscriberId khi truy vấn db ném lỗi', async () => {
      const adapter = new TelegramNotificationAdapter(client, stubDb(new Error('db down')));

      await adapter.sendSoftAlert(softInput);

      expect(sendMessage.mock.calls[0][0]).toBe('1');
    });
  });

  describe('sendRedAlert', () => {
    it('gửi vào nhóm gia đình khi đã cấu hình group chat id', async () => {
      const adapter = new TelegramNotificationAdapter(
        client,
        stubDb([{ telegramChatId: '55555' }]),
        'group-123'
      );

      await expect(adapter.sendRedAlert(redInput)).resolves.toBe(true);

      expect(sendMessage).toHaveBeenCalledTimes(1);
      const [chatId, message] = sendMessage.mock.calls[0];
      expect(chatId).toBe('group-123');
      expect(message).toContain('[RED ALERT]');
      expect(message).toContain('Thẻ [Techcombank]');
      expect(message).toContain('tg://user?id=55555');
    });

    it('dùng nhãn thẻ mặc định khi không có cardLabel', async () => {
      const adapter = new TelegramNotificationAdapter(client, undefined, 'group-123');

      await adapter.sendRedAlert({ ...redInput, cardLabel: null });

      expect(sendMessage.mock.calls[0][1]).toContain('Thẻ ngân hàng gia đình');
    });

    it('dùng tên thường (không mention) khi không resolve được chat id', async () => {
      const adapter = new TelegramNotificationAdapter(client, undefined, 'group-123');

      await adapter.sendRedAlert(redInput);

      const message = sendMessage.mock.calls[0][1];
      expect(message).not.toContain('tg://user');
      expect(message).toContain('Con Cả');
      expect(message).toContain('Bố');
    });

    it('dùng nhãn mặc định khi thiếu cả tên subscriber lẫn card owner', async () => {
      const adapter = new TelegramNotificationAdapter(client, undefined, 'group-123');

      await adapter.sendRedAlert({
        ...redInput,
        subscriberName: undefined,
        cardOwnerName: undefined,
      });

      const message = sendMessage.mock.calls[0][1];
      expect(message).toContain('Thành viên');
      expect(message).toContain('Chủ thẻ');
    });

    it('giữ nhãn "Chủ thẻ" khi gói không gắn cardOwnerId', async () => {
      const adapter = new TelegramNotificationAdapter(client, undefined, 'group-123');

      await adapter.sendRedAlert({ ...redInput, cardOwnerId: null });

      expect(sendMessage.mock.calls[0][1]).toContain('Chủ thẻ');
    });

    it('fallback: gửi riêng cho cả subscriber và card owner khi chưa cấu hình group', async () => {
      const adapter = new TelegramNotificationAdapter(client, undefined);

      await expect(adapter.sendRedAlert(redInput)).resolves.toBe(true);

      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(sendMessage.mock.calls[0][0]).toBe('1');
      expect(sendMessage.mock.calls[1][0]).toBe('2');
    });

    it('fallback: chỉ gửi cho subscriber khi không có card owner', async () => {
      const adapter = new TelegramNotificationAdapter(client, undefined);

      await adapter.sendRedAlert({ ...redInput, cardOwnerId: null });

      expect(sendMessage).toHaveBeenCalledTimes(1);
    });

    it('fallback: trả true khi ít nhất 1 người nhận thành công', async () => {
      sendMessage.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const adapter = new TelegramNotificationAdapter(client, undefined);

      await expect(adapter.sendRedAlert(redInput)).resolves.toBe(true);
    });

    it('fallback: trả false khi tất cả người nhận đều thất bại', async () => {
      sendMessage.mockResolvedValue(false);
      const adapter = new TelegramNotificationAdapter(client, undefined);

      await expect(adapter.sendRedAlert(redInput)).resolves.toBe(false);
    });
  });
});
