import React from 'react';

interface StatusBadgeProps {
  status: 'TRIAL' | 'ACTIVE' | 'PENDING_KILL' | 'KILLED';
  size?: 'sm' | 'md';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  TRIAL: { label: 'Dùng thử', className: 'badge-trial' },
  ACTIVE: { label: 'Đang dùng', className: 'badge-active' },
  PENDING_KILL: { label: 'Chờ hủy', className: 'badge-pending-kill' },
  KILLED: { label: 'Đã hủy', className: 'badge-killed' },
};

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.ACTIVE;
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg font-medium ${sizeClass} ${config.className}`}
    >
      {status === 'TRIAL' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
      )}
      {status === 'ACTIVE' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
      )}
      {status === 'PENDING_KILL' && (
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
