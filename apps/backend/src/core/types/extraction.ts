import { BillingCycle } from './enums';

/**
 * 2. Domain DTO dùng nội bộ trong hệ thống Subsentry
 */
export interface SubscriptionExtraction {
  merchantName: string;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: string; // Định dạng YYYY-MM-DD
  isTrial: boolean;
  confidenceScore: number;
  rawText?: string;
  directKillLink?: string | null;
}
