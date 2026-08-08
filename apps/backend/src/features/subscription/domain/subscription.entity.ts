export enum SubscriptionStatus {
  TRIAL = 'TRIAL',
  ACTIVE = 'ACTIVE',
  PENDING_KILL = 'PENDING_KILL',
  KILLED = 'KILLED',
}

export enum SubscriptionAction {
  KEEP = 'KEEP',
  KILL = 'KILL',
  CONFIRM_KILLED = 'CONFIRM_KILLED',
}

export enum BillingCycle {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export interface SubscriptionEntity {
  id: number;
  merchantName: string;
  amount: number;
  currency: string;
  subscriberId: number;
  paymentCardId?: number | null;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  nextBillingDate: string;
  confidenceScore: number;
  directKillLink?: string | null;
  isMustKeep: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export class InvalidStateTransitionError extends Error {
  constructor(
    public currentStatus: SubscriptionStatus,
    public action: SubscriptionAction
  ) {
    super(`Cannot execute action '${action}' on subscription in status '${currentStatus}'`);
    this.name = 'InvalidStateTransitionError';
  }
}

/**
 * Executes a valid state machine transition per SDD §1 & BR-04.
 *
 * Rules:
 * - TRIAL + KEEP -> ACTIVE (BR-04)
 * - TRIAL + KILL -> PENDING_KILL
 * - ACTIVE + KILL -> PENDING_KILL
 * - PENDING_KILL + CONFIRM_KILLED -> KILLED
 *
 * Reopen transition (TC-05):
 * - KILLED + New Invoice -> ACTIVE or TRIAL (handled by HandleIncomingInvoiceUseCase)
 */
export function transitionSubscriptionState(
  currentStatus: SubscriptionStatus,
  action: SubscriptionAction
): SubscriptionStatus {
  switch (currentStatus) {
    case SubscriptionStatus.TRIAL:
      if (action === SubscriptionAction.KEEP) {
        return SubscriptionStatus.ACTIVE;
      }
      if (action === SubscriptionAction.KILL) {
        return SubscriptionStatus.PENDING_KILL;
      }
      break;

    case SubscriptionStatus.ACTIVE:
      if (action === SubscriptionAction.KEEP) {
        return SubscriptionStatus.ACTIVE;
      }
      if (action === SubscriptionAction.KILL) {
        return SubscriptionStatus.PENDING_KILL;
      }
      break;

    case SubscriptionStatus.PENDING_KILL:
      if (action === SubscriptionAction.CONFIRM_KILLED) {
        return SubscriptionStatus.KILLED;
      }
      break;

    case SubscriptionStatus.KILLED:
      // KILLED cannot transition directly via user action buttons; reopens via handleIncomingInvoice
      break;
  }

  throw new InvalidStateTransitionError(currentStatus, action);
}
