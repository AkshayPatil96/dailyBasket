'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useForm, useWatch } from 'react-hook-form';
import type { Address, AddressLabel } from '@grocery-delivery/types';
import type { AddressInput } from '@/lib/addresses-api';
import type { CityResult } from '@/lib/nominatim-api';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import { CitySearch } from './city-search';

// Leaflet touches `window` — must not be part of the server-rendered bundle.
const AddressMapPicker = dynamic(
  () => import('./address-map-picker').then((mod) => mod.AddressMapPicker),
  { ssr: false },
);

const LABELS: AddressLabel[] = ['HOME', 'WORK', 'OTHER'];

export function AddressForm({
  initialValues,
  onSubmit,
  submitting,
}: {
  initialValues?: Address;
  onSubmit: (input: AddressInput) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors },
  } = useForm<AddressInput>({
    defaultValues: initialValues
      ? {
          label: initialValues.label,
          recipientName: initialValues.recipientName,
          phone: initialValues.phone,
          line1: initialValues.line1,
          line2: initialValues.line2 ?? undefined,
          landmark: initialValues.landmark ?? undefined,
          city: initialValues.city,
          state: initialValues.state,
          country: initialValues.country,
          postalCode: initialValues.postalCode,
          latitude: initialValues.latitude ?? undefined,
          longitude: initialValues.longitude ?? undefined,
          formattedAddress: initialValues.formattedAddress ?? undefined,
        }
      : { label: 'HOME', country: 'India' },
  });
  const [showLocationFields, setShowLocationFields] = useState(Boolean(initialValues));
  const label = useWatch({ control, name: 'label', defaultValue: 'HOME' }) ?? 'HOME';
  const latitude = useWatch({ control, name: 'latitude' });
  const longitude = useWatch({ control, name: 'longitude' });

  const applyCity = (city: CityResult) => {
    setValue('city', city.city, { shouldValidate: true });
    setValue('state', city.state);
    setValue('country', city.country || 'India');
    if (city.postalCode) setValue('postalCode', city.postalCode);
    setValue('latitude', city.latitude);
    setValue('longitude', city.longitude);
    setShowLocationFields(true);
  };

  const submit = (input: AddressInput) => {
    onSubmit({
      ...input,
      formattedAddress: [input.line1, input.landmark, input.city, input.state, input.postalCode]
        .filter(Boolean)
        .join(', '),
    });
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-(--color-foreground)">Label</span>
        <div className="flex gap-2">
          {LABELS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setValue('label', option)}
              className={cn(
                'cursor-pointer rounded-(--radius-inner) border px-4 py-2 text-sm font-medium capitalize transition-colors',
                label === option
                  ? 'border-(--color-primary) bg-(--color-primary)/10 text-(--color-primary)'
                  : 'border-(--color-border) text-(--color-foreground) hover:border-(--color-primary)',
              )}
            >
              {option.toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label="Recipient name"
          placeholder="Who should we deliver to?"
          error={errors.recipientName?.message}
          required
          {...register('recipientName', { required: 'recipientName is required' })}
        />
        <FormField
          label="Phone"
          type="tel"
          placeholder="10-digit mobile number"
          error={errors.phone?.message}
          required
          {...register('phone', { required: 'phone is required' })}
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-(--color-border) pt-4">
        <FormField
          label="Address line 1"
          placeholder="Flat / House no., building, area, street"
          error={errors.line1?.message}
          required
          {...register('line1', { required: 'line1 is required' })}
        />
        <FormField
          label="Address line 2 (optional)"
          placeholder="Apartment, suite, etc."
          {...register('line2')}
        />
        <FormField label="Landmark (optional)" placeholder="Near..." {...register('landmark')} />
      </div>

      <div className="flex flex-col gap-4 border-t border-(--color-border) pt-4">
        <CitySearch onSelect={applyCity} />

        {showLocationFields || initialValues ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="City"
                error={errors.city?.message}
                required
                {...register('city', { required: 'city is required' })}
              />
              <FormField
                label="State"
                error={errors.state?.message}
                required
                {...register('state', { required: 'state is required' })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Postal code"
                error={errors.postalCode?.message}
                required
                {...register('postalCode', { required: 'postalCode is required' })}
              />
              <FormField label="Country" {...register('country')} />
            </div>

            <AddressMapPicker
              latitude={latitude}
              longitude={longitude}
              onChange={(lat, lng) => {
                setValue('latitude', lat, { shouldValidate: true });
                setValue('longitude', lng, { shouldValidate: true });
              }}
            />
          </>
        ) : null}
      </div>

      <Button type="submit" loading={submitting} className="w-full">
        {initialValues ? 'Save changes' : 'Save address'}
      </Button>
    </form>
  );
}
