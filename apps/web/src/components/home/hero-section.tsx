"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Photo: Randy Fath, via Unsplash (images.unsplash.com already allow-listed in
// next.config.ts for placeholder/dev imagery) — free to use under the Unsplash License.
const HERO_IMAGE_URL =
  "https://images.unsplash.com/photo-1597362925123-77861d3fbac7?fm=jpg&q=80&w=2400&auto=format&fit=crop";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden border-b border-(--color-border) bg-(--color-muted)/40">
      <Image
        src={HERO_IMAGE_URL}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      {/* Scrim uses the current theme's background token, so it blends correctly
          in both light and dark mode without needing separate text colors. */}
      <div className="absolute inset-0 bg-gradient-to-r from-(--color-background) via-(--color-background)/85 to-(--color-background)/40" />

      <div className="relative flex container flex-col items-start gap-5 px-4 py-16 sm:px-6 sm:py-24">
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="rounded-full bg-(--color-primary)/10 px-3 py-1 text-xs font-medium text-(--color-primary)"
        >
          Delivered in as fast as 20 minutes
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.08, ease: "easeOut" }}
          className="font-display text-3xl font-bold text-(--color-foreground) sm:text-5xl"
        >
          Fresh groceries, delivered to your door.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.16, ease: "easeOut" }}
          className="max-w-md text-(--color-muted-foreground) sm:text-lg"
        >
          Everything you need, in one place — fruits, dairy, bakery, and pantry
          staples, picked fresh and delivered fast.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.24, ease: "easeOut" }}
        >
          <Link
            href="#shop-by-category"
            className={cn(buttonVariants({ size: "lg" }), "gap-1.5")}
          >
            Shop now
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
