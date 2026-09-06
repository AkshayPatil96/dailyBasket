'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
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

export default function OrdersPage() {
  return (
    <AuthGuard>
      <OrdersList />
    </AuthGuard>
  );
}

function OrdersList() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'list'],
    queryFn: () => ordersApi.list(),
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Your orders</h1>

      {isLoading ? (
        <p className="text-center text-(--color-muted-foreground)">Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-(--radius-outer) border border-dashed border-(--color-border) py-16 text-center">
          <Package className="size-8 text-(--color-muted-foreground)" aria-hidden />
          <p className="text-(--color-muted-foreground)">No orders yet.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex flex-col gap-1 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 hover:border-(--color-primary)"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-(--color-foreground)">
                    Order #{order.id.slice(0, 8)}
                  </span>
                  <span className="text-sm font-semibold text-(--color-foreground)">
                    {formatCurrency(Number(order.total))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-(--color-muted-foreground)">
                  <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                  <span>{STATUS_LABEL[order.status]}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
