'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@grocery-delivery/utils';
import { adminDeliveriesApi } from '@/lib/admin-deliveries-api';
import {
  ADMIN_ASSIGNMENT_STATUS_BADGE_CLASS,
  ADMIN_ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_OUTCOME_LABEL,
  DELIVERY_FAILURE_REASON_LABEL,
  DELIVERY_REJECTION_REASON_LABEL,
  DELIVERY_STATUS_BADGE_CLASS,
  DELIVERY_STATUS_LABEL,
} from '@/lib/delivery-status';

const TIMELINE_STEPS: { key: 'assignedAt' | 'acceptedAt' | 'pickedUpAt' | 'outForDeliveryAt' | 'deliveredAt'; label: string }[] = [
  { key: 'assignedAt', label: 'Assigned' },
  { key: 'acceptedAt', label: 'Accepted' },
  { key: 'pickedUpAt', label: 'Picked up' },
  { key: 'outForDeliveryAt', label: 'Out for delivery' },
  { key: 'deliveredAt', label: 'Delivered' },
];

// Read-only audit trail — assign/retry/cancel all live on the order page
// (admin/orders/[id]/order-detail.tsx) since they're order-level decisions,
// not delivery-record edits. This page just shows what happened.
//
// Every reassignment shares one Delivery row, so its own status/timeline
// only ever reflects the *current* attempt (adminAssign() resets those
// fields on every reassign — see DeliveryAssignment's field comment in
// schema.prisma). ?assignment=<id> switches this page to show one specific
// past attempt's own timeline/partner/reason instead — otherwise a
// rejected-then-redelivered order's rejected attempt would be
// unviewable in isolation once a later attempt succeeded.
export function DeliveryDetail({ deliveryId }: { deliveryId: string }) {
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignment');

  const { data: delivery, isLoading } = useQuery({
    queryKey: ['admin', 'deliveries', deliveryId],
    queryFn: () => adminDeliveriesApi.get(deliveryId),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--color-primary)" aria-hidden />
      </div>
    );
  }

  if (!delivery) {
    return <p className="text-(--color-muted-foreground)">Delivery not found.</p>;
  }

  const selectedAssignment = assignmentId ? delivery.assignments.find((a) => a.id === assignmentId) : undefined;

  const attemptReasonText = selectedAssignment
    ? selectedAssignment.outcome === 'REJECTED' && selectedAssignment.rejectionReason
      ? `Rejected: ${
          selectedAssignment.rejectionReason === 'OTHER' && selectedAssignment.rejectionNote
            ? selectedAssignment.rejectionNote
            : DELIVERY_REJECTION_REASON_LABEL[selectedAssignment.rejectionReason]
        }`
      : selectedAssignment.failedAt && selectedAssignment.failureReason
        ? `Failed: ${DELIVERY_FAILURE_REASON_LABEL[selectedAssignment.failureReason]}`
        : null
    : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/deliveries"
        className="flex items-center gap-1.5 text-sm text-(--color-muted-foreground) hover:text-(--color-foreground)"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to deliveries
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          {selectedAssignment ? `Attempt for #${delivery.order.orderNumber}` : `Delivery for #${delivery.order.orderNumber}`}
        </h1>
        {selectedAssignment ? (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${ADMIN_ASSIGNMENT_STATUS_BADGE_CLASS[selectedAssignment.displayStatus]}`}
          >
            {ADMIN_ASSIGNMENT_STATUS_LABEL[selectedAssignment.displayStatus]}
          </span>
        ) : (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${DELIVERY_STATUS_BADGE_CLASS[delivery.status]}`}>
            {DELIVERY_STATUS_LABEL[delivery.status]}
          </span>
        )}
      </div>

      {selectedAssignment ? (
        <Link href={`/admin/deliveries/${deliveryId}`} className="self-start text-sm font-medium text-(--color-primary) hover:underline">
          ← View current delivery status
        </Link>
      ) : null}

      {attemptReasonText ? (
        <div className="rounded-(--radius-outer) border border-(--color-destructive)/30 bg-(--color-card) p-4 text-sm text-(--color-destructive)">
          {attemptReasonText}
        </div>
      ) : !selectedAssignment && delivery.failureReason ? (
        <div className="rounded-(--radius-outer) border border-(--color-destructive)/30 bg-(--color-card) p-4 text-sm text-(--color-destructive)">
          Failed: {delivery.failureReason.replace(/_/g, ' ').toLowerCase()}
        </div>
      ) : null}

      <Link
        href={`/admin/orders/${delivery.order.id}`}
        className="self-start text-sm font-medium text-(--color-primary) hover:underline"
      >
        Manage from order page →
      </Link>

      <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-(--color-foreground)">Order</h2>
          <Link
            href={`/admin/orders/${delivery.order.id}`}
            className="text-sm font-medium text-(--color-primary) hover:underline"
          >
            View order
          </Link>
        </div>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-(--color-muted-foreground)">Recipient</dt>
            <dd className="text-right text-(--color-foreground)">{delivery.order.recipientName}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-(--color-muted-foreground)">Phone</dt>
            <dd className="text-right text-(--color-foreground)">{delivery.order.phone}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-(--color-muted-foreground)">Address</dt>
            <dd className="text-right text-(--color-foreground)">
              {delivery.order.city}, {delivery.order.state}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-(--color-muted-foreground)">Total</dt>
            <dd className="text-right text-(--color-foreground)">{formatCurrency(Number(delivery.order.total))}</dd>
          </div>
        </dl>
      </div>

      {selectedAssignment ? (
        <div className="flex flex-col gap-2 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
          <h2 className="text-sm font-semibold text-(--color-foreground)">Partner for this attempt</h2>
          <p className="text-sm text-(--color-foreground)">
            {selectedAssignment.deliveryPartner.user.firstName} {selectedAssignment.deliveryPartner.user.lastName}
          </p>
        </div>
      ) : delivery.deliveryPartner ? (
        <div className="flex flex-col gap-2 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
          <h2 className="text-sm font-semibold text-(--color-foreground)">Current partner</h2>
          <p className="text-sm text-(--color-foreground)">
            {delivery.deliveryPartner.user?.firstName} {delivery.deliveryPartner.user?.lastName}
          </p>
          <p className="text-sm text-(--color-muted-foreground)">{delivery.deliveryPartner.user?.phone}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
        <h2 className="text-sm font-semibold text-(--color-foreground)">Timeline</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {selectedAssignment ? (
            <>
              <li className="flex justify-between gap-4">
                <span className="text-(--color-foreground)">Assigned</span>
                <span className="text-(--color-muted-foreground)">{formatDate(selectedAssignment.assignedAt)}</span>
              </li>
              <li className="flex justify-between gap-4">
                <span className="text-(--color-foreground)">{ASSIGNMENT_OUTCOME_LABEL[selectedAssignment.outcome]}</span>
                <span className="text-(--color-muted-foreground)">
                  {selectedAssignment.respondedAt ? formatDate(selectedAssignment.respondedAt) : '—'}
                </span>
              </li>
              {selectedAssignment.outcome === 'ACCEPTED' ? (
                <>
                  <li className="flex justify-between gap-4">
                    <span
                      className={selectedAssignment.pickedUpAt ? 'text-(--color-foreground)' : 'text-(--color-muted-foreground)'}
                    >
                      Picked up
                    </span>
                    <span className="text-(--color-muted-foreground)">
                      {selectedAssignment.pickedUpAt ? formatDate(selectedAssignment.pickedUpAt) : '—'}
                    </span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span
                      className={
                        selectedAssignment.outForDeliveryAt ? 'text-(--color-foreground)' : 'text-(--color-muted-foreground)'
                      }
                    >
                      Out for delivery
                    </span>
                    <span className="text-(--color-muted-foreground)">
                      {selectedAssignment.outForDeliveryAt ? formatDate(selectedAssignment.outForDeliveryAt) : '—'}
                    </span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span
                      className={
                        selectedAssignment.deliveredAt || selectedAssignment.failedAt
                          ? 'text-(--color-foreground)'
                          : 'text-(--color-muted-foreground)'
                      }
                    >
                      {selectedAssignment.failedAt ? 'Failed' : 'Delivered'}
                    </span>
                    <span className="text-(--color-muted-foreground)">
                      {selectedAssignment.deliveredAt
                        ? formatDate(selectedAssignment.deliveredAt)
                        : selectedAssignment.failedAt
                          ? formatDate(selectedAssignment.failedAt)
                          : '—'}
                    </span>
                  </li>
                </>
              ) : null}
            </>
          ) : (
            TIMELINE_STEPS.map((step) => {
              const value = delivery[step.key];
              return (
                <li key={step.key} className="flex justify-between gap-4">
                  <span className={value ? 'text-(--color-foreground)' : 'text-(--color-muted-foreground)'}>
                    {step.label}
                  </span>
                  <span className="text-(--color-muted-foreground)">{value ? formatDate(value) : '—'}</span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
