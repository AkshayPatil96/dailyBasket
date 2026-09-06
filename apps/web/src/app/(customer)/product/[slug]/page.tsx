import Link from 'next/link';
import { notFound } from 'next/navigation';
import axios from 'axios';
import { catalogApi } from '@/lib/catalog-api';
import { FavoriteButton } from '@/components/catalog/favorite-button';
import { ProductImageGallery } from '@/components/catalog/product-image-gallery';
import { ProductVariantPicker } from '@/components/catalog/product-variant-picker';
import { RecordProductView } from '@/components/catalog/record-product-view';
import { ProductRail } from '@/components/home/product-rail';

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const product = await catalogApi.product({ slug }).catch((error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null;
    }
    throw error;
  });

  if (!product) {
    notFound();
  }

  const [parentCategory, similar] = await Promise.all([
    product.category.parentId
      ? catalogApi.category({ id: product.category.parentId })
      : Promise.resolve(null),
    catalogApi.products({ categoryId: product.categoryId, limit: 9 }),
  ]);

  const similarProducts = similar.items.filter((item) => item.id !== product.id).slice(0, 8);

  const nutritionalEntries =
    product.nutritionalInfo && typeof product.nutritionalInfo === 'object'
      ? Object.entries(product.nutritionalInfo).filter(
          ([, value]) => typeof value === 'string' || typeof value === 'number',
        )
      : [];

  return (
    <main className="flex flex-col">
      <div className="container px-4 py-8 sm:px-6">
        <nav className="mb-6 flex flex-wrap items-center gap-1.5 text-sm text-(--color-muted-foreground)">
          <Link href="/" className="hover:text-(--color-primary)">
            Home
          </Link>
          <span>/</span>
          {parentCategory ? (
            <>
              <Link
                href={`/category/${parentCategory.slug}`}
                className="hover:text-(--color-primary)"
              >
                {parentCategory.name}
              </Link>
              <span>/</span>
            </>
          ) : null}
          <Link href={`/category/${product.category.slug}`} className="hover:text-(--color-primary)">
            {product.category.name}
          </Link>
          <span>/</span>
          <span className="font-medium text-(--color-foreground)">{product.name}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-2">
          <ProductImageGallery images={product.images} productName={product.name} />

          <div className="flex flex-col gap-4">
            <RecordProductView productId={product.id} />
            {product.brand ? (
              <span className="text-sm font-medium text-(--color-muted-foreground)">
                {product.brand}
              </span>
            ) : null}
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
                {product.name}
              </h1>
              <FavoriteButton productId={product.id} className="shrink-0" />
            </div>

            {product.dietaryInfo.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {product.dietaryInfo.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-(--color-muted) px-2.5 py-0.5 text-xs font-medium text-(--color-muted-foreground)"
                  >
                    {tag.replace('_', ' ').toLowerCase()}
                  </span>
                ))}
              </div>
            ) : null}

            <ProductVariantPicker variants={product.variants} />

            <div className="flex flex-col gap-2 rounded-(--radius-outer) border border-(--color-border) p-4">
              <h2 className="text-sm font-semibold text-(--color-foreground)">Highlights</h2>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-(--color-muted-foreground)">Category</dt>
                  <dd className="text-right text-(--color-foreground)">{product.category.name}</dd>
                </div>
                {product.dietaryInfo.length > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-(--color-muted-foreground)">Dietary preference</dt>
                    <dd className="text-right text-(--color-foreground)">
                      {product.dietaryInfo
                        .map((tag) => tag.replace('_', ' ').toLowerCase())
                        .join(', ')}
                    </dd>
                  </div>
                ) : null}
                {product.countryOfOrigin ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-(--color-muted-foreground)">Country of origin</dt>
                    <dd className="text-right text-(--color-foreground)">
                      {product.countryOfOrigin}
                    </dd>
                  </div>
                ) : null}
                {nutritionalEntries.map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <dt className="text-(--color-muted-foreground)">{key}</dt>
                    <dd className="text-right text-(--color-foreground)">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {product.description ? (
              <div className="flex flex-col gap-1 border-t border-(--color-border) pt-4">
                <h2 className="text-sm font-semibold text-(--color-foreground)">Description</h2>
                <p className="text-sm text-(--color-muted-foreground)">{product.description}</p>
              </div>
            ) : null}

            {product.ingredients ? (
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold text-(--color-foreground)">Ingredients</h2>
                <p className="text-sm text-(--color-muted-foreground)">{product.ingredients}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ProductRail title="Similar products" products={similarProducts} />
    </main>
  );
}
