import { CheckCircle2, Circle } from 'lucide-react';
import type { Order, OrderEventType } from '@grocery-delivery/types';
import { ORDER_EVENT_ACTOR_LABEL } from '@/lib/order-status';

// The happy-path sequence a non-cancelled order moves through — used to show
// upcoming (not-yet-reached) steps alongside the actual, append-only
// OrderEvent rows (dailybasket-orders-order-tracking.md §8).
const TIMELINE_SEQUENCE: { type: OrderEventType; label: string }[] = [
  { type: 'ORDER_PLACED', label: 'Order placed' },
  { type: 'PAYMENT_CONFIRMED', label: 'Payment confirmed' },
  { type: 'ORDER_CONFIRMED', label: 'Order confirmed' },
  { type: 'PICKING_STARTED', label: 'Being packed' },
  { type: 'ORDER_PACKED', label: 'Packed' },
  { type: 'OUT_FOR_DELIVERY', label: 'Out for delivery' },
  { type: 'DELIVERED', label: 'Delivered' },
];

export function OrderTimeline({ order }: { order: Order }) {
  if (order.status === 'CANCELLED') {
    return (
      <ol className="flex flex-col gap-3">
        {(order.events ?? []).map((event) => (
          <li key={event.id} className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-(--color-primary)" aria-hidden />
            <div>
              <p className="font-medium text-(--color-foreground)">
                {TIMELINE_SEQUENCE.find((s) => s.type === event.type)?.label ?? 'Order cancelled'}
              </p>
              <p className="text-xs text-(--color-muted-foreground)">
                {new Date(event.createdAt).toLocaleString()}
                {event.type === 'ORDER_CANCELLED'
                  ? ` — cancelled by ${ORDER_EVENT_ACTOR_LABEL[event.actorType]}`
                  : ''}
                {event.message ? ` — ${event.message}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ol>
    );
  }

  const completed = new Map((order.events ?? []).map((event) => [event.type, event]));

  return (
    <ol className="flex flex-col gap-3">
      {TIMELINE_SEQUENCE.map((step) => {
        const event = completed.get(step.type);
        return (
          <li key={step.type} className="flex items-start gap-2 text-sm">
            {event ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-(--color-primary)" aria-hidden />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-(--color-muted-foreground)" aria-hidden />
            )}
            <div>
              <p
                className={
                  event
                    ? 'font-medium text-(--color-foreground)'
                    : 'text-(--color-muted-foreground)'
                }
              >
                {step.label}
              </p>
              {event ? (
                <p className="text-xs text-(--color-muted-foreground)">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
