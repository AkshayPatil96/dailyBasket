'use client';

import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { PaginatedResponse, ProductSummary } from '@grocery-delivery/types';
import { catalogApi } from '@/lib/catalog-api';
import { ProductCard } from '@/components/catalog/product-card';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { SelectItem } from '@/components/ui/select';

const PAGE_SIZE = 20;

// "Relevance" and "Newest" both resolve to createdAt-desc today — there's no
// curated ordering or search-relevance signal on a plain category browse.
// Kept as separate, conventionally-labeled options rather than pretending one
// is a real ranking; the underlying query is honestly just the default order.
const SORT_OPTIONS = {
  relevance: {},
  'name-asc': { sortBy: 'name' as const, sortOrder: 'asc' as const },
  'name-desc': { sortBy: 'name' as const, sortOrder: 'desc' as const },
  newest: { sortBy: 'createdAt' as const, sortOrder: 'desc' as const },
};
type SortKey = keyof typeof SORT_OPTIONS;

export function CategoryProductBrowser({
  categoryId,
  initialData,
}: {
  categoryId: string;
  initialData: PaginatedResponse<ProductSummary>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('relevance');

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['category-products', categoryId, sortKey],
    queryFn: ({ pageParam }) =>
      catalogApi.products({
        categoryId,
        offset: pageParam,
        limit: PAGE_SIZE,
        ...SORT_OPTIONS[sortKey],
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.offset + lastPage.limit : undefined),
    // Only the "relevance" (default) query matches what the server already rendered —
    // any other sort needs its own fresh fetch from offset 0.
    initialData: sortKey === 'relevance' ? { pages: [initialData], pageParams: [0] } : undefined,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? initialData.items;
  const total = data?.pages[0]?.total ?? initialData.total;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-(--color-muted-foreground)">
          {total} product{total === 1 ? '' : 's'}
        </p>
        <SelectField
          className="w-44"
          value={sortKey}
          onValueChange={(value) => setSortKey(value as SortKey)}
        >
          <SelectItem value="relevance">Relevance</SelectItem>
          <SelectItem value="name-asc">Name (A-Z)</SelectItem>
          <SelectItem value="name-desc">Name (Z-A)</SelectItem>
          <SelectItem value="newest">Newest first</SelectItem>
        </SelectField>
      </div>

      {items.length === 0 ? (
        <p className="mt-10 text-center text-(--color-muted-foreground)">
          No products in this category yet.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {items.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {hasNextPage ? (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                loading={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
