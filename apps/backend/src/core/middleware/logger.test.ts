import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from './logger';

describe('Logger Middleware & SanitizeUrl', () => {
  it('Mặt nạ hóa tham số sensitive trên URL query string', () => {
    const url = 'https://api.example.com/webhook?token=secret123&user=john';
    const sanitized = sanitizeUrl(url);
    expect(sanitized).toContain('token=%5BREDACTED%5D');
    expect(sanitized).toContain('user=john');
  });

  it('Trả về nguyên mẫu urlString nếu không parse được URL hợp lệ', () => {
    const invalidUrl = 'not-a-valid-url-string';
    expect(sanitizeUrl(invalidUrl)).toBe(invalidUrl);
  });
});
