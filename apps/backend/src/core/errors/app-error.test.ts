import { describe, it, expect, vi } from 'vitest';
import { NotFoundError, BadRequestError, UnauthorizedError } from './app-error';
import { globalErrorHandler, notFoundHandler } from './error-handler';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import type { Context } from 'hono';

describe('AppError & Error Handlers', () => {
  it('Khởi tạo đúng properties cho các subclass AppError', () => {
    const notFound = new NotFoundError('Item missing');
    expect(notFound.statusCode).toBe(404);
    expect(notFound.errorCode).toBe('NOT_FOUND');
    expect(notFound.message).toBe('Item missing');

    const badRequest = new BadRequestError('Invalid input', { field: 'name' });
    expect(badRequest.statusCode).toBe(400);
    expect(badRequest.errorCode).toBe('BAD_REQUEST');
    expect(badRequest.details).toEqual({ field: 'name' });

    const unauthorized = new UnauthorizedError();
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.errorCode).toBe('UNAUTHORIZED');

    const defaultNotFound = new NotFoundError();
    expect(defaultNotFound.message).toBe('Resource not found');
  });

  it('globalErrorHandler trả về JSON đúng chuẩn khi gặp AppError', () => {
    const jsonFn = vi.fn().mockImplementation((payload, status) => ({ payload, status }));
    const mockContext = { json: jsonFn } as unknown as Context;

    const error = new BadRequestError('Field missing', { field: 'email' });
    globalErrorHandler(error, mockContext);

    expect(jsonFn).toHaveBeenCalledWith(
      {
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Field missing',
          details: { field: 'email' },
        },
      },
      400
    );
  });

  it('globalErrorHandler trả về status 500 khi gặp lỗi chưa xác định', () => {
    const jsonFn = vi.fn().mockImplementation((payload, status) => ({ payload, status }));
    const mockContext = { json: jsonFn } as unknown as Context;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    globalErrorHandler(new Error('Unexpected database failure'), mockContext);

    expect(jsonFn).toHaveBeenCalledWith(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected internal error occurred',
        },
      },
      500
    );
    consoleSpy.mockRestore();
  });

  it('notFoundHandler trả về response JSON 404', () => {
    const jsonFn = vi.fn().mockImplementation((payload, status) => ({ payload, status }));
    const mockContext = {
      req: { method: 'GET', path: '/invalid-path' },
      json: jsonFn,
    } as unknown as Context;

    notFoundHandler(mockContext);

    expect(jsonFn).toHaveBeenCalledWith(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: "Route 'GET /invalid-path' not found",
        },
      },
      404
    );
  });
});
