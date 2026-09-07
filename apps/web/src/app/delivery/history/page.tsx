'use client';

import { Loader2, Package } from 'lucide-react';
import { formatDate } from '@grocery-delivery/utils';
import { useDeliveryHistory } from '@/hooks/use-delivery';
import {
  ASSIGNMENT_OUTCOME_BADGE_CLASS,
  ASSIGNMENT_OUTCOME_LABEL,
  DELIVERY_STATUS_BADGE_CLASS,
  DELIVERY_STATUS_LABEL,
} from '@/lib/delivery-status';

export default function DeliveryHistoryPage() {
  const { data: history, isLoading } = useDeliveryHistory(true);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">History</h1>

      {isLoading ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-(--color-primary)" aria-hidden />
        </div>
      ) : !history || history.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-(--radius-outer) border border-dashed border-(--color-border) py-12 text-center">
          <Package className="size-8 text-(--color-muted-foreground)" aria-hidden />
          <p className="text-sm text-(--color-muted-foreground)">No past deliveries yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((entry) => {
            // The same Delivery can appear once per assignment attempt
            // (reassigned-then-retried), so delivery.status/timestamps are
            // shared across rows — only meaningful for the ACCEPTED row
            // (the one that actually went on to a terminal outcome).
            // REJECTED/EXPIRED rows show the assignment's own outcome
            // instead, at the time that attempt was resolved.
            const wasAccepted = entry.assignmentOutcome === 'ACCEPTED';
            const label = wasAccepted ? DELIVERY_STATUS_LABEL[entry.status] : ASSIGNMENT_OUTCOME_LABEL[entry.assignmentOutcome];
            const badgeClass = wasAccepted
              ? DELIVERY_STATUS_BADGE_CLASS[entry.status]
              : ASSIGNMENT_OUTCOME_BADGE_CLASS[entry.assignmentOutcome];
            const when = wasAccepted
              ? (entry.deliveredAt ?? entry.failedAt ?? entry.assignmentRespondedAt ?? entry.assignmentAssignedAt)
              : (entry.assignmentRespondedAt ?? entry.assignmentAssignedAt);

            return (
              <div
                key={entry.assignmentId}
                className="flex items-center justify-between gap-4 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-3"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-(--color-foreground)">
                    #{entry.order.orderNumber}
                  </span>
                  <span className="text-xs text-(--color-muted-foreground)">{formatDate(when)}</span>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>{label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
