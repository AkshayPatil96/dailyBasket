import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { authApi } from '@/lib/api-client';

export const currentUserQueryKey = ['auth', 'me'] as const;

export function useCurrentUser() {
  const query = useQuery({
    queryKey: currentUserQueryKey,
    queryFn: authApi.me,
    retry: false,
    staleTime: 60_000,
  });

  return {
    user: query.data,
    isLoading: query.isLoading,
    isAuthenticated: query.isSuccess,
    refetch: query.refetch,
  };
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      queryClient.setQueryData(currentUserQueryKey, undefined);
      queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
    },
  });
}
