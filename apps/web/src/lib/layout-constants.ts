// Routes where the customer-facing header/footer chrome shouldn't render —
// admin/delivery have their own dashboard chrome, auth pages are standalone.
export const CUSTOMER_CHROME_HIDDEN_PREFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/admin',
  '/delivery',
];
