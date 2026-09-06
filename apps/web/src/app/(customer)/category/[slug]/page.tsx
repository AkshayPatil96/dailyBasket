import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import axios from 'axios';
import { Package } from 'lucide-react';
import type { CategoryTreeNode } from '@grocery-delivery/types';
import { catalogApi } from '@/lib/catalog-api';
import { CategoryProductBrowser } from '@/components/catalog/category-product-browser';
import { cn } from '@/lib/utils';

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const [categories, category] = await Promise.all([
    catalogApi.categoryTree(),
    catalogApi.category({ slug }).catch((error: unknown) => {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }),
  ]);

  if (!category) {
    notFound();
  }

  const products = await catalogApi.products({ categoryId: category.id, limit: 20 });

  // Categories are two levels deep here — resolve the top-level parent either
  // way (viewing the parent itself, or one of its subcategories) so the rail
  // can show "All" (the parent) plus every sibling subcategory.
  const parentNode: CategoryTreeNode | undefined = category.parentId
    ? categories.find((c) => c.id === category.parentId)
    : categories.find((c) => c.id === category.id);
  const subcategories = parentNode?.children ?? [];
  const isViewingAll = !category.parentId;

  const railItems = [
    { id: parentNode?.id ?? category.id, name: 'All', slug: parentNode?.slug ?? category.slug, imageUrl: null },
    ...subcategories,
  ];

  return (
    <main className="flex flex-col">
      <div className="container px-4 py-8 sm:px-6">
        <nav className="mb-4 flex items-center gap-1.5 text-sm text-(--color-muted-foreground)">
          <Link href="/" className="hover:text-(--color-primary)">
            Home
          </Link>
          <span>/</span>
          {parentNode ? (
            <Link href={`/category/${parentNode.slug}`} className="hover:text-(--color-primary)">
              {parentNode.name}
            </Link>
          ) : (
            <span className="text-(--color-foreground)">{category.name}</span>
          )}
          {!isViewingAll ? (
            <>
              <span>/</span>
              <span className="text-(--color-foreground)">{category.name}</span>
            </>
          ) : null}
        </nav>

        <div className="flex flex-col gap-6 md:flex-row">
          <nav
            aria-label="Subcategories"
            className="sticky top-(--header-height) z-20 -mx-4 flex gap-2 overflow-x-auto border-b border-(--color-border) bg-(--color-background) px-4 py-2 sm:-mx-6 sm:px-6 md:mx-0 md:w-56 md:shrink-0 md:flex-col md:gap-1 md:overflow-y-auto md:overflow-x-visible md:border-r md:border-b-0 md:bg-transparent md:px-0 md:pr-4 md:pb-4 md:sticky md:top-(--header-height) md:max-h-[calc(100vh-var(--header-height)-2rem)]"
          >
            {railItems.map((item) => {
              const isActive = item.name === 'All' ? isViewingAll : item.id === category.id;
              return (
                <Link
                  key={item.id}
                  href={`/category/${item.slug}`}
                  title={item.name}
                  className={cn(
                    'flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors md:w-full md:rounded-(--radius-inner) md:border-0 md:px-2 md:py-2',
                    isActive
                      ? 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary) md:border-l-2 md:border-(--color-primary) md:bg-(--color-primary)/8'
                      : 'border-(--color-border) text-(--color-foreground) hover:border-(--color-primary) md:border-l-2 md:border-transparent md:hover:bg-(--color-muted)',
                  )}
                >
                  {/* <span className="relative flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--color-muted)">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" fill sizes="28px" className="object-cover" />
                    ) : (
                      <Package className="size-3.5 text-(--color-muted-foreground)" aria-hidden />
                    )}
                  </span> */}
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
              {isViewingAll ? (parentNode?.name ?? category.name) : category.name}
            </h1>
            {category.description ? (
              <p className="mt-1 text-sm text-(--color-muted-foreground)">{category.description}</p>
            ) : null}

            <div className="mt-4">
              <CategoryProductBrowser categoryId={category.id} initialData={products} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
