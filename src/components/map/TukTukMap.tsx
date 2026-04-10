import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const tuktukIcon = new L.DivIcon({
  html: `<div style="font-size:28px;text-shadow:1px 1px 2px rgba(0,0,0,0.3);">🛺</div>`,
  className: 'tuktuk-marker',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const pickupIcon = new L.DivIcon({
  html: `<div style="width:16px;height:16px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  className: 'pickup-marker',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const dropoffIcon = new L.DivIcon({
  html: `<div style="width:16px;height:16px;background:#eab308;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`,
  className: 'dropoff-marker',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Nairobi area TukTuk locations
const availableTukTuks = [
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
  onTukTukSelect?: (tuktuk: typeof availableTukTuks[0]) => void;
}

const FitBounds = ({ pickup, dropoff }: { pickup?: { lat: number; lng: number } | null; dropoff?: { lat: number; lng: number } | null }) => {
  const map = useMap();
  useEffect(() => {
    if (pickup && dropoff) {
      const bounds = L.latLngBounds([pickup, dropoff]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (pickup) {
      map.setView([pickup.lat, pickup.lng], 15);
    }
  }, [pickup, dropoff, map]);
  return null;
};

const TukTukMap = ({ pickup, dropoff, className = '', onTukTukSelect }: TukTukMapProps) => {
  const nairobiCenter: [number, number] = [-1.2821, 36.8219];

  return (
    <div className={`rounded-xl overflow-hidden border-2 border-border ${className}`}>
      <MapContainer
        center={nairobiCenter}
        zoom={13}
        style={{ height: '100%', width: '100%', minHeight: '350px' }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <FitBounds pickup={pickup} dropoff={dropoff} />

        {availableTukTuks.map((tuktuk) => (
          <Marker
            key={tuktuk.id}
            position={[tuktuk.lat, tuktuk.lng]}
            icon={tuktukIcon}
            eventHandlers={{
              click: () => onTukTukSelect?.(tuktuk),
            }}
          >
            <Popup>
              <div className="text-sm font-sans">
                <p className="font-bold text-base">{tuktuk.name}</p>
                <p className="text-gray-600">{tuktuk.vehicle}</p>
                <p className="text-yellow-600 font-semibold">★ {tuktuk.rating}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={pickupIcon}>
            <Popup>📍 Pickup Location</Popup>
          </Marker>
        )}

        {dropoff && (
          <Marker position={[dropoff.lat, dropoff.lng]} icon={dropoffIcon}>
            <Popup>🏁 Dropoff Location</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};

export default TukTukMap;
