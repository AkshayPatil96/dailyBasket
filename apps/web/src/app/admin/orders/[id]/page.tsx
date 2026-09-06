import { OrderDetail } from './order-detail';

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetail orderId={id} />;
}
