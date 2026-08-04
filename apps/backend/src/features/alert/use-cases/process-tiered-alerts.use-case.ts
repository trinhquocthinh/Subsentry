import type { ISubscriptionRepository } from '@/features/subscription/domain/subscription-repository.interface';
import type { IMemberRepository } from '@/features/subscription/domain/member-repository.interface';
import type { IPaymentCardRepository } from '@/features/subscription/domain/payment-card-repository.interface';
import type { IAlertRepository } from '../domain/alert-repository.interface';
import type { INotificationService } from '../domain/notification.interface';

export interface ExemptedSpendReportItem {
  subscriptionId: number;
  merchantName: string;
  amount: number;
  currency: string;
  nextBillingDate: string;
}

export interface ProcessTieredAlertsResult {
  processedCount: number;
  softAlertsSent: number;
  redAlertsSent: number;
  exemptedCount: number;
  exemptedSpendReports: ExemptedSpendReportItem[];
}

export class ProcessTieredAlertsUseCase {
  constructor(
    private subscriptionRepo: ISubscriptionRepository,
    private alertRepo: IAlertRepository,
    private notificationService: INotificationService,
    private memberRepo?: IMemberRepository,
    private paymentCardRepo?: IPaymentCardRepository
  ) {}

  private calculateDaysRemaining(nextBillingDateStr: string, currentDateStr: string): number {
    const nextDate = new Date(nextBillingDateStr.split('T')[0]);
    const currDate = new Date(currentDateStr.split('T')[0]);
    const diffTime = nextDate.getTime() - currDate.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24));
  }

  async execute(currentDate?: string): Promise<ProcessTieredAlertsResult> {
    const today = currentDate || new Date().toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    const activeSubscriptions = await this.subscriptionRepo.findActiveSubscriptions();

    let softAlertsSent = 0;
    let redAlertsSent = 0;
    let exemptedCount = 0;
    const exemptedSpendReports: ExemptedSpendReportItem[] = [];

    for (const sub of activeSubscriptions) {
      const daysRemaining = this.calculateDaysRemaining(sub.nextBillingDate, today);

      // T-3 Days: Soft Alert (Private Chat)
      if (daysRemaining === 3) {
        const existingSoftAlert = await this.alertRepo.findLatestAlertForCycle(sub.id, 'SOFT_T3');

        // Avoid duplicate soft alerts for the same nextBillingDate cycle
        if (!existingSoftAlert || existingSoftAlert.scheduledAt.split('T')[0] !== today) {
          const alertRecord = await this.alertRepo.create({
            subscriptionId: sub.id,
            alertType: 'SOFT_T3',
            scheduledAt: nowIso,
            status: 'SCHEDULED',
            response: 'PENDING',
          });

          const sent = await this.notificationService.sendSoftAlert({
            alertId: alertRecord.id,
            subscriptionId: sub.id,
            merchantName: sub.merchantName,
            amount: sub.amount,
            currency: sub.currency,
            nextBillingDate: sub.nextBillingDate,
            subscriberId: sub.subscriberId,
          });

          if (sent) {
            await this.alertRepo.update(alertRecord.id, {
              status: 'SENT',
              triggeredAt: nowIso,
            });
            softAlertsSent++;
          }
        }
      }

      // T-1 Day (T-24h): Red Alert Escalation (Family Group Chat)
      if (daysRemaining === 1) {
        const latestSoftAlert = await this.alertRepo.findLatestAlertForCycle(sub.id, 'SOFT_T3');
        const hasReplied = latestSoftAlert && latestSoftAlert.response !== 'PENDING';

        if (!hasReplied) {
          // BR-05 & TC-08: Must-Keep Exemption
          if (sub.isMustKeep) {
            exemptedCount++;
            const spendItem: ExemptedSpendReportItem = {
              subscriptionId: sub.id,
              merchantName: sub.merchantName,
              amount: sub.amount,
              currency: sub.currency,
              nextBillingDate: sub.nextBillingDate,
            };
            exemptedSpendReports.push(spendItem);
            // eslint-disable-next-line no-console
            console.log(
              `[SpendReport] Logged Must-Keep Exemption for ${sub.merchantName} (${sub.amount} ${sub.currency}) - Next billing: ${sub.nextBillingDate}`
            );
            continue;
          }

          const existingRedAlert = await this.alertRepo.findLatestAlertForCycle(sub.id, 'RED_T24');

          if (!existingRedAlert || existingRedAlert.scheduledAt.split('T')[0] !== today) {
            const alertRecord = await this.alertRepo.create({
              subscriptionId: sub.id,
              alertType: 'RED_T24',
              scheduledAt: nowIso,
              status: 'SENT',
              triggeredAt: nowIso,
              response: 'PENDING',
            });

            // Join Subscriber & Card Owner Member Details (BR-04)
            let subscriberName: string | undefined;
            let cardOwnerId: number | undefined;
            let cardLabel: string | undefined;
            let cardOwnerName: string | undefined;

            if (this.memberRepo) {
              const subscriber = await this.memberRepo.findById(sub.subscriberId);
              if (subscriber) {
                subscriberName = subscriber.displayName;
              }
            }

            if (sub.paymentCardId && this.paymentCardRepo) {
              const card = await this.paymentCardRepo.findById(sub.paymentCardId);
              if (card) {
                cardLabel = card.cardLabel;
                cardOwnerId = card.cardOwnerId;

                if (this.memberRepo) {
                  const owner = await this.memberRepo.findById(card.cardOwnerId);
                  if (owner) {
                    cardOwnerName = owner.displayName;
                  }
                }
              }
            }

            const sent = await this.notificationService.sendRedAlert({
              alertId: alertRecord.id,
              subscriptionId: sub.id,
              merchantName: sub.merchantName,
              amount: sub.amount,
              currency: sub.currency,
              nextBillingDate: sub.nextBillingDate,
              subscriberId: sub.subscriberId,
              subscriberName,
              cardOwnerId,
              cardLabel,
              cardOwnerName,
            });

            if (sent) {
              redAlertsSent++;
            }
          }
        }
      }
    }

    return {
      processedCount: activeSubscriptions.length,
      softAlertsSent,
      redAlertsSent,
      exemptedCount,
      exemptedSpendReports,
    };
  }
}
