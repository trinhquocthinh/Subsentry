import React from 'react';
import { usePaymentCards } from '@/hooks/useSubscriptions';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ErrorState, EmptyState } from '@/components/ui/ErrorState';

export function PaymentCardList() {
  const { data: cards, isLoading, isError, refetch } = usePaymentCards();

  if (isLoading) return <LoadingSpinner text="Đang tải thẻ..." />;
  if (isError) return <ErrorState onRetry={() => refetch()} />;

  if (!cards || cards.length === 0) {
    return (
      <EmptyState
        icon="💳"
        title="Chưa có thẻ thanh toán"
        message="Thẻ sẽ được tạo tự động khi phát hiện giao dịch"
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-surface-300">Thẻ thanh toán</h2>
        <span className="text-[11px] text-surface-500">{cards.length} thẻ</span>
      </div>

      {cards.map((card, i) => (
        <div
          key={card.id}
          className="surface-card p-4 animate-slide-up"
          style={{ animationDelay: `${i * 75}ms`, animationFillMode: 'both' }}
        >
          <div className="flex items-center gap-3">
            {/* Card icon */}
            <div className="w-12 h-8 rounded-lg bg-gradient-to-br from-brand-600 to-accent-600 flex items-center justify-center shadow-glow">
              <svg
                className="w-5 h-5 text-white/80"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white truncate">{card.cardLabel}</h3>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-lg font-medium ${
                    card.isActive
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                      : 'bg-surface-700/50 text-surface-500 border border-surface-600/20'
                  }`}
                >
                  {card.isActive ? 'Hoạt động' : 'Tạm dừng'}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {card.lastFour && (
                  <span className="text-xs text-surface-500 font-mono">•••• {card.lastFour}</span>
                )}
                <span className="text-[11px] text-surface-600">Chủ thẻ: {card.cardOwnerName}</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
