'use client';

import { Controller, useForm } from 'react-hook-form';
import type { ProductVariant, Unit, VariantStatus } from '@grocery-delivery/types';
import type { VariantInput } from '@/lib/admin-catalog-api';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { SelectField } from '@/components/ui/select-field';
import { SelectItem } from '@/components/ui/select';

const UNITS: Unit[] = ['KG', 'G', 'L', 'ML', 'PIECE', 'PACK', 'DOZEN'];
const STATUSES: VariantStatus[] = ['ACTIVE', 'INACTIVE', 'DISCONTINUED'];

export function VariantForm({
  initialValues,
  onSubmit,
  submitting,
}: {
  initialValues?: ProductVariant;
  onSubmit: (input: VariantInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<VariantInput>({
    defaultValues: initialValues
      ? {
          skuCode: initialValues.skuCode,
          barcode: initialValues.barcode ?? undefined,
          label: initialValues.label,
          quantity: initialValues.quantity,
          unit: initialValues.unit,
          price: Number(initialValues.price),
          compareAtPrice: initialValues.compareAtPrice
            ? Number(initialValues.compareAtPrice)
            : undefined,
          status: initialValues.status,
        }
      : { unit: 'PIECE' },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {!initialValues ? (
        <FormField
          label="SKU code"
          error={errors.skuCode?.message}
          required
          {...register('skuCode', { required: 'skuCode is required' })}
        />
      ) : null}
      <FormField
        label="Label"
        placeholder='e.g. "500 g pack"'
        error={errors.label?.message}
        required
        {...register('label', { required: 'label is required' })}
      />
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Pack quantity"
          type="number"
          error={errors.quantity?.message}
          required
          {...register('quantity', { required: 'quantity is required', valueAsNumber: true })}
        />
        <Controller
          control={control}
          name="unit"
          render={({ field }) => (
            <SelectField label="Unit" value={field.value} onValueChange={field.onChange}>
              {UNITS.map((unit) => (
                <SelectItem key={unit} value={unit}>
                  {unit}
                </SelectItem>
              ))}
            </SelectField>
          )}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Price (₹)"
          type="number"
          step="0.01"
          error={errors.price?.message}
          required
          {...register('price', { required: 'price is required', valueAsNumber: true })}
        />
        <FormField
          label="Compare-at price (optional)"
          type="number"
          step="0.01"
          {...register('compareAtPrice', { valueAsNumber: true })}
        />
      </div>
      {initialValues ? (
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SelectField label="Status" value={field.value} onValueChange={field.onChange}>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectField>
          )}
        />
      ) : null}
      <Button type="submit" loading={submitting} className="w-full">
        {initialValues ? 'Save changes' : 'Add variant'}
      </Button>
    </form>
  );
}
