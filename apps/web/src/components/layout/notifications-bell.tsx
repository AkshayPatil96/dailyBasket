'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { notificationsApi } from '@/lib/notifications-api';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const notificationsQueryKey = ['notifications', 'list'];

export function NotificationsBell() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: notificationsQueryKey,
    queryFn: () => notificationsApi.list(0, 10),
    // No websocket for this — a light poll keeps it reasonably fresh without
    // prematurely building realtime infra (see delivery-tracking doc).
    refetchInterval: 60_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: notificationsQueryKey });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: invalidate,
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: invalidate,
  });

  const unreadCount = data?.unreadCount ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="relative flex size-9 items-center justify-center rounded-full text-foreground hover:bg-muted"
          >
            <Bell className="size-5" aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
            <span className="sr-only">Notifications</span>
          </button>
        }
      />
      <DropdownMenuContent className="w-80">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <span className="text-sm font-semibold text-foreground">Notifications</span>
          {unreadCount > 0 ? (
            <button
              type="button"
              onClick={() => markAllReadMutation.mutate()}
              className="text-xs font-medium text-primary hover:underline"
            >
              Mark all read
            </button>
          ) : null}
        </div>

        {!data || data.items.length === 0 ? (
          <p className="px-2.5 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
            {data.items.map((notification) => (
              <Link
                key={notification.id}
                href={notification.orderId ? `/orders/${notification.orderId}` : '#'}
                onClick={() => {
                  if (!notification.readAt) {
                    markReadMutation.mutate(notification.id);
                  }
                }}
                className={cn(
                  'flex flex-col gap-0.5 rounded-md px-2.5 py-2 text-sm hover:bg-muted',
                  !notification.readAt && 'bg-primary/5',
                )}
              >
                <span className="font-medium text-foreground">{notification.title}</span>
                <span className="text-xs text-muted-foreground">{notification.message}</span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(notification.createdAt).toLocaleString()}
                </span>
              </Link>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
