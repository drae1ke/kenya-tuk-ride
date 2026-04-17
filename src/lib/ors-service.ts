// ─── Geocoding via Nominatim (OpenStreetMap) ─────────────────────────────────
// Full Kenya coverage, free, no API key needed.

const ORS_API_KEY = import.meta.env.VITE_ORS_API_KEY || '';
const ORS_BASE = 'https://api.openrouteservice.org/v2';
const NOMINATIM = 'https://nominatim.openstreetmap.org';

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

// ── Nominatim geocode (replaces ORS geocode — better Kenya coverage) ──────────
export async function geocodeAddress(query: string): Promise<GeocodedLocation[]> {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    limit: '7',
    countrycodes: 'ke',
    addressdetails: '1',
    'accept-language': 'en',
  });

  const res = await fetch(`${NOMINATIM}/search?${params}`, {
    headers: { 'User-Agent': 'TookRide/1.0 (tookride.co.ke)' },
  });

  if (!res.ok) throw new Error('Geocoding failed');
  const data: any[] = await res.json();

  return data.map((f) => {
    // Build a clean label: "Area, Sub-county, County"
    const a = f.address || {};
    const parts = [
      a.neighbourhood || a.suburb || a.village || a.town || a.road,
      a.city_district || a.county,
      a.state || 'Kenya',
    ].filter(Boolean);
    const label = parts.length > 0 ? parts.join(', ') : f.display_name.split(',').slice(0, 3).join(',');

    return {
      lat: parseFloat(f.lat),
      lng: parseFloat(f.lon),
      label,
    };
  });
}

// ── Reverse geocode coords → human address ─────────────────────────────────
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const params = new URLSearchParams({
    lat: lat.toString(),
    lon: lng.toString(),
    format: 'json',
    'accept-language': 'en',
  });

  const res = await fetch(`${NOMINATIM}/reverse?${params}`, {
    headers: { 'User-Agent': 'TookRide/1.0 (tookride.co.ke)' },
  });

  if (!res.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const data = await res.json();
  const a = data.address || {};
  const parts = [
    a.neighbourhood || a.suburb || a.village || a.town || a.road,
    a.city_district || a.county,
  ].filter(Boolean);
  return parts.join(', ') || data.display_name?.split(',').slice(0, 2).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

// ── ORS Directions (driving route between two points) ─────────────────────
export async function getRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<ORSRoute> {
  // Try ORS first (more accurate)
  if (ORS_API_KEY) {
    try {
      const res = await fetch(`${ORS_BASE}/directions/driving-car`, {
        method: 'POST',
        headers: {
          Authorization: ORS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        }),
      });

      if (res.ok) {
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
    } catch {
      // fall through to OSRM
    }
  }

  // Fallback: OSRM (free, open source routing)
  return getRouteOSRM(from, to);
}

// ── OSRM fallback routing ──────────────────────────────────────────────────
async function getRouteOSRM(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<ORSRoute> {
  const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Route calculation failed');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No route found');

  const r = data.routes[0];
  return {
    distance: r.distance,
    duration: r.duration,
    geometry: {
      type: 'LineString',
      coordinates: r.geometry.coordinates as [number, number][],
    },
  };
}

// ── Decode ORS polyline ────────────────────────────────────────────────────
function decodePolyline(encoded: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number, shift = 0, result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0; result = 0;
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / 1e5, lat / 1e5]);
  }
  return coords;
}

// ── Pricing ────────────────────────────────────────────────────────────────
export const PRICING = { baseFare: 100, perKm: 40, minimumFare: 150 };

export function calculateFare(distanceMeters: number, surgeMult = 1.0): number {
  const km = distanceMeters / 1000;
  return Math.round(Math.max(PRICING.baseFare + km * PRICING.perKm, PRICING.minimumFare) * surgeMult);
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function formatDistance(meters: number): string {
  const km = meters / 1000;
  return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(1)} km`;
}