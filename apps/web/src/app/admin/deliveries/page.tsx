'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { formatCurrency, formatRelativeTime } from '@grocery-delivery/utils';
import type { AdminDeliveryAssignmentListItem, AdminDeliveryAssignmentStatus } from '@grocery-delivery/types';
import { adminDeliveriesApi } from '@/lib/admin-deliveries-api';
import {
  ADMIN_ASSIGNMENT_STATUS_BADGE_CLASS,
  ADMIN_ASSIGNMENT_STATUS_LABEL,
  DELIVERY_FAILURE_REASON_LABEL,
  DELIVERY_REJECTION_REASON_LABEL,
} from '@/lib/delivery-status';
import { DataTable } from '@/components/ui/data-table';
import { SelectField } from '@/components/ui/select-field';
import { SelectItem } from '@/components/ui/select';

const STATUS_OPTIONS: AdminDeliveryAssignmentStatus[] = [
  'ASSIGNED',
  'ACCEPTED',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'REJECTED',
  'EXPIRED',
  'FAILED',
  'REASSIGNED',
];

// One row per assignment attempt (not per order/delivery) — a
// rejected-then-retried-and-delivered order shows up as two separate rows
// here, same as the partner's own /delivery/history. See
// dailybasket-delivery-partner-operations.md for why.
export default function AdminDeliveriesPage() {
  const [status, setStatus] = useState<AdminDeliveryAssignmentStatus | ''>('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'deliveries', 'list', status],
    queryFn: () => adminDeliveriesApi.list(status || undefined),
  });

  const columns = useMemo<ColumnDef<AdminDeliveryAssignmentListItem>[]>(
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
        id: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => {
          const { displayStatus, rejectionReason, rejectionNote, failureReason } = row.original;
          const reason =
            displayStatus === 'REJECTED' && rejectionReason
              ? rejectionReason === 'OTHER' && rejectionNote
                ? rejectionNote
                : DELIVERY_REJECTION_REASON_LABEL[rejectionReason]
              : displayStatus === 'FAILED' && failureReason
                ? DELIVERY_FAILURE_REASON_LABEL[failureReason]
                : null;
          return (
            <div className="flex flex-col gap-0.5">
              <span
                className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${ADMIN_ASSIGNMENT_STATUS_BADGE_CLASS[displayStatus]}`}
              >
                {ADMIN_ASSIGNMENT_STATUS_LABEL[displayStatus]}
              </span>
              {reason ? <span className="text-xs text-(--color-muted-foreground)">{reason}</span> : null}
            </div>
          );
        },
      },
      {
        id: 'partner',
        header: 'Partner',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">
            {row.original.deliveryPartner.user.firstName} {row.original.deliveryPartner.user.lastName}
          </span>
        ),
      },
      {
        id: 'assigned',
        header: 'Assigned',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">{formatRelativeTime(row.original.assignedAt)}</span>
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
        // Deliveries is a read-only audit trail — assign/retry/cancel all
        // live on the order page instead (see admin/orders/[id]/order-detail.tsx).
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Link
              href={`/admin/deliveries/${row.original.deliveryId}?assignment=${row.original.id}`}
              className="text-sm font-medium text-(--color-primary) hover:underline"
            >
              View
            </Link>
          </div>
        ),
      },
    ],
    [],
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
            setStatus(value as AdminDeliveryAssignmentStatus | '');
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectItem value="">All statuses</SelectItem>
          {STATUS_OPTIONS.map((option) => (
            <SelectItem key={option} value={option}>
              {ADMIN_ASSIGNMENT_STATUS_LABEL[option]}
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
