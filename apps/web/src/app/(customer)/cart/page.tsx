"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Minus,
  Package,
  Plus,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@grocery-delivery/utils";
import { Button } from "@/components/ui/button";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  useCart,
  useRemoveCartItem,
  useUpdateCartItem,
} from "@/hooks/use-cart";

export default function CartPage() {
  const router = useRouter();
  const { cart, isLoading } = useCart();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const [quantityLimitError, setQuantityLimitError] = useState<{
    itemId: string;
    message: string;
  } | null>(null);

  const onCartError = (error: unknown) =>
    toast.error(getApiErrorMessage(error, "Could not update your cart."));

  const updateQuantity = (itemId: string, quantity: number) => {
    updateItem.mutate(
      { itemId, quantity },
      {
        onSuccess: () =>
          setQuantityLimitError((prev) =>
            prev?.itemId === itemId ? null : prev,
          ),
        onError: (error) =>
          setQuantityLimitError({
            itemId,
            message: getApiErrorMessage(error, "Could not update quantity."),
          }),
      },
    );
  };

  if (isLoading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2
          className="size-6 animate-spin text-(--color-primary)"
          aria-hidden
        />
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    return (
      <main className="container flex flex-col items-center gap-4 px-4 py-20 text-center sm:px-6">
        <span className="flex size-16 items-center justify-center rounded-full bg-(--color-muted)">
          <ShoppingCart
            className="size-7 text-(--color-muted-foreground)"
            aria-hidden
          />
        </span>
        <h1 className="font-display text-xl font-semibold text-(--color-foreground)">
          Your cart is empty
        </h1>
        <p className="text-sm text-(--color-muted-foreground)">
          Add items to get started with your order.
        </p>
        <Link
          href="/"
          className="rounded-(--radius-inner) bg-(--color-primary) px-5 py-2.5 text-sm font-medium text-(--color-primary-foreground) hover:bg-(--color-primary-hover)"
        >
          Start shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="container flex flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
        Your cart
      </h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-3">
          {cart.items.map((item) => {
            const isItemMutating =
              (updateItem.isPending &&
                updateItem.variables?.itemId === item.id) ||
              (removeItem.isPending && removeItem.variables === item.id);

            return (
              <div
                key={item.id}
                className="flex gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-3"
              >
                <Link
                  href={`/product/${item.product.slug}`}
                  className="relative size-20 shrink-0 overflow-hidden rounded-(--radius-inner) bg-(--color-muted)"
                >
                  {item.product.imageUrl ? (
                    <Image
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      fill
                      sizes="80px"
                      className="object-contain p-1.5"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center">
                      <Package
                        className="size-6 text-(--color-muted-foreground)"
                        aria-hidden
                      />
                    </div>
                  )}
                </Link>

                <div className="flex flex-1 flex-col gap-1">
                  <Link
                    href={`/product/${item.product.slug}`}
                    className="text-sm font-medium text-(--color-foreground) hover:text-(--color-primary)"
                  >
                    {item.product.name}
                  </Link>
                  <span className="text-xs text-(--color-muted-foreground)">
                    {item.variant.label}
                  </span>

                  {!item.availability.inStock ? (
                    <span className="text-xs font-medium text-(--color-destructive)">
                      Out of stock
                    </span>
                  ) : item.availability.availableQuantity < item.quantity ? (
                    <span className="text-xs font-medium text-(--color-destructive)">
                      Only {item.availability.availableQuantity} left
                    </span>
                  ) : quantityLimitError?.itemId === item.id ? (
                    <span className="text-xs font-medium text-(--color-destructive)">
                      {quantityLimitError.message}
                    </span>
                  ) : null}

                  <div className="mt-auto flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center rounded-(--radius-inner) border border-(--color-primary) px-1.5 py-1">
                        <button
                          type="button"
                          disabled={isItemMutating}
                          onClick={() =>
                            item.quantity <= 1
                              ? removeItem.mutate(item.id, {
                                  onError: onCartError,
                                })
                              : updateQuantity(item.id, item.quantity - 1)
                          }
                          className="flex size-6 shrink-0 items-center justify-center text-(--color-primary) disabled:opacity-50"
                        >
                          <Minus
                            className="size-3.5"
                            aria-hidden
                          />
                          <span className="sr-only">Remove one</span>
                        </button>
                        <QuantityInput
                          quantity={item.quantity}
                          disabled={isItemMutating}
                          onCommit={(quantity) => updateQuantity(item.id, quantity)}
                        />
                        <button
                          type="button"
                          disabled={isItemMutating}
                          onClick={() =>
                            updateQuantity(item.id, item.quantity + 1)
                          }
                          className="flex size-6 shrink-0 items-center justify-center text-(--color-primary) disabled:opacity-50"
                        >
                          <Plus
                            className="size-3.5"
                            aria-hidden
                          />
                          <span className="sr-only">Add one more</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        disabled={isItemMutating}
                        onClick={() =>
                          removeItem.mutate(item.id, { onError: onCartError })
                        }
                        className="text-(--color-muted-foreground) hover:text-(--color-destructive) disabled:opacity-50"
                      >
                        <Trash2
                          className="size-4"
                          aria-hidden
                        />
                        <span className="sr-only">Remove item</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-semibold text-(--color-foreground)">
                        {formatCurrency(item.lineTotal)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex h-fit flex-col gap-3 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
          <h2 className="text-sm font-semibold text-(--color-foreground)">
            Order summary
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-(--color-muted-foreground)">
                Subtotal ({cart.itemCount}{" "}
                {cart.itemCount === 1 ? "item" : "items"})
              </span>
              <span className="text-(--color-foreground)">
                {formatCurrency(cart.subtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-(--color-muted-foreground)">
                Delivery fee
              </span>
              <span className="text-(--color-foreground)">
                {formatCurrency(cart.deliveryFee)}
              </span>
            </div>
            <div className="flex justify-between border-t border-(--color-border) pt-2 font-semibold text-(--color-foreground)">
              <span>Total</span>
              <span>{formatCurrency(cart.total)}</span>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={cart.items.some(
              (item) =>
                !item.availability.inStock ||
                item.availability.availableQuantity < item.quantity,
            )}
            onClick={() => router.push("/checkout")}
          >
            Proceed to checkout
          </Button>
        </div>
      </div>
    </main>
  );
}

function QuantityInput({
  quantity,
  disabled,
  onCommit,
}: {
  quantity: number;
  disabled: boolean;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState(String(quantity));

  // Re-sync whenever the server-confirmed quantity changes from outside
  // (the +/- buttons, or a revert after an invalid manual entry).
  useEffect(() => {
    setDraft(String(quantity));
  }, [quantity]);

  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isInteger(parsed) || parsed < 1) {
      setDraft(String(quantity));
      return;
    }
    if (parsed !== quantity) {
      onCommit(parsed);
    } else {
      setDraft(String(quantity));
    }
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className="w-8 shrink-0 border-0 bg-transparent text-center text-sm font-semibold text-(--color-primary) outline-none [appearance:textfield] disabled:opacity-50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}
