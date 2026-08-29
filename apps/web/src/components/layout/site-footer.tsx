"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Leaf } from "lucide-react";
import { catalogApi } from "@/lib/catalog-api";
import { CUSTOMER_CHROME_HIDDEN_PREFIXES } from "@/lib/layout-constants";

export function SiteFooter() {
  const pathname = usePathname();
  const { data: categories } = useQuery({
    queryKey: ["footer", "categories"],
    queryFn: catalogApi.categoryTree,
    staleTime: 5 * 60 * 1000,
  });

  if (CUSTOMER_CHROME_HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
    return null;
  }

  const topCategories = (categories ?? []).slice(0, 6);

  return (
    <footer className="mt-auto border-t border-(--color-border) bg-(--color-muted)/30">
      <div className="container px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-3">
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-(--color-primary)/15">
                <Leaf className="size-4 text-(--color-primary)" aria-hidden />
              </span>
              <span className="font-display text-lg font-semibold text-(--color-foreground)">
                DailyBasket
              </span>
            </Link>
            <p className="max-w-xs text-sm text-(--color-muted-foreground)">
              Fresh groceries, delivered fast. A portfolio project built end to end —
              Next.js on the frontend, NestJS + Postgres on the backend.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-(--color-foreground)">Shop by category</h3>
            {topCategories.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {topCategories.map((category) => (
                  <li key={category.id}>
                    <Link
                      href={`/category/${category.slug}`}
                      className="text-sm text-(--color-muted-foreground) hover:text-(--color-primary)"
                    >
                      {category.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold text-(--color-foreground)">Account</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/login"
                  className="text-sm text-(--color-muted-foreground) hover:text-(--color-primary)"
                >
                  Sign in
                </Link>
              </li>
              <li>
                <Link
                  href="/register"
                  className="text-sm text-(--color-muted-foreground) hover:text-(--color-primary)"
                >
                  Create account
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-(--color-border) pt-6 text-xs text-(--color-muted-foreground)">
          © {new Date().getFullYear()} DailyBasket — a portfolio project, not a real store.
        </div>
      </div>
    </footer>
  );
}
