import {
  SubscriptionAction,
  SubscriptionStatus,
  type SubscriptionEntity,
  transitionSubscriptionState,
} from '../domain/subscription.entity';
import type { ISubscriptionRepository } from '../domain/subscription-repository.interface';
import { generateDirectKillLink } from '../utils/kill-link-generator';

export interface TransitionSubscriptionStateInput {
  subscriptionId: number;
  action: SubscriptionAction;
}

export class SubscriptionNotFoundError extends Error {
  constructor(public subscriptionId: number) {
    super(`Subscription with ID ${subscriptionId} not found`);
    this.name = 'SubscriptionNotFoundError';
  }
}

export class TransitionSubscriptionStateUseCase {
  constructor(private subscriptionRepo: ISubscriptionRepository) {}

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

    return await this.subscriptionRepo.update(sub.id, updateData);
  }
}
