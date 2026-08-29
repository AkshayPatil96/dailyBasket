'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Controller, useForm, useWatch } from 'react-hook-form';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Category, CategoryStatus } from '@grocery-delivery/types';
import { adminCategoriesApi, type CategoryInput } from '@/lib/admin-catalog-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { TableAvatar } from '@/components/ui/table-avatar';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select-field';
import { SelectItem } from '@/components/ui/select';
import { ImageUploadField } from '@/components/admin/image-upload-field';
import { CategoryComboboxField } from '@/components/admin/category-combobox-field';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

const QUERY_KEY = ['admin', 'categories'];

interface CategoryTreeRow extends Category {
  children: CategoryTreeRow[];
}

function buildTree(categories: Category[]): CategoryTreeRow[] {
  const byId = new Map<string, CategoryTreeRow>(
    categories.map((c) => [c.id, { ...c, children: [] }]),
  );
  const roots: CategoryTreeRow[] = [];
  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: CategoryTreeRow[]) => {
    nodes.sort((a, b) => a.sortOrder - b.sortOrder);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function collectParentIds(nodes: CategoryTreeRow[], out: string[] = []): string[] {
  for (const node of nodes) {
    if (node.children.length > 0) {
      out.push(node.id);
      collectParentIds(node.children, out);
    }
  }
  return out;
}

function flattenVisible(
  nodes: CategoryTreeRow[],
  depth: number,
  collapsed: Set<string>,
  out: Array<{ node: CategoryTreeRow; depth: number }>,
) {
  for (const node of nodes) {
    out.push({ node, depth });
    if (node.children.length > 0 && !collapsed.has(node.id)) {
      flattenVisible(node.children, depth + 1, collapsed, out);
    }
  }
}

export default function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const [dialogState, setDialogState] = useState<{ open: boolean; editing?: Category }>({
    open: false,
  });
  const [view, setView] = useState<'flat' | 'tree'>('flat');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CategoryStatus | ''>('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'sortOrder', desc: false }]);
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: categories, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: adminCategoriesApi.listAll,
  });

  const filtered = useMemo(() => {
    let list = categories ?? [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (statusFilter) {
      list = list.filter((c) => c.status === statusFilter);
    }
    return list;
  }, [categories, search, statusFilter]);

  const tree = useMemo(() => buildTree(categories ?? []), [categories]);

  const visibleRows = useMemo(() => {
    const out: Array<{ node: CategoryTreeRow; depth: number }> = [];
    flattenVisible(tree, 0, collapsed, out);
    return out;
  }, [tree, collapsed]);

  const toggleNode = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: adminCategoriesApi.create,
    onSuccess: () => {
      invalidate();
      setDialogState({ open: false });
      toast.success('Category created');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not create category.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<CategoryInput> }) =>
      adminCategoriesApi.update(id, input),
    onSuccess: () => {
      invalidate();
      setDialogState({ open: false });
      toast.success('Category updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update category.')),
  });

  const deleteMutation = useMutation({
    mutationFn: adminCategoriesApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success('Category deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not delete category.')),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const handleDelete = (category: Category) => setDeleteTarget(category);
  const confirmDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteTarget(null);
    }
  };

  const columns = useMemo<ColumnDef<Category>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <TableAvatar src={row.original.imageUrl} alt={row.original.name} />
            <span className="text-(--color-foreground)">{row.original.name}</span>
            {row.original.isSystem ? (
              <span title="Protected showcase data">
                <Lock className="size-3.5 shrink-0 text-(--color-muted-foreground)" aria-hidden />
              </span>
            ) : null}
          </div>
        ),
      },
      {
        id: 'parent',
        header: 'Parent',
        enableSorting: false,
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">
            {categories?.find((c) => c.id === row.original.parentId)?.name ?? '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span
            className={
              row.original.status === 'ACTIVE'
                ? 'text-(--color-primary)'
                : 'text-(--color-muted-foreground)'
            }
          >
            {row.original.status.toLowerCase()}
          </span>
        ),
      },
      {
        accessorKey: 'sortOrder',
        header: 'Sort',
        cell: ({ row }) => (
          <span className="text-(--color-muted-foreground)">{row.original.sortOrder}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        enableSorting: false,
        cell: ({ row }) => {
          const editLocked = row.original.isSystem && !isSuperAdmin;
          return (
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={editLocked}
                title={editLocked ? 'Protected showcase category — super admin only' : undefined}
                onClick={() => setDialogState({ open: true, editing: row.original })}
              >
                <Pencil className="size-4" aria-hidden />
                <span className="sr-only">Edit</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={editLocked}
                title={editLocked ? 'Protected showcase category — super admin only' : undefined}
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
    [categories, isSuperAdmin],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          Categories
        </h1>
        <Button onClick={() => setDialogState({ open: true })}>
          <Plus className="size-4" aria-hidden />
          Add category
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          {(['flat', 'tree'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                'cursor-pointer rounded-(--radius-inner) border px-4 py-2 text-sm font-medium capitalize transition-colors',
                view === v
                  ? 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)'
                  : 'border-(--color-border) text-(--color-foreground) hover:border-(--color-primary)',
              )}
            >
              {v === 'flat' ? 'Flat' : 'Tree'}
            </button>
          ))}
        </div>

        {view === 'flat' ? (
          <div className="flex flex-wrap gap-3">
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
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value as CategoryStatus | '');
                setPagination((p) => ({ ...p, pageIndex: 0 }));
              }}
            >
              <SelectItem value="">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectField>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-(--color-muted-foreground)">
              Full hierarchy, ordered by sort order — filters apply to the flat view only.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}>
              Expand all
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(new Set(collectParentIds(tree)))}
            >
              Collapse all
            </Button>
          </div>
        )}
      </div>

      {view === 'flat' ? (
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          sorting={sorting}
          onSortingChange={setSorting}
          pagination={pagination}
          onPaginationChange={setPagination}
          emptyMessage={
            categories && categories.length > 0
              ? 'No categories match your filters.'
              : 'No categories yet.'
          }
        />
      ) : isLoading ? (
        <p className="text-(--color-muted-foreground)">Loading…</p>
      ) : !categories || categories.length === 0 ? (
        <p className="text-(--color-muted-foreground)">No categories yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-(--radius-outer) border border-(--color-border)">
          <table className="w-full text-sm">
            <thead className="border-b border-(--color-border) text-left text-(--color-muted-foreground)">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Sort</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.map(({ node, depth }) => {
                const hasChildren = node.children.length > 0;
                const isCollapsed = collapsed.has(node.id);
                return (
                  <tr key={node.id} className="border-b border-(--color-border) last:border-0">
                    <td className="px-4 py-2">
                      <div
                        className="flex items-center gap-1.5"
                        style={{ paddingLeft: `${depth * 1.5}rem` }}
                      >
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleNode(node.id)}
                            className="flex size-5 shrink-0 cursor-pointer items-center justify-center text-(--color-muted-foreground) hover:text-(--color-foreground)"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="size-4" aria-hidden />
                            ) : (
                              <ChevronDown className="size-4" aria-hidden />
                            )}
                            <span className="sr-only">
                              {isCollapsed ? 'Expand' : 'Collapse'} {node.name}
                            </span>
                          </button>
                        ) : (
                          <span className="size-5 shrink-0" />
                        )}
                        {hasChildren ? (
                          isCollapsed ? (
                            <Folder
                              className="size-4 shrink-0 text-(--color-muted-foreground)"
                              aria-hidden
                            />
                          ) : (
                            <FolderOpen
                              className="size-4 shrink-0 text-(--color-muted-foreground)"
                              aria-hidden
                            />
                          )
                        ) : (
                          <span className="size-4 shrink-0" />
                        )}
                        <TableAvatar src={node.imageUrl} alt={node.name} />
                        <span className="text-(--color-foreground)">{node.name}</span>
                        {node.isSystem ? (
                          <span title="Protected showcase data">
                            <Lock className="size-3.5 shrink-0 text-(--color-muted-foreground)" aria-hidden />
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={cn(
                          node.status === 'ACTIVE'
                            ? 'text-(--color-primary)'
                            : 'text-(--color-muted-foreground)',
                        )}
                      >
                        {node.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-(--color-muted-foreground)">{node.sortOrder}</td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={node.isSystem && !isSuperAdmin}
                          title={
                            node.isSystem && !isSuperAdmin
                              ? 'Protected showcase category — super admin only'
                              : undefined
                          }
                          onClick={() => setDialogState({ open: true, editing: node })}
                        >
                          <Pencil className="size-4" aria-hidden />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={node.isSystem && !isSuperAdmin}
                          title={
                            node.isSystem && !isSuperAdmin
                              ? 'Protected showcase category — super admin only'
                              : undefined
                          }
                          onClick={() => handleDelete(node)}
                        >
                          <Trash2 className="size-4" aria-hidden />
                          <span className="sr-only">Delete</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogState.editing ? 'Edit category' : 'Add a category'}</DialogTitle>
          </DialogHeader>
          <CategoryForm
            categories={categories ?? []}
            initialValues={dialogState.editing}
            submitting={isSubmitting}
            onSubmit={(input) => {
              if (dialogState.editing) {
                updateMutation.mutate({ id: dialogState.editing.id, input });
              } else {
                createMutation.mutate(input as CategoryInput);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently delete &quot;{deleteTarget?.name}&quot; and everything under it
              (subcategories, products). This cannot be undone.
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

function CategoryForm({
  categories,
  initialValues,
  onSubmit,
  submitting,
}: {
  categories: Category[];
  initialValues?: Category;
  onSubmit: (input: CategoryInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<CategoryInput>({
    defaultValues: initialValues
      ? {
          name: initialValues.name,
          parentId: initialValues.parentId ?? undefined,
          description: initialValues.description ?? undefined,
          imageUrl: initialValues.imageUrl ?? undefined,
          sortOrder: initialValues.sortOrder,
          status: initialValues.status,
        }
      : { sortOrder: 0 },
  });
  const imageUrl = useWatch({ control, name: 'imageUrl' });

  const submit = (values: CategoryInput) => {
    onSubmit({ ...values, parentId: values.parentId || undefined });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-4" noValidate>
      <FormField
        label="Name"
        error={errors.name?.message}
        required
        {...register('name', { required: 'name is required' })}
      />
      <Controller
        control={control}
        name="parentId"
        render={({ field }) => (
          <CategoryComboboxField
            label="Parent category"
            categories={categories}
            excludeId={initialValues?.id}
            allowClear
            value={field.value}
            onValueChange={field.onChange}
          />
        )}
      />
      <ImageUploadField
        label="Category image (optional)"
        folder="categories"
        value={imageUrl}
        onChange={(url) => setValue('imageUrl', url)}
      />
      <FormField
        label="Sort order"
        type="number"
        {...register('sortOrder', { valueAsNumber: true })}
      />
      {initialValues ? (
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SelectField label="Status" value={field.value} onValueChange={field.onChange}>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectField>
          )}
        />
      ) : null}
      <Button type="submit" loading={submitting} className="w-full">
        {initialValues ? 'Save changes' : 'Create category'}
      </Button>
    </form>
  );
}
