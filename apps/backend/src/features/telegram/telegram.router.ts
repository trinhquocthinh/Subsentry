import { Hono } from 'hono';
import { createDbClient } from '@/core/db';
import { members, alerts } from '@/core/db/schema';
import { eq } from 'drizzle-orm';
import { OpenAIParserAdapter } from '@/features/parser/adapters/openai-parser.adapter';
import { ParseReceiptUseCase } from '@/features/parser/use-cases/parse-receipt.use-case';
import { TransitionSubscriptionStateUseCase } from '@/features/subscription/use-cases/transition-subscription-state.use-case';
import { DrizzleSubscriptionRepository } from '@/features/subscription/adapters/drizzle-subscription.repository';
import { SubscriptionAction } from '@/features/subscription/domain/subscription.entity';
import { TelegramClientAdapter, type ITelegramClient } from './adapters/telegram-client.adapter';
import { telegramSignatureMiddleware } from './middleware/telegram-signature';
import type { TelegramUpdate } from './domain/telegram-payload.interface';

export type TelegramRouterEnv = {
  Bindings: {
    DB: D1Database;
    OPENAI_API_KEY?: string;
    TELEGRAM_BOT_TOKEN?: string;
    TELEGRAM_WEBHOOK_SECRET?: string;
    [key: string]: unknown;
  };
  Variables: {
    rawBody?: string;
    // Optional dependency overrides for testing
    telegramClientOverride?: ITelegramClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parserServiceOverride?: any;
  };
};

const telegramRouter = new Hono<TelegramRouterEnv>();

// Task 7.2: Xác thực X-Telegram-Bot-Api-Secret-Token
telegramRouter.use('*', telegramSignatureMiddleware);

