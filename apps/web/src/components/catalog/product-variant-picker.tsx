'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@grocery-delivery/utils';
import type { ProductVariant } from '@grocery-delivery/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getApiErrorMessage } from '@/lib/api-client';
import { useAddToCart, useCart, useRemoveCartItem, useUpdateCartItem } from '@/hooks/use-cart';

export function ProductVariantPicker({ variants }: { variants: ProductVariant[] }) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  const { cart } = useCart();
  const addToCart = useAddToCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const isMutating = addToCart.isPending || updateItem.isPending || removeItem.isPending;

  if (!selected) {
    return (
      <p className="text-sm font-medium text-(--color-muted-foreground)">
        Currently out of stock
      </p>
    );
  }

  const cartItem = cart?.items.find((item) => item.variantId === selected.id);
  const onCartError = (error: unknown) =>
    toast.error(getApiErrorMessage(error, 'Could not update your cart.'));

  const handleAdd = () => {
    addToCart.mutate({ variantId: selected.id }, { onError: onCartError });
  };

  const handleIncrement = () => {
    addToCart.mutate({ variantId: selected.id, quantity: 1 }, { onError: onCartError });
  };

  const handleDecrement = () => {
    if (!cartItem) return;
    if (cartItem.quantity <= 1) {
      removeItem.mutate(cartItem.id, { onError: onCartError });
    } else {
      updateItem.mutate(
        { itemId: cartItem.id, quantity: cartItem.quantity - 1 },
        { onError: onCartError },
      );
    }
  };

  const price = Number(selected.price);
  const compareAt = selected.compareAtPrice ? Number(selected.compareAtPrice) : null;
  const amountOff = compareAt && compareAt > price ? compareAt - price : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-(--color-muted-foreground)">Net Qty: {selected.label}</p>

      <div className="flex items-center gap-3">
        <span className="rounded-(--radius-inner) bg-(--color-primary) px-3 py-1.5 font-display text-xl font-bold text-(--color-primary-foreground)">
          {formatCurrency(price)}
        </span>
        {compareAt ? (
          <div className="flex flex-col text-sm leading-tight">
            <span className="text-(--color-muted-foreground)">
              MRP <span className="line-through">{formatCurrency(compareAt)}</span>
            </span>
            {amountOff ? (
              <span className="font-medium text-(--color-primary)">
                {formatCurrency(amountOff)} OFF
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {variants.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {variants.map((variant) => (
            <button
              key={variant.id}
              type="button"
              onClick={() => setSelectedId(variant.id)}
              className={cn(
                'cursor-pointer rounded-(--radius-inner) border px-4 py-2 text-sm font-medium transition-colors',
                variant.id === selected.id
                  ? 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)'
                  : 'border-(--color-border) text-(--color-foreground) hover:border-(--color-primary)',
              )}
            >
              {variant.label}
            </button>
          ))}
        </div>
      ) : null}

      {cartItem ? (
        <div className="flex w-fit items-center gap-3 rounded-(--radius-inner) border border-(--color-primary) bg-(--color-primary)/10 px-2 py-1.5">
          <button
            type="button"
            disabled={isMutating}
            onClick={handleDecrement}
            className="flex size-7 shrink-0 items-center justify-center text-(--color-primary) disabled:opacity-50"
          >
            <Minus className="size-4" aria-hidden />
            <span className="sr-only">Remove one</span>
          </button>
          <span className="min-w-[2ch] text-center font-semibold text-(--color-primary)">
            {cartItem.quantity}
          </span>
          <button
            type="button"
            disabled={isMutating}
            onClick={handleIncrement}
            className="flex size-7 shrink-0 items-center justify-center text-(--color-primary) disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden />
            <span className="sr-only">Add one more</span>
          </button>
        </div>
      ) : (
        <Button
          onClick={handleAdd}
          disabled={isMutating}
          loading={addToCart.isPending}
          className="w-fit"
        >
          Add to cart
        </Button>
      )}
    </div>
  );
}
