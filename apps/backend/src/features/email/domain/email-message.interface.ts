export interface ParsedEmailPayload {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
  date?: string;
  headers?: Record<string, string>;
}

export interface CloudflareForwardableEmailMessage {
  from: string;
  to: string;
  headers: Headers;
  raw: ReadableStream<Uint8Array> | ArrayBuffer;
  rawSize: number;
  setReject(reason: string): void;
  forward(to: string, headers?: Headers): Promise<void>;
}
