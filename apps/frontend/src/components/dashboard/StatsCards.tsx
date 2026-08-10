import React from 'react';
import { useSpendingStats } from '@/hooks/useSubscriptions';
import { Skeleton } from '@/components/ui/LoadingSpinner';

export function StatsCards() {
  const { data: stats, isLoading } = useSpendingStats();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="surface-card p-3.5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      label: 'Chi tiêu / tháng',
      value: formatVND(stats.totalMonthly),
      icon: '💰',
      gradient: 'from-brand-500/20 to-brand-600/5',
      borderColor: 'border-brand-500/15',
      textColor: 'text-brand-400',
    },
    {
      label: 'Đang hoạt động',
      value: stats.activeCount.toString(),
      icon: '🟢',
      gradient: 'from-emerald-500/20 to-emerald-600/5',
      borderColor: 'border-emerald-500/15',
      textColor: 'text-emerald-400',
    },
    {
      label: 'Dùng thử',
      value: stats.trialCount.toString(),
      icon: '⏳',
      gradient: 'from-amber-500/20 to-amber-600/5',
      borderColor: 'border-amber-500/15',
      textColor: 'text-amber-400',
    },
    {
      label: 'Tổng dịch vụ',
      value: (stats.activeCount + stats.trialCount).toString(),
      icon: '📊',
      gradient: 'from-purple-500/20 to-purple-600/5',
      borderColor: 'border-purple-500/15',
      textColor: 'text-purple-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((card, i) => (
        <div
          key={card.label}
          className={`surface-card p-3.5 bg-gradient-to-br ${card.gradient} ${card.borderColor} animate-slide-up`}
          style={{ animationDelay: `${i * 75}ms`, animationFillMode: 'both' }}
        >
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-sm">{card.icon}</span>
            <span className="text-[11px] font-medium text-surface-500 uppercase tracking-wide">
              {card.label}
            </span>
          </div>
          <p className={`text-xl font-bold ${card.textColor} animate-count-up`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}

function formatVND(amount: number): string {
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)}K`;
  }
  return amount.toLocaleString('vi-VN');
}
