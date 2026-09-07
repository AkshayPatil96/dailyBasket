import { KeyRound } from 'lucide-react';
import type { Delivery } from '@grocery-delivery/types';

// Shown on both the authenticated order detail page and the guest
// track-order page — same trust boundary as the rest of that response
// (owner-only via userId, or orderNumber+email for guests), so surfacing
// the handoff code here isn't a new exposure.
export function DeliveryOtpCard({ delivery }: { delivery: Delivery | null | undefined }) {
  if (!delivery?.otpCode) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-(--radius-outer) border border-(--color-primary)/30 bg-(--color-primary)/5 p-4 text-center">
      <span className="flex items-center gap-1.5 text-sm font-medium text-(--color-primary)">
        <KeyRound className="size-4" aria-hidden />
        Delivery code
      </span>
      <span className="font-display text-3xl font-semibold tracking-[0.3em] text-(--color-foreground)">
        {delivery.otpCode}
      </span>
      <p className="text-xs text-(--color-muted-foreground)">
        Share this with the delivery partner when they arrive to confirm handoff.
      </p>
    </div>
  );
}
