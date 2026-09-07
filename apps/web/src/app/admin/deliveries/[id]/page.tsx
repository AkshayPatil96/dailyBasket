import { DeliveryDetail } from './delivery-detail';

export default async function AdminDeliveryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeliveryDetail deliveryId={id} />;
}
