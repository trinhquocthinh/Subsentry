import React from 'react';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SubscriptionSkeleton } from '@/components/ui/LoadingSpinner';
import { ErrorState, EmptyState } from '@/components/ui/ErrorState';
import type { SubscriptionDTO } from '@/lib/api';

// Merchant icon mapping (emoji fallback)
const merchantIcons: Record<string, string> = {
  netflix: '🎬',
  spotify: '🎵',
  apple: '🍎',
  google: '🔍',
  youtube: '▶️',
  canva: '🎨',
  adobe: '📐',
  openai: '🤖',
  chatgpt: '🤖',
  icloud: '☁️',
  microsoft: '💻',
  github: '🐙',
  notion: '📝',
  figma: '🎯',
  zoom: '📹',
  slack: '💬',
  discord: '🎮',
  duolingo: '🦉',
};

function getMerchantIcon(merchantName: string): string {
  const key = merchantName.toLowerCase().replace(/[^a-z]/g, '');
  for (const [k, v] of Object.entries(merchantIcons)) {
    if (key.includes(k)) return v;
  }
  return '📦';
}

interface SubscriptionListProps {
  onSelectSubscription?: (sub: SubscriptionDTO) => void;
}

export function SubscriptionList({ onSelectSubscription }: SubscriptionListProps) {
  const { data: subscriptions, isLoading, isError, refetch } = useSubscriptions();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <SubscriptionSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState onRetry={() => refetch()} />;
  }

  if (!subscriptions || subscriptions.length === 0) {
    return (
      <EmptyState
        icon="📋"
        title="Chưa có đăng ký nào"
        message="Gửi hóa đơn qua Telegram Bot để bắt đầu theo dõi"
      />
    );
  }

  // Sort: TRIAL first, then ACTIVE, PENDING_KILL, KILLED last
  const statusOrder = { TRIAL: 0, ACTIVE: 1, PENDING_KILL: 2, KILLED: 3 };
  const sorted = [...subscriptions].sort(
    (a, b) => (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4)
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-surface-300">Danh sách đăng ký</h2>
        <span className="text-[11px] text-surface-500">{subscriptions.length} dịch vụ</span>
      </div>

      {sorted.map((sub, i) => (
        <SubscriptionCard
          key={sub.id}
          subscription={sub}
          index={i}
          onClick={() => onSelectSubscription?.(sub)}
        />
      ))}
    </div>
  );
}

function SubscriptionCard({
  subscription: sub,
  index,
  onClick,
}: {
  subscription: SubscriptionDTO;
  index: number;
  onClick?: () => void;
}) {
  const daysLeft = getDaysUntil(sub.nextBillingDate);
  const urgency = getUrgencyColor(daysLeft);

  return (
    <button
      onClick={onClick}
      className="w-full text-left surface-card hover-card p-3.5 animate-slide-up"
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-surface-800 border border-surface-700 flex items-center justify-center text-lg flex-shrink-0">
          {getMerchantIcon(sub.merchantName)}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white truncate">{sub.merchantName}</h3>
            <StatusBadge status={sub.status} />
          </div>

          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-surface-500">
              {sub.subscriberName}
              {sub.cardLabel && <span className="text-surface-600"> · {sub.cardLabel}</span>}
            </span>
            <span className="text-sm font-bold text-white">
              {sub.amount.toLocaleString('vi-VN')}
              <span className="text-[10px] font-normal text-surface-500 ml-0.5">
                {sub.currency}
              </span>
            </span>
          </div>

          {/* Next billing countdown */}
          {(sub.status === 'TRIAL' || sub.status === 'ACTIVE') && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className={`w-1.5 h-1.5 rounded-full ${urgency.dot}`} />
              <span className={`text-[11px] font-medium ${urgency.text}`}>
                {daysLeft <= 0 ? 'Hết hạn hôm nay' : `Còn ${daysLeft} ngày`}
              </span>
              <span className="text-[11px] text-surface-600">
                · {formatDate(sub.nextBillingDate)}
              </span>
            </div>
          )}

          {sub.isMustKeep && (
            <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
              🔒 Must-Keep
            </span>
          )}
        </div>

        {/* Chevron */}
        <svg
          className="w-4 h-4 text-surface-600 flex-shrink-0 mt-1"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </div>
    </button>
  );
}

function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getUrgencyColor(days: number) {
  if (days <= 1) return { dot: 'bg-red-400 animate-pulse', text: 'text-red-400' };
  if (days <= 3) return { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400' };
  return { dot: 'bg-emerald-400', text: 'text-emerald-400' };
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}
