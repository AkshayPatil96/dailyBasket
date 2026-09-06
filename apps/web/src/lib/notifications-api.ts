import { apiClient } from './api-client';

export type NotificationType =
  | 'ORDER_CONFIRMED'
  | 'ORDER_PACKED'
  | 'ORDER_OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED';

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  orderId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationsList {
  items: AppNotification[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  unreadCount: number;
}

export const notificationsApi = {
  list: (offset = 0, limit = 20) =>
    apiClient
      .post<NotificationsList>('/notifications/list', { offset, limit })
      .then((res) => res.data),

  markRead: (id: string) =>
    apiClient.post<{ success: boolean }>(`/notifications/mark-read?id=${id}`).then((res) => res.data),

  markAllRead: () =>
    apiClient.post<{ success: boolean }>('/notifications/mark-all-read').then((res) => res.data),
};
