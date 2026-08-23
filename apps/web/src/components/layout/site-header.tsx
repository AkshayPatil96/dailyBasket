"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Loader2 } from "lucide-react";
import { useCurrentUser, useLogout } from "@/hooks/use-current-user";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const HIDDEN_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
];

export function SiteHeader() {
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated } = useCurrentUser();
  const logoutMutation = useLogout();

  if (HIDDEN_PREFIXES.some((prefix) => pathname?.startsWith(prefix))) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-(--color-border) bg-(--color-background)/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-(--color-primary)/15">
            <Leaf className="size-4 text-(--color-primary)" aria-hidden />
          </span>
          <span className="font-display text-base font-semibold text-(--color-foreground)">
            DailyBasket
          </span>
        </Link>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <Loader2
              className="size-4 animate-spin text-(--color-muted-foreground)"
              aria-hidden
            />
          ) : isAuthenticated && user ? (
            <>
              <span className="text-sm text-(--color-muted-foreground)">
                Hi, {user.firstName}
              </span>
              <Button
                variant="ghost"
                size="sm"
                loading={logoutMutation.isPending}
                onClick={() => logoutMutation.mutate()}
              >
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-(--color-foreground) hover:text-(--color-primary)"
              >
                Sign in
              </Link>
              <Link
                href="/register"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
