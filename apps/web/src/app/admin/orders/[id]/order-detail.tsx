'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Eye, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency, formatDate } from '@grocery-delivery/utils';
import type { OrderStatus } from '@grocery-delivery/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { AssignPartnerPicker } from '@/components/admin/assign-partner-picker';
import { getApiErrorMessage } from '@/lib/api-client';
import { adminOrdersApi } from '@/lib/admin-orders-api';
import { adminDeliveriesApi } from '@/lib/admin-deliveries-api';
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABEL } from '@/lib/order-status';
import { ASSIGNMENT_OUTCOME_LABEL, RETRYABLE_DELIVERY_STATUSES } from '@/lib/delivery-status';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DELIVERY_STATUS_LABEL: Record<string, string> = {
  PENDING_ASSIGNMENT: 'Waiting for assignment',
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Accepted',
  PICKED_UP: 'Picked up',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  REJECTED: 'Rejected by partner',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
};

// Mirrors OrdersService's ALLOWED_TRANSITIONS — kept in sync manually since
// this is presentation-only; the backend is what actually enforces it.
// PACKED has no manual next status anymore: OUT_FOR_DELIVERY/DELIVERED are
// now reached via the delivery-partner assignment flow, not an admin click
// (see dailybasket-delivery-partner-operations.md) — the assign-partner UI
// for PACKED orders lands with that feature.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  CONFIRMED: 'PROCESSING',
  PROCESSING: 'PACKED',
};

const CANCELLABLE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'PACKED'];

