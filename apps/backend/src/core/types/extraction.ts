import { BillingCycle } from './enums';

/**
 * 1. Payload thô do OpenAI GPT-4o-mini trả về (Khớp 100% JSON Schema sdd.md §3.1)
 */
export interface RawLLMExtractedPayload {
  merchant: string;
  amount: number;
  currency: string;
  is_trial: boolean;
  next_billing_date: string;
  confidence_score: number;
}

/**
 * 2. Domain DTO dùng nội bộ trong hệ thống Subsentry
 */
export interface SubscriptionExtraction {
  merchant_name: string;
  amount: number;
  currency: string;
  is_trial: boolean;
  billing_cycle: BillingCycle;
  next_billing_date: string;
  confidence_score: number;
  direct_kill_link?: string | null;
}

/**
 * Utility Mapper chuyển đổi từ Raw LLM Payload sang Domain DTO
 */
export const mapRawToSubscriptionExtraction = (
  raw: RawLLMExtractedPayload,
  billingCycle: BillingCycle = BillingCycle.MONTHLY,
  directKillLink: string | null = null
): SubscriptionExtraction => {
  return {
    merchant_name: raw.merchant,
    amount: raw.amount,
    currency: raw.currency || 'VND',
    is_trial: raw.is_trial,
    billing_cycle: billingCycle,
    next_billing_date: raw.next_billing_date,
    confidence_score: raw.confidence_score,
    direct_kill_link: directKillLink,
  };
};
