'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { formatCurrency } from '@grocery-delivery/utils';
import { ordersApi } from '@/lib/orders-api';
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABEL } from '@/lib/order-status';

export default function OrdersPage() {
  return <OrdersList />;
}

function OrdersList() {
  const { data, isLoading } = useQuery({
    queryKey: ['orders', 'list'],
    queryFn: () => ordersApi.list(),
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
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
                    Order #{order.orderNumber}
                  </span>
                  <span className="text-sm font-semibold text-(--color-foreground)">
                    {formatCurrency(Number(order.total))}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-(--color-muted-foreground)">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${ORDER_STATUS_BADGE_CLASS[order.status]}`}
                  >
                    {ORDER_STATUS_LABEL[order.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
