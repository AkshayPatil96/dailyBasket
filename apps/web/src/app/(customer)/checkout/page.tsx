'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Loader2, MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@grocery-delivery/utils';
import type { Order } from '@grocery-delivery/types';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { AddressForm } from '@/components/address/address-form';
import { addressesApi, type AddressInput } from '@/lib/addresses-api';
import { checkoutApi, type SetCheckoutAddressInput } from '@/lib/checkout-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useCart, cartQueryKey } from '@/hooks/use-cart';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const ADDRESSES_QUERY_KEY = ['addresses'];

type Step = 'address' | 'payment' | 'confirmed';

export default function CheckoutPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: isLoadingUser, isAuthenticated } = useCurrentUser();
  const { cart, isLoading: isLoadingCart } = useCart();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('address');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [guestEmail, setGuestEmail] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const startedRef = useRef(false);

  const startMutation = useMutation({
    mutationFn: () => checkoutApi.start(),
    onSuccess: (session) => setSessionId(session.id),
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not start checkout.')),
  });

  useEffect(() => {
    if (startedRef.current || isLoadingCart || !cart || cart.items.length === 0) return;
    startedRef.current = true;
    startMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingCart, cart]);

  const { data: addresses, isLoading: isLoadingAddresses } = useQuery({
    queryKey: ADDRESSES_QUERY_KEY,
    queryFn: addressesApi.list,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (addresses && addresses.length > 0 && !selectedAddressId) {
      const preferred = addresses.find((address) => address.isDefault) ?? addresses[0];
      setSelectedAddressId(preferred.id);
    }
  }, [addresses, selectedAddressId]);

  const setAddressMutation = useMutation({
    mutationFn: (input: SetCheckoutAddressInput) => checkoutApi.setAddress(sessionId!, input),
    onSuccess: () => setStep('payment'),
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not save delivery address.')),
  });

  const createAddressMutation = useMutation({
    mutationFn: (input: AddressInput) => addressesApi.create(input),
    onSuccess: (address) => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_QUERY_KEY });
      setSelectedAddressId(address.id);
      setShowNewAddressForm(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not save address.')),
  });

  const createPaymentMutation = useMutation({
    mutationFn: () => checkoutApi.createPayment(sessionId!),
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not start payment.')),
  });

  const verifyPaymentMutation = useMutation({
    mutationFn: (input: Parameters<typeof checkoutApi.verifyPayment>[1]) =>
      checkoutApi.verifyPayment(sessionId!, input),
    onSuccess: (order) => {
      setConfirmedOrder(order);
      setStep('confirmed');
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
      toast.success('Order placed!');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Payment verification failed.')),
  });

  const devCompleteMutation = useMutation({
    mutationFn: () => checkoutApi.devCompletePayment(sessionId!),
    onSuccess: (order) => {
      setConfirmedOrder(order);
      setStep('confirmed');
      queryClient.invalidateQueries({ queryKey: cartQueryKey });
      toast.success('Order placed (dev — payment skipped)');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not skip payment.')),
  });

  // Dev convenience: reserves stock/pricing the same way handlePay() does via
  // createPayment, then marks it captured directly instead of opening
  // Razorpay's checkout modal. See CheckoutService.devCompletePayment.
  const handleSkipPayment = async () => {
    if (!sessionId) return;
    await createPaymentMutation.mutateAsync();
    devCompleteMutation.mutate();
  };

  const handlePay = async () => {
    if (!sessionId) return;
    const payment = await createPaymentMutation.mutateAsync();
    const selectedAddress = addresses?.find((address) => address.id === selectedAddressId);
    const razorpay = new window.Razorpay({
      key: payment.razorpayKeyId,
      amount: payment.amount,
      currency: payment.currency,
      order_id: payment.razorpayOrderId,
      name: 'DailyBasket',
      description: 'Order payment',
      prefill: {
        name: selectedAddress?.recipientName ?? (user ? `${user.firstName} ${user.lastName}` : undefined),
        contact: selectedAddress?.phone ?? user?.phone ?? undefined,
        email: user?.email ?? guestEmail ?? undefined,
      },
      theme: { color: '#16a34a' },
      handler: (response: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        verifyPaymentMutation.mutate({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        });
      },
    });
    razorpay.open();
  };

  if (isLoadingCart || isLoadingUser || !sessionId) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-(--color-primary)" aria-hidden />
      </main>
    );
  }

  // Once the order is placed, the cart is correctly emptied server-side —
  // render the confirmation screen from confirmedOrder before ever checking
  // cart again, so emptying it can't bounce this page back to /cart.
  if (step === 'confirmed' && confirmedOrder) {
    return (
      <main className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Checkout</h1>
        <div className="flex flex-col items-center gap-4 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-8 text-center">
          <CheckCircle2 className="size-12 text-(--color-primary)" aria-hidden />
          <h2 className="font-display text-xl font-semibold text-(--color-foreground)">
            Order confirmed
          </h2>
          <p className="text-sm text-(--color-muted-foreground)">
            Your order total was {formatCurrency(Number(confirmedOrder.total))}.
          </p>
          {isAuthenticated ? (
            <Button onClick={() => router.push(`/orders/${confirmedOrder.id}`)}>View order</Button>
          ) : (
            <>
              <p className="text-xs text-(--color-muted-foreground)">
                Order #{confirmedOrder.orderNumber} — save this to track your order later at{' '}
                <span className="font-medium text-(--color-foreground)">/track-order</span>.
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(
                      `/track-order?orderNumber=${encodeURIComponent(confirmedOrder.orderNumber)}&email=${encodeURIComponent(confirmedOrder.guestEmail ?? '')}`,
                    )
                  }
                >
                  Track this order
                </Button>
                <Button onClick={() => router.push('/')}>Continue shopping</Button>
              </div>
            </>
          )}
        </div>
      </main>
    );
  }

  if (!cart || cart.items.length === 0) {
    router.replace('/cart');
    return null;
  }

  return (
    <main className="container mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />

      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Checkout</h1>

      <ol className="flex items-center gap-2 text-sm text-(--color-muted-foreground)">
            <li className={cn('font-medium', step === 'address' && 'text-(--color-primary)')}>
              1. Delivery address
            </li>
            <li>—</li>
            <li className={cn('font-medium', step === 'payment' && 'text-(--color-primary)')}>
              2. Payment
            </li>
          </ol>

          {step === 'address' ? (
            <div className="flex flex-col gap-4 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
              {!isAuthenticated ? (
                <>
                  <FormField
                    label="Email (for order updates)"
                    type="email"
                    placeholder="you@example.com"
                    value={guestEmail}
                    onChange={(event) => setGuestEmail(event.target.value)}
                  />
                  <AddressForm
                    submitting={setAddressMutation.isPending}
                    onSubmit={(input) =>
                      setAddressMutation.mutate({ ...input, guestEmail: guestEmail || undefined })
                    }
                  />
                </>
              ) : isLoadingAddresses ? (
                <p className="text-center text-(--color-muted-foreground)">Loading addresses…</p>
              ) : showNewAddressForm ? (
                <AddressForm
                  submitting={createAddressMutation.isPending}
                  onSubmit={(input) => createAddressMutation.mutate(input)}
                />
              ) : (
                <>
                  {addresses && addresses.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {addresses.map((address) => (
                        <li key={address.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedAddressId(address.id)}
                            className={cn(
                              'flex w-full cursor-pointer flex-col gap-1 rounded-(--radius-inner) border p-3 text-left transition-colors',
                              selectedAddressId === address.id
                                ? 'border-(--color-primary) bg-(--color-primary)/5'
                                : 'border-(--color-border) hover:border-(--color-primary)',
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <MapPin className="size-4 text-(--color-muted-foreground)" aria-hidden />
                              <span className="text-sm font-medium text-(--color-foreground)">
                                {address.recipientName} — {address.phone}
                              </span>
                            </div>
                            <span className="text-xs text-(--color-muted-foreground)">
                              {[address.line1, address.line2, address.city, address.state, address.postalCode]
                                .filter(Boolean)
                                .join(', ')}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-center text-sm text-(--color-muted-foreground)">
                      No saved addresses yet.
                    </p>
                  )}
                  <Button variant="outline" onClick={() => setShowNewAddressForm(true)}>
                    <Plus className="size-4" aria-hidden />
                    Add a new address
                  </Button>
                  <Button
                    disabled={!selectedAddressId}
                    loading={setAddressMutation.isPending}
                    onClick={() =>
                      selectedAddressId && setAddressMutation.mutate({ savedAddressId: selectedAddressId })
                    }
                  >
                    Deliver to this address
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4">
                <h2 className="text-sm font-semibold text-(--color-foreground)">Order summary</h2>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-(--color-muted-foreground)">
                      Subtotal ({cart.itemCount} {cart.itemCount === 1 ? 'item' : 'items'})
                    </span>
                    <span className="text-(--color-foreground)">{formatCurrency(cart.subtotal)}</span>
                  </div>
                  {cart.discount > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-(--color-muted-foreground)">
                        Discount {cart.couponCode ? `(${cart.couponCode})` : ''}
                      </span>
                      <span className="text-(--color-primary)">-{formatCurrency(cart.discount)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <span className="text-(--color-muted-foreground)">
                      Handling charge
                      {cart.handlingChargeWaived && cart.handlingChargeWaiverReason ? (
                        <span className="ml-1 text-xs text-(--color-primary)">
                          ({cart.handlingChargeWaiverReason})
                        </span>
                      ) : null}
                    </span>
                    <span className="text-(--color-foreground)">
                      {cart.handlingChargeWaived ? (
                        <>
                          <span className="mr-1.5 text-(--color-muted-foreground) line-through">
                            {formatCurrency(cart.handlingChargeOriginalAmount)}
                          </span>
                          Free
                        </>
                      ) : (
                        formatCurrency(cart.handlingCharge)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-(--color-muted-foreground)">Delivery fee</span>
                    <span className="text-(--color-foreground)">
                      {cart.deliveryFee === 0 && cart.deliveryFeeOriginalAmount > 0 ? (
                        <>
                          <span className="mr-1.5 text-(--color-muted-foreground) line-through">
                            {formatCurrency(cart.deliveryFeeOriginalAmount)}
                          </span>
                          Free
                        </>
                      ) : cart.deliveryFee === 0 ? (
                        'Free'
                      ) : (
                        formatCurrency(cart.deliveryFee)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-(--color-border) pt-2 font-semibold text-(--color-foreground)">
                    <span>Total</span>
                    <span>{formatCurrency(cart.total)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep('address')}>
                  Back
                </Button>
                <Button
                  className="flex-1"
                  loading={createPaymentMutation.isPending || verifyPaymentMutation.isPending}
                  onClick={handlePay}
                >
                  Pay {formatCurrency(cart.total)}
                </Button>
              </div>
              {process.env.NODE_ENV !== 'production' ? (
                <Button
                  variant="outline"
                  className="self-start text-xs text-(--color-muted-foreground)"
                  loading={devCompleteMutation.isPending}
                  onClick={handleSkipPayment}
                >
                  Skip payment (dev only)
                </Button>
              ) : null}
            </div>
          )}
    </main>
  );
}
