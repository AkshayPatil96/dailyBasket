'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, MapPin, Package, User } from 'lucide-react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/account', label: 'Profile', icon: User },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/account/addresses', label: 'Addresses', icon: MapPin },
  { href: '/account/favorites', label: 'Favorites', icon: Heart },
];

// Mobile-first: a horizontal scrollable tab strip below the header on small
// screens (customers open this more on mobile than desktop), a vertical
// sidebar from sm: up — same nav data, two layouts.
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/account' ? pathname === '/account' : pathname?.startsWith(href);

  return (
    <AuthGuard>
      <div className="container flex flex-col gap-6 px-4 py-6 sm:flex-row sm:gap-8 sm:px-6 sm:py-8">
        <nav className="flex gap-1 overflow-x-auto border-b border-(--color-border) pb-2 sm:w-48 sm:shrink-0 sm:flex-col sm:border-b-0 sm:pb-0">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-(--radius-inner) px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'bg-(--color-primary)/10 text-(--color-primary)'
                    : 'text-(--color-muted-foreground) hover:bg-(--color-muted) hover:text-(--color-foreground)',
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </AuthGuard>
  );
}
