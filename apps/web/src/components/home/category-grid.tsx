"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Package } from "lucide-react";
import type { CategoryTreeNode } from "@grocery-delivery/types";

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
};

export function CategoryGrid({
  categories,
}: {
  categories: CategoryTreeNode[];
}) {
  if (categories.length === 0) {
    return null;
  }

  return (
    <section
      id="shop-by-category"
      className="container px-4 py-10 sm:px-6"
    >
      <h2 className="font-display text-xl font-semibold text-foreground sm:text-2xl">
        Shop by Category
      </h2>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={containerVariants}
        className="mt-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8"
      >
        {categories.map((category) => (
          <motion.div
            key={category.id}
            variants={itemVariants}
            whileHover={{ y: -3 }}
          >
            <Link
              href={`/category/${category.slug}`}
              className="group flex flex-col items-center gap-2 text-center"
            >
              <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-primary/8 transition-colors group-hover:bg-primary/14">
                {category.imageUrl ? (
                  <Image
                    src={category.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1280px) 12vw, (min-width: 768px) 16vw, (min-width: 640px) 22vw, 28vw"
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <Package
                      className="size-7 text-primary/60"
                      aria-hidden
                    />
                  </div>
                )}
              </div>
              <span className="line-clamp-2 text-xs font-semibold text-foreground sm:text-sm">
                {category.name}
              </span>
            </Link>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
