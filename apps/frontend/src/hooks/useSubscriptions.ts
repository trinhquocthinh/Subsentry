import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getSubscriptions,
  getSubscription,
  updateSubscription,
  getMembers,
  getPaymentCards,
  getSpendingStats,
  type UpdateSubscriptionInput,
} from '@/lib/api';

// ── Query Keys ──
export const queryKeys = {
  subscriptions: ['subscriptions'] as const,
  subscription: (id: number) => ['subscriptions', id] as const,
  members: ['members'] as const,
  paymentCards: ['payment-cards'] as const,
  spendingStats: ['stats', 'spending'] as const,
};

// ── Queries ──

export function useSubscriptions() {
  return useQuery({
    queryKey: queryKeys.subscriptions,
    queryFn: getSubscriptions,
    staleTime: 30_000, // 30 seconds
  });
}

export function useSubscription(id: number) {
  return useQuery({
    queryKey: queryKeys.subscription(id),
    queryFn: () => getSubscription(id),
    enabled: id > 0,
  });
}

export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members,
    queryFn: getMembers,
    staleTime: 60_000,
  });
}

export function usePaymentCards() {
  return useQuery({
    queryKey: queryKeys.paymentCards,
    queryFn: getPaymentCards,
    staleTime: 60_000,
  });
}

export function useSpendingStats() {
  return useQuery({
    queryKey: queryKeys.spendingStats,
    queryFn: getSpendingStats,
    staleTime: 30_000,
  });
}

// ── Mutations ──

export function useUpdateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSubscriptionInput }) =>
      updateSubscription(id, data),
    onSuccess: () => {
      // Invalidate all subscription-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptions });
      queryClient.invalidateQueries({ queryKey: queryKeys.spendingStats });
    },
  });
}
