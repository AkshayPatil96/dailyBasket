'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import type { Address } from '@grocery-delivery/types';
import { addressesApi, type AddressInput } from '@/lib/addresses-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AddressForm } from '@/components/address/address-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

const ADDRESSES_QUERY_KEY = ['addresses'];

export default function AddressesPage() {
  return (
    <AuthGuard>
      <AddressesManager />
    </AuthGuard>
  );
}

function AddressesManager() {
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<{ open: boolean; editing?: Address }>({
    open: false,
  });

  const { data: addresses, isLoading } = useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: addressesApi.list,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY });

  const createMutation = useMutation({
    mutationFn: addressesApi.create,
    onSuccess: () => {
      invalidate();
      setDialogState({ open: false });
      toast.success('Address saved');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not save address.')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<AddressInput> }) =>
      addressesApi.update(id, input),
    onSuccess: () => {
      invalidate();
      setDialogState({ open: false });
      toast.success('Address updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update address.')),
  });

  const setDefaultMutation = useMutation({
    mutationFn: addressesApi.setDefault,
    onSuccess: () => {
      invalidate();
      toast.success('Default address updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not set default.')),
  });

  const removeMutation = useMutation({
    mutationFn: addressesApi.remove,
    onSuccess: () => {
      invalidate();
      toast.success('Address removed');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not remove address.')),
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          Delivery addresses
        </h1>
        <Button onClick={() => setDialogState({ open: true })}>
          <Plus className="size-4" aria-hidden />
          Add address
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-10 text-center text-(--color-muted-foreground)">Loading…</p>
      ) : !addresses || addresses.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 rounded-(--radius-outer) border border-dashed border-(--color-border) py-16 text-center">
          <MapPin className="size-8 text-(--color-muted-foreground)" aria-hidden />
          <p className="text-(--color-muted-foreground)">No saved addresses yet.</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {addresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-(--color-muted) px-2.5 py-0.5 text-xs font-medium capitalize text-(--color-muted-foreground)">
                    {address.label.toLowerCase()}
                  </span>
                  {address.isDefault ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-(--color-primary)">
                      <Star className="size-3 fill-current" aria-hidden />
                      Default
                    </span>
                  ) : null}
                </div>
                <p className="text-sm font-medium text-(--color-foreground)">
                  {address.recipientName} — {address.phone}
                </p>
                <p className="text-sm text-(--color-muted-foreground)">
                  {[address.line1, address.line2, address.landmark, address.city, address.state, address.postalCode]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {!address.isDefault ? (
                  <Button
                    variant="outline"
                    size="sm"
                    loading={
                      setDefaultMutation.isPending && setDefaultMutation.variables === address.id
                    }
                    onClick={() => setDefaultMutation.mutate(address.id)}
                  >
                    Set default
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDialogState({ open: true, editing: address })}
                >
                  <Pencil className="size-4" aria-hidden />
                  <span className="sr-only">Edit</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  loading={removeMutation.isPending && removeMutation.variables === address.id}
                  onClick={() => removeMutation.mutate(address.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogState.editing ? 'Edit address' : 'Add a new address'}
            </DialogTitle>
          </DialogHeader>
          <AddressForm
            initialValues={dialogState.editing}
            submitting={isSubmitting}
            onSubmit={(input) => {
              if (dialogState.editing) {
                updateMutation.mutate({ id: dialogState.editing.id, input });
              } else {
                createMutation.mutate(input);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </main>
  );
}
