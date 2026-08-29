import Image from 'next/image';
import Link from 'next/link';
import { Package } from 'lucide-react';
import { formatCurrency } from '@grocery-delivery/utils';
import type { ProductSummary } from '@grocery-delivery/types';

export function ProductCard({ product }: { product: ProductSummary }) {
  const primaryImage = product.images[0];
  const cheapestVariant = product.variants[0];
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
