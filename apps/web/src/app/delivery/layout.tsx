import { DeliveryGuard } from '@/components/auth/delivery-guard';
import { DashboardHeader } from '@/components/layout/dashboard-header';

export default function DeliveryLayout({ children }: { children: React.ReactNode }) {
  return (
    <DeliveryGuard>
      <DashboardHeader label="Delivery" />
      <div className="container px-4 py-8 sm:px-6">{children}</div>
    </DeliveryGuard>
  );
}
