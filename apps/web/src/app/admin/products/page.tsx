'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { Lock, Plus, TriangleAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductDetail, ProductStatus } from '@grocery-delivery/types';
import { adminProductsApi } from '@/lib/admin-catalog-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button, buttonVariants } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { TableAvatar } from '@/components/ui/table-avatar';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select-field';
import { SelectItem } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

const STATUSES: ProductStatus[] = ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'];

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  const sortBy = (sorting[0]?.id as 'name' | 'createdAt' | undefined) ?? 'createdAt';
  const sortOrder = sorting[0]?.desc === false ? 'asc' : 'desc';

  const { data, isLoading } = useQuery({
    queryKey: [
      'admin',
      'products',
      { search, status, sortBy, sortOrder, pageIndex: pagination.pageIndex, pageSize: pagination.pageSize },
    ],
    queryFn: () =>
      adminProductsApi.list({
        search: search || undefined,
        status: status || undefined,
        sortBy,
        sortOrder,
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: adminProductsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'products'] });
      toast.success('Product deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not delete product.')),
  });

  const [deleteTarget, setDeleteTarget] = useState<ProductDetail | null>(null);
  const handleDelete = (product: ProductDetail) => setDeleteTarget(product);
  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const columns = useMemo<ColumnDef<ProductDetail>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => {
          const primaryImage =
            row.original.images.find((image) => image.isPrimary) ?? row.original.images[0];
          return (
            <Link
              href={`/admin/products/${row.original.id}`}
              className="flex items-center gap-3 font-medium text-(--color-foreground) hover:text-(--color-primary)"
            >
              <TableAvatar src={primaryImage?.url} alt={row.original.name} />
              {row.original.name}
              {row.original.isSystem ? (
                <span title="Protected showcase data">
                  <Lock className="size-3.5 shrink-0 text-(--color-muted-foreground)" aria-hidden />
                </span>
              ) : null}
            </Link>
          );
        },
      },
      {
        id: 'category',
        header: 'Category',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">{row.original.category.name}</span>
        ),
      },
      {
        id: 'brand',
        header: 'Brand',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">{row.original.brand ?? '—'}</span>
        ),
      },
      {
        id: 'variants',
        header: 'Variants',
        enableSorting: false,
        cell: ({ row }) => {
          const lowStock = row.original.variants.some(
            (variant) =>
              variant.status === 'ACTIVE' &&
              variant.inventory &&
              variant.inventory.quantity <= variant.inventory.reorderLevel,
          );
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-(--color-muted-foreground)">
                {row.original.variants.length}
              </span>
              {lowStock ? (
                <span title="At or below reorder level">
                  <TriangleAlert
                    className="size-3.5 shrink-0 text-(--color-destructive)"
                    aria-hidden
                  />
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">
            {row.original.status.toLowerCase()}
          </span>
        ),
      },
      {
        accessorKey: 'createdAt',
        header: 'Created',
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
          const deleteLocked = row.original.isSystem && !isSuperAdmin;
          return (
            <div className="text-right">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={deleteLocked}
                title={deleteLocked ? 'Protected showcase product — super admin only' : undefined}
                onClick={() => handleDelete(row.original)}
              >
                <Trash2 className="size-4" aria-hidden />
                <span className="sr-only">Delete</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [isSuperAdmin],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          Products
        </h1>
        <Link href="/admin/products/new" className={cn(buttonVariants(), 'gap-1.5')}>
          <Plus className="size-4" aria-hidden />
          Add product
        </Link>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
          className="max-w-xs"
        />
        <SelectField
          className="max-w-40"
          placeholder="All statuses"
          value={status}
          onValueChange={(value) => {
            setStatus(value as ProductStatus | '');
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectItem value="">All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectField>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        manualSorting
        sorting={sorting}
        onSortingChange={setSorting}
        manualPagination
        rowCount={data?.total ?? 0}
        pagination={pagination}
        onPaginationChange={setPagination}
        emptyMessage="No products found."
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete &quot;{deleteTarget?.name}&quot; and all its variants/images.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
