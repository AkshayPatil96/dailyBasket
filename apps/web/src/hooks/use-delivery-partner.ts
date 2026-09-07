import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeliveryPartnerAvailability } from '@grocery-delivery/types';
import { deliveryPartnersApi } from '@/lib/delivery-partners-api';

const MY_PROFILE_QUERY_KEY = ['delivery-partners', 'me'] as const;

export function useMyDeliveryPartnerProfile() {
  return useQuery({ queryKey: MY_PROFILE_QUERY_KEY, queryFn: deliveryPartnersApi.me });
}

export function useSetAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (availability: Extract<DeliveryPartnerAvailability, 'OFFLINE' | 'AVAILABLE'>) =>
      deliveryPartnersApi.setAvailability(availability),
    onSuccess: (profile) => queryClient.setQueryData(MY_PROFILE_QUERY_KEY, profile),
  });
}
