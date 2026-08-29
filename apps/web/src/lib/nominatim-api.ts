// Free OpenStreetMap geocoding — no API key, no billing account.
// Usage policy: max ~1 req/sec, must identify the app (no default browser UA spoofing needed
// for fetch, but a Referer is sent automatically by the browser which satisfies the policy).
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

export interface CityResult {
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  displayName: string;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
}

export async function searchCity(query: string): Promise<CityResult[]> {
  if (!query.trim()) return [];

  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    addressdetails: "1",
    limit: "5",
    countrycodes: "in",
  });

  const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`);
  if (!res.ok) return [];

  const data = (await res.json()) as NominatimResult[];
  return data.map((result) => ({
    city:
      result.address?.city ??
      result.address?.town ??
      result.address?.village ??
      "",
    state: result.address?.state ?? "",
    country: result.address?.country ?? "India",
    postalCode: result.address?.postcode ?? "",
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    displayName: result.display_name,
  }));
}
