import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deliveryApi } from '@/lib/delivery-api';

const ACTIVE_QUERY_KEY = ['delivery', 'my', 'active'] as const;
const HISTORY_QUERY_KEY = ['delivery', 'my', 'history'] as const;

export function useActiveDelivery() {
  return useQuery({
    queryKey: ACTIVE_QUERY_KEY,
    queryFn: deliveryApi.active,
    // While waiting on accept, poll so the countdown/backend expiry (the
    // per-minute cron) shows up here without the partner refreshing —
    // otherwise a delivery that just expired would keep showing as "assigned"
    // with a countdown stuck at 0:00 until they reload.
    refetchInterval: (query) => (query.state.data?.status === 'ASSIGNED' ? 5_000 : false),
  });
}

export function useDeliveryHistory(enabled: boolean) {
  return useQuery({ queryKey: HISTORY_QUERY_KEY, queryFn: deliveryApi.history, enabled });
}

// Every partner action invalidates both the active delivery and (since
// accept/reject/complete all change what counts as "past") history, plus the
// partner's own profile — accepting flips availabilityStatus indirectly via
// admin's assign step already, but reject/complete free them back to AVAILABLE.
function useDeliveryAction<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-partners', 'me'] });
    },
  });
}

export function useAcceptDelivery() {
  return useDeliveryAction(deliveryApi.accept);
}

export function useRejectDelivery() {
  return useDeliveryAction(deliveryApi.reject);
}

export function usePickupDelivery() {
  return useDeliveryAction(deliveryApi.pickup);
}

export function useStartDelivery() {
  return useDeliveryAction(deliveryApi.start);
}

export function useCompleteDelivery() {
  return useDeliveryAction(({ deliveryId, otpCode }: { deliveryId: string; otpCode: string }) =>
    deliveryApi.complete(deliveryId, otpCode),
  );
}
