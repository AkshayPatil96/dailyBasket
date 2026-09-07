"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { loginSchema, type LoginInput } from "@grocery-delivery/validation";
import { authApi, getApiErrorMessage } from "@/lib/api-client";
import { currentUserQueryKey } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";
import { toast } from "sonner";

// Only allow same-site relative paths — reject protocol-relative ("//evil.com")
// and backslash ("/\evil.com") forms browsers can interpret as external hosts.
const isSafeNext = (value: string | null): value is string =>
  value !== null && /^\/(?!\/|\\)/.test(value);

// Every seeded demo account shares this password — see
// apps/api/prisma/seeds/seed-demo-accounts.js.
const DEMO_PASSWORD = "Demo@1234";
const DEMO_ACCOUNTS = [
  { label: "Customer", email: "demo.customer@dailybasket.app" },
  { label: "Delivery", email: "demo.delivery@dailybasket.app" },
  { label: "Admin", email: "demo.admin@dailybasket.app" },
];

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const next = useSearchParams().get("next");
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserQueryKey, user);
      router.push(isSafeNext(next) ? next : "/");
    },
  });

  const onSubmit = (values: LoginInput) => {
    const toastId = toast.loading("Logging in...");
    loginMutation
      .mutateAsync(values)
      .then(() => toast.success("Logged in successfully"))
      .catch((error) =>
        toast.error(getApiErrorMessage(error, "Invalid email or password.")),
      )
      .finally(() => toast.dismiss(toastId));
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          Welcome back
        </h1>
        <p className="text-[15px] text-(--color-muted-foreground)">
          Sign in to reorder your essentials in seconds.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        {loginMutation.isError ? (
          <Alert
            variant="destructive"
            className="bg-destructive/10 opacity-80 rounded-sm"
          >
            <AlertCircleIcon />
            <AlertTitle>
              {getApiErrorMessage(
                loginMutation.error,
                "Invalid email or password.",
              )}
            </AlertTitle>
          </Alert>
        ) : null}

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-3"
          noValidate
        >
          <FormField
            label="Email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            error={errors.email?.message}
            required
            {...register("email")}
          />
          <div className="flex flex-col gap-2">
            <FormField
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              error={errors.password?.message}
              required
              {...register("password")}
            />
            <Link
              href="/forgot-password"
              className="self-end text-sm font-medium text-(--color-primary) hover:text-(--color-primary-hover)"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            loading={loginMutation.isPending}
            className="w-full"
          >
            Sign in
          </Button>
        </form>

        <div className="flex flex-col gap-3 rounded-(--radius-inner) border border-(--color-border) bg-(--color-muted)/40 p-4">
          <p className="text-sm font-semibold text-(--color-foreground)">Demo logins</p>
          <div className="flex flex-col">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => {
                  setValue("email", account.email);
                  setValue("password", DEMO_PASSWORD);
                }}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-(--radius-inner) px-2 py-1.5 text-left text-sm transition-colors hover:bg-(--color-background)"
              >
                <span className="font-medium text-(--color-foreground)">{account.label}</span>
                <span className="text-(--color-muted-foreground)">{account.email}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-(--color-muted-foreground)">
            Password for all:{" "}
            <span className="font-medium text-(--color-primary)">{DEMO_PASSWORD}</span>
          </p>
        </div>

        <p className="text-center text-sm text-(--color-muted-foreground)">
          New to DailyBasket?{" "}
          <Link
            href="/register"
            className="font-medium text-(--color-primary) hover:text-(--color-primary-hover)"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
