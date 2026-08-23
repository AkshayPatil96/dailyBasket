"use client";

import { forwardRef, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  helperText?: string;
}

const baseInputStyles =
  "h-12 w-full rounded-[var(--radius-inner)] border border-[var(--color-border)] bg-[var(--color-input)]/30 px-4 text-[15px] text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] transition-colors duration-150 outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]/30 disabled:opacity-50";

export const FormField = forwardRef<HTMLInputElement, FormFieldProps>(
  (
    { label, error, helperText, id, type, className, required, ...props },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";

    return (
      <div className="flex flex-col gap-2">
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-(--color-foreground)"
        >
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={isPassword && showPassword ? "text" : type}
            className={cn(
              baseInputStyles,
              isPassword && "pr-12",
              error &&
                "border-red-500 focus:border-red-500 focus:ring-red-500/30",
              className,
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={
              error ? errorId : helperText ? helperId : undefined
            }
            {...props}
          />
          {isPassword ? (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-0 flex w-12 cursor-pointer items-center justify-center text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] opacity-50"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff
                  className="size-4.5"
                  aria-hidden
                />
              ) : (
                <Eye
                  className="size-4.5"
                  aria-hidden
                />
              )}
            </button>
          ) : null}
        </div>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-red-600 dark:text-red-400"
          >
            {error}
          </p>
        ) : helperText ? (
          <p
            id={helperId}
            className="text-sm text-[var(--color-muted-foreground)]"
          >
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
FormField.displayName = "FormField";
