'use client';

import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@grocery-delivery/validation';
import { authApi, getApiErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';

export default function ForgotPasswordPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const forgotPasswordMutation = useMutation({ mutationFn: authApi.forgotPassword });

  const onSubmit = (values: ForgotPasswordInput) => forgotPasswordMutation.mutate(values);

  if (forgotPasswordMutation.isSuccess) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-foreground)]">
          Check your email
        </h1>
        <p className="text-[15px] text-[var(--color-muted-foreground)]">
          If that email is registered, a password reset link is on its way.
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
          Reset your password
        </h1>
        <p className="text-[15px] text-[var(--color-muted-foreground)]">
          Enter your email and we&apos;ll send you a reset link.
        </p>
      </div>

      {forgotPasswordMutation.isError ? (
        <p
          role="alert"
          className="rounded-[var(--radius-inner)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {getApiErrorMessage(forgotPasswordMutation.error, 'Something went wrong. Try again.')}
        </p>
      ) : null}

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5" noValidate>
        <FormField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" loading={forgotPasswordMutation.isPending} className="w-full">
          Send reset link
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        <Link href="/login" className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
