import type { IGoogleSheetsClient, SheetRow } from '../domain/google-sheets-client.interface';
import type { SubscriptionEntity } from '../../subscription/domain/subscription.entity';
import type { IMemberRepository } from '../../subscription/domain/member-repository.interface';

export class SyncD1ToSheetsUseCase {
  constructor(
    private sheetsClient: IGoogleSheetsClient,
    private memberRepo: IMemberRepository
  ) {}

  async execute(subscription: SubscriptionEntity): Promise<void> {
    try {
      // 1. Resolve subscriber name
      let subscriberName = `User ${subscription.subscriberId}`;
      const member = await this.memberRepo.findById(subscription.subscriberId);
      if (member) {
        subscriberName = member.displayName;
      }

      // 2. Map entity to SheetRow
      const now = new Date().toISOString();
      const rowData: SheetRow = {
        id: subscription.id,
        merchantName: subscription.merchantName,
        amount: subscription.amount,
        currency: subscription.currency,
        subscriberName,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        nextBillingDate: subscription.nextBillingDate,
        isMustKeep: subscription.isMustKeep,
        directKillLink: subscription.directKillLink || null,
        confidenceScore: subscription.confidenceScore,
        lastSynced: now,
      };

      // 3. Find existing row index
      const existingRowIndex = await this.sheetsClient.findRowIndexBySubscriptionId(
        subscription.id
      );

      // 4. Update or Append
      if (existingRowIndex) {
        await this.sheetsClient.updateRow(existingRowIndex, rowData);
        // eslint-disable-next-line no-console
        console.log(
          `[SyncD1ToSheets] Updated row ${existingRowIndex} for sub_id ${subscription.id}`
        );
      } else {
        await this.sheetsClient.appendRow(rowData);
        // eslint-disable-next-line no-console
        console.log(`[SyncD1ToSheets] Appended new row for sub_id ${subscription.id}`);
      }
    } catch (error) {
      // Best effort sync, so we just log the error and don't throw to break the main flow
      // eslint-disable-next-line no-console
      console.error(`[SyncD1ToSheets] Failed to sync sub_id ${subscription.id} to Sheets:`, error);
    }
  }
}
