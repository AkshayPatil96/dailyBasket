'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Package } from 'lucide-react';
import type { ProductImage } from '@grocery-delivery/types';
import { cn } from '@/lib/utils';

export function ProductImageGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const sorted = [...images].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
    return a.sortOrder - b.sortOrder;
  });
  const [activeIndex, setActiveIndex] = useState(0);
  const active = sorted[activeIndex];

  return (
    <div className="flex gap-3">
      {sorted.length > 1 ? (
        <div className="flex flex-col gap-2">
          {sorted.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`Show image ${index + 1}`}
              aria-current={index === activeIndex}
              className={cn(
                'relative size-14 shrink-0 overflow-hidden rounded-(--radius-inner) border-2 bg-(--color-muted) transition-colors',
                index === activeIndex
                  ? 'border-(--color-primary)'
                  : 'border-transparent hover:border-(--color-border)',
              )}
            >
              <Image src={image.url} alt="" fill sizes="56px" className="object-contain p-1" />
            </button>
          ))}
        </div>
      ) : null}

      <div className="relative aspect-square w-full overflow-hidden rounded-(--radius-outer) bg-(--color-muted)">
        {active ? (
          <Image
            key={active.id}
            src={active.url}
            alt={active.altText ?? productName}
            fill
            sizes="(min-width: 768px) 45vw, 100vw"
            className="object-contain p-6"
            priority
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Package className="size-16 text-(--color-muted-foreground)" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}
