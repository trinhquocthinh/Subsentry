import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleSheetsClientAdapter } from './google-sheets-client.adapter';
import type { SheetRow } from '../domain/google-sheets-client.interface';

// Mock Web Crypto API
const mockSign = vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
const mockImportKey = vi.fn().mockResolvedValue({} as CryptoKey);

Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      sign: mockSign,
      importKey: mockImportKey,
    },
  },
});

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GoogleSheetsClientAdapter', () => {
  let adapter: GoogleSheetsClientAdapter;
  const mockEmail = 'test@example.com';
  // Use a minimal valid base64 string to simulate the PEM body
  const mockPrivateKey = '-----BEGIN PRIVATE KEY-----\ndGVzdA==\n-----END PRIVATE KEY-----';
  const mockSheetId = 'sheet123';

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GoogleSheetsClientAdapter(mockEmail, mockPrivateKey, mockSheetId);
  });

  it('should authenticate and append a row', async () => {
    // Mock token response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock-token', expires_in: 3600 }),
    });

    // Mock append response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const row: SheetRow = {
      id: 1,
      merchantName: 'Netflix',
      amount: 260000,
      currency: 'VND',
      subscriberName: 'Con Cả',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      nextBillingDate: '2026-09-02',
      isMustKeep: false,
      directKillLink: null,
      confidenceScore: 0.95,
      lastSynced: '2026-08-09T00:00:00.000Z',
    };

    await expect(adapter.appendRow(row)).resolves.not.toThrow();

    // Verify token fetch
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://oauth2.googleapis.com/token',
      expect.any(Object)
    );

    // Verify append fetch
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      `https://sheets.googleapis.com/v4/spreadsheets/${mockSheetId}/values/Sheet1!A:L:append?valueInputOption=USER_ENTERED`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      })
    );
  });

  it('should read all rows and parse correctly', async () => {
    // Mock token response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock-token', expires_in: 3600 }),
    });

    // Mock read response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        values: [
          [
            1,
            'Netflix',
            260000,
            'VND',
            'Con Cả',
            'ACTIVE',
            'MONTHLY',
            '2026-09-02',
            'FALSE',
            '',
            0.95,
            '',
          ],
        ],
      }),
    });

    const rows = await adapter.readAllRows();

    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(1);
    expect(rows[0].merchantName).toBe('Netflix');
    expect(rows[0].amount).toBe(260000);
    expect(rows[0].isMustKeep).toBe(false);
  });

  it('should throw an error if Sheets API returns non-ok status', async () => {
    // Mock token response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock-token', expires_in: 3600 }),
    });

    // Mock error response
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    });

    await expect(adapter.readAllRows()).rejects.toThrow('Failed to read rows: 403 Forbidden');
  });
});
