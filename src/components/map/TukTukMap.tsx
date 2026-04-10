import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const tuktukIcon = L.divIcon({
  html: `<div style="font-size:28px;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">🛺</div>`,
  className: 'tuktuk-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const pickupIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const dropoffIcon = L.divIcon({
  html: `<div style="width:16px;height:16px;background:#eab308;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export interface TukTukDriver {
  id: number;
  name: string;
  lat: number;
  lng: number;
  rating: number;
  vehicle: string;
}

// Nairobi area TukTuk locations
export const availableTukTuks: TukTukDriver[] = [
  { id: 1, name: 'James O.', lat: -1.2721, lng: 36.8110, rating: 4.8, vehicle: 'Bajaj RE' },
  { id: 2, name: 'Mary W.', lat: -1.2890, lng: 36.7830, rating: 4.9, vehicle: 'Piaggio Ape' },
  { id: 3, name: 'Peter K.', lat: -1.2634, lng: 36.8025, rating: 4.5, vehicle: 'TVS King' },
  { id: 4, name: 'Grace M.', lat: -1.2800, lng: 36.8200, rating: 4.7, vehicle: 'Bajaj RE' },
  { id: 5, name: 'David N.', lat: -1.2950, lng: 36.7950, rating: 4.6, vehicle: 'TVS King' },
];

interface TukTukMapProps {
  pickup?: { lat: number; lng: number } | null;
  dropoff?: { lat: number; lng: number } | null;
  className?: string;
  showTukTuks?: boolean;
  showRoute?: boolean;
  orderMarkers?: Array<{ id: string; pickup: { lat: number; lng: number }; dropoff: { lat: number; lng: number }; label: string }>;
  onTukTukSelect?: (tuktuk: TukTukDriver) => void;
}

const TukTukMap = ({ pickup, dropoff, className = '', showTukTuks = true, showRoute = false, orderMarkers, onTukTukSelect }: TukTukMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([-1.2821, 36.8219], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapInstanceRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markers = markersRef.current;
    if (!map || !markers) return;

    markers.clearLayers();

    // TukTuk markers
    if (showTukTuks) {
      availableTukTuks.forEach((tuktuk) => {
        const marker = L.marker([tuktuk.lat, tuktuk.lng], { icon: tuktukIcon })
          .bindPopup(`<div style="font-family:sans-serif"><b>${tuktuk.name}</b><br/>${tuktuk.vehicle}<br/><span style="color:#eab308">★ ${tuktuk.rating}</span></div>`);
        if (onTukTukSelect) {
          marker.on('click', () => onTukTukSelect(tuktuk));
        }
        markers.addLayer(marker);
      });
    }

    // Order markers (for driver dashboard)
    if (orderMarkers) {
      orderMarkers.forEach((order) => {
        L.marker([order.pickup.lat, order.pickup.lng], { icon: pickupIcon })
          .bindPopup(`📍 Pickup: ${order.label}`)
          .addTo(markers);
        L.marker([order.dropoff.lat, order.dropoff.lng], { icon: dropoffIcon })
          .bindPopup(`🏁 Dropoff: ${order.label}`)
          .addTo(markers);
      });
    }

    // Pickup/dropoff markers
    if (pickup) {
      L.marker([pickup.lat, pickup.lng], { icon: pickupIcon })
        .bindPopup('📍 Pickup Location')
        .addTo(markers);
    }
    if (dropoff) {
      L.marker([dropoff.lat, dropoff.lng], { icon: dropoffIcon })
        .bindPopup('🏁 Dropoff Location')
        .addTo(markers);
    }

    // Route line
    if (routeRef.current) {
      routeRef.current.remove();
      routeRef.current = null;
    }
    if (showRoute && pickup && dropoff) {
      // Simulate a route with intermediate points
      const midLat = (pickup.lat + dropoff.lat) / 2 + (Math.random() - 0.5) * 0.01;
      const midLng = (pickup.lng + dropoff.lng) / 2 + (Math.random() - 0.5) * 0.01;
      routeRef.current = L.polyline(
        [[pickup.lat, pickup.lng], [midLat, midLng], [dropoff.lat, dropoff.lng]],
        { color: '#16a34a', weight: 4, opacity: 0.8, dashArray: '10, 10' }
      ).addTo(map);
    }

    // Fit bounds
    const allPoints: L.LatLngExpression[] = [];
    if (pickup) allPoints.push([pickup.lat, pickup.lng]);
    if (dropoff) allPoints.push([dropoff.lat, dropoff.lng]);
    if (showTukTuks) availableTukTuks.forEach(t => allPoints.push([t.lat, t.lng]));
    if (orderMarkers) orderMarkers.forEach(o => { allPoints.push([o.pickup.lat, o.pickup.lng]); allPoints.push([o.dropoff.lat, o.dropoff.lng]); });

    if (allPoints.length > 1) {
      map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40] });
    }
  }, [pickup, dropoff, showTukTuks, showRoute, orderMarkers, onTukTukSelect]);

  return (
    <div className={`rounded-xl overflow-hidden border-2 border-border ${className}`}>
      <div ref={mapRef} style={{ height: '100%', width: '100%', minHeight: '350px' }} />
    </div>
  );
};

export default TukTukMap;
