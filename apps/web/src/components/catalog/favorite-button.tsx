'use client';

import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFavoriteIds, useToggleFavorite } from '@/hooks/use-favorites';
import { getApiErrorMessage } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function FavoriteButton({ productId, className }: { productId: string; className?: string }) {
  const { isAuthenticated } = useCurrentUser();
  const { ids } = useFavoriteIds();
  const toggle = useToggleFavorite();
  const isFavorited = ids.includes(productId);

  const handleClick = () => {
    if (!isAuthenticated) {
      toast('Sign in to save favorites', {
        description: 'Create an account to keep track of products you like.',
      });
      return;
    }
    toggle.mutate(
      { productId, isFavorited },
      { onError: (error) => toast.error(getApiErrorMessage(error, 'Could not update favorites.')) },
    );
  };

  return (
    <button
      type="button"
      disabled={toggle.isPending}
      onClick={handleClick}
      aria-pressed={isFavorited}
      className={cn(
        'flex size-9 items-center justify-center rounded-full border border-(--color-border) bg-(--color-card) text-(--color-muted-foreground) transition-colors hover:text-(--color-destructive) disabled:opacity-50',
        isFavorited && 'border-(--color-destructive) text-(--color-destructive)',
        className,
      )}
    >
      <Heart className={cn('size-4', isFavorited && 'fill-current')} aria-hidden />
      <span className="sr-only">{isFavorited ? 'Remove from favorites' : 'Save to favorites'}</span>
    </button>
  );
}
