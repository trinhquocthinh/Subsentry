import { eq, and, desc } from 'drizzle-orm';
import { alerts } from '@/core/db/schema';
import type {
  IAlertRepository,
  CreateAlertInput,
  UpdateAlertInput,
} from '../domain/alert-repository.interface';
import type { AlertEntity, AlertType, AlertStatus, AlertResponse } from '../domain/alert.entity';

export class DrizzleAlertRepository implements IAlertRepository {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(private db: any) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapToEntity(row: any): AlertEntity {
    return {
      id: row.id,
      subscriptionId: row.subscriptionId,
      alertType: row.alertType as AlertType,
      scheduledAt: row.scheduledAt,
      triggeredAt: row.triggeredAt ?? null,
      status: row.status as AlertStatus,
      response: row.response as AlertResponse,
      createdAt: row.createdAt,
    };
  }

  async findById(id: number): Promise<AlertEntity | null> {
    const rows = await this.db.select().from(alerts).where(eq(alerts.id, id));
    if (!rows || rows.length === 0) return null;
    return this.mapToEntity(rows[0]);
  }

  async findAlertsBySubscriptionId(subscriptionId: number): Promise<AlertEntity[]> {
    const rows = await this.db
      .select()
      .from(alerts)
      .where(eq(alerts.subscriptionId, subscriptionId))
      .orderBy(desc(alerts.id));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => this.mapToEntity(r));
  }

  async findLatestAlertForCycle(
    subscriptionId: number,
    alertType: AlertType
  ): Promise<AlertEntity | null> {
    const rows = await this.db
      .select()
      .from(alerts)
      .where(and(eq(alerts.subscriptionId, subscriptionId), eq(alerts.alertType, alertType)))
      .orderBy(desc(alerts.id))
      .limit(1);

    if (!rows || rows.length === 0) return null;
    return this.mapToEntity(rows[0]);
  }

  async create(data: CreateAlertInput): Promise<AlertEntity> {
    const [inserted] = await this.db
      .insert(alerts)
      .values({
        subscriptionId: data.subscriptionId,
        alertType: data.alertType,
        scheduledAt: data.scheduledAt,
        triggeredAt: data.triggeredAt ?? null,
        status: data.status || 'SCHEDULED',
        response: data.response || 'PENDING',
      })
      .returning();

    return this.mapToEntity(inserted);
  }

  async update(id: number, data: UpdateAlertInput): Promise<AlertEntity> {
    const updatePayload: Record<string, unknown> = {};

    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.response !== undefined) updatePayload.response = data.response;
    if (data.triggeredAt !== undefined) updatePayload.triggeredAt = data.triggeredAt;

    const [updated] = await this.db
      .update(alerts)
      .set(updatePayload)
      .where(eq(alerts.id, id))
      .returning();

    return this.mapToEntity(updated);
  }
}
