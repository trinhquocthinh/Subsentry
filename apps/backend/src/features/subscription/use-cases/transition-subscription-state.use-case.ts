import {
  SubscriptionAction,
  SubscriptionStatus,
  type SubscriptionEntity,
  transitionSubscriptionState,
} from '../domain/subscription.entity';
import type { ISubscriptionRepository } from '../domain/subscription-repository.interface';
import { generateDirectKillLink } from '../utils/kill-link-generator';
import type { SyncD1ToSheetsUseCase } from '../../sheets/use-cases/sync-d1-to-sheets.use-case';

export interface TransitionSubscriptionStateInput {
  subscriptionId: number;
  action: SubscriptionAction;
  onAsyncWork?: (promise: Promise<void>) => void;
}

export class SubscriptionNotFoundError extends Error {
  constructor(public subscriptionId: number) {
    super(`Subscription with ID ${subscriptionId} not found`);
    this.name = 'SubscriptionNotFoundError';
  }
}

export class TransitionSubscriptionStateUseCase {
  constructor(
    private subscriptionRepo: ISubscriptionRepository,
    private syncD1ToSheetsUseCase?: SyncD1ToSheetsUseCase
  ) {}

  async execute(input: TransitionSubscriptionStateInput): Promise<SubscriptionEntity> {
    const sub = await this.subscriptionRepo.findById(input.subscriptionId);
    if (!sub) {
      throw new SubscriptionNotFoundError(input.subscriptionId);
    }

    const nextStatus = transitionSubscriptionState(sub.status, input.action);

    const updateData: Partial<SubscriptionEntity> = {
      status: nextStatus,
    };

    // Task 4.2.2: Generates direct_kill_link when moving to PENDING_KILL
    if (nextStatus === SubscriptionStatus.PENDING_KILL && !sub.directKillLink) {
      updateData.directKillLink = generateDirectKillLink(sub.merchantName);
    }

    const updatedSub = await this.subscriptionRepo.update(sub.id, updateData);

    if (this.syncD1ToSheetsUseCase) {
      const promise = this.syncD1ToSheetsUseCase.execute(updatedSub).catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[TransitionSubscriptionState] Sync failed:', err);
      });
      if (input.onAsyncWork) {
        input.onAsyncWork(promise);
      }
    }

    return updatedSub;
  }
}
