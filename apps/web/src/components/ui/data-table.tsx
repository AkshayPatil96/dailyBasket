'use client';

import {
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SelectField } from '@/components/ui/select-field';
import { SelectItem } from '@/components/ui/select';

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  manualSorting?: boolean;
  manualPagination?: boolean;
  rowCount?: number;
  isLoading?: boolean;
  emptyMessage?: string;
  pageSizeOptions?: number[];
}

export function DataTable<TData>({
  columns,
  data,
  sorting,
  onSortingChange,
  pagination,
  onPaginationChange,
  manualSorting = false,
  manualPagination = false,
  rowCount,
  isLoading = false,
  emptyMessage = 'No results.',
  pageSizeOptions = [10, 20, 50],
}: DataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    state: { sorting, pagination },
    onSortingChange,
    onPaginationChange,
    manualSorting,
    manualPagination,
    rowCount: manualPagination ? rowCount : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const total = manualPagination ? (rowCount ?? 0) : data.length;
  const pageCount = table.getPageCount();
  const firstRow = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const lastRow = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-(--radius-outer) border border-(--color-border)">
        <table className="w-full text-sm">
          <thead className="border-b border-(--color-border) text-left text-(--color-muted-foreground)">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th key={header.id} className="px-4 py-2 font-medium">
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex cursor-pointer items-center gap-1 hover:text-(--color-foreground)"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? (
                            <ChevronUp className="size-3.5" aria-hidden />
                          ) : sorted === 'desc' ? (
                            <ChevronDown className="size-3.5" aria-hidden />
                          ) : (
                            <ChevronsUpDown className="size-3.5 opacity-40" aria-hidden />
                          )}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-(--color-muted-foreground)"
                >
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-6 text-center text-(--color-muted-foreground)"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-(--color-border) last:border-0">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-(--color-muted-foreground)">
          <div className="flex items-center gap-2">
            <span>Rows per page</span>
            <SelectField
              className="h-9 w-20 py-0"
              value={String(pagination.pageSize)}
              onValueChange={(value) =>
                onPaginationChange({ pageIndex: 0, pageSize: Number(value) })
              }
            >
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectField>
          </div>

          <div className="flex items-center gap-4">
            <span>
              {firstRow}-{lastRow} of {total}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.setPageIndex(0)}
              >
                <ChevronsLeft className="size-4" aria-hidden />
                <span className="sr-only">First page</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                <ChevronLeft className="size-4" aria-hidden />
                <span className="sr-only">Previous page</span>
              </Button>
              <span className="px-2 text-(--color-foreground)">
                {pageCount === 0 ? 0 : pagination.pageIndex + 1} / {pageCount || 1}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                <ChevronRight className="size-4" aria-hidden />
                <span className="sr-only">Next page</span>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!table.getCanNextPage()}
                onClick={() => table.setPageIndex(pageCount - 1)}
              >
                <ChevronsRight className="size-4" aria-hidden />
                <span className="sr-only">Last page</span>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
