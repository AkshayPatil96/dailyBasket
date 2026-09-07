import { Leaf } from "lucide-react";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { GuestGuard } from "@/components/auth/guest-guard";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <AuthBrandPanel />

      <div className="relative flex flex-col justify-center px-6 py-10 sm:px-12 lg:px-16">
        <div className="absolute top-0 left-0 z-10 flex items-center justify-between w-full px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/15">
              <Leaf
                className="size-5 text-primary"
                aria-hidden
              />
            </span>
            <span className="font-display text-lg font-semibold">
              DailyBasket
            </span>
          </div>

          <ThemeToggle />
        </div>
        <div className="w-full max-w-md flex flex-col gap-8 animate-fade-slide-up self-center">
          <GuestGuard>{children}</GuestGuard>
        </div>
      </div>
    </div>
  );
}
