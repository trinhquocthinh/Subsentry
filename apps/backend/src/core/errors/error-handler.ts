import { ErrorHandler, NotFoundHandler } from 'hono';
import { ContentfulStatusCode } from 'hono/utils/http-status';
import { AppError } from './app-error';

/**
 * Global Error Handler bắt exception ném ra (throw)
 */
export const globalErrorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.errorCode,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.statusCode as ContentfulStatusCode
    );
  }

  // eslint-disable-next-line no-console
  console.error('[Unhandled Internal Error]:', err);

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred',
      },
    },
    500
  );
};

/**
 * NotFound Handler bắt tất cả route không tồn tại (404) trả về JSON chuẩn
 */
export const notFoundHandler: NotFoundHandler = (c) => {
  return c.json(
    {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route '${c.req.method} ${c.req.path}' not found`,
      },
    },
    404
  );
};
