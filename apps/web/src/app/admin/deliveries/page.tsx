'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { formatCurrency, formatRelativeTime } from '@grocery-delivery/utils';
import type { DeliveryListItem, DeliveryStatus } from '@grocery-delivery/types';
import { adminDeliveriesApi } from '@/lib/admin-deliveries-api';
import { DELIVERY_STATUS_BADGE_CLASS, DELIVERY_STATUS_LABEL, RETRYABLE_DELIVERY_STATUSES } from '@/lib/delivery-status';
import { AssignPartnerPicker } from '@/components/admin/assign-partner-picker';
import { buttonVariants } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { SelectField } from '@/components/ui/select-field';
import { SelectItem } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const STATUS_OPTIONS: DeliveryStatus[] = [
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'FAILED',
  'CANCELLED',
];

export default function AdminDeliveriesPage() {
  const [status, setStatus] = useState<DeliveryStatus | ''>('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [openPickerFor, setOpenPickerFor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'deliveries', 'list', status],
    queryFn: () => adminDeliveriesApi.list(status || undefined),
  });

  const columns = useMemo<ColumnDef<DeliveryListItem>[]>(
    () => [
      {
        id: 'order',
        header: 'Order',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/admin/orders/${row.original.order.id}`}
            className="font-medium text-(--color-foreground) hover:text-(--color-primary)"
          >
            #{row.original.order.orderNumber}
          </Link>
        ),
      },
      {
        id: 'customer',
        header: 'Customer',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">
            {row.original.order.recipientName} · {row.original.order.city}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${DELIVERY_STATUS_BADGE_CLASS[row.original.status]}`}
          >
            {DELIVERY_STATUS_LABEL[row.original.status]}
          </span>
        ),
      },
      {
        id: 'partner',
        header: 'Partner',
        enableSorting: false,
        cell: ({ row }) => {
          const partner = row.original.deliveryPartner;
          return (
            <span className="text-(--color-muted-foreground)">
              {partner?.user ? `${partner.user.firstName} ${partner.user.lastName}` : '—'}
            </span>
          );
        },
      },
      {
        id: 'placed',
        header: 'Placed',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">
            {formatRelativeTime(row.original.order.createdAt)}
          </span>
        ),
      },
      {
        id: 'total',
        header: 'Total',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-foreground)">{formatCurrency(Number(row.original.order.total))}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const delivery = row.original;
          const canAssign = delivery.status === 'PENDING_ASSIGNMENT';
          const canRetry = RETRYABLE_DELIVERY_STATUSES.includes(delivery.status);

          if (canAssign || canRetry) {
            return (
              <div className="flex justify-end">
                <Popover
                  open={openPickerFor === delivery.id}
                  onOpenChange={(open) => setOpenPickerFor(open ? delivery.id : null)}
                >
                  <PopoverTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                    {canRetry ? 'Retry' : 'Assign'}
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold text-(--color-foreground)">
                        Available partners
                      </span>
                      <AssignPartnerPicker deliveryId={delivery.id} onAssigned={() => setOpenPickerFor(null)} />
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            );
          }

          return (
            <div className="flex justify-end">
              <Link
                href={`/admin/deliveries/${delivery.id}`}
                className="text-sm font-medium text-(--color-primary) hover:underline"
              >
                View
              </Link>
            </div>
          );
        },
      },
    ],
    [openPickerFor],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Deliveries</h1>

      <div className="flex gap-3">
        <SelectField
          className="max-w-56"
          placeholder="All statuses"
          value={status}
          onValueChange={(value) => {
            setStatus(value as DeliveryStatus | '');
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectItem value="">All statuses</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {DELIVERY_STATUS_LABEL[option]}
            </SelectItem>
          ))}
        </SelectField>
      </div>

      <DataTable
        columns={columns}
        data={data ?? []}
        isLoading={isLoading}
        sorting={sorting}
        onSortingChange={setSorting}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage="No deliveries found."
      />
    </div>
  );
}
