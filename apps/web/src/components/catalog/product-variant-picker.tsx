'use client';

import { useState } from 'react';
import { formatCurrency } from '@grocery-delivery/utils';
import type { ProductVariant } from '@grocery-delivery/types';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ProductVariantPicker({ variants }: { variants: ProductVariant[] }) {
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const selected = variants.find((variant) => variant.id === selectedId) ?? variants[0];

  if (!selected) {
    return (
      <p className="text-sm font-medium text-(--color-muted-foreground)">
        Currently out of stock
      </p>
    );
  }

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

      <div className="flex flex-col gap-1.5">
        <Button disabled className="w-fit">
          Add to cart
        </Button>
        {/* <span className="text-xs text-(--color-muted-foreground)">
          SKU: {selected.skuCode} — cart coming soon
        </span> */}
      </div>
    </div>
  );
}
