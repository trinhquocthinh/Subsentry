import type { AlertEntity, AlertType } from './alert.entity';

export type CreateAlertInput = Omit<AlertEntity, 'id' | 'createdAt' | 'triggeredAt'> & {
  triggeredAt?: string | null;
};

export type UpdateAlertInput = Partial<Omit<AlertEntity, 'id' | 'createdAt'>>;

export interface IAlertRepository {
  findById(id: number): Promise<AlertEntity | null>;
  findAlertsBySubscriptionId(subscriptionId: number): Promise<AlertEntity[]>;
  findLatestAlertForCycle(
    subscriptionId: number,
    alertType: AlertType
  ): Promise<AlertEntity | null>;
  create(data: CreateAlertInput): Promise<AlertEntity>;
  update(id: number, data: UpdateAlertInput): Promise<AlertEntity>;
}
