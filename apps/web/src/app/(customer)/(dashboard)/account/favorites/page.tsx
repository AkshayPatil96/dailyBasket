'use client';

import { useQuery } from '@tanstack/react-query';
import { Clock, Heart, RotateCcw } from 'lucide-react';
import type { ProductSummary } from '@grocery-delivery/types';
import { ProductCard } from '@/components/catalog/product-card';
import { useFavoriteIds, useFavoritesList } from '@/hooks/use-favorites';
import { useRecentlyViewed } from '@/hooks/use-product-views';
import { ordersApi } from '@/lib/orders-api';

function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  isLoading,
  products,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  isLoading: boolean;
  products: ProductSummary[];
}) {
  if (!isLoading && products.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-(--color-foreground)">
        <Icon className="size-4 text-(--color-muted-foreground)" aria-hidden />
        {title}
      </h2>
      {isLoading ? (
        <p className="text-sm text-(--color-muted-foreground)">Loading…</p>
      ) : (
        <ProductGrid products={products} />
      )}
    </div>
  );
}

export default function FavoritesPage() {
  const { ids: favoriteIds } = useFavoriteIds();
  const hasFavorites = favoriteIds.length > 0;
  const favorites = useFavoritesList(hasFavorites);
  const buyAgain = useQuery({ queryKey: ['orders', 'buy-again'], queryFn: ordersApi.buyAgain });
  const recentlyViewed = useRecentlyViewed(true);

  const favoriteProducts = favorites.data ?? [];
  const buyAgainProducts = (buyAgain.data ?? []).map((item) => item.product);
  const recentProducts = recentlyViewed.data ?? [];

  const isLoading = favorites.isLoading || buyAgain.isLoading || recentlyViewed.isLoading;
  const isEmpty =
    !isLoading &&
    favoriteProducts.length === 0 &&
    buyAgainProducts.length === 0 &&
    recentProducts.length === 0;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Favorites</h1>

      {isEmpty ? (
        <div className="flex flex-col items-center gap-2 rounded-(--radius-outer) border border-dashed border-(--color-border) py-16 text-center">
          <Heart className="size-8 text-(--color-muted-foreground)" aria-hidden />
          <p className="text-(--color-muted-foreground)">
            Save products you like, and they&apos;ll show up here.
          </p>
        </div>
      ) : (
        <>
          <Section
            title="Favorites"
            icon={Heart}
            isLoading={hasFavorites && favorites.isLoading}
            products={favoriteProducts}
          />
          <Section
            title="Buy again"
            icon={RotateCcw}
            isLoading={buyAgain.isLoading}
            products={buyAgainProducts}
          />
          <Section
            title="Recently viewed"
            icon={Clock}
            isLoading={recentlyViewed.isLoading}
            products={recentProducts}
          />
        </>
      )}
    </div>
  );
}
