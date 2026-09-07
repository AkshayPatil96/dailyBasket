'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Package, Search } from 'lucide-react';
import { formatCurrency } from '@grocery-delivery/utils';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { DeliveryOtpCard } from '@/components/orders/delivery-otp-card';
import { getApiErrorMessage } from '@/lib/api-client';
import { ordersApi } from '@/lib/orders-api';
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABEL } from '@/lib/order-status';

// Public, read-only lookup — no login required, and no action here can
// mutate the order. To cancel or otherwise manage an order, the customer
// must register/login with the email the order was placed under.
//
// Supports being linked to directly with ?orderNumber=...&email=... (e.g.
// from a future order-confirmation email/WhatsApp message) — both fields
// prefill and the lookup runs automatically on load.
export default function TrackOrderPage() {
  return (
    <Suspense>
      <TrackOrderView />
    </Suspense>
  );
}

function TrackOrderView() {
  const searchParams = useSearchParams();
  const initialOrderNumber = searchParams.get('orderNumber') ?? '';
  const initialEmail = searchParams.get('email') ?? '';
  const autoSubmitted = useRef(false);

  const trackMutation = useMutation({
    mutationFn: ({ orderNumber, email }: { orderNumber: string; email: string }) =>
      ordersApi.track(orderNumber, email),
  });

  useEffect(() => {
    if (!autoSubmitted.current && initialOrderNumber && initialEmail) {
      autoSubmitted.current = true;
      trackMutation.mutate({ orderNumber: initialOrderNumber, email: initialEmail });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderNumber, initialEmail]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const orderNumber = String(form.get('orderNumber') ?? '').trim();
    const email = String(form.get('email') ?? '').trim();
    if (orderNumber && email) {
      trackMutation.mutate({ orderNumber, email });
    }
  };

  const order = trackMutation.data;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          Track your order
        </h1>
        <p className="mt-1 text-sm text-(--color-muted-foreground)">
          Enter your order number and the email you used at checkout.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <FormField
            name="orderNumber"
            label="Order number"
            placeholder="DB-20260906-000123"
            defaultValue={initialOrderNumber}
            required
          />
        </div>
        <div className="flex-1">
          <FormField
            name="email"
            type="email"
            label="Email"
            placeholder="you@example.com"
            defaultValue={initialEmail}
            required
          />
        </div>
        <Button type="submit" loading={trackMutation.isPending}>
          <Search className="size-4" aria-hidden />
          Track
        </Button>
      </form>

      {trackMutation.isError ? (
        <p className="text-sm text-(--color-destructive)">
          {getApiErrorMessage(trackMutation.error, 'No order found for that order number and email.')}
        </p>
      ) : null}

      {order ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-(--color-foreground)">
              Order #{order.orderNumber}
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${ORDER_STATUS_BADGE_CLASS[order.status]}`}
            >
              {ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>

          <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
            <h3 className="text-sm font-semibold text-(--color-foreground)">Status</h3>
            <OrderTimeline order={order} />
          </div>

          <DeliveryOtpCard delivery={order.delivery} />

          <div className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
            <h3 className="text-sm font-semibold text-(--color-foreground)">Items</h3>
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
              <span className="text-(--color-foreground)">
                {formatCurrency(Number(order.deliveryFee))}
              </span>
            </div>
            {Number(order.discount) > 0 ? (
              <div className="flex justify-between">
                <span className="text-(--color-muted-foreground)">Discount</span>
                <span className="text-(--color-foreground)">
                  -{formatCurrency(Number(order.discount))}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-(--color-border) pt-2 font-semibold text-(--color-foreground)">
              <span>Total</span>
              <span>{formatCurrency(Number(order.total))}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 text-sm">
            <h3 className="mb-1 text-sm font-semibold text-(--color-foreground)">
              Delivery address
            </h3>
            <p className="text-(--color-foreground)">
              {order.recipientName} — {order.phone}
            </p>
            <p className="text-(--color-muted-foreground)">
              {[order.line1, order.line2, order.landmark, order.city, order.state, order.postalCode]
                .filter(Boolean)
                .join(', ')}
            </p>
          </div>

          <p className="text-center text-xs text-(--color-muted-foreground)">
            To cancel or manage this order, register or log in with this same email.
          </p>
        </div>
      ) : null}
    </main>
  );
}
