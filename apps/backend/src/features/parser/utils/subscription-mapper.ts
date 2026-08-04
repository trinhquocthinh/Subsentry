import type { SubscriptionExtraction } from '@/core/types/extraction';
import { SubscriptionStatus } from '@/core/types/enums';

export function mapExtractionToSubscriptionInsertValues(
  extraction: SubscriptionExtraction,
  subscriberId?: number | null
) {
  return {
    merchantName: extraction.merchantName,
    amount: extraction.amount,
    currency: extraction.currency,
    billingCycle: extraction.billingCycle,
    status: extraction.isTrial ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE,
    nextBillingDate: extraction.nextBillingDate,
    ...(subscriberId !== undefined ? { subscriberId } : {}),
  };
}
