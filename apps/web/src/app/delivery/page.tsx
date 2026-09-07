'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2, MapPin, Package, Phone, Power } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@grocery-delivery/utils';
import { useMyDeliveryPartnerProfile, useSetAvailability } from '@/hooks/use-delivery-partner';
import {
  useAcceptDelivery,
  useActiveDelivery,
  useDeliveryHistory,
  usePickupDelivery,
  useRejectDelivery,
  useStartDelivery,
} from '@/hooks/use-delivery';
import { getApiErrorMessage } from '@/lib/api-client';
import { DELIVERY_STATUS_BADGE_CLASS, DELIVERY_STATUS_LABEL } from '@/lib/delivery-status';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'Your account is awaiting admin approval.',
  SUSPENDED: 'Your account has been suspended — contact an admin.',
  INACTIVE: 'Your account is inactive — contact an admin.',
};

// Ticks locally against the server-computed deadline (see myActive()'s
// acceptDeadlineAt) — the countdown itself is just display, the actual
// expiry is enforced by the backend's per-minute sweep, not this timer.
function AcceptCountdown({ deadlineIso }: { deadlineIso: string }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(deadlineIso).getTime() - Date.now());

  useEffect(() => {
    const tick = () => setRemainingMs(new Date(deadlineIso).getTime() - Date.now());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [deadlineIso]);

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const isExpiring = totalSeconds <= 30;

  return (
    <span
      className={cn(
        'flex items-center gap-1.5 text-sm font-medium',
        isExpiring ? 'text-(--color-destructive)' : 'text-(--color-muted-foreground)',
      )}
    >
      <Clock className="size-4" aria-hidden />
      {totalSeconds > 0
        ? `Accept within ${minutes}:${String(seconds).padStart(2, '0')}`
        : 'Accept window expired — refreshing…'}
    </span>
  );
}

export default function DeliveryHomePage() {
  const { data: partner, isLoading, error } = useMyDeliveryPartnerProfile();
  const setAvailability = useSetAvailability();
  const { data: active, isLoading: isLoadingActive } = useActiveDelivery();
  const { data: history } = useDeliveryHistory(true);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const acceptMutation = useAcceptDelivery();
  const rejectMutation = useRejectDelivery();
  const pickupMutation = usePickupDelivery();
  const startMutation = useStartDelivery();

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

  const onActionError = (err: unknown) => toast.error(getApiErrorMessage(err, 'Could not update the delivery.'));

  const today = new Date().toDateString();
  const completedToday = history?.filter((d) => d.deliveredAt && new Date(d.deliveredAt).toDateString() === today).length ?? 0;
  const completedTotal = history?.filter((d) => d.status === 'DELIVERED').length ?? 0;

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

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 text-center">
          <p className="font-display text-2xl font-semibold text-(--color-foreground)">{completedToday}</p>
          <p className="text-xs text-(--color-muted-foreground)">Completed today</p>
        </div>
        <div className="rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 text-center">
          <p className="font-display text-2xl font-semibold text-(--color-foreground)">{completedTotal}</p>
          <p className="text-xs text-(--color-muted-foreground)">Completed total</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-(--color-foreground)">Active delivery</h2>

        {isLoadingActive ? (
          <p className="text-sm text-(--color-muted-foreground)">Loading…</p>
        ) : !active ? (
          <div className="flex flex-col items-center gap-2 rounded-(--radius-outer) border border-dashed border-(--color-border) py-12 text-center">
            <Package className="size-8 text-(--color-muted-foreground)" aria-hidden />
            <p className="text-sm text-(--color-muted-foreground)">No active delivery right now.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-(--color-foreground)">
                #{active.order.orderNumber}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DELIVERY_STATUS_BADGE_CLASS[active.status]}`}>
                {DELIVERY_STATUS_LABEL[active.status]}
              </span>
            </div>

            {active.status === 'ASSIGNED' && active.acceptDeadlineAt ? (
              <AcceptCountdown deadlineIso={active.acceptDeadlineAt} />
            ) : null}

            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-(--color-foreground)">{active.order.recipientName}</span>
              <span className="flex items-center gap-1.5 text-(--color-muted-foreground)">
                <Phone className="size-3.5" aria-hidden />
                {active.order.phone}
              </span>
              <span className="flex items-start gap-1.5 text-(--color-muted-foreground)">
                <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {active.order.line1}
                {active.order.line2 ? `, ${active.order.line2}` : ''}
                {active.order.landmark ? ` (near ${active.order.landmark})` : ''}, {active.order.city},{' '}
                {active.order.state} {active.order.postalCode}
              </span>
            </div>

            <div className="flex flex-col gap-1 border-t border-(--color-border) pt-3 text-sm">
              {active.order.items.map((item) => (
                <div key={item.id} className="flex justify-between text-(--color-muted-foreground)">
                  <span>
                    {item.productNameSnapshot} ({item.variantNameSnapshot}) × {item.quantity}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-(--color-border) pt-1.5 font-medium text-(--color-foreground)">
                <span>Total</span>
                <span>{formatCurrency(Number(active.order.total))}</span>
              </div>
              <span className="text-xs text-(--color-muted-foreground)">
                Payment: {active.order.payment?.status ?? 'unknown'}
              </span>
            </div>

            <div className="flex gap-2">
              {active.status === 'ASSIGNED' ? (
                <>
                  <Button
                    className="flex-1"
                    loading={acceptMutation.isPending}
                    onClick={() => acceptMutation.mutate(active.id, { onError: onActionError })}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    disabled={acceptMutation.isPending}
                    onClick={() => setShowRejectDialog(true)}
                  >
                    Reject
                  </Button>
                </>
              ) : active.status === 'ACCEPTED' ? (
                <Button
                  className="flex-1"
                  loading={pickupMutation.isPending}
                  onClick={() => pickupMutation.mutate(active.id, { onError: onActionError })}
                >
                  Picked up
                </Button>
              ) : active.status === 'PICKED_UP' ? (
                <Button
                  className="flex-1"
                  loading={startMutation.isPending}
                  onClick={() => startMutation.mutate(active.id, { onError: onActionError })}
                >
                  Start delivery
                </Button>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-(--color-muted-foreground)">
                  <Clock className="size-3.5" aria-hidden />
                  On the way — mark delivered once the customer confirms.
                </p>
              )}
            </div>

            <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject this delivery?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It goes back to the admin to reassign. You&apos;ll be available for new deliveries again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={rejectMutation.isPending}
                    onClick={() =>
                      rejectMutation.mutate(active.id, {
                        onError: onActionError,
                        onSuccess: () => setShowRejectDialog(false),
                      })
                    }
                  >
                    Reject delivery
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {history && history.length > 0 ? (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-(--color-foreground)">Delivery history</h2>
          <div className="flex flex-col gap-2">
            {history.map((delivery) => (
              <div
                key={delivery.id}
                className="flex items-center justify-between gap-4 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-(--color-foreground)">
                    #{delivery.order.orderNumber}
                  </span>
                  <span className="text-xs text-(--color-muted-foreground)">
                    {delivery.deliveredAt ? formatDate(delivery.deliveredAt) : formatDate(delivery.updatedAt ?? delivery.createdAt)}
                  </span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DELIVERY_STATUS_BADGE_CLASS[delivery.status]}`}>
                  {DELIVERY_STATUS_LABEL[delivery.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
