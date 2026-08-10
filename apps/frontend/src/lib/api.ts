/**
 * API client for Subsentry backend.
 *
 * Automatically attaches Telegram initData for authentication.
 * All requests go through the Cloudflare Worker backend.
 */

import { getInitData } from './telegram';

// ── Types ──

export interface SubscriptionDTO {
  id: number;
  merchantName: string;
  amount: number;
  currency: string;
  subscriberId: number;
  subscriberName: string;
  subscriberRole: string;
  paymentCardId: number | null;
  cardLabel: string | null;
  cardLastFour: string | null;
  cardOwnerName: string | null;
  status: 'TRIAL' | 'ACTIVE' | 'PENDING_KILL' | 'KILLED';
  billingCycle: 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  nextBillingDate: string;
  confidenceScore: number;
  directKillLink: string | null;
  isMustKeep: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemberDTO {
  id: number;
  displayName: string;
  role: string;
  telegramChatId: string | null;
  email: string | null;
  createdAt: string;
}

export interface PaymentCardDTO {
  id: number;
  cardLabel: string;
  lastFour: string | null;
  cardOwnerId: number;
  cardOwnerName: string;
  isActive: boolean;
  createdAt: string;
}

export interface SpendingStatsDTO {
  totalMonthly: number;
  activeCount: number;
  trialCount: number;
  currency: string;
  byMerchant: Array<{ name: string; amount: number }>;
  bySubscriber: Array<{ name: string; amount: number }>;
  nextBilling: {
    merchantName: string;
    nextBillingDate: string;
    amount: number;
    currency: string;
  } | null;
}

export interface UpdateSubscriptionInput {
  amount?: number;
  nextBillingDate?: string;
  isMustKeep?: boolean;
  paymentCardId?: number | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { code: string; message: string };
}

// ── API Client ──

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let initData = getInitData();

  // Support local development outside Telegram App
  if (import.meta.env.DEV && !initData) {
    initData = 'mock-dev-data';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (initData) {
    headers['X-Telegram-Init-Data'] = initData;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    const message = (errorBody as ApiResponse<null>)?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new Error(json.error?.message || 'API request failed');
  }

  return json.data;
}

// ── Endpoint Functions ──

export async function getSubscriptions(): Promise<SubscriptionDTO[]> {
  return apiFetch<SubscriptionDTO[]>('/subscriptions');
}

export async function getSubscription(id: number): Promise<SubscriptionDTO> {
  return apiFetch<SubscriptionDTO>(`/subscriptions/${id}`);
}

export async function updateSubscription(
  id: number,
  data: UpdateSubscriptionInput
): Promise<SubscriptionDTO> {
  return apiFetch<SubscriptionDTO>(`/subscriptions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getMembers(): Promise<MemberDTO[]> {
  return apiFetch<MemberDTO[]>('/members');
}

export async function getPaymentCards(): Promise<PaymentCardDTO[]> {
  return apiFetch<PaymentCardDTO[]>('/payment-cards');
}

export async function getSpendingStats(): Promise<SpendingStatsDTO> {
  return apiFetch<SpendingStatsDTO>('/stats/spending');
}
