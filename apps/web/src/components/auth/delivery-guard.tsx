'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/use-current-user';

/**
 * UX-only gate — the actual authorization boundary is server-side (every
 * delivery endpoint checks role itself); this just avoids flashing delivery
 * UI to non-delivery-partners.
 */
export function DeliveryGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useCurrentUser();
  const isDeliveryPartner = isAuthenticated && user?.role === 'DELIVERY_PARTNER';

  useEffect(() => {
    if (!isLoading && !isDeliveryPartner) {
      router.replace('/login');
    }
  }, [isLoading, isDeliveryPartner, router]);

  if (!isDeliveryPartner) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--color-primary)" aria-hidden />
      </div>
    );
  }

  return <>{children}</>;
}
