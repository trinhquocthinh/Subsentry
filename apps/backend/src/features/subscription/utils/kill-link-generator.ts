/**
 * Known direct cancellation URL mappings for common subscription services.
 */
const KNOWN_KILL_LINKS: Record<string, string> = {
  netflix: 'https://www.netflix.com/youraccount',
  spotify: 'https://www.spotify.com/account/overview/',
  apple: 'https://support.apple.com/HT202039',
  'apple billing': 'https://support.apple.com/HT202039',
  'apple.com/bill': 'https://support.apple.com/HT202039',
  google: 'https://play.google.com/store/account/subscriptions',
  'google play': 'https://play.google.com/store/account/subscriptions',
  youtube: 'https://www.youtube.com/paid_memberships',
  'youtube premium': 'https://www.youtube.com/paid_memberships',
  canva: 'https://www.canva.com/settings/billing-and-teams',
  chatgpt: 'https://chatgpt.com/#settings/Subscription',
  openai: 'https://chatgpt.com/#settings/Subscription',
  icloud: 'https://support.apple.com/HT207594',
  disney: 'https://www.disneyplus.com/account',
};

/**
 * Generates a direct cancellation link for a given merchant name.
 * If the merchant is known, returns the direct account management link.
 * Otherwise, returns a Google Search query for how to cancel the subscription.
 */
export function generateDirectKillLink(merchantName: string): string {
  const normalized = merchantName.trim().toLowerCase();

  if (KNOWN_KILL_LINKS[normalized]) {
    return KNOWN_KILL_LINKS[normalized];
  }

  // Partial matching for known merchants
  for (const [key, url] of Object.entries(KNOWN_KILL_LINKS)) {
    if (normalized.includes(key)) {
      return url;
    }
  }

  const query = encodeURIComponent(`hướng dẫn hủy gia hạn ${merchantName}`);
  return `https://www.google.com/search?q=${query}`;
}
