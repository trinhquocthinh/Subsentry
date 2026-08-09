import type { IGoogleSheetsClient, SheetRow } from '../domain/google-sheets-client.interface';

export class GoogleSheetsClientAdapter implements IGoogleSheetsClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(
    private serviceAccountEmail: string,
    private serviceAccountPrivateKey: string,
    private sheetId: string,
    private sheetName: string = 'Sheet1'
  ) {}

  private async getAccessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.accessToken && now < this.tokenExpiresAt - 60) {
      return this.accessToken;
    }

    const token = await this.generateJWT();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: token,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get Google access token: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = now + data.expires_in;

    return this.accessToken;
  }

  private str2ab(str: string): ArrayBuffer {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  }

  private base64UrlEncode(buffer: ArrayBuffer): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  private async importPrivateKey(pem: string): Promise<CryptoKey> {
    const pemHeader = '-----BEGIN PRIVATE KEY-----';
    const pemFooter = '-----END PRIVATE KEY-----';
    // Xóa tất cả khoảng trắng, newline, carriage return, và header/footer
    let pemContents = pem;
    pemContents = pemContents.replace(pemHeader, '');
    pemContents = pemContents.replace(pemFooter, '');
    pemContents = pemContents.replace(/\\n/g, ''); // In case it's escaped
    pemContents = pemContents.replace(/\s/g, '');

    const binaryDerString = atob(pemContents);
    const binaryDer = this.str2ab(binaryDerString);

    return crypto.subtle.importKey(
      'pkcs8',
      binaryDer,
      {
        name: 'RSASSA-PKCS1-v1_5',
        hash: 'SHA-256',
      },
      false,
      ['sign']
    );
  }

  private async generateJWT(): Promise<string> {
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: this.serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const headerBase64 = btoa(JSON.stringify(header))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const claimBase64 = btoa(JSON.stringify(claim))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const signatureInput = `${headerBase64}.${claimBase64}`;

    const privateKey = await this.importPrivateKey(this.serviceAccountPrivateKey);
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(signatureInput)
    );

    const signatureBase64 = this.base64UrlEncode(signature);

    return `${signatureInput}.${signatureBase64}`;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapRowToValues(row: SheetRow): any[] {
    return [
      row.id,
      row.merchantName,
      row.amount,
      row.currency,
      row.subscriberName,
      row.status,
      row.billingCycle,
      row.nextBillingDate,
      row.isMustKeep ? 'TRUE' : 'FALSE',
      row.directKillLink || '',
      row.confidenceScore,
      row.lastSynced,
    ];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapValuesToRow(values: any[]): SheetRow {
    return {
      id: Number(values[0]),
      merchantName: values[1] || '',
      amount: Number(values[2]) || 0,
      currency: values[3] || 'VND',
      subscriberName: values[4] || '',
      status: values[5] || '',
      billingCycle: values[6] || '',
      nextBillingDate: values[7] || '',
      isMustKeep: values[8] === 'TRUE',
      directKillLink: values[9] || null,
      confidenceScore: Number(values[10]) || 0,
      lastSynced: values[11] || '',
    };
  }

  private async mutateRow(
    url: string,
    method: string,
    row: SheetRow,
    actionDesc: string
  ): Promise<void> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        values: [this.mapRowToValues(row)],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to ${actionDesc}: ${response.status} ${errorText}`);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async fetchSheetData(url: string, actionDesc: string): Promise<any[][]> {
    const accessToken = await this.getAccessToken();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to ${actionDesc}: ${response.status} ${errorText}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await response.json()) as any;
    return data.values || [];
  }

  async appendRow(row: SheetRow): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${this.sheetName}!A:L:append?valueInputOption=USER_ENTERED`;
    await this.mutateRow(url, 'POST', row, 'append row');
  }

  async updateRow(rowIndex: number, row: SheetRow): Promise<void> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${this.sheetName}!A${rowIndex}:L${rowIndex}?valueInputOption=USER_ENTERED`;
    await this.mutateRow(url, 'PUT', row, 'update row');
  }

  async readAllRows(): Promise<SheetRow[]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${this.sheetName}!A2:L`;
    const values = await this.fetchSheetData(url, 'read rows');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return values.map((v: any[]) => this.mapValuesToRow(v));
  }

  async readColumnA(): Promise<number[]> {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.sheetId}/values/${this.sheetName}!A2:A`;
    const values = await this.fetchSheetData(url, 'read column A');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return values.map((v: any[]) => Number(v[0]));
  }

  async findRowIndexBySubscriptionId(id: number): Promise<number | null> {
    const ids = await this.readColumnA();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] === id) {
        // rowIndex = i + 2 (vì header là row 1, data bắt đầu từ row 2)
        return i + 2;
      }
    }
    return null;
  }
}
