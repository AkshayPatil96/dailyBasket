'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { HandlingChargeType, SystemSettings } from '@grocery-delivery/types';
import { settingsApi, type UpdateSettingsInput } from '@/lib/settings-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';

const CHARGE_TYPES: HandlingChargeType[] = ['FIXED', 'PERCENTAGE'];

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin', 'settings'], queryFn: settingsApi.get });

  const updateMutation = useMutation({
    mutationFn: (input: UpdateSettingsInput) => settingsApi.adminUpdate(input),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'settings'], updated);
      toast.success('Settings saved');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not save settings.')),
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Settings</h1>
      {isLoading || !data ? (
        <p className="text-sm text-(--color-muted-foreground)">Loading…</p>
      ) : (
        <SettingsForm
          key={data.updatedAt ?? 'initial'}
          initialValues={data}
          submitting={updateMutation.isPending}
          onSubmit={(input) => updateMutation.mutate(input)}
        />
      )}
    </div>
  );
}

function SettingsForm({
  initialValues,
  onSubmit,
  submitting,
}: {
  initialValues: SystemSettings;
  onSubmit: (input: UpdateSettingsInput) => void;
  submitting?: boolean;
}) {
  const [handlingChargeType, setHandlingChargeType] = useState<HandlingChargeType>(
    initialValues.handlingChargeType,
  );
  const [maintenanceMode, setMaintenanceMode] = useState(initialValues.maintenanceMode);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{
    deliveryFee: string;
    freeDeliveryThreshold: string;
    handlingChargeValue: string;
    handlingChargeMaxAmount: string;
    handlingChargeWaivedUntil: string;
    handlingChargeWaiverReason: string;
    bannerText: string;
    supportEmail: string;
    supportPhone: string;
  }>({
    defaultValues: {
      deliveryFee: initialValues.deliveryFee,
      freeDeliveryThreshold: initialValues.freeDeliveryThreshold ?? '',
      handlingChargeValue: initialValues.handlingChargeValue,
      handlingChargeMaxAmount: initialValues.handlingChargeMaxAmount ?? '',
      handlingChargeWaivedUntil: initialValues.handlingChargeWaivedUntil
        ? initialValues.handlingChargeWaivedUntil.slice(0, 10)
        : '',
      handlingChargeWaiverReason: initialValues.handlingChargeWaiverReason ?? '',
      bannerText: initialValues.bannerText ?? '',
      supportEmail: initialValues.supportEmail ?? '',
      supportPhone: initialValues.supportPhone ?? '',
    },
  });

  const submit = handleSubmit((values) => {
    onSubmit({
      deliveryFee: Number(values.deliveryFee),
      freeDeliveryThreshold: values.freeDeliveryThreshold ? Number(values.freeDeliveryThreshold) : null,
      handlingChargeType,
      handlingChargeValue: Number(values.handlingChargeValue),
      handlingChargeMaxAmount:
        handlingChargeType === 'PERCENTAGE' && values.handlingChargeMaxAmount
          ? Number(values.handlingChargeMaxAmount)
          : null,
      handlingChargeWaivedUntil: values.handlingChargeWaivedUntil
        ? new Date(values.handlingChargeWaivedUntil).toISOString()
        : null,
      handlingChargeWaiverReason: values.handlingChargeWaiverReason || null,
      maintenanceMode,
      bannerText: values.bannerText || null,
      supportEmail: values.supportEmail || null,
      supportPhone: values.supportPhone || null,
    });
  });

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-(--color-foreground)">Delivery</h2>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Delivery fee (₹)"
            type="number"
            step="0.01"
            error={errors.deliveryFee?.message}
            required
            {...register('deliveryFee', { required: 'deliveryFee is required' })}
          />
          <FormField
            label="Free above (₹, optional)"
            type="number"
            step="0.01"
            {...register('freeDeliveryThreshold')}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-(--color-foreground)">Handling charge</h2>
        <div className="flex gap-2">
          {CHARGE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setHandlingChargeType(type)}
              className={cn(
                'cursor-pointer rounded-(--radius-inner) border px-4 py-2 text-sm font-medium capitalize transition-colors',
                handlingChargeType === type
                  ? 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)'
                  : 'border-(--color-border) text-(--color-foreground) hover:border-(--color-primary)',
              )}
            >
              {type === 'FIXED' ? 'Flat amount' : 'Percentage'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label={handlingChargeType === 'FIXED' ? 'Charge (₹)' : 'Charge (%)'}
            type="number"
            step="0.01"
            error={errors.handlingChargeValue?.message}
            required
            {...register('handlingChargeValue', { required: 'handlingChargeValue is required' })}
          />
          {handlingChargeType === 'PERCENTAGE' ? (
            <FormField
              label="Max charge (₹, optional)"
              type="number"
              step="0.01"
              {...register('handlingChargeMaxAmount')}
            />
          ) : null}
        </div>
        <p className="text-xs text-(--color-muted-foreground)">
          Optional promotional waiver — e.g. &ldquo;free until launch week ends&rdquo;. Leave the date empty to
          charge normally.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Waived until (optional)" type="date" {...register('handlingChargeWaivedUntil')} />
          <FormField
            label="Waiver reason (optional)"
            placeholder="Free during launch week"
            {...register('handlingChargeWaiverReason')}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-(--color-foreground)">Site status</h2>
        <label className="flex items-center gap-2 text-sm text-(--color-foreground)">
          <input
            type="checkbox"
            checked={maintenanceMode}
            onChange={(e) => setMaintenanceMode(e.target.checked)}
            className="size-4 rounded border-(--color-border)"
          />
          Maintenance mode (blocks new checkouts)
        </label>
        <FormField label="Banner text (optional)" placeholder="Free delivery on orders above ₹200!" {...register('bannerText')} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Support email (optional)" type="email" {...register('supportEmail')} />
          <FormField label="Support phone (optional)" {...register('supportPhone')} />
        </div>
      </section>

      <Button type="submit" loading={submitting} className="w-full">
        Save settings
      </Button>
    </form>
  );
}
