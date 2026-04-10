import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockOrders } from '@/lib/mock-data';
import {
  MapPin, Navigation, CreditCard, Banknote, Star, Map,
  LocateFixed, Loader2, ChevronRight, X, Phone, CheckCircle,
  Zap, TrendingUp, Car, History, AlertCircle, RefreshCw, Timer,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  geocodeAddress, getRoute, calculateFare, formatDuration, formatDistance,
  type GeocodedLocation, type ORSRoute,
} from '@/lib/ors-service';
import {
  connectSocket, getSocket, emitRideRequest, emitCancelRide,
  type RideRequestedEvent, type RideAcceptedEvent, type LocationUpdateEvent,
} from '@/lib/socket-service';
import { useAuth } from '@/lib/auth-context';

// ── Leaflet icon fix ──────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const pickupIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
  className: '', iconSize: [14, 14], iconAnchor: [7, 7],
});
const dropoffIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;background:#eab308;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
  className: '', iconSize: [14, 14], iconAnchor: [7, 7],
});
const driverIcon = L.divIcon({
  html: `<div style="font-size:26px;line-height:1;">🛺</div>`,
  className: '', iconSize: [28, 28], iconAnchor: [14, 14],
});

// ── Saved quick-pick locations ───────────────────────────────────────────────
const SAVED_LOCATIONS = [
  { label: 'Home', address: 'Kilimani, Nairobi, Kenya', icon: '🏠' },
  { label: 'Work', address: 'Upper Hill, Nairobi, Kenya', icon: '🏢' },
  { label: 'Westlands', address: 'Westlands Mall, Nairobi, Kenya', icon: '🛍️' },
  { label: 'Karen', address: 'Karen, Nairobi, Kenya', icon: '🌳' },
];

type BookingState = 'idle' | 'geocoding' | 'routing' | 'searching' | 'driver-found' | 'mpesa-pending' | 'in-progress';

interface FoundDriver {
  id: string;
  name: string;
  vehicle: string;
  plate: string;
  rating: number;
  eta: string;
  phone: string;
  location?: { lat: number; lng: number };
}

const statusColor = (s: string) => {
  switch (s) {
    case 'completed': return 'bg-primary/10 text-primary border-primary/20';
    case 'pending': return 'bg-secondary/20 text-secondary-foreground border-secondary/30';
    case 'in_progress': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return '';
  }
};

