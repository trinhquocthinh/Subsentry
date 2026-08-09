import PostalMime from 'postal-mime';
import type { ParsedEmailPayload } from '../domain/email-message.interface';

export interface IEmailParserAdapter {
  parseRawEmail(
    rawInput: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
    fallbackFrom?: string,
    fallbackTo?: string
  ): Promise<ParsedEmailPayload>;
}

export class PostalMimeEmailAdapter implements IEmailParserAdapter {
  async parseRawEmail(
    rawInput: ArrayBuffer | Uint8Array | ReadableStream<Uint8Array>,
    fallbackFrom?: string,
    fallbackTo?: string
  ): Promise<ParsedEmailPayload> {
    let buffer: ArrayBuffer | Uint8Array;

    if (rawInput instanceof ReadableStream) {
      buffer = await new Response(rawInput).arrayBuffer();
    } else {
      buffer = rawInput;
    }

    const parser = new PostalMime();
    const parsed = await parser.parse(buffer as ArrayBuffer);

    // Extract headers as dictionary
    const headersDict: Record<string, string> = {};
    if (parsed.headers && Array.isArray(parsed.headers)) {
      for (const h of parsed.headers) {
        if (h.key && h.value) {
          headersDict[h.key.toLowerCase()] = h.value;
        }
      }
    }

    const fromAddress =
      parsed.from?.address ||
      (typeof parsed.from === 'string' ? parsed.from : undefined) ||
      fallbackFrom ||
      '';

    const toAddress =
      parsed.to?.[0]?.address ||
      (typeof parsed.to === 'string' ? parsed.to : undefined) ||
      fallbackTo ||
      '';

    return {
      from: fromAddress,
      to: toAddress,
      subject: parsed.subject || '',
      text: parsed.text || undefined,
      html: parsed.html || undefined,
      date: parsed.date || undefined,
      headers: headersDict,
    };
  }
}
