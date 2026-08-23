"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  registerSchema,
  type RegisterInput,
} from "@grocery-delivery/validation";
import { authApi, getApiErrorMessage } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PhoneInput } from "@/components/ui/phone-input";
import { PasswordStrengthMeter } from "@/components/auth/password-strength-meter";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const password = useWatch({ control, name: "password", defaultValue: "" });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: () => router.push("/login?registered=1"),
  });

  const onSubmit = (values: RegisterInput) => {
    const toastId = toast.loading("Creating your account...");
    registerMutation
      .mutateAsync(values)
      .then(() => toast.success("Account created successfully"))
      .catch((error) =>
        toast.error(
          getApiErrorMessage(error, "Could not create your account."),
        ),
      )
      .finally(() => toast.dismiss(toastId));
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          Create your account
        </h1>
        <p className="text-[15px] text-(--color-muted-foreground)">
          Fresh groceries are a couple of taps away.
        </p>
      </div>

      {registerMutation.isError ? (
        <p
          role="alert"
          className="rounded-inner border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
        >
          {getApiErrorMessage(
            registerMutation.error,
            "Could not create your account.",
          )}
        </p>
      ) : null}

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-3"
        noValidate
      >
        <div className="grid grid-cols-2 gap-2">
          <FormField
            label="First name"
            autoComplete="given-name"
            placeholder="Ada"
            error={errors.firstName?.message}
            required
            {...register("firstName")}
          />
          <FormField
            label="Last name"
            autoComplete="family-name"
            placeholder="Lovelace"
            error={errors.lastName?.message}
            {...register("lastName")}
            required
          />
        </div>
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
          <label
            htmlFor="phone"
            className="text-sm font-medium text-(--color-foreground)"
          >
            Phone
          </label>
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value, name } }) => (
              <PhoneInput
                onChange={onChange}
                onBlur={onBlur}
                value={value}
                name={name}
                id="phone"
                maxLength={10}
                defaultCountry="IN"
                placeholder="Enter phone number"
                autoComplete="tel"
                aria-invalid={Boolean(errors.phone)}
              />
            )}
          />
          {errors.phone ? (
            <p
              role="alert"
              className="text-xs text-red-600 dark:text-red-400"
            >
              {errors.phone.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-3">
          <FormField
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            error={errors.password?.message}
            required
            {...register("password")}
          />
          <PasswordStrengthMeter password={password} />
        </div>

        <Button
          type="submit"
          loading={registerMutation.isPending}
          className="w-full"
        >
          Create account
        </Button>
      </form>

      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
