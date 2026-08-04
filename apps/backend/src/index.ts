import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { RetryFailedParsingLogsUseCase } from './features/parser/use-cases/retry-failed-parsing-logs.use-case';
import { OpenAIParserAdapter } from './features/parser/adapters/openai-parser.adapter';
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

export default {
  fetch: app.fetch,
  scheduled: async (event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) => {
    const db = createDbClient(env.DB);
    const parserService = new OpenAIParserAdapter(env.OPENAI_API_KEY as string);
    const useCase = new RetryFailedParsingLogsUseCase(parserService, db);

    ctx.waitUntil(useCase.execute());
  },
};
