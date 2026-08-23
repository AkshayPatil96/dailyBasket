'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { z } from 'zod';
import { authApi, getApiErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { PasswordStrengthMeter } from '@/components/auth/password-strength-meter';

const resetPasswordFormSchema = z.object({
  password: z.string().min(8, 'password must be at least 8 characters'),
});
type ResetPasswordFormInput = z.infer<typeof resetPasswordFormSchema>;

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const token = useSearchParams().get('token');
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ResetPasswordFormInput>({ resolver: zodResolver(resetPasswordFormSchema) });
  const password = useWatch({ control, name: 'password', defaultValue: '' });

  const resetPasswordMutation = useMutation({
    mutationFn: (values: ResetPasswordFormInput) =>
      authApi.resetPassword({ token: token ?? '', password: values.password }),
  });

  const onSubmit = (values: ResetPasswordFormInput) => resetPasswordMutation.mutate(values);

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-foreground)]">
          Invalid reset link
        </h1>
        <p className="text-[15px] text-[var(--color-muted-foreground)]">
          This link is missing its reset token. Request a new one below.
        </p>
        <Link
          href="/forgot-password"
          className="mt-2 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  if (resetPasswordMutation.isSuccess) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-foreground)]">
          Password updated
        </h1>
        <p className="text-[15px] text-[var(--color-muted-foreground)]">
          You&apos;re all set. Sign in with your new password.
        </p>
        <Link
          href="/login"
          className="mt-2 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-foreground)]">
          Set a new password
        </h1>
        <p className="text-[15px] text-[var(--color-muted-foreground)]">
          Choose a strong password you haven&apos;t used before.
        </p>
      </div>

      {resetPasswordMutation.isError ? (
        <p
          role="alert"
          className="rounded-[var(--radius-inner)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {getApiErrorMessage(resetPasswordMutation.error, 'This reset link is invalid or has expired.')}
        </p>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-3">
          <FormField
            label="New password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <Button type="submit" loading={resetPasswordMutation.isPending} className="w-full">
          Update password
        </Button>
      </form>
    </div>
  );
}
