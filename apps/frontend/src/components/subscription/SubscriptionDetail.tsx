import React, { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useUpdateSubscription, usePaymentCards } from '@/hooks/useSubscriptions';
import { hapticFeedback } from '@/lib/telegram';
import type { SubscriptionDTO } from '@/lib/api';

interface SubscriptionDetailProps {
  subscription: SubscriptionDTO;
  onClose: () => void;
}

export function SubscriptionDetail({ subscription: sub, onClose }: SubscriptionDetailProps) {
  const { data: cards } = usePaymentCards();
  const updateMutation = useUpdateSubscription();

  const [amount, setAmount] = useState(sub.amount.toString());
  const [nextBillingDate, setNextBillingDate] = useState(sub.nextBillingDate);
  const [isMustKeep, setIsMustKeep] = useState(sub.isMustKeep);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(sub.paymentCardId);
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync({
        id: sub.id,
        data: {
          amount: parseFloat(amount),
          nextBillingDate,
          isMustKeep,
          paymentCardId: selectedCardId,
        },
      });
      hapticFeedback('notification', 'success');
      setIsEditing(false);
    } catch {
      hapticFeedback('notification', 'error');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
        <div className="bg-surface-900 border-t border-white/10 rounded-t-3xl max-h-[85vh] overflow-y-auto">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-surface-700" />
          </div>

          <div className="px-5 pb-8 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-surface-800 border border-surface-700 flex items-center justify-center text-2xl">
                  {getMerchantEmoji(sub.merchantName)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{sub.merchantName}</h2>
                  <p className="text-xs text-surface-500">
                    {sub.subscriberName} · {sub.billingCycle}
                  </p>
                </div>
              </div>
              <StatusBadge status={sub.status} size="md" />
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3">
              <InfoCell
                label="Số tiền"
                editing={isEditing}
                value={
                  isEditing ? (
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  ) : (
                    <span className="text-base font-bold text-white">
                      {sub.amount.toLocaleString('vi-VN')} {sub.currency}
                    </span>
                  )
                }
              />
              <InfoCell
                label="Ngày gia hạn"
                editing={isEditing}
                value={
                  isEditing ? (
                    <input
                      type="date"
                      value={nextBillingDate}
                      onChange={(e) => setNextBillingDate(e.target.value)}
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  ) : (
                    <span className="text-sm font-semibold text-white">
                      {new Date(sub.nextBillingDate).toLocaleDateString('vi-VN')}
                    </span>
                  )
                }
              />
              <InfoCell
                label="Thẻ thanh toán"
                editing={isEditing}
                value={
                  isEditing ? (
                    <select
                      value={selectedCardId || ''}
                      onChange={(e) =>
                        setSelectedCardId(e.target.value ? parseInt(e.target.value) : null)
                      }
                      className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="">Chưa gán</option>
                      {cards?.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.cardLabel} {card.lastFour ? `(*${card.lastFour})` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-surface-300">
                      {sub.cardLabel
                        ? `${sub.cardLabel}${sub.cardLastFour ? ` (*${sub.cardLastFour})` : ''}`
                        : 'Chưa gán thẻ'}
                    </span>
                  )
                }
              />
              <InfoCell
                label="Must-Keep"
                editing={isEditing}
                value={
                  isEditing ? (
                    <button
                      onClick={() => setIsMustKeep(!isMustKeep)}
                      className={`w-full py-1.5 rounded-lg text-sm font-medium transition-all ${
                        isMustKeep
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-surface-800 text-surface-500 border border-surface-700'
                      }`}
                    >
                      {isMustKeep ? '🔒 Bật' : '🔓 Tắt'}
                    </button>
                  ) : (
                    <span
                      className={`text-sm font-medium ${sub.isMustKeep ? 'text-blue-400' : 'text-surface-500'}`}
                    >
                      {sub.isMustKeep ? '🔒 Thiết yếu' : '—'}
                    </span>
                  )
                }
              />
            </div>

            {/* Additional info */}
            <div className="surface-card p-3 space-y-2">
              <DetailRow label="Chủ thẻ" value={sub.cardOwnerName || '—'} />
              <DetailRow
                label="Độ tin cậy AI"
                value={`${Math.round(sub.confidenceScore * 100)}%`}
              />
              <DetailRow
                label="Đăng ký từ"
                value={new Date(sub.createdAt).toLocaleDateString('vi-VN')}
              />
              {sub.directKillLink && (
                <DetailRow label="Link hủy" value={sub.directKillLink} isLink />
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {isEditing ? (
                <>
                  <button onClick={() => setIsEditing(false)} className="btn-ghost flex-1">
                    Hủy
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    {updateMutation.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsEditing(true)} className="btn-ghost flex-1">
                    ✏️ Chỉnh sửa
                  </button>
                  <button onClick={onClose} className="btn-primary flex-1">
                    Đóng
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function InfoCell({
  label,
  value,
  editing,
}: {
  label: string;
  value: React.ReactNode;
  editing: boolean;
}) {
  return (
    <div className={`p-3 rounded-xl ${editing ? 'bg-surface-800/50' : 'surface-card'}`}>
      <span className="text-[10px] text-surface-500 uppercase tracking-wider block mb-1.5">
        {label}
      </span>
      {value}
    </div>
  );
}

function DetailRow({ label, value, isLink }: { label: string; value: string; isLink?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-surface-500">{label}</span>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-brand-400 hover:underline truncate max-w-[180px]"
        >
          Mở link ↗
        </a>
      ) : (
        <span className="text-xs text-surface-300 font-medium">{value}</span>
      )}
    </div>
  );
}

function getMerchantEmoji(name: string): string {
  const key = name.toLowerCase();
  if (key.includes('netflix')) return '🎬';
  if (key.includes('spotify')) return '🎵';
  if (key.includes('apple')) return '🍎';
  if (key.includes('google')) return '🔍';
  if (key.includes('youtube')) return '▶️';
  if (key.includes('canva')) return '🎨';
  if (key.includes('adobe')) return '📐';
  if (key.includes('openai') || key.includes('chatgpt')) return '🤖';
  return '📦';
}
