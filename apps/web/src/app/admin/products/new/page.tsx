'use client';

import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminProductsApi, type ProductInput } from '@/lib/admin-catalog-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { ProductForm } from '@/components/admin/product-form';

export default function NewProductPage() {
  const router = useRouter();

  const createMutation = useMutation({
    mutationFn: (input: ProductInput) => adminProductsApi.create(input),
    onSuccess: (product) => {
      toast.success('Product created — add variants and images next.');
      router.push(`/admin/products/${product.id}`);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not create product.')),
  });

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
        Add a product
      </h1>
      <ProductForm
        submitting={createMutation.isPending}
        onSubmit={(input) => createMutation.mutate(input)}
      />
    </div>
  );
}
