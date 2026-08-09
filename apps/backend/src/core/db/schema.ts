import { sqliteTable, integer, text, real, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 1. Bảng members: Định danh 10 thành viên gia đình (Zalo & Telegram)
export const members = sqliteTable(
  'members',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    zaloUserId: text('zalo_user_id').unique(),
    telegramChatId: text('telegram_chat_id').unique(),
    email: text('email').unique(),
    displayName: text('display_name').notNull(),
    role: text('role', { enum: ['ADMIN', 'SUBSCRIBER', 'CARD_OWNER'] }).notNull(),
    createdAt: text('created_at')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    roleCheck: check('role_check', sql`${table.role} IN ('ADMIN', 'SUBSCRIBER', 'CARD_OWNER')`),
  })
);

// 2. Bảng payment_cards: Thẻ thanh toán (Bảo mật BR-09)
export const paymentCards = sqliteTable('payment_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cardLabel: text('card_label').notNull(),
  cardOwnerId: integer('card_owner_id')
    .notNull()
    .references(() => members.id, { onDelete: 'cascade' }),
  lastFour: text('last_four'),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: text('created_at')
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

// 3. Bảng subscriptions: Quản lý gói dịch vụ / dùng thử
export const subscriptions = sqliteTable(
  'subscriptions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    merchantName: text('merchant_name').notNull(),
    amount: real('amount').notNull(),
    currency: text('currency').default('VND').notNull(),
    subscriberId: integer('subscriber_id')
      .notNull()
      .references(() => members.id, { onDelete: 'cascade' }),
    paymentCardId: integer('payment_card_id').references(() => paymentCards.id, {
      onDelete: 'set null',
    }),
    status: text('status', { enum: ['TRIAL', 'ACTIVE', 'PENDING_KILL', 'KILLED'] }).notNull(),
    billingCycle: text('billing_cycle', { enum: ['WEEKLY', 'MONTHLY', 'YEARLY'] }).notNull(),
    nextBillingDate: text('next_billing_date').notNull(),
    confidenceScore: real('confidence_score').notNull(),
    directKillLink: text('direct_kill_link'),
    isMustKeep: integer('is_must_keep', { mode: 'boolean' }).default(false).notNull(),
    createdAt: text('created_at')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: text('updated_at')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    statusCheck: check(
      'status_check',
      sql`${table.status} IN ('TRIAL', 'ACTIVE', 'PENDING_KILL', 'KILLED')`
    ),
    billingCycleCheck: check(
      'billing_cycle_check',
      sql`${table.billingCycle} IN ('WEEKLY', 'MONTHLY', 'YEARLY')`
    ),
  })
);

// 4. Bảng alerts: Lịch gửi & phản hồi cảnh báo
export const alerts = sqliteTable(
  'alerts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    subscriptionId: integer('subscription_id')
      .notNull()
      .references(() => subscriptions.id, { onDelete: 'cascade' }),
    alertType: text('alert_type', { enum: ['SOFT_T3', 'RED_T24'] }).notNull(),
    scheduledAt: text('scheduled_at').notNull(),
    triggeredAt: text('triggered_at'),
    status: text('status', { enum: ['SCHEDULED', 'SENT', 'CANCELLED'] })
      .default('SCHEDULED')
      .notNull(),
    response: text('response', { enum: ['PENDING', 'KEEP', 'KILL'] })
      .default('PENDING')
      .notNull(),
    createdAt: text('created_at')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    alertTypeCheck: check('alert_type_check', sql`${table.alertType} IN ('SOFT_T3', 'RED_T24')`),
    alertStatusCheck: check(
      'alert_status_check',
      sql`${table.status} IN ('SCHEDULED', 'SENT', 'CANCELLED', 'FAILED')`
    ),
    alertResponseCheck: check(
      'alert_response_check',
      sql`${table.response} IN ('PENDING', 'KEEP', 'KILL')`
    ),
  })
);

// 5. Bảng parsing_logs: Nhật ký xử lý hóa đơn thô
export const parsingLogs = sqliteTable(
  'parsing_logs',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    source: text('source', { enum: ['EMAIL', 'CHAT_ZALO', 'CHAT_TG'] }).notNull(),
    senderId: text('sender_id').notNull(),
    rawContent: text('raw_content').notNull(),
    parsedJson: text('parsed_json'),
    confidenceScore: real('confidence_score').default(0.0),
    status: text('status', { enum: ['SUCCESS', 'LOW_CONFIDENCE', 'FAILED'] }).notNull(),
    createdAt: text('created_at')
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => ({
    sourceCheck: check('source_check', sql`${table.source} IN ('EMAIL', 'CHAT_ZALO', 'CHAT_TG')`),
    logStatusCheck: check(
      'log_status_check',
      sql`${table.status} IN ('SUCCESS', 'LOW_CONFIDENCE', 'FAILED')`
    ),
  })
);
