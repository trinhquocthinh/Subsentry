export const MemberRole = {
  ADMIN: 'ADMIN',
  SUBSCRIBER: 'SUBSCRIBER',
  CARD_OWNER: 'CARD_OWNER',
} as const;
export type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];

export const SubscriptionStatus = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PENDING_KILL: 'PENDING_KILL',
  KILLED: 'KILLED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];

export const BillingCycle = {
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;
export type BillingCycle = (typeof BillingCycle)[keyof typeof BillingCycle];

export const AlertType = {
  SOFT_T3: 'SOFT_T3',
  RED_T24: 'RED_T24',
} as const;
export type AlertType = (typeof AlertType)[keyof typeof AlertType];

export const AlertStatus = {
  SCHEDULED: 'SCHEDULED',
  SENT: 'SENT',
  CANCELLED: 'CANCELLED',
} as const;
export type AlertStatus = (typeof AlertStatus)[keyof typeof AlertStatus];

export const AlertResponse = {
  PENDING: 'PENDING',
  KEEP: 'KEEP',
  KILL: 'KILL',
} as const;
export type AlertResponse = (typeof AlertResponse)[keyof typeof AlertResponse];

export const ParsingLogStatus = {
  SUCCESS: 'SUCCESS',
  LOW_CONFIDENCE: 'LOW_CONFIDENCE',
  FAILED: 'FAILED',
} as const;
export type ParsingLogStatus = (typeof ParsingLogStatus)[keyof typeof ParsingLogStatus];

export const ParserSource = {
  EMAIL: 'EMAIL',
  CHAT_ZALO: 'CHAT_ZALO',
  CHAT_TG: 'CHAT_TG',
} as const;
export type ParserSource = (typeof ParserSource)[keyof typeof ParserSource];
