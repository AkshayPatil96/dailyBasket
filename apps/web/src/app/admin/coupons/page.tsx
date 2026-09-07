'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@grocery-delivery/utils';
import type { Coupon, CouponDiscountType } from '@grocery-delivery/types';
import { adminCouponsApi, type CouponInput } from '@/lib/admin-coupons-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { SelectField } from '@/components/ui/select-field';
import { SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const DISCOUNT_TYPES: CouponDiscountType[] = ['FLAT', 'PERCENTAGE'];

function formatDiscount(coupon: Coupon): string {
  const base =
    coupon.discountType === 'FLAT'
      ? formatCurrency(Number(coupon.discountValue))
      : `${Number(coupon.discountValue)}%`;
  return coupon.discountType === 'PERCENTAGE' && coupon.maxDiscountAmount
    ? `${base} (max ${formatCurrency(Number(coupon.maxDiscountAmount))})`
    : base;
}

export default function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'active' | 'inactive'>('');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [dialogState, setDialogState] = useState<{ open: boolean; editing?: Coupon }>({
    open: false,
  });

  const { data, isLoading } = useQuery({
    queryKey: [
      'admin',
      'coupons',
      { search, statusFilter, pageIndex: pagination.pageIndex, pageSize: pagination.pageSize },
    ],
    queryFn: () =>
      adminCouponsApi.list({
        search: search || undefined,
        isActive: statusFilter === '' ? undefined : statusFilter === 'active',
        offset: pagination.pageIndex * pagination.pageSize,
        limit: pagination.pageSize,
      }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });

  const createMutation = useMutation({
    mutationFn: (input: CouponInput) => adminCouponsApi.create(input),
    onSuccess: () => {
      invalidate();
      setDialogState({ open: false });
      toast.success('Coupon created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not create coupon.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CouponInput> }) =>
      adminCouponsApi.update(id, input),
    onSuccess: () => {
      invalidate();
      setDialogState({ open: false });
      toast.success('Coupon updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update coupon.')),
  });

  const columns = useMemo<ColumnDef<Coupon>[]>(
    () => [
      {
        accessorKey: 'code',
        header: 'Code',
        enableSorting: false,
        cell: ({ row }) => (
          <button
            type="button"
            onClick={() => setDialogState({ open: true, editing: row.original })}
            className="font-medium text-(--color-foreground) hover:text-(--color-primary)"
          >
            {row.original.code}
          </button>
        ),
      },
      {
        id: 'discount',
        header: 'Discount',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">{formatDiscount(row.original)}</span>
        ),
      },
      {
        id: 'minOrder',
        header: 'Min order',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">
            {row.original.minOrderValue ? formatCurrency(Number(row.original.minOrderValue)) : '—'}
          </span>
        ),
      },
      {
        id: 'usage',
        header: 'Usage',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">
            {row.original.usedCount} / {row.original.usageLimit ?? '∞'}
          </span>
        ),
      },
      {
        id: 'expiresAt',
        header: 'Expires',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">
            {row.original.expiresAt ? new Date(row.original.expiresAt).toLocaleDateString() : 'Never'}
          </span>
        ),
      },
      {
        accessorKey: 'isActive',
        header: 'Status',
        enableSorting: false,
        cell: ({ row }) => (
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium',
              row.original.isActive
                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                : 'bg-(--color-muted) text-(--color-muted-foreground)',
            )}
          >
            {row.original.isActive ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-right">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDialogState({ open: true, editing: row.original })}
            >
              <Pencil className="size-4" aria-hidden />
              <span className="sr-only">Edit</span>
            </Button>
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Coupons</h1>
        <Button onClick={() => setDialogState({ open: true })}>
          <Plus className="size-4" aria-hidden />
          Add coupon
        </Button>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search by code…"
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
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value as typeof statusFilter);
            setPagination((p) => ({ ...p, pageIndex: 0 }));
          }}
        >
          <SelectItem value="">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
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
        emptyMessage="No coupons found."
      />

      <Dialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogState.editing ? 'Edit coupon' : 'Add a new coupon'}</DialogTitle>
          </DialogHeader>
          <CouponForm
            key={dialogState.editing?.id ?? 'new'}
            initialValues={dialogState.editing}
            submitting={createMutation.isPending || updateMutation.isPending}
            onSubmit={(input) => {
              if (dialogState.editing) {
                updateMutation.mutate({ id: dialogState.editing.id, input });
              } else {
                createMutation.mutate(input);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CouponForm({
  initialValues,
  onSubmit,
  submitting,
}: {
  initialValues?: Coupon;
  onSubmit: (input: CouponInput) => void;
  submitting?: boolean;
}) {
  const [discountType, setDiscountType] = useState<CouponDiscountType>(
    initialValues?.discountType ?? 'FLAT',
  );
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(initialValues?.isFeatured ?? false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{
    code: string;
    description: string;
    discountValue: string;
    maxDiscountAmount: string;
    minOrderValue: string;
    usageLimit: string;
    usageLimitPerUser: string;
    expiresAt: string;
  }>({
    defaultValues: {
      code: initialValues?.code ?? '',
      description: initialValues?.description ?? '',
      discountValue: initialValues?.discountValue ?? '',
      maxDiscountAmount: initialValues?.maxDiscountAmount ?? '',
      minOrderValue: initialValues?.minOrderValue ?? '',
      usageLimit: initialValues?.usageLimit ? String(initialValues.usageLimit) : '',
      usageLimitPerUser: initialValues?.usageLimitPerUser ? String(initialValues.usageLimitPerUser) : '',
      expiresAt: initialValues?.expiresAt ? initialValues.expiresAt.slice(0, 10) : '',
    },
  });

  const submit = handleSubmit((values) => {
    onSubmit({
      ...(initialValues ? {} : { code: values.code }),
      description: values.description || undefined,
      discountType,
      discountValue: Number(values.discountValue),
      maxDiscountAmount: values.maxDiscountAmount ? Number(values.maxDiscountAmount) : undefined,
      minOrderValue: values.minOrderValue ? Number(values.minOrderValue) : undefined,
      usageLimit: values.usageLimit ? Number(values.usageLimit) : undefined,
      usageLimitPerUser: values.usageLimitPerUser ? Number(values.usageLimitPerUser) : undefined,
      expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      isActive,
      isFeatured,
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <FormField
        label="Code"
        placeholder="SAVE100"
        disabled={Boolean(initialValues)}
        error={errors.code?.message}
        required={!initialValues}
        {...register('code', { required: initialValues ? false : 'code is required' })}
      />
      <FormField label="Description (optional)" placeholder="Flat ₹100 off" {...register('description')} />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-(--color-foreground)">Discount type</span>
        <div className="flex gap-2">
          {DISCOUNT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setDiscountType(type)}
              className={cn(
                'cursor-pointer rounded-(--radius-inner) border px-4 py-2 text-sm font-medium capitalize transition-colors',
                discountType === type
                  ? 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)'
                  : 'border-(--color-border) text-(--color-foreground) hover:border-(--color-primary)',
              )}
            >
              {type === 'FLAT' ? 'Flat amount' : 'Percentage'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={discountType === 'FLAT' ? 'Discount amount (₹)' : 'Discount (%)'}
          type="number"
          step="0.01"
          error={errors.discountValue?.message}
          required
          {...register('discountValue', { required: 'discountValue is required' })}
        />
        {discountType === 'PERCENTAGE' ? (
          <FormField
            label="Max discount (₹, optional)"
            type="number"
            step="0.01"
            {...register('maxDiscountAmount')}
          />
        ) : (
          <FormField label="Min order value (₹, optional)" type="number" step="0.01" {...register('minOrderValue')} />
        )}
      </div>
      {discountType === 'PERCENTAGE' ? (
        <FormField label="Min order value (₹, optional)" type="number" step="0.01" {...register('minOrderValue')} />
      ) : null}

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Total usage limit (optional)" type="number" {...register('usageLimit')} />
        <FormField label="Per-customer limit (optional)" type="number" {...register('usageLimitPerUser')} />
      </div>

      <FormField label="Expires on (optional)" type="date" {...register('expiresAt')} />

      <label className="flex items-center gap-2 text-sm text-(--color-foreground)">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="size-4 rounded border-(--color-border)"
        />
        Active
      </label>

      <label className="flex items-center gap-2 text-sm text-(--color-foreground)">
        <input
          type="checkbox"
          checked={isFeatured}
          onChange={(e) => setIsFeatured(e.target.checked)}
          className="size-4 rounded border-(--color-border)"
        />
        Featured (shown first in the cart's coupon popover)
      </label>

      <Button type="submit" loading={submitting} className="w-full">
        {initialValues ? 'Save changes' : 'Create coupon'}
      </Button>
    </form>
  );
}
