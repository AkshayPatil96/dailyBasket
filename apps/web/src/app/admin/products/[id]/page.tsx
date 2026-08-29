'use client';

import { useCallback, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { ImagePlus, Lock, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ProductVariant } from '@grocery-delivery/types';
import { adminProductsApi, type ProductInput, type VariantInput } from '@/lib/admin-catalog-api';
import { uploadsApi } from '@/lib/uploads-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { ProductForm } from '@/components/admin/product-form';
import { VariantForm } from '@/components/admin/variant-form';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  const queryKey = ['admin', 'products', id];
  const { data: product, isLoading } = useQuery({
    queryKey,
    queryFn: () => adminProductsApi.findOne(id),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const updateProductMutation = useMutation({
    mutationFn: (input: Partial<ProductInput>) => adminProductsApi.update(id, input),
    onSuccess: () => {
      invalidate();
      toast.success('Product updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update product.')),
  });

  const [variantDialog, setVariantDialog] = useState<{ open: boolean; editing?: ProductVariant }>({
    open: false,
  });

  const createVariantMutation = useMutation({
    mutationFn: (input: VariantInput) => adminProductsApi.createVariant({ ...input, productId: id }),
    onSuccess: () => {
      invalidate();
      setVariantDialog({ open: false });
      toast.success('Variant added');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not add variant.')),
  });

  const updateVariantMutation = useMutation({
    mutationFn: ({ variantId, input }: { variantId: string; input: Partial<VariantInput> }) =>
      adminProductsApi.updateVariant(variantId, input),
    onSuccess: () => {
      invalidate();
      setVariantDialog({ open: false });
      toast.success('Variant updated');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update variant.')),
  });

  const addImageMutation = useMutation({
    mutationFn: (input: { url: string; altText?: string; isPrimary?: boolean }) =>
      adminProductsApi.addImage({ ...input, productId: id }),
    onSuccess: () => {
      invalidate();
      toast.success('Image added');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not add image.')),
  });

  const removeImageMutation = useMutation({
    mutationFn: (imageId: string) => adminProductsApi.removeImage(imageId),
    onSuccess: () => {
      invalidate();
      toast.success('Image removed');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not remove image.')),
  });

  const [imageMeta, setImageMeta] = useState({ altText: '', isPrimary: false });
  const [imageUpload, setImageUpload] = useState({ inProgress: false, current: 0, total: 0 });

  // Product images have no crop step (see ImageUploadField's enableCrop doc), so a
  // batch is just N independent upload+addImage calls — no per-file crop UI to
  // multiplex. Only the first successfully uploaded file in a batch can become
  // primary, regardless of upload order, so the outcome stays predictable.
  const onDropImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setImageUpload({ inProgress: true, current: 0, total: files.length });
      let uploaded = 0;
      for (const [index, file] of files.entries()) {
        setImageUpload({ inProgress: true, current: index + 1, total: files.length });
        try {
          const url = await uploadsApi.uploadImage(file, 'products');
          await addImageMutation.mutateAsync({
            url,
            altText: imageMeta.altText || undefined,
            isPrimary: imageMeta.isPrimary && uploaded === 0,
          });
          uploaded++;
        } catch (error) {
          toast.error(getApiErrorMessage(error, `Could not upload ${file.name}.`));
        }
      }
      setImageUpload({ inProgress: false, current: 0, total: 0 });
      if (uploaded > 0) setImageMeta({ altText: '', isPrimary: false });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- addImageMutation is stable across renders
    [imageMeta],
  );

  const isLocked = Boolean(product?.isSystem) && !isSuperAdmin;
  const lockedReason = 'Protected showcase product — only a super admin can edit this';

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropImages,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    multiple: true,
    disabled: isLocked,
  });

  if (isLoading || !product) {
    return <p className="text-(--color-muted-foreground)">Loading…</p>;
  }

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      {isLocked ? (
        <div className="flex items-center gap-2 rounded-(--radius-inner) border border-(--color-border) bg-(--color-muted) px-4 py-3 text-sm text-(--color-muted-foreground)">
          <Lock className="size-4 shrink-0" aria-hidden />
          {lockedReason}
        </div>
      ) : null}

      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
          {product.name}
        </h1>
        <ProductForm
          initialValues={product}
          submitting={updateProductMutation.isPending}
          disabled={isLocked}
          disabledReason={lockedReason}
          onSubmit={(input) => updateProductMutation.mutate(input)}
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-(--color-border) pt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-(--color-foreground)">Variants</h2>
          <Button
            size="sm"
            disabled={isLocked}
            title={isLocked ? lockedReason : undefined}
            onClick={() => setVariantDialog({ open: true })}
          >
            <Plus className="size-4" aria-hidden />
            Add variant
          </Button>
        </div>

        {product.variants.length === 0 ? (
          <p className="text-sm text-(--color-muted-foreground)">No variants yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-(--radius-outer) border border-(--color-border)">
            <table className="w-full text-sm">
              <thead className="border-b border-(--color-border) text-left text-(--color-muted-foreground)">
                <tr>
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">Label</th>
                  <th className="px-4 py-2 font-medium">Pack</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => (
                  <tr key={variant.id} className="border-b border-(--color-border) last:border-0">
                    <td className="px-4 py-2 text-(--color-foreground)">{variant.skuCode}</td>
                    <td className="px-4 py-2 text-(--color-foreground)">{variant.label}</td>
                    <td className="px-4 py-2 text-(--color-muted-foreground)">
                      {variant.quantity} {variant.unit}
                    </td>
                    <td className="px-4 py-2 text-(--color-muted-foreground)">₹{variant.price}</td>
                    <td className="px-4 py-2 text-(--color-muted-foreground)">
                      {variant.status.toLowerCase()}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={isLocked}
                        title={isLocked ? lockedReason : undefined}
                        onClick={() => setVariantDialog({ open: true, editing: variant })}
                      >
                        <Pencil className="size-4" aria-hidden />
                        <span className="sr-only">Edit</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 border-t border-(--color-border) pt-6">
        <h2 className="text-lg font-semibold text-(--color-foreground)">Images</h2>

        {product.images.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {product.images.map((image) => (
              <div
                key={image.id}
                className="relative flex w-32 flex-col gap-1 rounded-(--radius-inner) border border-(--color-border) p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-entered URLs aren't whitelisted in next/image remotePatterns */}
                <img
                  src={image.url}
                  alt={image.altText ?? product.name}
                  className="h-24 w-full rounded-(--radius-inner) bg-(--color-muted) object-contain p-1"
                />
                {image.isPrimary ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-(--color-primary)">
                    <Star className="size-3 fill-current" aria-hidden />
                    Primary
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="absolute right-1 top-1 bg-(--color-background)/80"
                  disabled={isLocked}
                  title={isLocked ? lockedReason : undefined}
                  loading={removeImageMutation.isPending && removeImageMutation.variables === image.id}
                  onClick={() => removeImageMutation.mutate(image.id)}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-(--color-muted-foreground)">No images yet.</p>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <FormField
            label="Alt text (optional, applied to this batch)"
            value={imageMeta.altText}
            onChange={(e) => setImageMeta((prev) => ({ ...prev, altText: e.target.value }))}
          />
          <label className="flex items-center gap-1.5 pb-3 text-sm text-(--color-foreground)">
            <input
              type="checkbox"
              checked={imageMeta.isPrimary}
              onChange={(e) =>
                setImageMeta((prev) => ({ ...prev, isPrimary: e.target.checked }))
              }
            />
            First image is primary
          </label>
        </div>

        <div>
          <span className="text-sm font-medium text-(--color-foreground)">Add images</span>
          <div
            {...getRootProps()}
            title={isLocked ? lockedReason : undefined}
            className={cn(
              'mt-2 flex h-32 w-64 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-(--radius-inner) border border-dashed text-center transition-colors',
              isLocked && 'cursor-not-allowed opacity-50',
              isDragActive
                ? 'border-(--color-primary) bg-(--color-primary)/5'
                : 'border-(--color-border) hover:border-(--color-primary)',
            )}
          >
            <input {...getInputProps()} />
            <ImagePlus className="size-5 text-(--color-muted-foreground)" aria-hidden />
            <span className="px-2 text-xs text-(--color-muted-foreground)">
              {imageUpload.inProgress
                ? `Uploading ${imageUpload.current}/${imageUpload.total}…`
                : 'Drop one or more images, or click'}
            </span>
          </div>
        </div>
      </div>

      <Dialog
        open={variantDialog.open}
        onOpenChange={(open) => setVariantDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{variantDialog.editing ? 'Edit variant' : 'Add a variant'}</DialogTitle>
          </DialogHeader>
          <VariantForm
            initialValues={variantDialog.editing}
            submitting={createVariantMutation.isPending || updateVariantMutation.isPending}
            onSubmit={(input) => {
              if (variantDialog.editing) {
                updateVariantMutation.mutate({ variantId: variantDialog.editing.id, input });
              } else {
                createVariantMutation.mutate(input);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
