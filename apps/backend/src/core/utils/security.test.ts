import { describe, it, expect } from 'vitest';
import { timingSafeEqualStr } from './security';

describe('Security Utilities', () => {
  describe('timingSafeEqualStr', () => {
    it('should return true for identical strings', () => {
      expect(timingSafeEqualStr('secret_token_123', 'secret_token_123')).toBe(true);
    });

    it('should return false for strings of different lengths', () => {
      expect(timingSafeEqualStr('short', 'longer_string')).toBe(false);
    });

    it('should return false for strings of same length but different content', () => {
      expect(timingSafeEqualStr('secret_token_123', 'secret_token_456')).toBe(false);
    });
  });
});
