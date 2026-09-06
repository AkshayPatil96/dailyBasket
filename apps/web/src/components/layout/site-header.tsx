"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Leaf,
  Loader2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Heart,
  Package,
  ShoppingCart,
  User,
  ChevronDown,
} from "lucide-react";
import { useCurrentUser, useLogout } from "@/hooks/use-current-user";
import { useCart } from "@/hooks/use-cart";
import { buttonVariants } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { CUSTOMER_CHROME_HIDDEN_PREFIXES } from "@/lib/layout-constants";

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  DELIVERY_PARTNER: "Delivery partner",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

export function SiteHeader() {
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const logoutMutation = useLogout();
  const { itemCount } = useCart();

  if (
    CUSTOMER_CHROME_HIDDEN_PREFIXES.some((prefix) =>
      pathname?.startsWith(prefix),
    )
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 min-h-(--header-height) border-b border-border bg-background/95 backdrop-blur">
      <div className="container flex h-(--header-height) items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15">
            <Leaf
              className="size-4 text-primary"
              aria-hidden
            />
          </span>
          <span className="font-display text-lg font-semibold text-foreground">
            DailyBasket
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/cart"
            className="relative flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <ShoppingCart className="size-5" aria-hidden />
            {itemCount > 0 ? (
              <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {itemCount > 9 ? "9+" : itemCount}
              </span>
            ) : null}
            <span className="sr-only">Cart</span>
          </Link>
          {isLoading ? (
            <Loader2
              className="size-4 animate-spin text-muted-foreground"
              aria-hidden
            />
          ) : isAuthenticated && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <User
                        className="size-5"
                        aria-hidden
                      />
                    </span>
                    <div className="flex flex-col items-start">
                      <span className="">Hi, {user.firstName}</span>
                      {user.role !== "CUSTOMER" ? (
                        <span className="text-xs font-xs text-primary">
                          {ROLE_LABELS[user.role] ?? user.role}
                        </span>
                      ) : null}
                    </div>
                    <span className="flex size-4 items-center justify-center text-muted-foreground">
                      <ChevronDown aria-hidden />
                    </span>
                  </button>
                }
              />
              <DropdownMenuContent>
                {user.role === "ADMIN" || user.role === "SUPER_ADMIN" ? (
                  <DropdownMenuItem render={<Link href="/admin" />}>
                    <LayoutDashboard aria-hidden />
                    Admin dashboard
                  </DropdownMenuItem>
                ) : null}
                {user.role === "DELIVERY_PARTNER" ? (
                  <DropdownMenuItem render={<Link href="/delivery" />}>
                    <LayoutDashboard aria-hidden />
                    Delivery dashboard
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem render={<Link href="/account" />}>
                  <User aria-hidden />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/orders" />}>
                  <Package aria-hidden />
                  My orders
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/account/addresses" />}>
                  <MapPin aria-hidden />
                  Addresses
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/account/wishlist" />}>
                  <Heart aria-hidden />
                  Wishlist
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                  <LogOut aria-hidden />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg" }))}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
