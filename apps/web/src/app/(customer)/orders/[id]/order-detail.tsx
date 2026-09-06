'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2, Package } from 'lucide-react';
import { formatCurrency } from '@grocery-delivery/utils';
import type { OrderStatus } from '@grocery-delivery/types';
import { AuthGuard } from '@/components/auth/auth-guard';
import { ordersApi } from '@/lib/orders-api';

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pending payment',
  PAYMENT_FAILED: 'Payment failed',
  CONFIRMED: 'Confirmed',
  PROCESSING: 'Processing',
  PACKED: 'Packed',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

export function OrderDetail({ orderId }: { orderId: string }) {
  return (
    <AuthGuard>
      <OrderDetailContent orderId={orderId} />
    </AuthGuard>
  );
}

function OrderDetailContent({ orderId }: { orderId: string }) {
  const { data: order, isLoading } = useQuery({
    queryKey: ['orders', orderId],
    queryFn: () => ordersApi.get(orderId),
  });

  if (isLoading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--color-primary)" aria-hidden />
      </main>
    );
  }

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
        <p className="text-(--color-muted-foreground)">Order not found.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          Order #{order.id.slice(0, 8)}
        </h1>
        <span className="rounded-full bg-(--color-muted) px-3 py-1 text-xs font-medium text-(--color-muted-foreground)">
          {STATUS_LABEL[order.status]}
        </span>
      </div>
      <p className="text-sm text-(--color-muted-foreground)">
        Placed on {new Date(order.createdAt).toLocaleString()}
      </p>

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
                {item.variantNameSnapshot} × {item.quantity}
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
        <p className="text-(--color-foreground)">{order.recipientName} — {order.phone}</p>
        <p className="text-(--color-muted-foreground)">
          {[order.line1, order.line2, order.landmark, order.city, order.state, order.postalCode]
            .filter(Boolean)
            .join(', ')}
        </p>
      </div>
    </main>
  );
}
