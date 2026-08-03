import { describe, expect, it } from 'vitest';
import { alerts, createDbClient, members, paymentCards, subscriptions } from './client';

describe('Epic 2 - Shared Kernel: DB Client Wrapper', () => {
  it('Phải export đầy đủ các bảng schema từ client wrapper', () => {
    expect(members).toBeDefined();
    expect(paymentCards).toBeDefined();
    expect(subscriptions).toBeDefined();
    expect(alerts).toBeDefined();
  });

  it('Khởi tạo Drizzle DB Client từ D1 Binding thành công', () => {
    const mockD1 = {} as D1Database;
    const db = createDbClient(mockD1);
    expect(db).toBeDefined();
    expect(db.query).toBeDefined();
  });
});
