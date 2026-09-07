'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { formatRelativeTime } from '@grocery-delivery/utils';
import type { DeliveryPartnerAdminItem } from '@grocery-delivery/types';
import { adminDeliveryPartnersApi } from '@/lib/admin-delivery-partners-api';
import { DataTable } from '@/components/ui/data-table';

const ACCOUNT_STATUS_BADGE_CLASS: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  ACTIVE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  SUSPENDED: 'bg-red-500/15 text-red-700 dark:text-red-400',
  INACTIVE: 'bg-(--color-muted) text-(--color-muted-foreground)',
};

const AVAILABILITY_BADGE_CLASS: Record<string, string> = {
  AVAILABLE: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  BUSY: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  OFFLINE: 'bg-(--color-muted) text-(--color-muted-foreground)',
};

export default function AdminDeliveryPartnersPage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'delivery-partners'],
    queryFn: adminDeliveryPartnersApi.list,
  });

  const columns = useMemo<ColumnDef<DeliveryPartnerAdminItem>[]>(
    () => [
      {
        id: 'name',
        header: 'Name',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-(--color-foreground)">
              {row.original.user?.firstName} {row.original.user?.lastName}
            </span>
            <span className="text-xs text-(--color-muted-foreground)">{row.original.user?.email}</span>
          </div>
        ),
      },
      {
        id: 'phone',
        header: 'Phone',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">{row.original.user?.phone ?? '—'}</span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Account',
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACCOUNT_STATUS_BADGE_CLASS[row.original.status]}`}
          >
            {row.original.status.replace('_', ' ').toLowerCase()}
          </span>
        ),
      },
      {
        accessorKey: 'availabilityStatus',
        header: 'Availability',
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${AVAILABILITY_BADGE_CLASS[row.original.availabilityStatus]}`}
          >
            {row.original.availabilityStatus.toLowerCase()}
          </span>
        ),
      },
      {
        id: 'presence',
        header: 'Since / last seen',
        enableSorting: false,
        cell: ({ row }) => {
          const partner = row.original;
          if (partner.availabilityStatus === 'AVAILABLE' && partner.availableSince) {
            return (
              <span className="text-(--color-muted-foreground)">
                Idle {formatRelativeTime(partner.availableSince)}
              </span>
            );
          }
          if (partner.lastSeenAt) {
            return (
              <span className="text-(--color-muted-foreground)">
                Last seen {formatRelativeTime(partner.lastSeenAt)}
              </span>
            );
          }
          return <span className="text-(--color-muted-foreground)">Never online</span>;
        },
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Delivery Partners</h1>

      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage="No delivery partners found."
      />
    </div>
  );
}
