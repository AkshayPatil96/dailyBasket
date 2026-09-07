"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import type { ProductSummary } from "@grocery-delivery/types";
import { ProductCard } from "@/components/catalog/product-card";
import { cn } from "@/lib/utils";

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export function ProductRail({
  id,
  title,
  subtitle,
  products,
  viewAllHref,
  highlight = false,
}: {
  id?: string;
  title: string;
  subtitle?: string;
  products: ProductSummary[];
  viewAllHref?: string;
  highlight?: boolean;
}) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section
      id={id}
      className={cn(highlight && "bg-(--color-accent)/5 border-y border-(--color-border)")}
    >
      <div className="container px-4 py-10 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold text-(--color-foreground) sm:text-2xl">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-(--color-muted-foreground)">{subtitle}</p>
            ) : null}
          </div>
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="shrink-0 text-sm font-medium text-(--color-primary) hover:underline"
            >
              View all
            </Link>
          ) : null}
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={containerVariants}
          className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
        >
          {products.map((product) => (
            <motion.div key={product.id} className="h-full" variants={itemVariants}>
              <ProductCard product={product} />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
