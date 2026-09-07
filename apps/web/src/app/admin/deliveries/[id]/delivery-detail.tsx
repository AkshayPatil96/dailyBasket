'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { formatCurrency, formatDate } from '@grocery-delivery/utils';
import type { DeliveryAssignmentOutcome } from '@grocery-delivery/types';
import { adminDeliveriesApi } from '@/lib/admin-deliveries-api';
import { DELIVERY_STATUS_BADGE_CLASS, DELIVERY_STATUS_LABEL, RETRYABLE_DELIVERY_STATUSES } from '@/lib/delivery-status';
import { AssignPartnerPicker } from '@/components/admin/assign-partner-picker';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ASSIGNMENT_OUTCOME_LABEL: Record<DeliveryAssignmentOutcome, string> = {
  PENDING: 'Awaiting response',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  REASSIGNED: 'Reassigned',
  EXPIRED: 'Missed the accept window',
};

const TIMELINE_STEPS: { key: 'assignedAt' | 'acceptedAt' | 'pickedUpAt' | 'outForDeliveryAt' | 'deliveredAt'; label: string }[] = [
  { key: 'assignedAt', label: 'Assigned' },
  { key: 'acceptedAt', label: 'Accepted' },
  { key: 'pickedUpAt', label: 'Picked up' },
  { key: 'outForDeliveryAt', label: 'Out for delivery' },
  { key: 'deliveredAt', label: 'Delivered' },
];

export function DeliveryDetail({ deliveryId }: { deliveryId: string }) {
  const queryClient = useQueryClient();
  const [showAssignDialog, setShowAssignDialog] = useState(false);

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

  const canAssignOrRetry = delivery.status === 'PENDING_ASSIGNMENT' || RETRYABLE_DELIVERY_STATUSES.includes(delivery.status);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Link
        href="/admin/deliveries"
        className="flex items-center gap-1.5 text-sm text-(--color-muted-foreground) hover:text-(--color-foreground)"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to deliveries
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          Delivery for #{delivery.order.orderNumber}
        </h1>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${DELIVERY_STATUS_BADGE_CLASS[delivery.status]}`}>
          {DELIVERY_STATUS_LABEL[delivery.status]}
        </span>
      </div>

      {delivery.failureReason ? (
        <div className="rounded-(--radius-outer) border border-(--color-destructive)/30 bg-(--color-card) p-4 text-sm text-(--color-destructive)">
          Failed: {delivery.failureReason.replace(/_/g, ' ').toLowerCase()}
        </div>
      ) : null}

      {canAssignOrRetry ? (
        <Button className="self-start" onClick={() => setShowAssignDialog(true)}>
          {delivery.status === 'PENDING_ASSIGNMENT' ? 'Assign delivery' : 'Retry — reassign'}
        </Button>
      ) : null}

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

      {delivery.deliveryPartner ? (
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
          {TIMELINE_STEPS.map((step) => {
            const value = delivery[step.key];
            return (
              <li key={step.key} className="flex justify-between gap-4">
                <span className={value ? 'text-(--color-foreground)' : 'text-(--color-muted-foreground)'}>
                  {step.label}
                </span>
                <span className="text-(--color-muted-foreground)">{value ? formatDate(value) : '—'}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {delivery.assignments.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
          <h2 className="text-sm font-semibold text-(--color-foreground)">Assignment history</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {delivery.assignments.map((assignment) => (
              <li key={assignment.id} className="flex items-center justify-between gap-4">
                <span className="text-(--color-foreground)">
                  {assignment.deliveryPartner.user.firstName} {assignment.deliveryPartner.user.lastName}
                </span>
                <span className="text-(--color-muted-foreground)">
                  {ASSIGNMENT_OUTCOME_LABEL[assignment.outcome]} · {formatDate(assignment.assignedAt)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {delivery.status === 'PENDING_ASSIGNMENT' ? 'Assign a delivery partner' : 'Reassign to a new partner'}
            </DialogTitle>
          </DialogHeader>
          <AssignPartnerPicker
            deliveryId={delivery.id}
            onAssigned={() => {
              setShowAssignDialog(false);
              queryClient.invalidateQueries({ queryKey: ['admin', 'deliveries', deliveryId] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
