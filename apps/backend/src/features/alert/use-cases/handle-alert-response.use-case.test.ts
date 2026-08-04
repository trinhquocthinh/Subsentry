import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import { members } from '@/core/db/schema';
import { DrizzleSubscriptionRepository } from '@/features/subscription/adapters/drizzle-subscription.repository';
import { TransitionSubscriptionStateUseCase } from '@/features/subscription/use-cases/transition-subscription-state.use-case';
import {
  SubscriptionStatus,
  BillingCycle,
} from '@/features/subscription/domain/subscription.entity';
import { DrizzleAlertRepository } from '../adapters/drizzle-alert.repository';
import { HandleAlertResponseUseCase, AlertNotFoundError } from './handle-alert-response.use-case';

const migrationsFolder = path.resolve(__dirname, '../../../../drizzle');

describe('HandleAlertResponseUseCase Tests', () => {
  let sqlite: InstanceType<typeof Database>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;
  let subRepo: DrizzleSubscriptionRepository;
  let alertRepo: DrizzleAlertRepository;
  let transitionUseCase: TransitionSubscriptionStateUseCase;
  let useCase: HandleAlertResponseUseCase;
  let subscriptionId: number;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    sqlite.pragma('foreign_keys = ON');
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder });

    subRepo = new DrizzleSubscriptionRepository(db);
    alertRepo = new DrizzleAlertRepository(db);
    transitionUseCase = new TransitionSubscriptionStateUseCase(subRepo);
    useCase = new HandleAlertResponseUseCase(alertRepo, subRepo, transitionUseCase);

    const [member] = await db
      .insert(members)
      .values({
        displayName: 'Thành viên Test Alert Response',
        role: 'SUBSCRIBER',
        zaloUserId: 'zalo_resp_1',
      })
      .returning();

    const sub = await subRepo.create({
      merchantName: 'Adobe Creative Cloud',
      amount: 499000,
      currency: 'VND',
      subscriberId: member.id,
      status: SubscriptionStatus.ACTIVE,
      billingCycle: BillingCycle.MONTHLY,
      nextBillingDate: '2026-08-10',
      confidenceScore: 0.95,
      isMustKeep: false,
    });

    subscriptionId = sub.id;
  });

  it('Xử lý phản hồi KEEP: cập nhật alert response = KEEP và duy trì trạng thái ACTIVE', async () => {
    const alert = await alertRepo.create({
      subscriptionId,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-08-07T08:00:00.000Z',
      status: 'SENT',
      response: 'PENDING',
    });

    const result = await useCase.execute({
      alertId: alert.id,
      response: 'KEEP',
    });

    expect(result.alert.response).toBe('KEEP');
    expect(result.subscription.status).toBe(SubscriptionStatus.ACTIVE);
  });

  it('Xử lý phản hồi KILL: cập nhật alert response = KILL và chuyển trạng thái subscription sang PENDING_KILL kèm kill link', async () => {
    const alert = await alertRepo.create({
      subscriptionId,
      alertType: 'SOFT_T3',
      scheduledAt: '2026-08-07T08:00:00.000Z',
      status: 'SENT',
      response: 'PENDING',
    });

    const result = await useCase.execute({
      alertId: alert.id,
      response: 'KILL',
    });

    expect(result.alert.response).toBe('KILL');
    expect(result.subscription.status).toBe(SubscriptionStatus.PENDING_KILL);
    expect(result.subscription.directKillLink).toBeDefined();
    expect(decodeURIComponent(result.subscription.directKillLink || '')).toContain('Adobe');
  });

  it('Ném ra lỗi AlertNotFoundError khi truyền alertId không tồn tại', async () => {
    await expect(
      useCase.execute({
        alertId: 999999,
        response: 'KEEP',
      })
    ).rejects.toThrow(AlertNotFoundError);
  });
});
