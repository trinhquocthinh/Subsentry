import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createDbClient } from './core/db';
import { globalErrorHandler, notFoundHandler } from './core/errors/error-handler';
import { requestLogger } from './core/middleware/logger';

export type Bindings = {
  DB: D1Database;
  [key: string]: unknown;
};

const app = new Hono<{ Bindings: Bindings }>();

// Middlewares
app.use('*', requestLogger);

// Global Error & 404 Handler
app.onError(globalErrorHandler);
app.notFound(notFoundHandler);

// Health Check có thực hiện Query D1 thực tế
app.get('/health-check', async (c) => {
  try {
    const db = createDbClient(c.env.DB);
    // Thực thi query thật xuống SQLite D1
    await db.run(sql`SELECT 1`);

    return c.json({
      status: 'ok',
      service: '@subsentry/backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return c.json(
      {
        status: 'error',
        service: '@subsentry/backend',
        database: 'disconnected',
        error: error instanceof Error ? error.message : 'D1 Query Failed',
      },
      500
    );
  }
});

app.get('/', (c) => c.text('Subsentry API Kernel Active'));

export default app;
