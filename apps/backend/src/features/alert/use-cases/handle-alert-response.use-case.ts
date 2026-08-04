import type { ISubscriptionRepository } from '@/features/subscription/domain/subscription-repository.interface';
import {
  SubscriptionAction,
  type SubscriptionEntity,
} from '@/features/subscription/domain/subscription.entity';
import type { TransitionSubscriptionStateUseCase } from '@/features/subscription/use-cases/transition-subscription-state.use-case';
import type { IAlertRepository } from '../domain/alert-repository.interface';
import type { AlertEntity, AlertResponse } from '../domain/alert.entity';

export class AlertNotFoundError extends Error {
  constructor(public alertId: number) {
    super(`Alert with ID ${alertId} not found`);
    this.name = 'AlertNotFoundError';
  }
}

export interface HandleAlertResponseInput {
  alertId: number;
  response: 'KEEP' | 'KILL';
}

export interface HandleAlertResponseOutput {
  alert: AlertEntity;
  subscription: SubscriptionEntity;
}

export class HandleAlertResponseUseCase {
  constructor(
    private alertRepo: IAlertRepository,
    private subscriptionRepo: ISubscriptionRepository,
    private transitionStateUseCase: TransitionSubscriptionStateUseCase
  ) {}

  async execute(input: HandleAlertResponseInput): Promise<HandleAlertResponseOutput> {
    const alert = await this.alertRepo.findById(input.alertId);
    if (!alert) {
      throw new AlertNotFoundError(input.alertId);
    }

    const updatedResponse: AlertResponse = input.response;
    const updatedAlert = await this.alertRepo.update(alert.id, {
      response: updatedResponse,
    });

    const sub = await this.subscriptionRepo.findById(alert.subscriptionId);
    if (!sub) {
      throw new Error(`Subscription with ID ${alert.subscriptionId} not found`);
    }

    let updatedSubscription = sub;

    if (input.response === 'KEEP') {
      if (sub.status === 'TRIAL') {
        updatedSubscription = await this.transitionStateUseCase.execute({
          subscriptionId: alert.subscriptionId,
          action: SubscriptionAction.KEEP,
        });
      }
    } else if (input.response === 'KILL') {
      updatedSubscription = await this.transitionStateUseCase.execute({
        subscriptionId: alert.subscriptionId,
        action: SubscriptionAction.KILL,
      });
    }

    return {
      alert: updatedAlert,
      subscription: updatedSubscription,
    };
  }
}
