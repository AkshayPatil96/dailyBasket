'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DeliveryGuard } from '@/components/auth/delivery-guard';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/delivery', label: 'Dashboard' },
  { href: '/delivery/history', label: 'History' },
];

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <DeliveryGuard>
      <DashboardHeader label="Delivery" />
      <div className="container flex gap-8 px-4 py-8 sm:px-6">
        <nav className="flex w-44 shrink-0 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/delivery' ? pathname === '/delivery' : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-(--radius-inner) px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-(--color-primary)/10 text-(--color-primary)'
                    : 'text-(--color-muted-foreground) hover:bg-(--color-muted) hover:text-(--color-foreground)',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </DeliveryGuard>
  );
}
