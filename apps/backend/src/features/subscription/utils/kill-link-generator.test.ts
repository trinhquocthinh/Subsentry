import { describe, it, expect } from 'vitest';
import { generateDirectKillLink } from './kill-link-generator';

describe('generateDirectKillLink', () => {
  it('Trả về đúng link hủy trực tiếp cho các dịch vụ phổ biến đã biết', () => {
    expect(generateDirectKillLink('Netflix')).toBe('https://www.netflix.com/youraccount');
    expect(generateDirectKillLink('Spotify')).toBe('https://www.spotify.com/account/overview/');
    expect(generateDirectKillLink('Apple Billing')).toBe('https://support.apple.com/HT202039');
    expect(generateDirectKillLink('YouTube Premium')).toBe(
      'https://www.youtube.com/paid_memberships'
    );
    expect(generateDirectKillLink('Canva')).toBe(
      'https://www.canva.com/settings/billing-and-teams'
    );
    expect(generateDirectKillLink('ChatGPT')).toBe('https://chatgpt.com/#settings/Subscription');
  });

  it('Trả về link hủy khi khớp một phần tên merchant (partial match)', () => {
    expect(generateDirectKillLink('Apple Music')).toBe('https://support.apple.com/HT202039');
    expect(generateDirectKillLink('OpenAI ChatGPT Plus')).toBe(
      'https://chatgpt.com/#settings/Subscription'
    );
  });

  it('Trả về link Google Search hướng dẫn hủy đối với dịch vụ lạ không có sẵn link', () => {
    const link = generateDirectKillLink('Unknown Service XYZ');
    expect(link).toContain('https://www.google.com/search?q=');
    expect(link).toContain('Unknown%20Service%20XYZ');
  });
});
