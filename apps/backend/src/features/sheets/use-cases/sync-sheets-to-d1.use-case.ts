import type { IGoogleSheetsClient } from '../domain/google-sheets-client.interface';
import type { ISubscriptionRepository } from '../../subscription/domain/subscription-repository.interface';
import { BillingCycle } from '../../subscription/domain/subscription.entity';

import type { SyncD1ToSheetsUseCase } from './sync-d1-to-sheets.use-case';

export interface SyncSheetsToD1Result {
  scanned: number;
  updated: number;
  skipped: number;
  errors: number;
  backfilled: number;
}

export class SyncSheetsToD1UseCase {
  constructor(
    private sheetsClient: IGoogleSheetsClient,
    private subscriptionRepo: ISubscriptionRepository,
    private syncD1ToSheetsUseCase?: SyncD1ToSheetsUseCase
  ) {}

  async execute(): Promise<SyncSheetsToD1Result> {
    const result: SyncSheetsToD1Result = {
      scanned: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      backfilled: 0,
    };

    try {
      const rows = await this.sheetsClient.readAllRows();

      for (const row of rows) {
        if (!row.id || isNaN(row.id)) {
          continue; // Skip invalid or manually added rows without ID
        }

        result.scanned++;

        try {
          const subscription = await this.subscriptionRepo.findById(row.id);
          if (!subscription) {
            result.skipped++;
            continue;
          }

          let needsUpdate = false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const updatePayload: any = {};

          // Compare allowed modifiable fields
          if (row.amount !== subscription.amount) {
            updatePayload.amount = row.amount;
            needsUpdate = true;
          }

          if (row.nextBillingDate !== subscription.nextBillingDate) {
            updatePayload.nextBillingDate = row.nextBillingDate;
            needsUpdate = true;
          }

          if (row.isMustKeep !== subscription.isMustKeep) {
            updatePayload.isMustKeep = row.isMustKeep;
            needsUpdate = true;
          }

          // Check for valid billing cycle before updating
          if (row.billingCycle !== subscription.billingCycle) {
            if (Object.values(BillingCycle).includes(row.billingCycle as BillingCycle)) {
              updatePayload.billingCycle = row.billingCycle as BillingCycle;
              needsUpdate = true;
            }
          }

          const rowKillLink = row.directKillLink === '' ? null : row.directKillLink;
          if (rowKillLink !== (subscription.directKillLink || null)) {
            updatePayload.directKillLink = rowKillLink;
            needsUpdate = true;
          }

          if (needsUpdate) {
            await this.subscriptionRepo.update(subscription.id, updatePayload);
            // eslint-disable-next-line no-console
            console.log(
              `[SyncSheetsToD1] Updated sub_id ${subscription.id} from Sheets`,
              updatePayload
            );
            result.updated++;

            // Note: We don't write back to Sheets here immediately to avoid circular sync,
            // the next D1 to Sheets sync or next read will pick it up.
          } else {
            result.skipped++;
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`[SyncSheetsToD1] Error processing row ${row.id}:`, error);
          result.errors++;
        }
      }

      // Phase 2: D1 -> Sheets Backfill (Reconciliation)
      if (this.syncD1ToSheetsUseCase) {
        try {
          const sheetIds = new Set(rows.map((r) => r.id).filter((id) => !isNaN(id)));
          const allSubscriptions = await this.subscriptionRepo.findAll();

          for (const sub of allSubscriptions) {
            if (!sheetIds.has(sub.id)) {
              // Missing in Sheets, backfill it
              await this.syncD1ToSheetsUseCase.execute(sub);
              result.backfilled++;
            }
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error(`[SyncSheetsToD1] Backfill failed:`, error);
        }
      }

      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`[SyncSheetsToD1] Failed to read from Sheets:`, error);
      throw error;
    }
  }
}
