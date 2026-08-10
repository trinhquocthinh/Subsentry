import React, { useState, useEffect } from 'react';
import { useSpendingStats } from '@/hooks/useSubscriptions';

export function CountdownTimer() {
  const { data: stats } = useSpendingStats();
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);

  const nextBilling = stats?.nextBilling;

  useEffect(() => {
    if (!nextBilling) return;

    const update = () => {
      const diff = new Date(nextBilling.nextBillingDate).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        expired: false,
      });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [nextBilling]);

  if (!nextBilling || !timeLeft) return null;

  const urgencyColor = getUrgencyGradient(timeLeft.days);

  return (
    <div
      className="surface-card p-4 animate-slide-up"
      style={{ animationDelay: '100ms', animationFillMode: 'both' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-surface-300">Sắp gia hạn</h2>
        <span className="text-[11px] text-surface-500">{nextBilling.merchantName}</span>
      </div>

      <div className="flex items-center gap-4 justify-center">
        {/* Ring progress */}
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            {/* Background ring */}
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="4"
            />
            {/* Progress ring */}
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke={`url(#countdown-gradient)`}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 34}
              strokeDashoffset={2 * Math.PI * 34 * (1 - Math.min(timeLeft.days / 30, 1))}
              className="transition-all duration-1000 ease-out"
            />
            <defs>
              <linearGradient id="countdown-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={urgencyColor.from} />
                <stop offset="100%" stopColor={urgencyColor.to} />
              </linearGradient>
            </defs>
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-xl font-bold ${urgencyColor.textClass}`}>{timeLeft.days}</span>
            <span className="text-[9px] text-surface-500 uppercase tracking-wider">ngày</span>
          </div>
        </div>

        {/* Time units */}
        <div className="flex gap-2">
          <TimeUnit value={timeLeft.hours} label="giờ" />
          <span className="text-surface-600 self-start mt-1.5 text-lg font-light">:</span>
          <TimeUnit value={timeLeft.minutes} label="phút" />
          <span className="text-surface-600 self-start mt-1.5 text-lg font-light">:</span>
          <TimeUnit value={timeLeft.seconds} label="giây" />
        </div>
      </div>

      {/* Amount info */}
      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
        <span className="text-[11px] text-surface-500">Số tiền sắp trừ</span>
        <span className={`text-sm font-bold ${urgencyColor.textClass}`}>
          {nextBilling.amount.toLocaleString('vi-VN')} {nextBilling.currency}
        </span>
      </div>
    </div>
  );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-lg font-mono font-bold text-white tabular-nums w-8 text-center">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[9px] text-surface-600 uppercase tracking-wider">{label}</span>
    </div>
  );
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  expired: boolean;
}

function getUrgencyGradient(days: number) {
  if (days <= 1) return { from: '#ff6b6b', to: '#e64980', textClass: 'text-red-400' };
  if (days <= 3) return { from: '#fcc419', to: '#f59f00', textClass: 'text-amber-400' };
  return { from: '#20c997', to: '#12b886', textClass: 'text-emerald-400' };
}
