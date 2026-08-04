import {
  BillingCycle,
  SubscriptionStatus,
  type SubscriptionEntity,
} from '../domain/subscription.entity';
import type { ISubscriptionRepository } from '../domain/subscription-repository.interface';
import type { SubscriptionExtraction } from '@/core/types/extraction';

export interface HandleIncomingInvoiceInput {
  subscriberId: number;
  extraction: SubscriptionExtraction;
}

export interface HandleIncomingInvoiceResult {
  subscription: SubscriptionEntity;
  isReopened: boolean;
  isNew: boolean;
}

export class HandleIncomingInvoiceUseCase {
  constructor(private subscriptionRepo: ISubscriptionRepository) {}

  async execute(input: HandleIncomingInvoiceInput): Promise<HandleIncomingInvoiceResult> {
    const { subscriberId, extraction } = input;
    const existing = await this.subscriptionRepo.findByMerchantAndSubscriber(
      extraction.merchantName,
      subscriberId
    );

    const isTrialInvoice = extraction.amount === 0 || Boolean(extraction.isTrial);
    const targetStatus = isTrialInvoice ? SubscriptionStatus.TRIAL : SubscriptionStatus.ACTIVE;

    if (existing) {
      const wasKilled = existing.status === SubscriptionStatus.KILLED;

      // Update existing subscription, reopen if KILLED
      const updated = await this.subscriptionRepo.update(existing.id, {
        merchantName: extraction.merchantName, // Normalized or updated name
        amount: extraction.amount,
        currency: extraction.currency || 'VND',
        billingCycle: (extraction.billingCycle as BillingCycle) || existing.billingCycle,
        nextBillingDate: extraction.nextBillingDate,
        confidenceScore: extraction.confidenceScore,
        status: targetStatus,
      });

      return {
        subscription: updated,
        isReopened: wasKilled,
        isNew: false,
      };
    }

    // Create new subscription if none exists
    const created = await this.subscriptionRepo.create({
      merchantName: extraction.merchantName,
      amount: extraction.amount,
      currency: extraction.currency || 'VND',
      subscriberId,
      status: targetStatus,
      billingCycle: (extraction.billingCycle as BillingCycle) || BillingCycle.MONTHLY,
      nextBillingDate: extraction.nextBillingDate,
      confidenceScore: extraction.confidenceScore,
      isMustKeep: false,
      directKillLink: null,
      paymentCardId: null,
    });

    return {
      subscription: created,
      isReopened: false,
      isNew: true,
    };
  }
}
