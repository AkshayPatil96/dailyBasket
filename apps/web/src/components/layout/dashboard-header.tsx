"use client";

import Link from "next/link";
import { ChevronDown, Home, Leaf, LogOut, MapPin, User } from "lucide-react";
import { useCurrentUser, useLogout } from "@/hooks/use-current-user";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: "Customer",
  DELIVERY_PARTNER: "Delivery partner",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super admin",
};

export function DashboardHeader({ label }: { label: string }) {
  const { user } = useCurrentUser();
  const logoutMutation = useLogout();

  return (
    <header className="sticky top-0 z-40 border-b border-(--color-border) bg-(--color-background)/95 backdrop-blur">
      <div className="container flex items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-3 hover:scale-105 transition-transform duration-300"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-(--color-primary)/15">
            <Leaf
              className="size-4 text-(--color-primary)"
              aria-hidden
            />
          </span>
          <span className="font-display text-base font-semibold text-(--color-foreground)">
            DailyBasket{" "}
            <span className="text-(--color-muted-foreground)">— {label}</span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {user ? (
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
                <DropdownMenuItem render={<Link href="/" />}>
                  <Home aria-hidden />
                  Back to store
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link href="/account/addresses" />}>
                  <MapPin aria-hidden />
                  Addresses
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
                  <LogOut aria-hidden />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </header>
  );
}
