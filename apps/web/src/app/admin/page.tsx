import Link from 'next/link';

const SECTIONS = [
  { href: '/admin/categories', label: 'Categories', description: 'Manage the category tree.' },
  {
    href: '/admin/products',
    label: 'Products',
    description: 'Manage products, variants and images.',
  },
];

export default function AdminHomePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold text-(--color-foreground)">
        Admin dashboard
      </h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex flex-col gap-1 rounded-(--radius-outer) border border-(--color-border) bg-(--color-card) p-4 transition-colors hover:border-(--color-primary)"
          >
            <span className="font-medium text-(--color-foreground)">{section.label}</span>
            <span className="text-sm text-(--color-muted-foreground)">{section.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
