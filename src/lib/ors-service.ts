const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || '';
const ORS_BASE = 'https://api.openrouteservice.org/v2';

export interface ORSRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: {
    coordinates: [number, number][];
    type: string;
  };
}

export interface GeocodedLocation {
  lat: number;
  lng: number;
  label: string;
}

/** Forward geocode an address string → coordinates */
export async function geocodeAddress(query: string): Promise<GeocodedLocation[]> {
  const params = new URLSearchParams({
    api_key: ORS_API_KEY,
    text: query,
    'boundary.country': 'KE',
    size: '5',
  });

  const res = await fetch(`https://api.openrouteservice.org/geocode/search?${params}`);
  if (!res.ok) throw new Error('Geocoding failed');
  const data = await res.json();

  return (data.features ?? []).map((f: any) => ({
    lat: f.geometry.coordinates[1],
    lng: f.geometry.coordinates[0],
    label: f.properties.label,
  }));
}

/** Get driving directions between two points */
export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<ORSRoute> {
  const res = await fetch(`${ORS_BASE}/directions/driving-car`, {
    method: 'POST',
    headers: {
      'Authorization': ORS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates: [
        [from.lng, from.lat],
        [to.lng, to.lat],
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? 'Route calculation failed');
  }

  const data = await res.json();
  const route = data.routes[0];

  return {
    distance: route.summary.distance,
    duration: route.summary.duration,
    geometry: {
      type: 'LineString',
      coordinates: decodePolyline(route.geometry),
    },
  };
}

/** Decode ORS-encoded polyline (same as Google's algorithm) */
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

/** Pricing model matching the backend */
export const PRICING = {
  baseFare: 100,
  perKm: 40,
  minimumFare: 150,
};

export function calculateFare(distanceMeters: number, surgeMult = 1.0): number {
  const km = distanceMeters / 1000;
  const raw = PRICING.baseFare + km * PRICING.perKm;
  return Math.round(Math.max(raw, PRICING.minimumFare) * surgeMult);
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(1)} km`;
}