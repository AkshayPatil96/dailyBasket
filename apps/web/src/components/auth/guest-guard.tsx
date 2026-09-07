"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * Inverse of AuthGuard — for pages that only make sense signed-out
 * (login, register, forgot/reset password, verify-email). Redirects to "/"
 * if a session already exists. UX-only, same as AuthGuard.
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useCurrentUser();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  // Deny by default: don't flash the form until we're sure there's no session.
  if (isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2
          className="size-6 animate-spin text-(--color-primary)"
          aria-hidden
        />
      </div>
    );
  }

  return <>{children}</>;
}
