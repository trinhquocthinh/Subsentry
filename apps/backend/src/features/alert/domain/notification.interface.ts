export interface SoftAlertInput {
  alertId: number;
  subscriptionId: number;
  merchantName: string;
  amount: number;
  currency: string;
  nextBillingDate: string;
  subscriberId: number;
}

export interface RedAlertInput {
  alertId: number;
  subscriptionId: number;
  merchantName: string;
  amount: number;
  currency: string;
  nextBillingDate: string;
  subscriberId: number;
  cardOwnerId?: number | null;
  cardLabel?: string | null;
  subscriberName?: string;
  cardOwnerName?: string;
}

export interface INotificationService {
  sendSoftAlert(input: SoftAlertInput): Promise<boolean>;
  sendRedAlert(input: RedAlertInput): Promise<boolean>;
}
