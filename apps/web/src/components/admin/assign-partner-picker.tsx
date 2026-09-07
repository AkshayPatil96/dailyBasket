'use client';

import { Clock, User } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatRelativeTime } from '@grocery-delivery/utils';
import { adminDeliveriesApi } from '@/lib/admin-deliveries-api';
import { getApiErrorMessage } from '@/lib/api-client';
import { Button } from '@/components/ui/button';

// Shared by the order detail page's "Assign delivery" dialog, the deliveries
// queue's quick-assign popover, and the delivery detail page's
// assign/reassign/retry action — one place for the partner list + assign
// mutation instead of three copies.
export function AssignPartnerPicker({
  deliveryId,
  onAssigned,
}: {
  deliveryId: string;
  onAssigned?: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: partners, isLoading } = useQuery({
    queryKey: ['admin', 'deliveries', 'available-partners'],
    queryFn: adminDeliveriesApi.listAvailablePartners,
  });

  const assignMutation = useMutation({
    mutationFn: (deliveryPartnerId: string) => adminDeliveriesApi.assign(deliveryId, deliveryPartnerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      toast.success('Delivery assigned');
      onAssigned?.();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Could not assign delivery.')),
  });

  if (isLoading) {
    return <p className="text-sm text-(--color-muted-foreground)">Loading…</p>;
  }
  if (!partners || partners.length === 0) {
    return <p className="text-sm text-(--color-muted-foreground)">No partners available right now.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {partners.map((partner) => (
        <div
          key={partner.id}
          className="flex items-center justify-between gap-2 rounded-(--radius-inner) border border-(--color-border) p-2.5"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-(--color-muted)">
              <User className="size-4 text-(--color-muted-foreground)" aria-hidden />
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-(--color-foreground)">
                {partner.user?.firstName} {partner.user?.lastName}
              </span>
              <span className="flex items-center gap-1 text-xs text-(--color-muted-foreground)">
                <Clock className="size-3" aria-hidden />
                {partner.availableSince ? `Idle ${formatRelativeTime(partner.availableSince)}` : 'Just went online'}
              </span>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            loading={assignMutation.isPending && assignMutation.variables === partner.id}
            onClick={() => assignMutation.mutate(partner.id)}
          >
            Assign
          </Button>
        </div>
      ))}
    </div>
  );
}
