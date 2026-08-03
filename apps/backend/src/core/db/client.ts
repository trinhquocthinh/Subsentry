import { drizzle, DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type AppDatabase = DrizzleD1Database<typeof schema>;

/**
 * Khởi tạo Drizzle DB Client từ Cloudflare D1 Database Binding (env.DB)
 */
export const createDbClient = (d1: D1Database): AppDatabase => {
  return drizzle(d1, { schema });
};

// Export schema tập trung phục vụ cho các Feature dùng chung
export * from './schema';
export { schema };
