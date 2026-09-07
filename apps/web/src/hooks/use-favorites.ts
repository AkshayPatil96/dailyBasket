import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { favoritesApi } from '@/lib/favorites-api';
import { useCurrentUser } from '@/hooks/use-current-user';

const favoriteIdsQueryKey = ['favorites', 'ids'] as const;
const favoritesListQueryKey = ['favorites', 'list'] as const;

// Auth-only, same as the backend — a guest never has favorites, so the
// query stays disabled rather than round-tripping to a 401.
export function useFavoriteIds() {
  const { isAuthenticated } = useCurrentUser();
  const query = useQuery({
    queryKey: favoriteIdsQueryKey,
    queryFn: favoritesApi.ids,
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  return { ids: query.data ?? [], isLoading: query.isLoading };
}

export function useFavoritesList(enabled: boolean) {
  return useQuery({
    queryKey: favoritesListQueryKey,
    queryFn: favoritesApi.list,
    enabled,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, isFavorited }: { productId: string; isFavorited: boolean }) =>
      isFavorited ? favoritesApi.remove(productId) : favoritesApi.add(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoriteIdsQueryKey });
      queryClient.invalidateQueries({ queryKey: favoritesListQueryKey });
    },
  });
}
