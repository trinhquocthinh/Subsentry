import type {
  INotificationService,
  RedAlertInput,
  SoftAlertInput,
} from '@/features/alert/domain/notification.interface';
import { members } from '@/core/db/schema';
import { eq } from 'drizzle-orm';

export interface TelegramInlineButton {
  text: string;
  callback_data: string;
}

export interface ITelegramClient {
  sendMessage(
    chatId: string | number,
    text: string,
    buttons?: TelegramInlineButton[][]
  ): Promise<boolean>;
  answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean>;
  getFileAsDataUrl(fileId: string): Promise<string | null>;
}

export class TelegramClientAdapter implements ITelegramClient {
  constructor(private botToken?: string) {}

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    buttons?: TelegramInlineButton[][]
  ): Promise<boolean> {
    if (!this.botToken) {
      // eslint-disable-next-line no-console
      console.log(`[TelegramClient Mock] Outbound message to ${chatId}: ${text}`);
      return true;
    }

    try {
      const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'Markdown' };
      if (buttons && buttons.length > 0) {
        body.reply_markup = { inline_keyboard: buttons };
      }

      const response = await fetch(this.apiUrl('sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const resBody = (await response.json()) as { ok: boolean; description?: string };
      if (!response.ok || !resBody.ok) {
        // eslint-disable-next-line no-console
        console.error(
          `[TelegramClient] Failed to send message: ${resBody.description || response.statusText}`
        );
        return false;
      }

      return true;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[TelegramClient] Network error sending message to Telegram API:', err);
      return false;
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<boolean> {
    if (!this.botToken) {
      // eslint-disable-next-line no-console
      console.log(`[TelegramClient Mock] answerCallbackQuery ${callbackQueryId}: ${text || ''}`);
      return true;
    }

    try {
      const response = await fetch(this.apiUrl('answerCallbackQuery'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
      });
      return response.ok;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[TelegramClient] Network error answering callback query:', err);
      return false;
    }
  }

  // Task 7.3.1: Tải ảnh về Base64 Data URL ngay trong Worker (tránh lộ bot token
  // của Telegram File API nếu chỉ forward thẳng URL cho OpenAI xử lý).
  async getFileAsDataUrl(fileId: string): Promise<string | null> {
    if (!this.botToken) {
      return null;
    }

    try {
      const fileInfoRes = await fetch(`${this.apiUrl('getFile')}?file_id=${fileId}`);
      if (!fileInfoRes.ok) {
        // eslint-disable-next-line no-console
        console.error(`[TelegramClient] getFile failed: ${fileInfoRes.statusText}`);
        return null;
      }

      const fileInfo = (await fileInfoRes.json()) as {
        ok: boolean;
        result?: { file_path: string };
      };
      if (!fileInfo.ok || !fileInfo.result?.file_path) {
        return null;
      }

      const downloadRes = await fetch(
        `https://api.telegram.org/file/bot${this.botToken}/${fileInfo.result.file_path}`
      );
      if (!downloadRes.ok) {
        // eslint-disable-next-line no-console
        console.error(`[TelegramClient] File download failed: ${downloadRes.statusText}`);
        return null;
      }

      let contentType = downloadRes.headers.get('content-type') || 'image/jpeg';
      if (contentType === 'application/octet-stream' || !contentType.startsWith('image/')) {
        contentType = 'image/jpeg';
      }
      const arrayBuffer = await downloadRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[TelegramClient] Error downloading Telegram file attachment:', err);
      return null;
    }
  }
}

/**
 * Adapter implementing INotificationService for sending alerts via Telegram Bot API.
 */
export class TelegramNotificationAdapter implements INotificationService {
  constructor(
    private telegramClient: ITelegramClient,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private db?: any,
    // Task 6.4.2 gap fix: Telegram hỗ trợ group chat thật, không như Zalo OA (chỉ 1-1)
    private familyGroupChatId?: string
  ) {}

  private async resolveTelegramChatId(memberId: number): Promise<string | null> {
    if (!this.db) return null;
    try {
      const rows = await this.db.select().from(members).where(eq(members.id, memberId)).limit(1);
      return rows[0]?.telegramChatId || null;
    } catch {
      return null;
    }
  }

  async sendSoftAlert(input: SoftAlertInput): Promise<boolean> {
    // Task 5.2.2 & Task 7.3.2: Soft Alert (Private Chat) with Inline Keyboard Buttons
    const recipientId =
      (await this.resolveTelegramChatId(input.subscriberId)) || String(input.subscriberId);

    const formattedAmount = input.amount.toLocaleString('vi-VN');
    const message =
      `🔔 *[SOFT ALERT]* Nhắc nhở gia hạn dịch vụ!\n\n` +
      `Dịch vụ ${input.merchantName} của bạn sắp gia hạn vào ngày ${input.nextBillingDate}.\n` +
      `Số tiền dự kiến: ${formattedAmount} ${input.currency}.\n\n` +
      `Vui lòng chọn nút bấm bên dưới để xác nhận.`;

    const buttons: TelegramInlineButton[][] = [
      [
        {
          text: '✅ Giữ dịch vụ (KEEP)',
          callback_data: `ACTION_KEEP_SUB_ID_${input.subscriptionId}_ALERT_${input.alertId}`,
        },
        {
          text: '🛑 Lên lịch hủy (KILL)',
          callback_data: `ACTION_KILL_SUB_ID_${input.subscriptionId}_ALERT_${input.alertId}`,
        },
      ],
    ];

    return this.telegramClient.sendMessage(recipientId, message, buttons);
  }

  async sendRedAlert(input: RedAlertInput): Promise<boolean> {
    // Task 5.4.1 & Task 7.3.2: Red Alert gửi thẳng vào Nhóm Chat Gia Đình (Telegram Group
    // hỗ trợ group thật, khác với giới hạn 1-1 của Zalo OA), tag cả Subscriber + Card Owner.
    const formattedAmount = input.amount.toLocaleString('vi-VN');
    const cardInfo = input.cardLabel ? `Thẻ [${input.cardLabel}]` : 'Thẻ ngân hàng gia đình';

    const subscriberChatId = await this.resolveTelegramChatId(input.subscriberId);
    const subMention = subscriberChatId
      ? `[${input.subscriberName || 'Subscriber'}](tg://user?id=${subscriberChatId})`
      : input.subscriberName || 'Thành viên';

    let ownerMention = 'Chủ thẻ';
    if (input.cardOwnerId) {
      const ownerChatId = await this.resolveTelegramChatId(input.cardOwnerId);
      ownerMention = ownerChatId
        ? `[${input.cardOwnerName || 'Card Owner'}](tg://user?id=${ownerChatId})`
        : input.cardOwnerName || 'Chủ thẻ';
    }

    const message =
      `🚨 *[RED ALERT]* Cảnh báo báo động đỏ gia hạn khẩn cấp!\n\n` +
      `${cardInfo} sắp bị trừ ${formattedAmount} ${input.currency} cho dịch vụ [${input.merchantName}] đăng ký bởi ${subMention}.\n` +
      `Hạn gia hạn: ${input.nextBillingDate}.\n\n` +
      `⚠️ ${ownerMention} vui lòng kiểm tra khẩn cấp hoặc chủ động khóa thẻ trên app ngân hàng!`;

    if (this.familyGroupChatId) {
      return this.telegramClient.sendMessage(this.familyGroupChatId, message);
    }

    // Fallback: không cấu hình group -> gửi riêng cho cả 2 người
    const recipients = [subscriberChatId || String(input.subscriberId)];
    if (input.cardOwnerId) {
      const ownerChatId = await this.resolveTelegramChatId(input.cardOwnerId);
      recipients.push(ownerChatId || String(input.cardOwnerId));
    }

    let successCount = 0;
    for (const recipientId of recipients) {
      const sent = await this.telegramClient.sendMessage(recipientId, message);
      if (sent) successCount++;
    }
    return successCount > 0;
  }
}
