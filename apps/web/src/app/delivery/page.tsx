'use client';

import { Loader2, Package, Power } from 'lucide-react';
import { toast } from 'sonner';
import { useMyDeliveryPartnerProfile, useSetAvailability } from '@/hooks/use-delivery-partner';
import { getApiErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'Your account is awaiting admin approval.',
  SUSPENDED: 'Your account has been suspended — contact an admin.',
  INACTIVE: 'Your account is inactive — contact an admin.',
};

export default function DeliveryHomePage() {
  const { data: partner, isLoading, error } = useMyDeliveryPartnerProfile();
  const setAvailability = useSetAvailability();

  if (isLoading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--color-primary)" aria-hidden />
      </main>
    );
  }

  if (error || !partner) {
    return (
      <main className="flex flex-col items-center gap-2 py-16 text-center">
        <h1 className="font-display text-xl font-semibold text-(--color-foreground)">
          No delivery partner profile
        </h1>
        <p className="text-sm text-(--color-muted-foreground)">
          {getApiErrorMessage(error, 'Contact an admin to set up your delivery partner profile.')}
        </p>
      </main>
    );
  }

  const isAvailable = partner.availabilityStatus === 'AVAILABLE';
  const isBusy = partner.availabilityStatus === 'BUSY';
  const isActive = partner.status === 'ACTIVE';

  const toggleAvailability = () => {
    setAvailability.mutate(isAvailable ? 'OFFLINE' : 'AVAILABLE', {
      onError: (err) => toast.error(getApiErrorMessage(err, 'Could not update availability.')),
    });
  };

  return (
    <main className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Dashboard</h1>

      {!isActive ? (
        <div className="rounded-(--radius-outer) border border-(--color-destructive)/30 bg-(--color-card) p-4 text-sm text-(--color-destructive)">
          {ACCOUNT_STATUS_LABEL[partner.status] ?? 'Your account is not active.'}
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'flex size-10 items-center justify-center rounded-full',
                isBusy
                  ? 'bg-(--color-primary)/15 text-(--color-primary)'
                  : isAvailable
                    ? 'bg-emerald-500/15 text-emerald-600'
                    : 'bg-(--color-muted) text-(--color-muted-foreground)',
              )}
            >
              <Power className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-(--color-foreground)">
                {isBusy ? 'On a delivery' : isAvailable ? 'Available' : 'Offline'}
              </p>
              <p className="text-xs text-(--color-muted-foreground)">
                {isBusy
                  ? "You'll be able to go offline once it's done."
                  : isAvailable
                    ? 'Visible to admins for new assignments.'
                    : 'Go available to start receiving deliveries.'}
              </p>
            </div>
          </div>
          <Button
            variant={isAvailable ? 'outline' : 'default'}
            disabled={isBusy}
            loading={setAvailability.isPending}
            onClick={toggleAvailability}
          >
            {isAvailable ? 'Go offline' : 'Go available'}
          </Button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 text-center">
          <p className="font-display text-2xl font-semibold text-(--color-foreground)">0</p>
          <p className="text-xs text-(--color-muted-foreground)">Today&apos;s deliveries</p>
        </div>
        <div className="rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 text-center">
          <p className="font-display text-2xl font-semibold text-(--color-foreground)">0</p>
          <p className="text-xs text-(--color-muted-foreground)">Completed</p>
        </div>
        <div className="rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 text-center">
          <p className="font-display text-2xl font-semibold text-(--color-foreground)">0</p>
          <p className="text-xs text-(--color-muted-foreground)">Pending</p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 rounded-(--radius-outer) border border-dashed border-(--color-border) py-12 text-center">
        <Package className="size-8 text-(--color-muted-foreground)" aria-hidden />
        <p className="text-sm text-(--color-muted-foreground)">No active delivery right now.</p>
      </div>
    </main>
  );
}
