import { useState, useEffect, useCallback } from 'react';
import {
  getTelegramWebApp,
  getUserInfo,
  getColorScheme,
  initializeTelegramApp,
  isTelegramMiniApp,
  hapticFeedback,
  type TelegramWebAppUser,
} from '@/lib/telegram';

/**
 * React hook for Telegram Mini App integration.
 * Initializes the app and provides user info + theme.
 */
export function useTelegram() {
  const [user, setUser] = useState<TelegramWebAppUser | null>(null);
  const [colorScheme, setColorScheme] = useState<'light' | 'dark'>('dark');
  const [isReady, setIsReady] = useState(false);
  const [isTelegram, setIsTelegram] = useState(false);

  useEffect(() => {
    const tgApp = getTelegramWebApp();

    if (tgApp) {
      initializeTelegramApp();
      setUser(getUserInfo());
      setColorScheme(getColorScheme());
      setIsTelegram(isTelegramMiniApp());
    }

    setIsReady(true);
  }, []);

  const triggerHaptic = useCallback(
    (type: 'impact' | 'notification' | 'selection', style?: string) => {
      hapticFeedback(type, style);
    },
    []
  );

  return {
    user,
    colorScheme,
    isReady,
    isTelegram,
    triggerHaptic,
  };
}
