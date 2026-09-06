// Flat V1 estimate per the cart/checkout architecture docs — a real
// delivery-fee calculation (zone/distance/slot) is explicitly out of scope
// until location-aware delivery is built. Shared so cart and checkout can
// never quote different totals for the same order.
export const DELIVERY_FEE = 40;