export function OrderDetail({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showAssignDialog, setShowAssignDialog] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['admin', 'orders', orderId],
    queryFn: () => adminOrdersApi.get(orderId),
  });

  // Same query key delivery-detail.tsx uses for the same delivery — shares
  // its cache entry rather than duplicating a fetch when both pages are
  // visited. Assignment history moved here (see order-detail vs.
  // deliveries-detail split in dailybasket-delivery-partner-operations.md) —
  // deliveries pages are a flat audit list/single-delivery view, checking one
  // order's full history is an order-level concern.
  const deliveryId = order?.delivery?.id;
  const { data: deliveryDetail } = useQuery({
    queryKey: ['admin', 'deliveries', deliveryId],
    queryFn: () => adminDeliveriesApi.get(deliveryId!),
    enabled: !!deliveryId,
  });

  const invalidateLists = () => queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });

  const advanceMutation = useMutation({
    mutationFn: (status: OrderStatus) => adminOrdersApi.updateStatus(orderId, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'orders', orderId], updated);
      invalidateLists();
      toast.success(`Order marked as ${ORDER_STATUS_LABEL[updated.status].toLowerCase()}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update order status.')),
  });

  const cancelMutation = useMutation({
    mutationFn: () => adminOrdersApi.updateStatus(orderId, 'CANCELLED', cancelReason),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'orders', orderId], updated);
      invalidateLists();
      setShowCancelDialog(false);
      setCancelReason('');
      toast.success('Order cancelled');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not cancel order.')),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--color-primary)" aria-hidden />
      </div>
    );
  }

  if (!order) {
    return <p className="text-(--color-muted-foreground)">Order not found.</p>;
  }

  const nextStatus = NEXT_STATUS[order.status];
  // A Delivery row exists from the moment the order is placed (well before
  // PACKED), so we don't show this panel until there's something to act on
  // or report — either the order's ready for assignment, or the delivery
  // already has a real history (assigned/accepted/rejected/etc).
  const showDeliveryPanel =
    !!order.delivery && (order.status === 'PACKED' || order.delivery.status !== 'PENDING_ASSIGNMENT');
  const canAssignOrRetry =
    !!order.delivery &&
    ((order.status === 'PACKED' && order.delivery.status === 'PENDING_ASSIGNMENT') ||
      RETRYABLE_DELIVERY_STATUSES.includes(order.delivery.status));
  const isFailedDelivery = order.delivery?.status === 'FAILED';

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/orders"
        className="flex items-center gap-1.5 text-sm text-(--color-muted-foreground) hover:text-(--color-foreground)"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to orders
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          Order #{order.orderNumber}
        </h1>
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${ORDER_STATUS_BADGE_CLASS[order.status]}`}
        >
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </div>
      <p className="text-sm text-(--color-muted-foreground)">
        Placed on {new Date(order.createdAt).toLocaleString()}
      </p>

      {nextStatus || CANCELLABLE_STATUSES.includes(order.status) ? (
        <div className="flex gap-3">
          {nextStatus ? (
            <Button
              loading={advanceMutation.isPending}
              onClick={() => advanceMutation.mutate(nextStatus)}
            >
              Mark as {ORDER_STATUS_LABEL[nextStatus].toLowerCase()}
            </Button>
          ) : null}
          {CANCELLABLE_STATUSES.includes(order.status) ? (
            <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
              Cancel order
            </Button>
          ) : null}
        </div>
      ) : null}

      {showDeliveryPanel ? (
        <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-(--color-foreground)">
                {DELIVERY_STATUS_LABEL[order.delivery!.status] ?? order.delivery!.status}
              </span>
              {order.delivery!.deliveryPartner?.user ? (
                <span className="text-xs text-(--color-muted-foreground)">
                  {order.delivery!.deliveryPartner.user.firstName} {order.delivery!.deliveryPartner.user.lastName}
                </span>
              ) : order.delivery!.status === 'PENDING_ASSIGNMENT' ? (
                <span className="text-xs text-(--color-muted-foreground)">No partner assigned yet.</span>
              ) : null}
            </div>
            <Link
              href={`/admin/deliveries/${order.delivery!.id}`}
              className="text-sm font-medium text-(--color-primary) hover:underline"
            >
              View delivery
            </Link>
          </div>
          {canAssignOrRetry || isFailedDelivery ? (
            <div className="flex gap-2">
              {canAssignOrRetry ? (
                <Button size="sm" onClick={() => setShowAssignDialog(true)}>
                  {order.delivery!.status === 'PENDING_ASSIGNMENT' ? 'Assign delivery' : 'Retry — reassign'}
                </Button>
              ) : null}
              {isFailedDelivery ? (
                <Button size="sm" variant="outline" onClick={() => setShowCancelDialog(true)}>
                  Cancel order
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {order.delivery ? (
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {order.delivery?.status === 'PENDING_ASSIGNMENT' ? 'Assign a delivery partner' : 'Reassign to a new partner'}
              </DialogTitle>
            </DialogHeader>
            <AssignPartnerPicker
              deliveryId={order.delivery.id}
              onAssigned={() => {
                setShowAssignDialog(false);
                queryClient.invalidateQueries({ queryKey: ['admin', 'orders', orderId] });
              }}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {deliveryDetail && deliveryDetail.assignments.length > 0 ? (
        <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
          <h2 className="text-sm font-semibold text-(--color-foreground)">Assignment history</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {deliveryDetail.assignments.map((assignment) => {
              // An ACCEPTED row can still have gone on to fail under this
              // partner — surface that here since it's this attempt's own
              // outcome, not visible from Delivery's current (possibly
              // later-reassigned) status/failureReason anymore.
              const outcomeLabel =
                assignment.outcome === 'ACCEPTED' && assignment.failedAt
                  ? `Failed — ${assignment.failureReason?.replace(/_/g, ' ').toLowerCase() ?? 'unknown reason'}`
                  : assignment.outcome === 'REJECTED'
                    ? `Rejected — ${
                        assignment.rejectionReason === 'OTHER' && assignment.rejectionNote
                          ? assignment.rejectionNote
                          : (assignment.rejectionReason?.replace(/_/g, ' ').toLowerCase() ?? 'no reason given')
                      }`
                    : ASSIGNMENT_OUTCOME_LABEL[assignment.outcome];
              const when = assignment.failedAt ?? assignment.deliveredAt ?? assignment.respondedAt ?? assignment.assignedAt;
              return (
                <li key={assignment.id} className="flex items-center justify-between gap-4">
                  <span className="text-(--color-foreground)">
                    {assignment.deliveryPartner.user.firstName} {assignment.deliveryPartner.user.lastName}
                  </span>
                  <span className="flex items-center gap-2 text-(--color-muted-foreground)">
                    {outcomeLabel} · {formatDate(when)}
                    <Link
                      href={`/admin/deliveries/${deliveryDetail.id}?assignment=${assignment.id}`}
                      title="View this attempt's details"
                      className="flex size-6 shrink-0 items-center justify-center rounded-(--radius-inner) text-(--color-muted-foreground) hover:bg-(--color-muted) hover:text-(--color-foreground)"
                    >
                      <Eye className="size-3.5" aria-hidden />
                      <span className="sr-only">View delivery details</span>
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
        <h2 className="text-sm font-semibold text-(--color-foreground)">Status</h2>
        <OrderTimeline order={order} />
      </div>

      <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
        <h2 className="text-sm font-semibold text-(--color-foreground)">Items</h2>
        {order.items.map((item) => (
          <div key={item.id} className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-inner) bg-(--color-muted)">
              <Package className="size-5 text-(--color-muted-foreground)" aria-hidden />
            </span>
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium text-(--color-foreground)">
                {item.productNameSnapshot}
              </span>
              <span className="text-xs text-(--color-muted-foreground)">
                {item.variantNameSnapshot} × {item.quantity} · SKU {item.skuSnapshot}
              </span>
            </div>
            <span className="text-sm font-semibold text-(--color-foreground)">
              {formatCurrency(Number(item.lineTotal))}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-(--color-muted-foreground)">Subtotal</span>
          <span className="text-(--color-foreground)">{formatCurrency(Number(order.subtotal))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-(--color-muted-foreground)">Delivery fee</span>
          <span className="text-(--color-foreground)">{formatCurrency(Number(order.deliveryFee))}</span>
        </div>
        {Number(order.discount) > 0 ? (
          <div className="flex justify-between">
            <span className="text-(--color-muted-foreground)">Discount</span>
            <span className="text-(--color-foreground)">-{formatCurrency(Number(order.discount))}</span>
          </div>
        ) : null}
        <div className="flex justify-between border-t border-(--color-border) pt-2 font-semibold text-(--color-foreground)">
          <span>Total</span>
          <span>{formatCurrency(Number(order.total))}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 text-sm">
        <h2 className="mb-1 text-sm font-semibold text-(--color-foreground)">Delivery address</h2>
        <p className="text-(--color-foreground)">
          {order.recipientName} — {order.phone}
        </p>
        <p className="text-(--color-muted-foreground)">
          {[order.line1, order.line2, order.landmark, order.city, order.state, order.postalCode]
            .filter(Boolean)
            .join(', ')}
        </p>
      </div>

      <AlertDialog
        open={showCancelDialog}
        onOpenChange={(open) => {
          setShowCancelDialog(open);
          if (!open) setCancelReason('');
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
            <AlertDialogDescription>
              {isFailedDelivery
                ? "The delivery failed and won't be retried. This cannot be undone."
                : 'Reserved stock will be returned to inventory. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Reason for cancellation…"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMutation.isPending || !cancelReason.trim()}
              onClick={() => cancelMutation.mutate()}
            >
              Cancel order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
