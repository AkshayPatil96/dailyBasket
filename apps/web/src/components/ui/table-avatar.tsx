import Image from 'next/image';
import { Package } from 'lucide-react';

// Same round-thumbnail-with-Package-icon-fallback convention as ProductCard/CategoryGrid.
export function TableAvatar({ src, alt }: { src?: string | null; alt: string }) {
  return (
    <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--color-muted)">
      {src ? (
        <Image src={src} alt={alt} fill sizes="36px" className="object-cover" />
      ) : (
        <Package className="size-4 text-(--color-muted-foreground)" aria-hidden />
      )}
    </span>
  );
}
