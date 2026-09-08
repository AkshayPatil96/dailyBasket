'use client';

import { useEffect, useState } from 'react';
import { Clock, Loader2, MapPin, Navigation, Package, Phone, Power } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@grocery-delivery/utils';
import { useMyDeliveryPartnerProfile, useSetAvailability } from '@/hooks/use-delivery-partner';
import type { DeliveryFailureReason, DeliveryRejectionReason } from '@grocery-delivery/types';
import {
  useAcceptDelivery,
  useActiveDelivery,
  useCompleteDelivery,
  useDeliveryHistory,
  useFailDelivery,
  usePickupDelivery,
  useRejectDelivery,
  useStartDelivery,
} from '@/hooks/use-delivery';
import { getApiErrorMessage } from '@/lib/api-client';
import {
  DELIVERY_FAILURE_REASON_LABEL,
  DELIVERY_REJECTION_REASON_LABEL,
  DELIVERY_STATUS_BADGE_CLASS,
  DELIVERY_STATUS_LABEL,
} from '@/lib/delivery-status';
import { Button, buttonVariants } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Textarea } from '@/components/ui/textarea';
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

const FAILURE_REASONS = Object.keys(DELIVERY_FAILURE_REASON_LABEL) as DeliveryFailureReason[];
const REJECTION_REASONS = Object.keys(DELIVERY_REJECTION_REASON_LABEL) as DeliveryRejectionReason[];

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

// Prefers the snapshotted lat/lng (set at checkout, see the address-location
// doc) over the text address — more accurate, and Maps still geocodes a
// plain address fine as a fallback for older orders placed before that
// snapshot existed.
function googleMapsDirectionsUrl(order: {
  latitude?: number | null;
  longitude?: number | null;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  postalCode: string;
}): string {
  const destination =
    order.latitude != null && order.longitude != null
      ? `${order.latitude},${order.longitude}`
      : [order.line1, order.line2, order.landmark, order.city, order.state, order.postalCode].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export default function DeliveryHomePage() {
  const { data: partner, isLoading, error } = useMyDeliveryPartnerProfile();
  const setAvailability = useSetAvailability();
  const { data: active, isLoading: isLoadingActive } = useActiveDelivery();
  const { data: history } = useDeliveryHistory(true);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showFailDialog, setShowFailDialog] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [failReason, setFailReason] = useState<DeliveryFailureReason>('CUSTOMER_UNAVAILABLE');
  const [rejectReason, setRejectReason] = useState<DeliveryRejectionReason>('TOO_FAR');
  const [rejectNote, setRejectNote] = useState('');

  const acceptMutation = useAcceptDelivery();
  const rejectMutation = useRejectDelivery();
  const pickupMutation = usePickupDelivery();
  const startMutation = useStartDelivery();
  const completeMutation = useCompleteDelivery();
  const failMutation = useFailDelivery();

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

  // Gate on assignmentDeliveredAt, this attempt's own terminal timestamp —
  // not Delivery's shared status/deliveredAt, which only ever reflects
  // whichever attempt is current (a failed-then-retried delivery would
  // otherwise count once per attempt, or not count the failed one as
  // distinct from the eventual success — see myHistory()'s comment).
  const today = new Date().toDateString();
  const completedDeliveries = history?.filter((d) => d.assignmentOutcome === 'ACCEPTED' && d.assignmentDeliveredAt) ?? [];
  const completedToday = completedDeliveries.filter(
    (d) => d.assignmentDeliveredAt && new Date(d.assignmentDeliveredAt).toDateString() === today,
  ).length;
  const completedTotal = completedDeliveries.length;

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
              <a
                href={googleMapsDirectionsUrl(active.order)}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'self-start')}
              >
                <Navigation className="size-3.5" aria-hidden />
                Navigate
              </a>
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
              ) : active.status === 'OUT_FOR_DELIVERY' ? (
                <form
                  className="flex w-full flex-col gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (otpInput.trim().length !== 6) return;
                    completeMutation.mutate(
                      { deliveryId: active.id, otpCode: otpInput.trim() },
                      {
                        onError: onActionError,
                        onSuccess: () => {
                          setOtpInput('');
                          toast.success('Delivery completed');
                        },
                      },
                    );
                  }}
                >
                  <p className="flex items-center gap-1.5 text-xs text-(--color-muted-foreground)">
                    <Clock className="size-3.5" aria-hidden />
                    Ask the customer for their delivery code to complete.
                  </p>
                  <div className="flex gap-2">
                    <FormField
                      label="Delivery code"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit code"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      className="flex-1"
                    />
                    <Button
                      type="submit"
                      className="self-end"
                      loading={completeMutation.isPending}
                      disabled={otpInput.trim().length !== 6}
                    >
                      Complete
                    </Button>
                  </div>
                  <button
                    type="button"
                    className="self-start text-xs font-medium text-(--color-destructive) underline-offset-2 hover:underline"
                    onClick={() => setShowFailDialog(true)}
                  >
                    Report a problem with this delivery
                  </button>
                </form>
              ) : null}
            </div>

            <AlertDialog
              open={showRejectDialog}
              onOpenChange={(open) => {
                setShowRejectDialog(open);
                if (!open) setRejectNote('');
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reject this delivery?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It goes back to the admin to reassign. You&apos;ll be available for new deliveries again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-1.5">
                  {REJECTION_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className="flex items-center gap-2 rounded-(--radius-outer) border border-(--color-border) p-2.5 text-sm has-checked:border-(--color-primary)"
                    >
                      <input
                        type="radio"
                        name="rejectReason"
                        value={reason}
                        checked={rejectReason === reason}
                        onChange={() => setRejectReason(reason)}
                      />
                      {DELIVERY_REJECTION_REASON_LABEL[reason]}
                    </label>
                  ))}
                </div>
                {rejectReason === 'OTHER' ? (
                  <Textarea
                    placeholder="What's the reason?"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  />
                ) : null}
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={rejectMutation.isPending || (rejectReason === 'OTHER' && !rejectNote.trim())}
                    onClick={() =>
                      rejectMutation.mutate(
                        { deliveryId: active.id, reason: rejectReason, note: rejectNote.trim() || undefined },
                        {
                          onError: onActionError,
                          onSuccess: () => {
                            setShowRejectDialog(false);
                            setRejectNote('');
                          },
                        },
                      )
                    }
                  >
                    Reject delivery
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={showFailDialog} onOpenChange={setShowFailDialog}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Report a delivery problem</AlertDialogTitle>
                  <AlertDialogDescription>
                    This goes to the admin for review — they&apos;ll retry, reassign, or cancel the order.
                    You&apos;ll be available for new deliveries again.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="flex flex-col gap-1.5">
                  {FAILURE_REASONS.map((reason) => (
                    <label
                      key={reason}
                      className="flex items-center gap-2 rounded-(--radius-outer) border border-(--color-border) p-2.5 text-sm has-checked:border-(--color-primary)"
                    >
                      <input
                        type="radio"
                        name="failReason"
                        value={reason}
                        checked={failReason === reason}
                        onChange={() => setFailReason(reason)}
                      />
                      {DELIVERY_FAILURE_REASON_LABEL[reason]}
                    </label>
                  ))}
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    disabled={failMutation.isPending}
                    onClick={() =>
                      failMutation.mutate(
                        { deliveryId: active.id, reason: failReason },
                        {
                          onError: onActionError,
                          onSuccess: () => {
                            setShowFailDialog(false);
                            toast.success('Reported — admin will review this delivery.');
                          },
                        },
                      )
                    }
                  >
                    Submit report
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
    </main>
  );
}
