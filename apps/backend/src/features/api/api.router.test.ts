import { describe, expect, it, vi, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { apiRouter } from './api.router';
import { members, subscriptions, paymentCards } from '@/core/db/schema';
import { createTestDatabase } from '@/test/d1-test-bridge';
import type { Bindings } from '@/index';

// Mock the middleware so we don't have to generate real Telegram initData signatures in tests
vi.mock('@/core/middleware/telegram-init-data.middleware', () => {
  return {
    telegramInitDataAuth: () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return async (c: any, next: any) => {
        // Just mock setting the context variables
        c.set('telegramUser', { id: 12345, first_name: 'Test' });
        c.set('familyMember', { id: 1, displayName: 'Test Member', role: 'ADMIN' });
        return next();
      };
    },
  };
});

describe('API Router (/api/v1)', () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>>['db'];
  let d1Mock: D1Database;
  let app: Hono<{ Bindings: Bindings }>;

  beforeEach(async () => {
    ({ db, d1: d1Mock } = await createTestDatabase());

    // Setup Hono app with the router
    app = new Hono<{ Bindings: Bindings }>();
    app.route('/api/v1', apiRouter);

    // Insert dummy family member (ID: 1)
    await db.insert(members).values({
      id: 1,
      displayName: 'Test Member',
      role: 'ADMIN',
      telegramChatId: '12345',
    });
  });

  describe('GET /subscriptions', () => {
    it('should return enriched subscriptions', async () => {
      await db.insert(paymentCards).values({
        id: 1,
        cardLabel: 'Techcombank',
        lastFour: '1234',
        cardOwnerId: 1,
        isActive: true,
      });

      await db.insert(subscriptions).values({
        merchantName: 'Netflix',
        amount: 260000,
        currency: 'VND',
        subscriberId: 1,
        paymentCardId: 1,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        nextBillingDate: '2024-05-15',
        confidenceScore: 0.95,
      });

      const res = await app.request(
        '/api/v1/subscriptions',
        {
          headers: { 'X-Telegram-Init-Data': 'mock-data' },
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].merchantName).toBe('Netflix');
      expect(json.data[0].subscriberName).toBe('Test Member');
      expect(json.data[0].cardLabel).toBe('Techcombank');
    });
  });

  describe('PATCH /subscriptions/:id', () => {
    let subId: number;

    beforeEach(async () => {
      const inserted = await db
        .insert(subscriptions)
        .values({
          merchantName: 'Spotify',
          amount: 59000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2024-06-01',
          confidenceScore: 0.99,
        })
        .returning();
      subId = inserted[0].id;

      await db.insert(paymentCards).values({
        id: 99,
        cardLabel: 'VPBank',
        cardOwnerId: 1,
        isActive: true,
      });
    });

    it('should reject invalid amount', async () => {
      const res = await app.request(
        `/api/v1/subscriptions/${subId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ amount: -100 }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(400);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.error.message).toBe('Invalid amount');
    });

    it('should reject invalid nextBillingDate', async () => {
      const res = await app.request(
        `/api/v1/subscriptions/${subId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ nextBillingDate: 'invalid-date' }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(400);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.error.message).toBe('Invalid nextBillingDate');
    });

    it('should reject non-existent paymentCardId', async () => {
      const res = await app.request(
        `/api/v1/subscriptions/${subId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ paymentCardId: 9999 }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(400);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.error.message).toBe('Payment card not found');
    });

    it('should successfully update valid fields', async () => {
      const res = await app.request(
        `/api/v1/subscriptions/${subId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({
            amount: 65000,
            nextBillingDate: '2099-07-01',
            isMustKeep: true,
            paymentCardId: 99,
          }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.success).toBe(true);

      const updated = await db.select().from(subscriptions).where(eq(subscriptions.id, subId));
      expect(updated[0].amount).toBe(65000);
      expect(updated[0].nextBillingDate).toBe('2099-07-01');
      expect(updated[0].isMustKeep).toBe(true);
      expect(updated[0].paymentCardId).toBe(99);
    });
  });

  describe('GET /stats/spending', () => {
    it('should return aggregated spending stats', async () => {
      await db.insert(subscriptions).values([
        {
          merchantName: 'Netflix',
          amount: 260000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-05-15',
          confidenceScore: 0.95,
        },
        {
          merchantName: 'Spotify',
          amount: 59000,
          currency: 'VND',
          subscriberId: 1,
          status: 'TRIAL',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-06-01',
          confidenceScore: 0.99,
        },
      ]);

      const res = await app.request(
        '/api/v1/stats/spending',
        {
          headers: { 'X-Telegram-Init-Data': 'mock-data' },
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();
      expect(json.success).toBe(true);

      expect(json.data.totalMonthly).toBe(319000);
      expect(json.data.activeCount).toBe(1);
      expect(json.data.trialCount).toBe(1);
      expect(json.data.byMerchant).toHaveLength(2);
      expect(json.data.bySubscriber).toHaveLength(1);
      expect(json.data.bySubscriber[0].amount).toBe(319000);
      expect(json.data.nextBilling.merchantName).toBe('Netflix');
    });

    it('quy đổi gói YEARLY và WEEKLY về số tiền hàng tháng', async () => {
      await db.insert(subscriptions).values([
        {
          merchantName: 'Adobe',
          amount: 1200000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'YEARLY',
          nextBillingDate: '2099-01-01',
          confidenceScore: 0.9,
        },
        {
          merchantName: 'Báo Tuần',
          amount: 10000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'WEEKLY',
          nextBillingDate: '2099-02-01',
          confidenceScore: 0.9,
        },
      ]);

      const res = await app.request(
        '/api/v1/stats/spending',
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      // 1.200.000/12 = 100.000 ; 10.000*4 = 40.000
      expect(json.data.totalMonthly).toBe(140000);
    });

    it('cộng dồn nhiều gói cùng merchant vào một mục', async () => {
      await db.insert(subscriptions).values([
        {
          merchantName: 'Netflix',
          amount: 100000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-05-15',
          confidenceScore: 0.95,
        },
        {
          merchantName: 'Netflix',
          amount: 50000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-05-20',
          confidenceScore: 0.95,
        },
      ]);

      const res = await app.request(
        '/api/v1/stats/spending',
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(json.data.byMerchant).toHaveLength(1);
      expect(json.data.byMerchant[0].amount).toBe(150000);
    });

    it('bỏ qua gói KILLED và trả nextBilling = null khi không có kỳ nào sắp tới', async () => {
      await db.insert(subscriptions).values([
        {
          merchantName: 'Đã Huỷ',
          amount: 999000,
          currency: 'VND',
          subscriberId: 1,
          status: 'KILLED',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-05-15',
          confidenceScore: 0.9,
        },
        {
          merchantName: 'Quá Hạn',
          amount: 50000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2000-01-01',
          confidenceScore: 0.9,
        },
      ]);

      const res = await app.request(
        '/api/v1/stats/spending',
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(json.data.totalMonthly).toBe(50000);
      expect(json.data.nextBilling).toBeNull();
    });
  });

  describe('GET /subscriptions/:id', () => {
    it('trả 400 khi id không phải số', async () => {
      const res = await app.request(
        '/api/v1/subscriptions/abc',
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.code).toBe('BAD_REQUEST');
    });

    it('trả 404 khi không tìm thấy gói', async () => {
      const res = await app.request(
        '/api/v1/subscriptions/9999',
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('trả chi tiết đầy đủ kèm thông tin thẻ và chủ thẻ', async () => {
      await db.insert(members).values({ id: 2, displayName: 'Chủ Thẻ', role: 'ADMIN' });
      await db.insert(paymentCards).values({
        id: 7,
        cardLabel: 'Techcombank',
        lastFour: '4321',
        cardOwnerId: 2,
        isActive: true,
      });
      const [sub] = await db
        .insert(subscriptions)
        .values({
          merchantName: 'Netflix',
          amount: 260000,
          currency: 'VND',
          subscriberId: 1,
          paymentCardId: 7,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-05-15',
          confidenceScore: 0.95,
          isMustKeep: true,
        })
        .returning();

      const res = await app.request(
        `/api/v1/subscriptions/${sub.id}`,
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(res.status).toBe(200);
      expect(json.data.merchantName).toBe('Netflix');
      expect(json.data.subscriberName).toBe('Test Member');
      expect(json.data.cardLabel).toBe('Techcombank');
      expect(json.data.cardLastFour).toBe('4321');
      expect(json.data.cardOwnerName).toBe('Chủ Thẻ');
      expect(json.data.isMustKeep).toBe(true);
    });

    it('trả các trường thẻ = null khi gói không gắn thẻ', async () => {
      const [sub] = await db
        .insert(subscriptions)
        .values({
          merchantName: 'Spotify',
          amount: 59000,
          currency: 'VND',
          subscriberId: 1,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-06-01',
          confidenceScore: 0.99,
        })
        .returning();

      const res = await app.request(
        `/api/v1/subscriptions/${sub.id}`,
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(json.data.cardLabel).toBeNull();
      expect(json.data.cardLastFour).toBeNull();
      expect(json.data.cardOwnerName).toBeNull();
      expect(json.data.isMustKeep).toBe(false);
    });
  });

  describe('PATCH /subscriptions/:id — nhánh còn thiếu', () => {
    it('trả 400 khi id không phải số', async () => {
      const res = await app.request(
        '/api/v1/subscriptions/abc',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ amount: 1000 }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(400);
    });

    it('trả 400 khi không có trường hợp lệ nào để cập nhật', async () => {
      const res = await app.request(
        '/api/v1/subscriptions/1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ merchantName: 'Không được phép sửa' }),
        },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(res.status).toBe(400);
      expect(json.error.message).toBe('No valid fields to update');
    });

    it('trả 400 khi amount không phải kiểu số', async () => {
      const res = await app.request(
        '/api/v1/subscriptions/1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ amount: '60000' }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(400);
    });

    it('trả 404 khi gói không tồn tại', async () => {
      const res = await app.request(
        '/api/v1/subscriptions/9999',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ amount: 1000 }),
        },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(res.status).toBe(404);
      expect(json.error.code).toBe('NOT_FOUND');
    });

    it('cho phép gỡ thẻ bằng paymentCardId = null (bỏ qua bước kiểm tra thẻ)', async () => {
      await db.insert(paymentCards).values({
        id: 5,
        cardLabel: 'VIB',
        cardOwnerId: 1,
        isActive: true,
      });
      const [sub] = await db
        .insert(subscriptions)
        .values({
          merchantName: 'YouTube',
          amount: 79000,
          currency: 'VND',
          subscriberId: 1,
          paymentCardId: 5,
          status: 'ACTIVE',
          billingCycle: 'MONTHLY',
          nextBillingDate: '2099-06-01',
          confidenceScore: 0.9,
        })
        .returning();

      const res = await app.request(
        `/api/v1/subscriptions/${sub.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': 'mock-data' },
          body: JSON.stringify({ paymentCardId: null }),
        },
        { DB: d1Mock }
      );

      expect(res.status).toBe(200);
      const updated = await db.select().from(subscriptions).where(eq(subscriptions.id, sub.id));
      expect(updated[0].paymentCardId).toBeNull();
    });
  });

  describe('GET /members', () => {
    it('trả danh sách thành viên gia đình', async () => {
      await db.insert(members).values({
        id: 3,
        displayName: 'Con Út',
        role: 'SUBSCRIBER',
        telegramChatId: '55555',
        email: 'conut@example.com',
      });

      const res = await app.request(
        '/api/v1/members',
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(2);
      const conUt = json.data.find((m: { id: number }) => m.id === 3);
      expect(conUt.displayName).toBe('Con Út');
      expect(conUt.email).toBe('conut@example.com');
    });
  });

  describe('GET /payment-cards', () => {
    it('trả danh sách thẻ kèm tên chủ thẻ', async () => {
      await db.insert(paymentCards).values({
        id: 11,
        cardLabel: 'Techcombank',
        lastFour: '1234',
        cardOwnerId: 1,
        isActive: true,
      });

      const res = await app.request(
        '/api/v1/payment-cards',
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(res.status).toBe(200);
      expect(json.data).toHaveLength(1);
      expect(json.data[0].cardOwnerName).toBe('Test Member');
      expect(json.data[0].isActive).toBe(true);
    });

    it('phản ánh đúng cờ isActive = false', async () => {
      await db.insert(paymentCards).values({
        id: 12,
        cardLabel: 'Thẻ Đã Khoá',
        cardOwnerId: 1,
        isActive: false,
      });

      const res = await app.request(
        '/api/v1/payment-cards',
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(json.data[0].isActive).toBe(false);
    });
  });

  describe('GET /subscriptions — nhánh làm giàu dữ liệu', () => {
    it('trả cardLabel = null khi gói chưa gắn thẻ', async () => {
      await db.insert(subscriptions).values({
        merchantName: 'Spotify',
        amount: 59000,
        currency: 'VND',
        subscriberId: 1,
        status: 'ACTIVE',
        billingCycle: 'MONTHLY',
        nextBillingDate: '2099-06-01',
        confidenceScore: 0.99,
      });

      const res = await app.request(
        '/api/v1/subscriptions',
        { headers: { 'X-Telegram-Init-Data': 'mock-data' } },
        { DB: d1Mock }
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json: any = await res.json();

      expect(json.data[0].cardLabel).toBeNull();
      expect(json.data[0].cardOwnerName).toBeNull();
    });
  });
});
