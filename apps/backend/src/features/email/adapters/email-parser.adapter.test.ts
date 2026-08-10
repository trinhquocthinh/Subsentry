import { describe, expect, it } from 'vitest';
import { PostalMimeEmailAdapter } from './email-parser.adapter';

const adapter = new PostalMimeEmailAdapter();

const encode = (raw: string) => new TextEncoder().encode(raw.trimStart());

/** Build a real RFC-822 message so PostalMime does actual parsing work. */
function buildRawEmail({
  from = 'billing@netflix.com',
  to = 'subs@yourfamily.com',
  subject = 'Your Netflix Invoice - Subscription Renewal',
  date = 'Sun, 02 Aug 2026 18:00:00 +0700',
  body = 'Your Netflix Premium package has been renewed. Amount: 260,000 VND.',
  extraHeaders = '',
}: Partial<Record<string, string>> = {}) {
  return `
From: ${from}
To: ${to}
Subject: ${subject}
Date: ${date}
${extraHeaders}Content-Type: text/plain; charset=utf-8

${body}
`;
}

describe('PostalMimeEmailAdapter', () => {
  it('bóc tách đầy đủ các trường từ email text thuần (Uint8Array)', async () => {
    const parsed = await adapter.parseRawEmail(encode(buildRawEmail()));

    expect(parsed.from).toBe('billing@netflix.com');
    expect(parsed.to).toBe('subs@yourfamily.com');
    expect(parsed.subject).toBe('Your Netflix Invoice - Subscription Renewal');
    expect(parsed.text).toContain('260,000 VND');
    expect(parsed.date).toBeDefined();
  });

  it('chấp nhận đầu vào ArrayBuffer', async () => {
    const bytes = encode(buildRawEmail({ subject: 'Hoá đơn Spotify' }));
    const parsed = await adapter.parseRawEmail(bytes.buffer as ArrayBuffer);

    expect(parsed.subject).toBe('Hoá đơn Spotify');
  });

  it('chấp nhận đầu vào ReadableStream (luồng raw của Cloudflare Email Routing)', async () => {
    const bytes = encode(buildRawEmail({ subject: 'Hoá đơn từ stream' }));
    // Miniflare disallows `new ReadableStream()`; take the stream off a Response body.
    const stream = new Response(bytes).body as ReadableStream<Uint8Array>;

    const parsed = await adapter.parseRawEmail(stream);

    expect(parsed.subject).toBe('Hoá đơn từ stream');
    expect(parsed.from).toBe('billing@netflix.com');
  });

  it('gom headers thành dictionary với key viết thường', async () => {
    const parsed = await adapter.parseRawEmail(
      encode(buildRawEmail({ extraHeaders: 'X-Forwarded-For: gmail-filter@gmail.com\n' }))
    );

    expect(parsed.headers).toBeDefined();
    expect(parsed.headers?.['x-forwarded-for']).toBe('gmail-filter@gmail.com');
    expect(parsed.headers?.['subject']).toBe('Your Netflix Invoice - Subscription Renewal');
  });

  it('bóc tách phần HTML của email multipart', async () => {
    const raw = `
From: billing@spotify.com
To: subs@yourfamily.com
Subject: Spotify Premium
Content-Type: multipart/alternative; boundary="BOUND"

--BOUND
Content-Type: text/plain; charset=utf-8

Phien ban text
--BOUND
Content-Type: text/html; charset=utf-8

<html><body>Gia hạn 59,000 VND</body></html>
--BOUND--
`;

    const parsed = await adapter.parseRawEmail(encode(raw));

    expect(parsed.text).toContain('Phien ban text');
    expect(parsed.html).toContain('59,000 VND');
  });

  it('dùng fallbackFrom/fallbackTo khi email thiếu header From/To', async () => {
    const raw = `
Subject: Không có người gửi
Content-Type: text/plain; charset=utf-8

Nội dung
`;

    const parsed = await adapter.parseRawEmail(
      encode(raw),
      'fallback-from@example.com',
      'fallback-to@example.com'
    );

    expect(parsed.from).toBe('fallback-from@example.com');
    expect(parsed.to).toBe('fallback-to@example.com');
  });

  it('trả chuỗi rỗng cho from/to khi vừa thiếu header vừa không có fallback', async () => {
    const raw = `
Subject: Trống hoàn toàn
Content-Type: text/plain; charset=utf-8

Nội dung
`;

    const parsed = await adapter.parseRawEmail(encode(raw));

    expect(parsed.from).toBe('');
    expect(parsed.to).toBe('');
  });

  it('trả subject rỗng và html/date undefined khi email tối giản', async () => {
    const raw = `
From: a@b.com
To: c@d.com
Content-Type: text/plain; charset=utf-8

Chỉ có thân thư
`;

    const parsed = await adapter.parseRawEmail(encode(raw));

    expect(parsed.subject).toBe('');
    expect(parsed.html).toBeUndefined();
    expect(parsed.text).toContain('Chỉ có thân thư');
  });
});