export async function processTelegramUpdate(
  update: TelegramUpdate,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  options: {
    openAiApiKey?: string;
    telegramBotToken?: string;
    telegramClientOverride?: ITelegramClient;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parserServiceOverride?: any;
  }
): Promise<void> {
  const telegramClient =
    options.telegramClientOverride || new TelegramClientAdapter(options.telegramBotToken);
  const parserService =
    options.parserServiceOverride ||
    new OpenAIParserAdapter(
      options.openAiApiKey || (process.env.OPENAI_API_KEY as string) || 'mock-api-key'
    );

  const parseReceiptUseCase = new ParseReceiptUseCase(parserService, db);
  const subscriptionRepo = new DrizzleSubscriptionRepository(db);
  const transitionUseCase = new TransitionSubscriptionStateUseCase(subscriptionRepo);

  // 1. Xử lý Callback Query (nút bấm Keep/Kill của Inline Keyboard)
  if (update.callback_query) {
    const cbq = update.callback_query;
    const senderChatId = cbq.from?.id;
    const data = cbq.data || '';

    const match = data.match(/^ACTION_(KEEP|KILL)_SUB_ID_(\d+)(?:_ALERT_(\d+))?$/);

    if (!match || senderChatId === undefined) {
      await telegramClient.answerCallbackQuery(cbq.id);
      return;
    }

    const actionStr = match[1];
    const subId = parseInt(match[2], 10);
    const alertId = match[3] ? parseInt(match[3], 10) : undefined;
    const action = actionStr === 'KEEP' ? SubscriptionAction.KEEP : SubscriptionAction.KILL;

    try {
      const updatedSub = await transitionUseCase.execute({ subscriptionId: subId, action });

      if (alertId) {
        await db.update(alerts).set({ response: actionStr }).where(eq(alerts.id, alertId));
      }

      const replyMsg =
        actionStr === 'KEEP'
          ? `✅ Bạn đã chọn GIỮ dịch vụ ${updatedSub.merchantName}. Trạng thái hiện tại: ACTIVE.`
          : `🛑 Bạn đã chọn HỦY dịch vụ ${updatedSub.merchantName}. Trạng thái: PENDING_KILL.\n` +
            `Link hỗ trợ hủy trực tiếp: ${updatedSub.directKillLink || 'N/A'}`;

      await telegramClient.answerCallbackQuery(
        cbq.id,
        actionStr === 'KEEP' ? 'Đã xác nhận GIỮ' : 'Đã ghi nhận HỦY'
      );
      await telegramClient.sendMessage(senderChatId, replyMsg);
    } catch {
      await telegramClient.answerCallbackQuery(cbq.id, 'Lỗi xử lý yêu cầu');
      await telegramClient.sendMessage(
        senderChatId,
        `⚠️ Không tìm thấy subscription #${subId} hoặc lỗi chuyển trạng thái.`
      );
    }
    return;
  }

  const message = update.message;
  if (!message) {
    return;
  }

  const senderChatId = message.chat?.id;
  if (senderChatId === undefined) {
    return;
  }

  // 2. Tìm thông tin member qua telegramChatId, tự động tạo mới nếu chưa có
  let subscriberId: number | undefined;
  try {
    const memberRecords = await db
      .select()
      .from(members)
      .where(eq(members.telegramChatId, String(senderChatId)))
      .limit(1);
    if (memberRecords.length > 0) {
      subscriberId = memberRecords[0].id;
    } else {
      const [newMember] = await db
        .insert(members)
        .values({
          displayName: `Telegram Member (${String(senderChatId).slice(-6)})`,
          role: 'SUBSCRIBER',
          telegramChatId: String(senderChatId),
        })
        .returning();
      subscriberId = newMember?.id;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[TelegramWebhook] Failed to query or create member by telegramChatId:', err);
  }

  // 3. Xử lý kịch bản: Text Message
  if (message.text) {
    const parseResult = await parseReceiptUseCase.execute({
      source: 'CHAT_TG',
      senderId: String(senderChatId),
      content: message.text.trim(),
      contentType: 'TEXT',
      subscriberId,
    });

    if (parseResult.message) {
      await telegramClient.sendMessage(senderChatId, parseResult.message);
    }
    return;
  }

  // 4. Xử lý kịch bản: Photo Attachment
  if (message.photo && message.photo.length > 0) {
    // Telegram trả về nhiều độ phân giải, phần tử cuối luôn có kích thước lớn nhất
    const largestPhoto = message.photo[message.photo.length - 1];
    const imageDataUrl = await telegramClient.getFileAsDataUrl(largestPhoto.file_id);

    if (!imageDataUrl) {
      await telegramClient.sendMessage(senderChatId, '⚠️ Không thể tải ảnh đính kèm từ Telegram.');
      return;
    }

    const parseResult = await parseReceiptUseCase.execute({
      source: 'CHAT_TG',
      senderId: String(senderChatId),
      content: imageDataUrl,
      contentType: 'IMAGE_URL',
      subscriberId,
    });

    if (parseResult.message) {
      await telegramClient.sendMessage(senderChatId, parseResult.message);
    }
    return;
  }
}

// Endpoint POST /webhook/telegram
telegramRouter.post('/', async (c) => {
  // Lấy rawBody đã lưu từ middleware (tránh đọc lại req.text() đã bị consume)
  const rawBody = c.get('rawBody') || c.var?.rawBody;
  if (!rawBody) {
    return c.json(
      {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Missing raw request body',
        },
      },
      400
    );
  }

  let update: TelegramUpdate;

  try {
    update = JSON.parse(rawBody);
  } catch {
    return c.json(
      {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid JSON payload in request body',
        },
      },
      400
    );
  }

  const db = createDbClient(c.env.DB);
  const options = {
    openAiApiKey: c.env.OPENAI_API_KEY as string | undefined,
    telegramBotToken: c.env.TELEGRAM_BOT_TOKEN as string | undefined,
    telegramClientOverride: c.var.telegramClientOverride,
    parserServiceOverride: c.var.parserServiceOverride,
  };

  // Task 7.1: Phản hồi 200 OK ngay lập tức, xử lý background bằng ctx.waitUntil()
  const backgroundWork = processTelegramUpdate(update, db, options).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[TelegramRouter] Error in background execution:', err);
  });

  let hasWaitUntil = false;
  try {
    if (c.executionCtx && typeof c.executionCtx.waitUntil === 'function') {
      c.executionCtx.waitUntil(backgroundWork);
      hasWaitUntil = true;
    }
  } catch {
    hasWaitUntil = false;
  }

  if (!hasWaitUntil) {
    await backgroundWork;
  }

  return c.json({ success: true, timestamp: Date.now() });
});

export { telegramRouter };
