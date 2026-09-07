import { homeApi } from '@/lib/home-api';
import { CategoryNav } from '@/components/catalog/category-nav';
import { HeroSection } from '@/components/home/hero-section';
import { CategoryGrid } from '@/components/home/category-grid';
import { ProductRail } from '@/components/home/product-rail';

// No dynamic APIs are used on this route, so Next would otherwise try to
// prerender it — either freezing stale catalog data into the build, or (with
// a revalidate window) making `next build` itself fail whenever the API
// isn't reachable at build time. Always render per-request instead.
export const dynamic = 'force-dynamic';

export default async function CustomerHomePage() {
  const home = await homeApi.get();

  return (
    <main className="flex flex-col">
      {/* <CategoryNav categories={home.categories} /> */}

      <HeroSection />

      <CategoryGrid categories={home.categories} />

      <ProductRail
        title="Popular Products"
        subtitle="Trending across DailyBasket right now"
        products={home.popularProducts}
      />

      <ProductRail
        id="deals"
        title="Deals & Offers"
        subtitle="Limited-time discounts on your everyday essentials"
        products={home.deals}
        highlight
      />

      <ProductRail
        title="Featured Products"
        subtitle="Hand-picked by our team"
        products={home.featuredProducts}
      />
    </main>
  );
}
