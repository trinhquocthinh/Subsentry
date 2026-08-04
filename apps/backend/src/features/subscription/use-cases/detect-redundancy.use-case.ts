import type { ISubscriptionRepository } from '../domain/subscription-repository.interface';
import type { SubscriptionEntity } from '../domain/subscription.entity';

export interface RedundancyAlertDTO {
  merchantName: string;
  count: number;
  subscriberIds: number[];
  subscriptions: SubscriptionEntity[];
  totalMonthlyCost: number;
  estimatedFamilyPlanCost: number;
  estimatedMonthlySavings: number;
  recommendationMessage: string;
}

const KNOWN_FAMILY_PLANS: Record<string, { familyCost: number; displayName: string }> = {
  spotify: { familyCost: 99000, displayName: 'Spotify Family' },
  youtube: { familyCost: 149000, displayName: 'YouTube Family' },
  'youtube premium': { familyCost: 149000, displayName: 'YouTube Premium Family' },
  netflix: { familyCost: 260000, displayName: 'Netflix Premium' },
  apple: { familyCost: 209000, displayName: 'Apple One Family' },
};

export class DetectRedundancyUseCase {
  constructor(private subscriptionRepo: ISubscriptionRepository) {}

  async execute(): Promise<RedundancyAlertDTO[]> {
    const grouped = await this.subscriptionRepo.findAllActiveGroupedByMerchant();
    const alerts: RedundancyAlertDTO[] = [];

    for (const [merchantKey, subs] of grouped.entries()) {
      // Find distinct subscribers for this merchant
      const subscriberIds = Array.from(new Set(subs.map((s) => s.subscriberId)));

      // Redundancy occurs if 2 or more DIFFERENT subscribers have active subs for same merchant
      if (subscriberIds.length >= 2) {
        const canonicalName = subs[0].merchantName;
        const totalMonthlyCost = subs.reduce((sum, s) => sum + s.amount, 0);

        let estimatedFamilyPlanCost: number;
        const knownConfig = KNOWN_FAMILY_PLANS[merchantKey];

        if (knownConfig) {
          estimatedFamilyPlanCost = knownConfig.familyCost;
        } else {
          // Fallback: estimate family plan cost at 65% of total individual subscriptions
          estimatedFamilyPlanCost = Math.round((totalMonthlyCost * 0.65) / 1000) * 1000;
        }

        const estimatedMonthlySavings = Math.max(0, totalMonthlyCost - estimatedFamilyPlanCost);
        const formattedSavings = new Intl.NumberFormat('vi-VN').format(estimatedMonthlySavings);

        const recommendationMessage =
          `💡 Phát hiện gia đình đang sử dụng ${subscriberIds.length} gói ${canonicalName} cá nhân. ` +
          `Khuyên dùng: Chuyển đổi sang gói ${knownConfig?.displayName || canonicalName + ' Family'} ` +
          `để tiết kiệm ${formattedSavings} VND/tháng.`;

        alerts.push({
          merchantName: canonicalName,
          count: subs.length,
          subscriberIds,
          subscriptions: subs,
          totalMonthlyCost,
          estimatedFamilyPlanCost,
          estimatedMonthlySavings,
          recommendationMessage,
        });
      }
    }

    return alerts;
  }
}
