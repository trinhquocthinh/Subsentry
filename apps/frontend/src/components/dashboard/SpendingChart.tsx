import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from 'recharts';
import { useSpendingStats } from '@/hooks/useSubscriptions';
import { Skeleton } from '@/components/ui/LoadingSpinner';

const CHART_COLORS = [
  '#5c7cfa', // brand
  '#20c997', // accent
  '#f59f00', // amber
  '#e64980', // pink
  '#845ef7', // violet
  '#15aabf', // cyan
  '#ff6b6b', // red
  '#51cf66', // green
  '#fcc419', // yellow
  '#339af0', // blue
];

type ViewMode = 'merchant' | 'subscriber';

export function SpendingChart() {
  const { data: stats, isLoading } = useSpendingStats();
  const [viewMode, setViewMode] = useState<ViewMode>('merchant');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="surface-card p-4 space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!stats) return null;

  const chartData = viewMode === 'merchant' ? stats.byMerchant : stats.bySubscriber;

  if (chartData.length === 0) {
    return (
      <div className="surface-card p-6 text-center">
        <p className="text-surface-500 text-sm">Chưa có dữ liệu chi tiêu</p>
      </div>
    );
  }

  const total = chartData.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div
      className="surface-card p-4 animate-slide-up"
      style={{ animationDelay: '150ms', animationFillMode: 'both' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-surface-300">Phân bổ chi tiêu</h2>
        <div className="flex bg-surface-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('merchant')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              viewMode === 'merchant'
                ? 'bg-brand-600/30 text-brand-400'
                : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            Dịch vụ
          </button>
          <button
            onClick={() => setViewMode('subscriber')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
              viewMode === 'subscriber'
                ? 'bg-brand-600/30 text-brand-400'
                : 'text-surface-500 hover:text-surface-300'
            }`}
          >
            Thành viên
          </button>
        </div>
      </div>

      {/* Chart */}
      <div className="relative h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={3}
              dataKey="amount"
              nameKey="name"
              activeIndex={activeIndex !== null ? activeIndex : undefined}
              activeShape={renderActiveShape}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
              animationBegin={200}
              animationDuration={800}
            >
              {chartData.map((_, index) => (
                <Cell
                  key={index}
                  fill={CHART_COLORS[index % CHART_COLORS.length]}
                  stroke="transparent"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.3))' }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[10px] text-surface-500 uppercase tracking-wider">Tổng/tháng</span>
          <span className="text-lg font-bold text-white">{formatCompact(total)}</span>
          <span className="text-[10px] text-surface-500">{stats.currency}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-3 space-y-1.5">
        {chartData.map((item, index) => (
          <div
            key={item.name}
            className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-colors ${
              activeIndex === index ? 'bg-white/5' : ''
            }`}
            onMouseEnter={() => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
              />
              <span className="text-xs text-surface-400">{item.name}</span>
            </div>
            <span className="text-xs font-medium text-surface-300">
              {formatCompact(item.amount)} ({Math.round((item.amount / total) * 100)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderActiveShape(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 2}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        style={{ filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.4))' }}
      />
    </g>
  );
}

function formatCompact(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return amount.toLocaleString('vi-VN');
}
