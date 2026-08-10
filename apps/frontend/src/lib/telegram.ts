/**
 * Telegram Web App SDK wrapper.
 *
 * Provides typed access to `window.Telegram.WebApp` for the Mini App.
 * See: https://core.telegram.org/bots/webapps
 */

// ── Type Definitions ──

export interface TelegramWebAppUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
}

export interface TelegramThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  section_header_text_color?: string;
  subtitle_text_color?: string;
  destructive_text_color?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    query_id?: string;
    user?: TelegramWebAppUser;
    auth_date?: number;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: TelegramThemeParams;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  headerColor: string;
  backgroundColor: string;
  isClosingConfirmationEnabled: boolean;

  ready(): void;
  expand(): void;
  close(): void;

  setHeaderColor(color: string): void;
  setBackgroundColor(color: string): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;

  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    isProgressVisible: boolean;
    setText(text: string): void;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
  };

  BackButton: {
    isVisible: boolean;
    onClick(callback: () => void): void;
    offClick(callback: () => void): void;
    show(): void;
    hide(): void;
  };

  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

// ── SDK Access Functions ──

/**
 * Get the Telegram WebApp instance. Returns null if not in Telegram context.
 */
export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
    return window.Telegram.WebApp;
  }
  return null;
}

/**
 * Check if app is running inside Telegram Mini App context.
 */
export function isTelegramMiniApp(): boolean {
  return getTelegramWebApp() !== null && !!getTelegramWebApp()?.initData;
}

/**
 * Get the raw initData string for API authentication.
 */
export function getInitData(): string {
  return getTelegramWebApp()?.initData || '';
}

/**
 * Get the current user info from initData.
 */
export function getUserInfo(): TelegramWebAppUser | null {
  return getTelegramWebApp()?.initDataUnsafe?.user || null;
}

/**
 * Get the current color scheme ('light' or 'dark').
 */
export function getColorScheme(): 'light' | 'dark' {
  return getTelegramWebApp()?.colorScheme || 'dark';
}

/**
 * Initialize the Mini App: signal ready, expand to full height, set theme.
 */
export function initializeTelegramApp(): void {
  const app = getTelegramWebApp();
  if (!app) return;

  app.ready();
  app.expand();
  app.setHeaderColor('#0d1117');
  app.setBackgroundColor('#0d1117');
  app.enableClosingConfirmation();
}

/**
 * Trigger haptic feedback if available.
 */
export function hapticFeedback(
  type: 'impact' | 'notification' | 'selection',
  style?: string
): void {
  const app = getTelegramWebApp();
  if (!app?.HapticFeedback) return;

  switch (type) {
    case 'impact':
      app.HapticFeedback.impactOccurred((style as 'light' | 'medium' | 'heavy') || 'medium');
      break;
    case 'notification':
      app.HapticFeedback.notificationOccurred(
        (style as 'error' | 'success' | 'warning') || 'success'
      );
      break;
    case 'selection':
      app.HapticFeedback.selectionChanged();
      break;
  }
}
