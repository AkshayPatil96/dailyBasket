export function formatCurrency(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
}

export function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(isoString));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function toSnakeCase<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((v) => toSnakeCase(v)) as unknown as T;
  }
  if (isPlainObject(obj)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), toSnakeCase(v)])
    ) as T;
  }
  return obj;
}

export function toCamelCase<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map((v) => toCamelCase(v)) as unknown as T;
  }
  if (isPlainObject(obj)) {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), toCamelCase(v)])
    ) as T;
  }
  return obj;
}
