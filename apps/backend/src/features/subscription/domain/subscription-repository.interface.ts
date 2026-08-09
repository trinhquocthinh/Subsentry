import type { SubscriptionEntity } from './subscription.entity';

export type CreateSubscriptionInput = Omit<SubscriptionEntity, 'id' | 'createdAt' | 'updatedAt'>;

export type UpdateSubscriptionInput = Partial<Omit<SubscriptionEntity, 'id' | 'createdAt'>>;

export interface ISubscriptionRepository {
  findById(id: number): Promise<SubscriptionEntity | null>;
  findByMerchantAndSubscriber(
    merchantName: string,
    subscriberId: number
  ): Promise<SubscriptionEntity | null>;
  findActiveSubscriptions(): Promise<SubscriptionEntity[]>;
  findByNextBillingDateRange(startDate: string, endDate: string): Promise<SubscriptionEntity[]>;
  findAllActiveGroupedByMerchant(): Promise<Map<string, SubscriptionEntity[]>>;
  findAll(): Promise<SubscriptionEntity[]>;
  create(data: CreateSubscriptionInput): Promise<SubscriptionEntity>;
  update(id: number, data: UpdateSubscriptionInput): Promise<SubscriptionEntity>;
}
