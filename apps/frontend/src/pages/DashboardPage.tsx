import React, { useState } from 'react';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { SubscriptionList } from '@/components/dashboard/SubscriptionList';
import { CountdownTimer } from '@/components/dashboard/CountdownTimer';
import { SubscriptionDetail } from '@/components/subscription/SubscriptionDetail';
import type { SubscriptionDTO } from '@/lib/api';

export function DashboardPage() {
  const [selectedSub, setSelectedSub] = useState<SubscriptionDTO | null>(null);

  return (
    <>
      <StatsCards />
      <CountdownTimer />
      <SpendingChart />
      <SubscriptionList onSelectSubscription={setSelectedSub} />

      {selectedSub && (
        <SubscriptionDetail subscription={selectedSub} onClose={() => setSelectedSub(null)} />
      )}
    </>
  );
}
