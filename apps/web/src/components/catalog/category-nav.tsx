'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { CategoryTreeNode } from '@grocery-delivery/types';
import { cn } from '@/lib/utils';

export function CategoryNav({ categories }: { categories: CategoryTreeNode[] }) {
  const pathname = usePathname();

  if (categories.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Categories"
      className="flex gap-2 overflow-x-auto border-b border-(--color-border) px-4 py-3 sm:px-6"
    >
      {categories.map((category) => {
        const isActive = pathname === `/category/${category.slug}`;
        return (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className={cn(
              'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              isActive
                ? 'border-(--color-primary) bg-(--color-primary) text-(--color-primary-foreground)'
                : 'border-(--color-border) text-(--color-foreground) hover:border-(--color-primary)',
            )}
          >
            {category.name}
          </Link>
        );
      })}
    </nav>
  );
}
