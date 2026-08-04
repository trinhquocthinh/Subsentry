export interface PaymentCardEntity {
  id: number;
  cardLabel: string;
  cardOwnerId: number;
  lastFour?: string | null;
  isActive: boolean;
  createdAt?: string;
}

export interface IPaymentCardRepository {
  findById(id: number): Promise<PaymentCardEntity | null>;
}
