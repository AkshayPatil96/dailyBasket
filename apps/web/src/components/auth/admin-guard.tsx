'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCurrentUser } from '@/hooks/use-current-user';

/**
 * UX-only gate — the actual authorization boundary is server-side (every
 * admin endpoint checks role itself); this just avoids flashing admin UI
 * to non-admins.
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isLoading, isAuthenticated, user } = useCurrentUser();
  const isAdmin =
    isAuthenticated && (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN');

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      router.replace('/login');
    }
  }, [isLoading, isAdmin, router]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--color-primary)" aria-hidden />
      </div>
    );
  }

  return <>{children}</>;
}
