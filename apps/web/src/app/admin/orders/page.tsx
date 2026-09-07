'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { ArrowRight, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@grocery-delivery/utils';
import type { Order, OrderStatus } from '@grocery-delivery/types';
import { adminOrdersApi } from '@/lib/admin-orders-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { ORDER_STATUS_BADGE_CLASS, ORDER_STATUS_LABEL } from '@/lib/order-status';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select-field';
import { SelectItem } from '@/components/ui/select';

const STATUSES: OrderStatus[] = [
  'CONFIRMED',
  'PROCESSING',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

// Mirrors OrdersService's ALLOWED_TRANSITIONS — the one-click "advance" shortcut
// only ever offers the single, safe next step, never an arbitrary status
// (cancellation needs a reason, so that stays in the detail page only).
// PACKED has no next step here anymore — OUT_FOR_DELIVERY/DELIVERED are now
// reached via delivery-partner assignment, not an admin click.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  CONFIRMED: 'PROCESSING',
  PROCESSING: 'PACKED',
};

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const queryKey = [
    'admin',
    'orders',
    { search, status, pageIndex: pagination.pageIndex, pageSize: pagination.pageSize },
  ];

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      adminOrdersApi.list({
        search: search || undefined,
        status: status || undefined,
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
      }),
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: OrderStatus }) =>
      adminOrdersApi.updateStatus(id, next),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success(`Order marked as ${ORDER_STATUS_LABEL[updated.status].toLowerCase()}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update order status.')),
  });

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        id: 'orderNumber',
        header: 'Order',
        enableSorting: false,
        cell: ({ row }) => (
          <Link
            href={`/admin/orders/${row.original.id}`}
            className="font-medium text-(--color-foreground) hover:text-(--color-primary)"
          >
            {row.original.orderNumber}
          </Link>
        ),
      },
      {
        id: 'recipient',
        header: 'Recipient',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">{row.original.recipientName}</span>
        ),
      },
      {
        id: 'total',
        header: 'Total',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-foreground)">
            {formatCurrency(Number(row.original.total))}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${ORDER_STATUS_BADGE_CLASS[row.original.status]}`}
          >
            {ORDER_STATUS_LABEL[row.original.status]}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Placed',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">
            {new Date(row.original.createdAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const next = NEXT_STATUS[row.original.status];
          const isAdvancing =
            advanceMutation.isPending && advanceMutation.variables?.id === row.original.id;
          return (
            <div className="flex justify-end gap-1">
              {next ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title={`Mark as ${ORDER_STATUS_LABEL[next].toLowerCase()}`}
                  loading={isAdvancing}
                  onClick={() => advanceMutation.mutate({ id: row.original.id, next })}
                >
                  <ArrowRight className="size-4" aria-hidden />
                  <span className="sr-only">Mark as {ORDER_STATUS_LABEL[next].toLowerCase()}</span>
                </Button>
              ) : null}
              <Link
                href={`/admin/orders/${row.original.id}`}
                title="View order"
                className="flex size-8 items-center justify-center rounded-(--radius-inner) text-(--color-muted-foreground) hover:bg-(--color-muted) hover:text-(--color-foreground)"
              >
                <Eye className="size-4" aria-hidden />
                <span className="sr-only">View order</span>
              </Link>
            </div>
          );
        },
      },
    ],
    [advanceMutation],
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Orders</h1>

      <div className="flex gap-3">
        <Input
          placeholder="Search by order number or recipient…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          className="max-w-xs"
        />
        <SelectField
          className="max-w-48"
          placeholder="All statuses"
          value={status}
          onValueChange={(value) => {
            setStatus(value as OrderStatus | '');
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectItem value="">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s.toLowerCase().replaceAll('_', ' ')}
            </SelectItem>
          ))}
        </SelectField>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        sorting={sorting}
        onSortingChange={setSorting}
        manualPagination
        rowCount={data?.total ?? 0}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage="No orders found."
      />
    </div>
  );
}
