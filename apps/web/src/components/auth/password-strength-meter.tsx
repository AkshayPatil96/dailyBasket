import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const CRITERIA = [
  { key: 'length', label: 'At least 8 characters', test: (v: string) => v.length >= 8 },
  { key: 'lowercase', label: 'Lowercase letter', test: (v: string) => /[a-z]/.test(v) },
  { key: 'uppercase', label: 'Uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'number', label: 'Number', test: (v: string) => /[0-9]/.test(v) },
  { key: 'symbol', label: 'Symbol (!?#@...)', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

const STRENGTH_LEVELS = [
  { label: 'Weak', barClass: 'bg-red-500', textClass: 'text-red-600 dark:text-red-400', segments: 1 },
  { label: 'Fair', barClass: 'bg-amber-500', textClass: 'text-amber-600 dark:text-amber-400', segments: 2 },
  { label: 'Good', barClass: 'bg-lime-500', textClass: 'text-lime-600 dark:text-lime-400', segments: 3 },
  { label: 'Strong', barClass: 'bg-[var(--color-primary)]', textClass: 'text-[var(--color-primary)]', segments: 4 },
] as const;

export function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;

  const metCriteria = CRITERIA.map((criterion) => ({
    ...criterion,
    met: criterion.test(password),
  }));
  const score = metCriteria.filter((c) => c.met).length;
  const level = STRENGTH_LEVELS[Math.max(0, Math.min(score - 1, STRENGTH_LEVELS.length - 1))];

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-inner)] border border-[var(--color-border)] bg-[var(--color-muted)]/50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full bg-[var(--color-border)] transition-colors duration-200',
                i < level.segments && level.barClass,
              )}
            />
          ))}
        </div>
        <span className={cn('text-xs font-semibold', level.textClass)}>{level.label}</span>
      </div>

      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {metCriteria.map((criterion) => (
          <li
            key={criterion.key}
            className={cn(
              'flex items-center gap-1.5 text-xs transition-colors duration-200',
              criterion.met ? 'text-[var(--color-foreground)]' : 'text-[var(--color-muted-foreground)]',
            )}
          >
            {criterion.met ? (
              <Check className="size-3.5 shrink-0 text-[var(--color-primary)]" aria-hidden />
            ) : (
              <Minus className="size-3.5 shrink-0" aria-hidden />
            )}
            {criterion.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
