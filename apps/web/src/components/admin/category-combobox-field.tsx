'use client';

import { useId, useMemo } from 'react';
import { FolderTree } from 'lucide-react';
import type { Category } from '@grocery-delivery/types';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { cn } from '@/lib/utils';

interface CategoryOption {
  id: string;
  name: string;
  parentName?: string;
}

// Deliberately not '' — Base UI's Combobox appears to treat an empty-string
// item id as its own internal "no selection" sentinel, so selecting the
// none-option (id '') never actually committed as a new value (selecting
// any real category worked fine; only clearing back to none silently
// reverted to the previously selected item). A non-empty sentinel sidesteps
// whatever internal collision that was. Translated back to `undefined` at
// the onValueChange boundary — callers never see this string.
const NONE_OPTION_ID = '__none__';

export interface CategoryComboboxFieldProps {
  label?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
  categories: Category[];
  /** Selected category id — empty string / undefined means "none". */
  value?: string;
  onValueChange: (id: string | undefined) => void;
  /** Excludes this category (and its own id) from the options — e.g. hide self when picking a parent. */
  excludeId?: string;
  /** Adds a "None (top-level)" option that clears the field. */
  allowClear?: boolean;
  clearLabel?: string;
}

export function CategoryComboboxField({
  label,
  placeholder = 'Search categories…',
  error,
  required,
  categories,
  value,
  onValueChange,
  excludeId,
  allowClear,
  clearLabel = 'None (top-level)',
}: CategoryComboboxFieldProps) {
  const generatedId = useId();

  const options = useMemo<CategoryOption[]>(() => {
    const byId = new Map(categories.map((c) => [c.id, c]));
    const items = categories
      .filter((c) => c.id !== excludeId)
      .map((c) => ({
        id: c.id,
        name: c.name,
        parentName: c.parentId ? byId.get(c.parentId)?.name : undefined,
      }));
    return allowClear ? [{ id: NONE_OPTION_ID, name: clearLabel }, ...items] : items;
  }, [categories, excludeId, allowClear, clearLabel]);

  const selected = useMemo(
    () => options.find((o) => o.id === (value || NONE_OPTION_ID)) ?? null,
    [options, value],
  );

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label
          htmlFor={generatedId}
          className="text-sm font-medium text-(--color-foreground)"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      ) : null}
      <Combobox<CategoryOption>
        items={options}
        value={selected}
        itemToStringLabel={(option) => option.name}
        isItemEqualToValue={(a, b) => a.id === b.id}
        // Base UI's default filter only matches the `{ value, label }` item shape —
        // our options are `{ id, name, parentName }`, so the built-in filter never
        // matches anything and silently shows every item unfiltered. Filter by name
        // (and parent, so "biscuits" still surfaces "Rusk in Biscuits") explicitly.
        filter={(option, query) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return (
            option.name.toLowerCase().includes(q) ||
            Boolean(option.parentName?.toLowerCase().includes(q))
          );
        }}
        onValueChange={(option) =>
          onValueChange(option && option.id !== NONE_OPTION_ID ? option.id : undefined)
        }
      >
        <ComboboxInput
          id={generatedId}
          placeholder={placeholder}
          className={cn(
            'h-10 w-full',
            error && 'border-red-500 focus-within:border-red-500 focus-within:ring-red-500/30',
          )}
        />
        <ComboboxContent>
          <ComboboxEmpty>No matching categories</ComboboxEmpty>
          {/* Function child — Base UI only applies `items`/`filter` to items rendered
              this way; a plain `.map()` here would render every option unfiltered. */}
          <ComboboxList>
            {(option: CategoryOption) => (
              <ComboboxItem key={option.id} value={option}>
                {option.id === NONE_OPTION_ID ? null : (
                  <FolderTree
                    className="size-3.5 shrink-0 text-(--color-muted-foreground)"
                    aria-hidden
                  />
                )}
                <div className="flex flex-col overflow-hidden">
                  <span className="truncate">{option.name}</span>
                  {option.parentName ? (
                    <span className="truncate text-xs text-(--color-muted-foreground)">
                      in {option.parentName}
                    </span>
                  ) : null}
                </div>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {error ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
