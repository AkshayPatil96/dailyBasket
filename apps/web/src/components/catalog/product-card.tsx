'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Loader2, Minus, Package, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@grocery-delivery/utils';
import type { ProductSummary } from '@grocery-delivery/types';
import { useCart, useAddToCart, useUpdateCartItem, useRemoveCartItem } from '@/hooks/use-cart';
import { getApiErrorMessage } from '@/lib/api-client';

export function ProductCard({ product }: { product: ProductSummary }) {
  const primaryImage = product.images[0];
  const cheapestVariant = product.variants[0];
  const { cart } = useCart();
  const addToCart = useAddToCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const cartItem = cheapestVariant
    ? cart?.items.find((item) => item.variantId === cheapestVariant.id)
    : undefined;
  const isMutating = addToCart.isPending || updateItem.isPending || removeItem.isPending;

  const onCartError = (error: unknown) =>
    toast.error(getApiErrorMessage(error, 'Could not update your cart.'));

  const handleAdd = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (cheapestVariant) {
      addToCart.mutate({ variantId: cheapestVariant.id }, { onError: onCartError });
    }
  };

  const handleIncrement = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (cheapestVariant) {
      addToCart.mutate({ variantId: cheapestVariant.id, quantity: 1 }, { onError: onCartError });
    }
  };

  const handleDecrement = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
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

  const discountPercent =
    cheapestVariant?.compareAtPrice &&
    Number(cheapestVariant.compareAtPrice) > Number(cheapestVariant.price)
      ? Math.round(
          (1 - Number(cheapestVariant.price) / Number(cheapestVariant.compareAtPrice)) * 100,
        )
      : null;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-outer border border-(--color-border) bg-(--color-card) transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square w-full bg-(--color-muted)">
        {discountPercent ? (
          <span className="absolute top-1.5 left-1.5 z-10 rounded-full bg-(--color-destructive) px-1.5 py-0.5 text-[10px] font-semibold text-(--color-destructive-foreground)">
            {discountPercent}% OFF
          </span>
        ) : null}
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.altText ?? product.name}
            fill
            sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 40vw"
            className="object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Package className="size-8 text-(--color-muted-foreground)" aria-hidden />
          </div>
        )}

        {cheapestVariant ? (
          <div className="absolute -bottom-3 right-1.5 z-10">
            {cartItem ? (
              <div className="flex items-center gap-1 rounded-lg border border-(--color-primary) bg-(--color-card) px-0.5 py-1 shadow-sm">
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={handleDecrement}
                  className="flex size-5 shrink-0 items-center justify-center text-(--color-primary) disabled:opacity-50"
                >
                  <Minus className="size-3" aria-hidden />
                  <span className="sr-only">Remove one</span>
                </button>
                <span className="min-w-[1ch] text-center text-xs font-semibold text-(--color-primary)">
                  {cartItem.quantity}
                </span>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={handleIncrement}
                  className="flex size-5 shrink-0 items-center justify-center text-(--color-primary) disabled:opacity-50"
                >
                  <Plus className="size-3" aria-hidden />
                  <span className="sr-only">Add one more</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isMutating}
                onClick={handleAdd}
                className="flex items-center justify-center rounded-lg border border-(--color-primary) bg-(--color-card) px-3 py-1 text-xs font-semibold text-(--color-primary) shadow-sm transition-colors hover:bg-(--color-primary)/5 disabled:opacity-50"
              >
                {addToCart.isPending ? (
                  <Loader2 className="size-3 animate-spin" aria-hidden />
                ) : (
                  'ADD'
                )}
              </button>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-0.5 p-2">
        {/* Fixed-height slot regardless of whether this product has a brand,
            so cards in the same row don't end up different heights. */}
        <div className="min-h-[14px] text-[11px] font-medium text-(--color-muted-foreground)">
          {product.brand}
        </div>
        <h3 className="line-clamp-2 min-h-9 text-xs font-medium text-(--color-foreground)">
          {product.name}
        </h3>
        {cheapestVariant ? (
          <div className="mt-auto flex flex-wrap items-baseline gap-x-1.5 pt-1">
            <span className="font-display text-sm font-semibold text-(--color-foreground)">
              {formatCurrency(Number(cheapestVariant.price))}
            </span>
            {cheapestVariant.compareAtPrice ? (
              <span className="text-[11px] text-(--color-muted-foreground) line-through">
                {formatCurrency(Number(cheapestVariant.compareAtPrice))}
              </span>
            ) : null}
            <span className="text-[11px] text-(--color-muted-foreground)">
              / {cheapestVariant.label}
            </span>
          </div>
        ) : (
          <span className="mt-auto pt-1 text-[11px] text-(--color-muted-foreground)">
            Out of stock
          </span>
        )}
      </div>
    </Link>
  );
}
