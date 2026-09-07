"use client";

import { Children, isValidElement, useId, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Select.Value only resolves a selected item's label automatically when Select.Root
// is given an `items` map; with plain declarative <SelectItem> children (our usage
// everywhere) it falls back to showing the raw value. Build the value->label lookup
// from the same children we already render, so every call site stays untouched.
function buildLabelMap(
  children: React.ReactNode,
): Map<string, React.ReactNode> {
  const map = new Map<string, React.ReactNode>();
  Children.forEach(children, (child) => {
    if (isValidElement(child) && child.type === SelectItem) {
      const props = child.props as { value: string; children: React.ReactNode };
      map.set(props.value, props.children);
    }
  });
  return map;
}

export interface SelectFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
}

export function SelectField({
  label,
  error,
  required,
  disabled,
  placeholder,
  className,
  id,
  name,
  value,
  defaultValue,
  onValueChange,
  children,
}: SelectFieldProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const labelMap = useMemo(() => buildLabelMap(children), [children]);

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <label
          htmlFor={selectId}
          className="text-sm font-medium text-(--color-foreground)"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      ) : null}
      <Select
        name={name}
        disabled={disabled}
        value={value}
        defaultValue={defaultValue}
        onValueChange={(nextValue) => onValueChange?.(nextValue as string)}
      >
        <SelectTrigger
          id={selectId}
          aria-invalid={Boolean(error)}
          className={cn(
            "min-w-36",
            error &&
              "border-red-500 focus:border-red-500 focus-visible:ring-red-500/30",
            className,
          )}
        >
          <SelectValue placeholder={placeholder}>
            {(currentValue: string) =>
              labelMap.get(currentValue) ?? placeholder
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectList>{children}</SelectList>
        </SelectContent>
      </Select>
      {error ? (
        <p
          role="alert"
          className="text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
