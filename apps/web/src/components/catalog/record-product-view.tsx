'use client';

import { useEffect, useRef } from 'react';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useRecordProductView } from '@/hooks/use-product-views';

// Fire-and-forget view tracking for "Recently viewed" — renders nothing.
// Only records for logged-in users (see ProductView model comment); a
// guest's view just isn't tracked, no silent no-op call needed.
export function RecordProductView({ productId }: { productId: string }) {
  const { isAuthenticated } = useCurrentUser();
  const recordView = useRecordProductView();
  const recordedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || recordedFor.current === productId) return;
    recordedFor.current = productId;
    recordView.mutate(productId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, productId]);

  return null;
}
