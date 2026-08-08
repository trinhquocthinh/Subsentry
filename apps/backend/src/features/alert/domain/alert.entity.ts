export type AlertType = 'SOFT_T3' | 'RED_T24';
export type AlertStatus = 'SCHEDULED' | 'SENT' | 'CANCELLED' | 'FAILED';
export type AlertResponse = 'PENDING' | 'KEEP' | 'KILL';

export interface AlertEntity {
  id: number;
  subscriptionId: number;
  alertType: AlertType;
  scheduledAt: string;
  triggeredAt?: string | null;
  status: AlertStatus;
  response: AlertResponse;
  createdAt: string;
}
