import { Heart } from 'lucide-react';

// Placeholder — there's no wishlist backend yet (no WishlistItem model, no
// add/remove/move-to-cart endpoints). Per grocery-delivery-customer-features.md
// §17, wishlist is explicitly portfolio-level, not MVP-required. This page
// exists so the nav entry isn't a dead link; building the real feature is
// separate work.
export default function WishlistPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">Wishlist</h1>
      <div className="flex flex-col items-center gap-2 rounded-(--radius-outer) border border-dashed border-(--color-border) py-16 text-center">
        <Heart className="size-8 text-(--color-muted-foreground)" aria-hidden />
        <p className="text-(--color-muted-foreground)">Wishlist is coming soon.</p>
      </div>
    </div>
  );
}
