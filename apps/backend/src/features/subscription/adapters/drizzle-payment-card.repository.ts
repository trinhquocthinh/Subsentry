import { eq } from 'drizzle-orm';
import { paymentCards } from '@/core/db/schema';
import type {
  IPaymentCardRepository,
  PaymentCardEntity,
} from '../domain/payment-card-repository.interface';

export class DrizzlePaymentCardRepository implements IPaymentCardRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  async findById(id: number): Promise<PaymentCardEntity | null> {
    const rows = await this.db.select().from(paymentCards).where(eq(paymentCards.id, id));
    if (!rows || rows.length === 0) return null;
    const r = rows[0];
    return {
      id: r.id,
      cardLabel: r.cardLabel,
      cardOwnerId: r.cardOwnerId,
      lastFour: r.lastFour ?? null,
      isActive: Boolean(r.isActive),
      createdAt: r.createdAt,
    };
  }
}
