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

  /** Chuẩn hoá mock cho lượt lấy access token (luôn là fetch đầu tiên). */
  const mockTokenOk = (expiresIn = 3600) =>
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: 'mock-token', expires_in: expiresIn }),
    });

  const mockValues = (values: unknown[][] | undefined) =>
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ values }) });

  describe('OAuth token', () => {
    it('ném lỗi khi Google từ chối cấp token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'invalid_grant',
      });

      await expect(adapter.readColumnA()).rejects.toThrow(
        'Failed to get Google access token: 401 invalid_grant'
      );
    });

    it('tái sử dụng access token còn hạn (chỉ gọi /token 1 lần cho 2 request)', async () => {
      mockTokenOk();
      mockValues([[1]]);
      mockValues([[2]]);

      await adapter.readColumnA();
      await adapter.readColumnA();

      const tokenCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === 'https://oauth2.googleapis.com/token'
      );
      expect(tokenCalls).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('xin token mới khi token cũ sắp hết hạn (đệm 60s)', async () => {
      // expires_in = 30s → luôn nằm trong vùng đệm 60s nên phải xin lại
      mockTokenOk(30);
      mockValues([[1]]);
      mockTokenOk(30);
      mockValues([[2]]);

      await adapter.readColumnA();
      await adapter.readColumnA();

      const tokenCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === 'https://oauth2.googleapis.com/token'
      );
      expect(tokenCalls).toHaveLength(2);
    });
  });

  describe('updateRow', () => {
    const row: SheetRow = {
      id: 7,
      merchantName: 'Spotify',
      amount: 59000,
      currency: 'VND',
      subscriberName: 'Con Út',
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      nextBillingDate: '2026-10-01',
      isMustKeep: true,
      directKillLink: 'https://spotify.com/cancel',
      confidenceScore: 0.99,
      lastSynced: '2026-08-10T00:00:00.000Z',
    };

    it('PUT đúng dải ô A{row}:L{row} và serialize isMustKeep thành TRUE', async () => {
      mockTokenOk();
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await expect(adapter.updateRow(5, row)).resolves.not.toThrow();

      const [url, init] = mockFetch.mock.calls[1];
      expect(url).toBe(
        `https://sheets.googleapis.com/v4/spreadsheets/${mockSheetId}/values/Sheet1!A5:L5?valueInputOption=USER_ENTERED`
      );
      expect(init.method).toBe('PUT');
      const sent = JSON.parse(init.body).values[0];
      expect(sent[8]).toBe('TRUE');
      expect(sent[9]).toBe('https://spotify.com/cancel');
    });

    it('serialize directKillLink null thành chuỗi rỗng', async () => {
      mockTokenOk();
      mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

      await adapter.updateRow(5, { ...row, isMustKeep: false, directKillLink: null });

      const sent = JSON.parse(mockFetch.mock.calls[1][1].body).values[0];
      expect(sent[8]).toBe('FALSE');
      expect(sent[9]).toBe('');
    });

    it('ném lỗi khi Sheets API trả status lỗi', async () => {
      mockTokenOk();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Server Error' });

      await expect(adapter.updateRow(5, row)).rejects.toThrow(
        'Failed to update row: 500 Server Error'
      );
    });
  });

  describe('readAllRows — giá trị khuyết', () => {
    it('áp giá trị mặc định khi ô trống hoặc không parse được', async () => {
      mockTokenOk();
      mockValues([[9, '', 'không-phải-số', '', '', '', '', '', 'TRUE', '', 'x', '']]);

      const [row] = await adapter.readAllRows();

      expect(row.id).toBe(9);
      expect(row.merchantName).toBe('');
      expect(row.amount).toBe(0);
      expect(row.currency).toBe('VND');
      expect(row.isMustKeep).toBe(true);
      expect(row.directKillLink).toBeNull();
      expect(row.confidenceScore).toBe(0);
    });

    it('trả mảng rỗng khi sheet chưa có dữ liệu (thiếu trường values)', async () => {
      mockTokenOk();
      mockValues(undefined);

      await expect(adapter.readAllRows()).resolves.toEqual([]);
    });
  });

  describe('readColumnA', () => {
    it('đọc dải A2:A và ép kiểu số', async () => {
      mockTokenOk();
      mockValues([['10'], ['20']]);

      await expect(adapter.readColumnA()).resolves.toEqual([10, 20]);
      expect(mockFetch.mock.calls[1][0]).toBe(
        `https://sheets.googleapis.com/v4/spreadsheets/${mockSheetId}/values/Sheet1!A2:A`
      );
    });

    it('ném lỗi khi API trả status lỗi', async () => {
      mockTokenOk();
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not Found' });

      await expect(adapter.readColumnA()).rejects.toThrow('Failed to read column A: 404 Not Found');
    });
  });

  describe('findRowIndexBySubscriptionId', () => {
    it('trả chỉ số dòng (offset +2 vì dòng 1 là header)', async () => {
      mockTokenOk();
      mockValues([[10], [20], [30]]);

      await expect(adapter.findRowIndexBySubscriptionId(30)).resolves.toBe(4);
    });

    it('trả 2 khi khớp bản ghi đầu tiên', async () => {
      mockTokenOk();
      mockValues([[10], [20]]);

      await expect(adapter.findRowIndexBySubscriptionId(10)).resolves.toBe(2);
    });

    it('trả null khi không tìm thấy id', async () => {
      mockTokenOk();
      mockValues([[10], [20]]);

      await expect(adapter.findRowIndexBySubscriptionId(999)).resolves.toBeNull();
    });

    it('trả null khi sheet rỗng', async () => {
      mockTokenOk();
      mockValues([]);

      await expect(adapter.findRowIndexBySubscriptionId(1)).resolves.toBeNull();
    });
  });

  it('dùng sheetName tuỳ chỉnh khi được truyền vào constructor', async () => {
    const custom = new GoogleSheetsClientAdapter(
      mockEmail,
      mockPrivateKey,
      mockSheetId,
      'Subscriptions'
    );
    mockTokenOk();
    mockValues([[1]]);

    await custom.readColumnA();

    expect(mockFetch.mock.calls[1][0]).toContain('Subscriptions!A2:A');
  });
});
