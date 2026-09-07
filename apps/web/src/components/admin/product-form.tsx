"use client";

import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import type { DietaryTag, ProductDetail } from "@grocery-delivery/types";
import { adminCategoriesApi, type ProductInput } from "@/lib/admin-catalog-api";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { SelectField } from "@/components/ui/select-field";
import { SelectItem } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CategoryComboboxField } from "@/components/admin/category-combobox-field";

const DIETARY_TAGS: DietaryTag[] = [
  "VEGETARIAN",
  "VEGAN",
  "ORGANIC",
  "GLUTEN_FREE",
  "SUGAR_FREE",
];

export function ProductForm({
  initialValues,
  onSubmit,
  submitting,
  disabled,
  disabledReason,
}: {
  initialValues?: ProductDetail;
  onSubmit: (input: ProductInput) => void;
  submitting?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const { data: categories } = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: adminCategoriesApi.listAll,
  });

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProductInput>({
    defaultValues: initialValues
      ? {
          categoryId: initialValues.categoryId,
          brand: initialValues.brand ?? undefined,
          name: initialValues.name,
          description: initialValues.description ?? undefined,
          ingredients: initialValues.ingredients ?? undefined,
          dietaryInfo: initialValues.dietaryInfo,
          countryOfOrigin: initialValues.countryOfOrigin ?? undefined,
          status: initialValues.status,
          isFeatured: initialValues.isFeatured,
        }
      : { dietaryInfo: [], isFeatured: false },
  });

  const submit = (values: ProductInput) => {
    onSubmit({ ...values, brand: values.brand?.trim() || undefined });
  };

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="flex flex-col gap-4"
      noValidate
    >
      <FormField
        label="Name"
        error={errors.name?.message}
        required
        {...register("name", { required: "name is required" })}
      />
      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={control}
          name="categoryId"
          rules={{ required: "categoryId is required" }}
          render={({ field }) => (
            <CategoryComboboxField
              label="Category"
              error={errors.categoryId?.message}
              required
              placeholder="Search categories…"
              categories={categories ?? []}
              value={field.value}
              onValueChange={field.onChange}
            />
          )}
        />
        <FormField label="Brand (optional)" {...register("brand")} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-(--color-foreground)">
          Description
        </label>
        <Textarea
          rows={3}
          {...register("description")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-(--color-foreground)">
          Ingredients
        </label>
        <Textarea
          rows={2}
          {...register("ingredients")}
        />
      </div>
      <FormField
        label="Country of origin"
        {...register("countryOfOrigin")}
      />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-(--color-foreground)">
          Dietary tags
        </span>
        <div className="flex flex-wrap gap-3">
          {DIETARY_TAGS.map((tag) => (
            <label
              key={tag}
              className="flex items-center gap-1.5 text-sm text-(--color-foreground)"
            >
              <input
                type="checkbox"
                value={tag}
                {...register("dietaryInfo")}
              />
              {tag
                .replace("_", " ")
                .toLowerCase()
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </label>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-(--color-foreground)">
        <input type="checkbox" {...register("isFeatured")} />
        Featured — show in the homepage&apos;s Featured Products section
      </label>

      {initialValues ? (
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <SelectField label="Status" value={field.value} onValueChange={field.onChange}>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
              <SelectItem value="ARCHIVED">Archived</SelectItem>
            </SelectField>
          )}
        />
      ) : null}

      <Button
        type="submit"
        loading={submitting}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className="w-full"
      >
        {initialValues ? "Save changes" : "Create product"}
      </Button>
    </form>
  );
}
