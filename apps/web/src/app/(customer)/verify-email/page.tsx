'use client';

import { Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import {
  resendVerificationSchema,
  type ResendVerificationInput,
} from '@grocery-delivery/validation';
import { authApi, getApiErrorMessage } from '@/lib/api-client';
import { currentUserQueryKey, useCurrentUser } from '@/hooks/use-current-user';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailStatus />
    </Suspense>
  );
}

function VerifyEmailStatus() {
  const token = useSearchParams().get('token');
  const queryClient = useQueryClient();
  const { isAuthenticated } = useCurrentUser();
  const verifyMutation = useMutation({
    mutationFn: authApi.verifyEmail,
    // Refreshes the cached user (emailVerifiedAt) so /account reflects the
    // change immediately if the caller was already logged in when they
    // opened this link — no full page reload needed.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: currentUserQueryKey }),
  });

  useEffect(() => {
    if (token) verifyMutation.mutate({ token });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-foreground)]">
          Missing verification link
        </h1>
        <p className="text-[15px] text-[var(--color-muted-foreground)]">
          Open the link from your email, or request a new one below.
        </p>
        <ResendVerificationForm />
      </div>
    );
  }

  if (verifyMutation.isPending || verifyMutation.isIdle) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <Loader2 className="size-8 animate-spin text-[var(--color-primary)]" aria-hidden />
        <p className="text-[15px] text-[var(--color-muted-foreground)]">Verifying your email…</p>
      </div>
    );
  }

  if (verifyMutation.isSuccess) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-foreground)]">
          Email verified
        </h1>
        <p className="text-[15px] text-[var(--color-muted-foreground)]">
          Your account is confirmed. You&apos;re ready to shop.
        </p>
        <Link
          href={isAuthenticated ? '/account' : '/login'}
          className="mt-2 text-sm font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
        >
          {isAuthenticated ? 'Back to your account' : 'Back to sign in'}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--color-foreground)]">
        Verification failed
      </h1>
      <p className="text-[15px] text-[var(--color-muted-foreground)]">
        {getApiErrorMessage(verifyMutation.error, 'This link is invalid or has expired.')}
      </p>
      <ResendVerificationForm />
    </div>
  );
}

function ResendVerificationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResendVerificationInput>({ resolver: zodResolver(resendVerificationSchema) });

  const resendMutation = useMutation({ mutationFn: authApi.resendVerification });

  if (resendMutation.isSuccess) {
    return (
      <p className="text-[15px] text-[var(--color-muted-foreground)]">
        If that email is registered, a new verification link is on its way.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit((values) => resendMutation.mutate(values))}
      className="flex flex-col gap-4 text-left"
      noValidate
    >
      <FormField
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Button type="submit" loading={resendMutation.isPending} className="w-full">
        Resend verification email
      </Button>
    </form>
  );
}