// ── Geocode suggestion dropdown ───────────────────────────────────────────────
function AddressInput({
  label, value, onChange, onSelect, placeholder, dotColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onSelect: (loc: GeocodedLocation) => void;
  placeholder: string;
  dotColor: string;
}) {
  const [suggestions, setSuggestions] = useState<GeocodedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleChange = (v: string) => {
    onChange(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (v.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await geocodeAddress(v + ', Kenya');
        setSuggestions(results.slice(0, 5));
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="space-y-1.5 relative">
      <Label className="text-xs font-medium flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        {label}
      </Label>
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={e => handleChange(e.target.value)}
          className="h-10 pr-8"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 w-full mt-1 rounded-xl border bg-card shadow-xl overflow-hidden"
          >
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors flex items-start gap-2 border-b last:border-0"
                onClick={() => { onSelect(s); onChange(s.label); setSuggestions([]); }}
              >
                <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
                <span className="line-clamp-2 leading-snug">{s.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  // form
  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickupCoords, setPickupCoords] = useState<GeocodedLocation | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<GeocodedLocation | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash'>('mpesa');
  const [gettingLocation, setGettingLocation] = useState(false);

  // route
  const [route, setRoute] = useState<ORSRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  // booking
  const [bookingState, setBookingState] = useState<BookingState>('idle');
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [foundDriver, setFoundDriver] = useState<FoundDriver | null>(null);
  const [mpesaTimer, setMpesaTimer] = useState(60);
  const mpesaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // map
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  const TOKEN_STORAGE_KEY = 'tookride.auth.token';

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;

    const socket = connectSocket(token);

    socket.on('ride:requested', (data: RideRequestedEvent) => {
      setCurrentRideId(data.rideId);
      setBookingState('searching');
      toast({ title: '🔍 Looking for drivers...', description: `Estimated fare: KES ${data.fare}` });
    });

    socket.on('ride:accepted', (data: RideAcceptedEvent) => {
      const d = data.driver;
      const loc = data.driverLocation?.coordinates;
      setFoundDriver({
        id: d.id,
        name: d.name,
        phone: d.phone,
        rating: d.rating,
        vehicle: `${d.vehicle?.make ?? ''} ${d.vehicle?.model ?? ''}`.trim() || 'TukTuk',
        plate: d.vehicle?.plateNumber ?? '',
        eta: data.eta,
        location: loc ? { lat: loc[1], lng: loc[0] } : undefined,
      });
      setBookingState('driver-found');
      toast({ title: `🛺 Driver found: ${d.name}`, description: `ETA ${data.eta}` });
    });

    socket.on('ride:location-update', (data: LocationUpdateEvent) => {
      if (data.location && mapInstanceRef.current && layersRef.current) {
        updateDriverMarker(data.location.latitude, data.location.longitude);
      }
    });

    socket.on('ride:completed', () => {
      toast({ title: '✅ Ride completed!', description: 'Thank you for riding with TookRide' });
      handleCancelBooking();
    });

    socket.on('ride:cancelled', (data: { reason: string; cancelledBy: string }) => {
      toast({
        title: 'Ride cancelled',
        description: `Cancelled by ${data.cancelledBy}: ${data.reason}`,
        variant: 'destructive',
      });
      handleCancelBooking();
    });

    socket.on('ride:error', (data: { message: string }) => {
      toast({ title: 'Ride error', description: data.message, variant: 'destructive' });
      setBookingState('idle');
    });

    return () => {
      socket.off('ride:requested');
      socket.off('ride:accepted');
      socket.off('ride:location-update');
      socket.off('ride:completed');
      socket.off('ride:cancelled');
      socket.off('ride:error');
    };
  }, []);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current).setView([-1.2821, 36.8219], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    mapInstanceRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // ── Draw route on map ────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    layers.clearLayers();

    if (pickupCoords) {
      L.marker([pickupCoords.lat, pickupCoords.lng], { icon: pickupIcon })
        .bindPopup('📍 Pickup').addTo(layers);
    }
    if (dropoffCoords) {
      L.marker([dropoffCoords.lat, dropoffCoords.lng], { icon: dropoffIcon })
        .bindPopup('🏁 Dropoff').addTo(layers);
    }
    if (route?.geometry?.coordinates?.length) {
      const latlngs: [number, number][] = route.geometry.coordinates.map(
        ([lng, lat]) => [lat, lng]
      );
      L.polyline(latlngs, { color: '#16a34a', weight: 4, opacity: 0.8, dashArray: '8,4' }).addTo(layers);

      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else if (pickupCoords && dropoffCoords) {
      map.fitBounds(
        L.latLngBounds([
          [pickupCoords.lat, pickupCoords.lng],
          [dropoffCoords.lat, dropoffCoords.lng],
        ]),
        { padding: [40, 40] }
      );
    }
  }, [pickupCoords, dropoffCoords, route]);

  const updateDriverMarker = (lat: number, lng: number) => {
    const layers = layersRef.current;
    if (!layers) return;
    // remove old driver marker and re-add
    layers.eachLayer((l: any) => { if (l.options?.icon === driverIcon) layers.removeLayer(l); });
    L.marker([lat, lng], { icon: driverIcon }).addTo(layers);
  };

  // ── Fetch route whenever both coords are set ─────────────────────────────────
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) { setRoute(null); setRouteError(null); return; }
    setBookingState('routing');
    setRouteError(null);
    getRoute(pickupCoords, dropoffCoords)
      .then(r => { setRoute(r); setBookingState('idle'); })
      .catch(e => {
        setRouteError(e.message);
        setBookingState('idle');
        toast({ title: 'Route error', description: e.message, variant: 'destructive' });
      });
  }, [pickupCoords, dropoffCoords]);

  // ── M-Pesa countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (bookingState === 'mpesa-pending') {
      setMpesaTimer(60);
      mpesaIntervalRef.current = setInterval(() => {
        setMpesaTimer(t => { if (t <= 1) { clearInterval(mpesaIntervalRef.current!); return 0; } return t - 1; });
      }, 1000);
    }
    return () => { if (mpesaIntervalRef.current) clearInterval(mpesaIntervalRef.current); };
  }, [bookingState]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
          .then(r => r.json())
          .then(data => {
            const label = data.display_name?.split(',').slice(0, 3).join(',') ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            setPickupText(label);
            setPickupCoords({ lat, lng, label });
            toast({ title: '📍 Location found', description: label });
          })
          .catch(() => {
            const label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            setPickupText(label);
            setPickupCoords({ lat, lng, label });
          })
          .finally(() => setGettingLocation(false));
      },
      () => { setGettingLocation(false); toast({ title: 'Location denied', variant: 'destructive' }); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleBookRide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupCoords || !dropoffCoords || !route) {
      toast({ title: 'Missing info', description: 'Please select pickup and dropoff from the suggestions', variant: 'destructive' });
      return;
    }

    const socket = getSocket();
    if (socket?.connected) {
      // Real-time via socket
      emitRideRequest({
        pickup: { latitude: pickupCoords.lat, longitude: pickupCoords.lng, address: pickupCoords.label },
        destination: { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, address: dropoffCoords.label },
        paymentMethod,
      });
      setBookingState('searching');
    } else {
      // Fallback: REST API
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/rides/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pickup: { latitude: pickupCoords.lat, longitude: pickupCoords.lng, address: pickupCoords.label },
          destination: { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, address: dropoffCoords.label },
          paymentMethod,
        }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.status === 'success') {
            setCurrentRideId(data.data.ride.id);
            setBookingState('searching');
            toast({ title: '🔍 Searching for drivers...', description: `Fare: KES ${data.data.ride.fare}` });
          } else {
            throw new Error(data.message);
          }
        })
        .catch(err => toast({ title: 'Booking failed', description: err.message, variant: 'destructive' }));
    }
  };

  const handleConfirmRide = () => {
    if (paymentMethod === 'mpesa') {
      setBookingState('mpesa-pending');
    } else {
      setBookingState('in-progress');
      toast({ title: '🛺 Ride confirmed!', description: 'Driver is on the way' });
    }
  };

  const handleMpesaSuccess = () => {
    if (mpesaIntervalRef.current) clearInterval(mpesaIntervalRef.current);
    setBookingState('in-progress');
    toast({ title: '✅ Payment confirmed!', description: 'Driver is on the way' });
  };

  const handleCancelBooking = useCallback(() => {
    if (currentRideId && (bookingState === 'searching' || bookingState === 'driver-found' || bookingState === 'in-progress')) {
      emitCancelRide(currentRideId, 'Cancelled by user');
    }
    if (mpesaIntervalRef.current) clearInterval(mpesaIntervalRef.current);
    setBookingState('idle');
    setFoundDriver(null);
    setCurrentRideId(null);
    setPickupText(''); setDropoffText('');
    setPickupCoords(null); setDropoffCoords(null);
    setRoute(null);
  }, [currentRideId, bookingState]);

  const fare = route ? calculateFare(route.distance) : 0;
  const canBook = !!pickupCoords && !!dropoffCoords && !!route && bookingState === 'idle';

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="Book a Ride" subtitle="Find a TukTuk near you in Nairobi">
      <div className="grid gap-6 lg:grid-cols-5">

        {/* ── LEFT: Form / States ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* IDLE FORM */}
          <AnimatePresence mode="wait">
            {bookingState === 'idle' || bookingState === 'routing' ? (
              <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card className="border-2 shadow-lg">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Navigation className="w-4 h-4 text-primary" />
                      </div>
                      <span className="font-display font-bold text-base">New Ride</span>
                      {bookingState === 'routing' && (
                        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Calculating route...
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={handleBookRide} className="space-y-4">

                      {/* Pickup */}
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <AddressInput
                              label="Pickup Location"
                              value={pickupText}
                              onChange={setPickupText}
                              onSelect={loc => { setPickupCoords(loc); setPickupText(loc.label); }}
                              placeholder="e.g. Westlands, Nairobi"
                              dotColor="bg-primary"
                            />
                          </div>
                          <div className="mt-6 flex-shrink-0">
                            <Button
                              type="button" variant="outline" size="icon"
                              className="h-10 w-10"
                              onClick={handleUseMyLocation}
                              disabled={gettingLocation}
                            >
                              {gettingLocation
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <LocateFixed className="w-4 h-4 text-primary" />}
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {SAVED_LOCATIONS.map(loc => (
                            <button key={loc.label} type="button"
                              onClick={() => { setPickupText(loc.address); geocodeAddress(loc.address).then(r => r[0] && setPickupCoords(r[0])); }}
                              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border bg-muted/50 hover:bg-muted hover:border-primary/40 transition-colors">
                              <span>{loc.icon}</span><span>{loc.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dropoff */}
                      <div className="space-y-2">
                        <AddressInput
                          label="Dropoff Location"
                          value={dropoffText}
                          onChange={setDropoffText}
                          onSelect={loc => { setDropoffCoords(loc); setDropoffText(loc.label); }}
                          placeholder="e.g. CBD, Nairobi"
                          dotColor="bg-secondary"
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {SAVED_LOCATIONS.map(loc => (
                            <button key={loc.label} type="button"
                              onClick={() => { setDropoffText(loc.address); geocodeAddress(loc.address).then(r => r[0] && setDropoffCoords(r[0])); }}
                              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border bg-muted/50 hover:bg-muted hover:border-secondary/40 transition-colors">
                              <span>{loc.icon}</span><span>{loc.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Route summary / fare */}
                      <AnimatePresence>
                        {route && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }} className="overflow-hidden"
                          >
                            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Estimated fare</span>
                                <span className="font-display font-bold text-2xl text-primary">KES {fare}</span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{formatDistance(route.distance)}</span>
                                <span>·</span>
                                <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{formatDuration(route.duration)}</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground/70">Powered by OpenRouteService · final fare may vary</p>
                            </div>
                          </motion.div>
                        )}
                        {routeError && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-destructive">Could not calculate route</p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{routeError}</p>
                              <button type="button" onClick={() => pickupCoords && dropoffCoords && getRoute(pickupCoords, dropoffCoords).then(setRoute).catch(() => {})}
                                className="text-[11px] text-primary underline mt-1 flex items-center gap-1">
                                <RefreshCw className="w-3 h-3" />Retry
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Payment */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Payment Method</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'mpesa', label: 'M-Pesa', icon: <CreditCard className="w-4 h-4" />, sub: 'Pay with phone' },
                            { id: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" />, sub: 'Pay driver' },
                          ].map(m => (
                            <button key={m.id} type="button"
                              onClick={() => setPaymentMethod(m.id as 'mpesa' | 'cash')}
                              className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${paymentMethod === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}>
                              <span className={paymentMethod === m.id ? 'text-primary' : 'text-muted-foreground'}>{m.icon}</span>
                              <div>
                                <p className="font-semibold text-sm leading-none">{m.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button
                        type="submit" variant="hero"
                        className="w-full h-11 gap-2 font-semibold"
                        disabled={!canBook}
                      >
                        {bookingState === 'routing'
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Calculating route...</>
                          : <><Zap className="w-4 h-4" />Request TukTuk<ChevronRight className="w-4 h-4 ml-auto" /></>}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>

            ) : bookingState === 'searching' ? (
              <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="border-2 border-primary/20">
                  <CardContent className="py-12 flex flex-col items-center gap-4 text-center">
                    <div className="relative w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-4 border-primary/20 animate-ping" />
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                        <Car className="w-7 h-7 text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="font-display font-bold text-lg">Finding your TukTuk...</p>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{pickupText} → {dropoffText}</p>
                      {route && <p className="text-xs text-primary font-semibold mt-1.5">KES {fare} · {formatDistance(route.distance)}</p>}
                    </div>
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                    <Button variant="outline" size="sm" onClick={handleCancelBooking} className="gap-1.5">
                      <X className="w-3.5 h-3.5" />Cancel
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

            ) : bookingState === 'driver-found' && foundDriver ? (
              <motion.div key="found" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <Card className="border-2 border-primary/30 overflow-hidden shadow-lg">
                  <div className="bg-primary px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-primary-foreground" />
                      <span className="font-display font-bold text-primary-foreground text-sm">Driver found!</span>
                    </div>
                    <Badge className="bg-white/20 text-primary-foreground border-0 text-xs">ETA {foundDriver.eta}</Badge>
                  </div>
                  <CardContent className="pt-5 space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-display font-bold text-primary text-lg flex-shrink-0">
                        {foundDriver.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{foundDriver.name}</p>
                        <p className="text-xs text-muted-foreground">{foundDriver.vehicle} · {foundDriver.plate}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <Star className="w-3 h-3 text-secondary fill-secondary" />
                          <span className="text-xs font-medium">{foundDriver.rating}</span>
                        </div>
                      </div>
                      <a href={`tel:${foundDriver.phone}`} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Phone className="w-4 h-4 text-primary" />
                      </a>
                    </div>

                    <div className="rounded-xl border p-3 space-y-2">
                      <div className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center mt-0.5 flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                        <div><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm line-clamp-1">{pickupText}</p></div>
                      </div>
                      <div className="ml-2 w-px h-3 bg-border" />
                      <div className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center mt-0.5 flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-secondary-foreground/80" />
                        </div>
                        <div><p className="text-xs text-muted-foreground">Dropoff</p><p className="text-sm line-clamp-1">{dropoffText}</p></div>
                      </div>
                    </div>

                    {route && (
                      <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Total fare</p>
                          <p className="font-display font-bold text-2xl text-primary">KES {fare}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDistance(route.distance)} · {formatDuration(route.duration)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Payment</p>
                          <p className="font-semibold text-sm capitalize flex items-center gap-1.5">
                            {paymentMethod === 'mpesa' ? <><CreditCard className="w-3.5 h-3.5" />M-Pesa</> : <><Banknote className="w-3.5 h-3.5" />Cash</>}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="hero" className="flex-1 h-11" onClick={handleConfirmRide}>Confirm Ride</Button>
                      <Button variant="outline" className="h-11 px-3" onClick={handleCancelBooking}><X className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

            ) : bookingState === 'mpesa-pending' ? (
              <motion.div key="mpesa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="border-2 border-green-600/30 overflow-hidden">
                  <div className="bg-green-600 px-5 py-3">
                    <p className="font-display font-bold text-white text-sm">M-Pesa Payment</p>
                  </div>
                  <CardContent className="py-6 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-50 border-4 border-green-600/20 flex items-center justify-center">
                      <Phone className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-lg">Check your phone</p>
                      <p className="text-sm text-muted-foreground mt-1">STK push sent — enter your M-Pesa PIN</p>
                    </div>
                    <div className="w-full rounded-xl bg-green-50 border border-green-200 p-4">
                      <p className="text-xs text-muted-foreground">Amount to pay</p>
                      <p className="font-display font-bold text-3xl text-green-700">KES {fare}</p>
                    </div>
                    <div className="w-full">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Expires in</span>
                        <span className={mpesaTimer < 15 ? 'text-destructive font-semibold' : ''}>{mpesaTimer}s</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div className="h-full bg-green-600 rounded-full"
                          animate={{ width: `${(mpesaTimer / 60) * 100}%` }} transition={{ duration: 0.5 }} />
                      </div>
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white" onClick={handleMpesaSuccess}>
                        <CheckCircle className="w-4 h-4 mr-1.5" />Paid — Continue
                      </Button>
                      <Button variant="outline" className="h-10 px-3" onClick={handleCancelBooking}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

            ) : bookingState === 'in-progress' ? (
              <motion.div key="inprogress" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
                <Card className="border-2 border-primary/30 overflow-hidden">
                  <div className="bg-primary px-5 py-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span className="font-display font-bold text-primary-foreground text-sm">Ride in progress</span>
                    <Badge className="ml-auto bg-white/20 text-white border-0 text-xs">KES {fare}</Badge>
                  </div>
                  <CardContent className="pt-5 space-y-4">
                    {foundDriver && (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                          {foundDriver.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{foundDriver.name} · {foundDriver.vehicle}</p>
                          <p className="text-xs text-muted-foreground">{foundDriver.plate}</p>
                        </div>
                        <a href={`tel:${foundDriver.phone}`} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                          <Phone className="w-4 h-4 text-primary" />
                        </a>
                      </div>
                    )}
                    <div className="rounded-xl bg-muted/40 border p-3 text-sm space-y-1.5">
                      <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary" /><span className="truncate">{pickupText}</span></div>
                      <div className="flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-secondary" /><span className="truncate">{dropoffText}</span></div>
                    </div>
                    <Button variant="outline" className="w-full h-10 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleCancelBooking}>
                      Cancel Ride
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ── RIGHT: Map + History ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* Map */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-primary" />
                <span className="font-display font-bold text-base">
                  {route ? 'Route Preview' : bookingState === 'in-progress' ? 'Live Tracking' : 'Map'}
                </span>
                {route && (
                  <Badge variant="outline" className="ml-auto text-[10px] bg-primary/5 border-primary/20 text-primary">
                    ORS Route
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div ref={mapRef} className="rounded-xl overflow-hidden border h-[300px]" />
              <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />Pickup</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" />Dropoff</span>
                {route && <span className="flex items-center gap-1"><span className="inline-block w-6 h-0.5 bg-primary border-dashed border-t-2" />Route</span>}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total rides', value: mockOrders.length, icon: Car },
              { label: 'Total spent', value: `KES ${mockOrders.reduce((a, o) => a + o.fare, 0).toLocaleString()}`, icon: TrendingUp },
              { label: 'Avg fare', value: `KES ${Math.round(mockOrders.reduce((a, o) => a + o.fare, 0) / mockOrders.length)}`, icon: Zap },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="pt-4 pb-3">
                  <stat.icon className="w-4 h-4 text-muted-foreground mb-2" />
                  <p className="font-display font-bold text-lg leading-none">{stat.value}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Rides */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <span className="font-display font-bold text-base">Recent Rides</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockOrders.map(order => (
                  <div key={order.id} className="flex items-start justify-between p-3.5 rounded-xl border hover:shadow-sm hover:border-primary/20 transition-all cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor(order.status)}`}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">{new Date(order.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-primary flex-shrink-0" /><span className="truncate">{order.pickup}</span></div>
                        <div className="flex items-center gap-1.5"><Navigation className="w-3 h-3 text-secondary flex-shrink-0" /><span className="truncate">{order.dropoff}</span></div>
                      </div>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="font-display font-bold text-base">KES {order.fare}</p>
                      <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                        {order.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}