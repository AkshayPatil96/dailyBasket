'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@grocery-delivery/utils';
import type { OrderStatus } from '@grocery-delivery/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { getApiErrorMessage } from '@/lib/api-client';
import { adminOrdersApi } from '@/lib/admin-orders-api';
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABEL } from '@/lib/order-status';
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

  const { data: order, isLoading } = useQuery({
    queryKey: ['admin', 'orders', orderId],
    queryFn: () => adminOrdersApi.get(orderId),
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

  return (
    <div className="flex max-w-2xl flex-col gap-6">
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

      {order.status === 'PACKED' ? (
        <p className="text-sm text-(--color-muted-foreground)">
          Ready for delivery — partner assignment is coming soon.
        </p>
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
              Reserved stock will be returned to inventory. This cannot be undone.
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
