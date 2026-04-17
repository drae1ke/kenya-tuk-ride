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
import {
  MapPin, Navigation, CreditCard, Banknote, Star, Map,
  LocateFixed, Loader2, ChevronRight, X, Phone, CheckCircle,
  Zap, TrendingUp, Car, History, AlertCircle, RefreshCw, Timer,
  Clock,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  geocodeAddress, reverseGeocode, getRoute, calculateFare, formatDuration, formatDistance,
  type GeocodedLocation, type ORSRoute,
} from '@/lib/ors-service';
import { rideApi } from '@/lib/api';
import {
  connectSocket, getSocket, emitRideRequest, emitCancelRide,
  type RideRequestedEvent, type RideAcceptedEvent, type LocationUpdateEvent, type DriverLocationUpdateEvent,
} from '@/lib/socket-service';

import { useAuth } from '@/lib/auth-context';
import RideChatPanel from '@/components/ride/RideChatPanel';

const TOKEN_KEY = 'tookride.auth.token';
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// ── Leaflet icon setup ────────────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});
const mkIcon = (color: string) => L.divIcon({
  html: `<div style="width:14px;height:14px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35)"></div>`,
  className: '', iconSize: [14, 14], iconAnchor: [7, 7],
});
const driverIcon = L.divIcon({
  html: `<div style="font-size:24px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));">🛺</div>`,
  className: '', iconSize: [28, 28], iconAnchor: [14, 14],
});

// ── Quick locations ───────────────────────────────────────────────────────────
const QUICK_LOCS = [
  { label: 'CBD', address: 'Nairobi CBD, Nairobi, Kenya', icon: '🏙️' },
  { label: 'Westlands', address: 'Westlands, Nairobi, Kenya', icon: '🛍️' },
  { label: 'Kilimani', address: 'Kilimani, Nairobi, Kenya', icon: '🏠' },
  { label: 'Upper Hill', address: 'Upper Hill, Nairobi, Kenya', icon: '🏢' },
  { label: 'Karen', address: 'Karen, Nairobi, Kenya', icon: '🌳' },
  { label: 'Westgate', address: 'Westgate Mall, Westlands, Nairobi, Kenya', icon: '🛒' },
];

type BookingState = 'idle' | 'routing' | 'searching' | 'driver-found' | 'mpesa-pending' | 'in-progress';

interface FoundDriver { id: string; name: string; vehicle: string; plate: string; rating: number; eta: string; phone: string; }
interface BackendRide { id: string; fare: number; distance: number; duration: number; status: string; createdAt: string; pickupLocation?: { address: string }; destination?: { address: string }; paymentMethod?: string; }
interface NearbyDriverPreview { id: string; name: string; rating: number; vehicle?: { make?: string; model?: string; plateNumber?: string }; }

// ── Address Input with Nominatim suggestions ──────────────────────────────────
function AddressInput({ label, value, onChange, onSelect, placeholder, dotColor }: {
  label: string; value: string; onChange: (v: string) => void;
  onSelect: (loc: GeocodedLocation) => void; placeholder: string; dotColor: string;
}) {
  const [sugs, setSugs] = useState<GeocodedLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setSugs([]); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleChange = (v: string) => {
    onChange(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (v.length < 2) { setSugs([]); return; }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try { setSugs((await geocodeAddress(v)).slice(0, 6)); }
      catch { setSugs([]); }
      finally { setLoading(false); }
    }, 400);
  };

  return (
    <div className="space-y-1.5 relative" ref={wrapRef}>
      <Label className="text-xs font-medium flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />{label}
      </Label>
      <div className="relative">
        <Input placeholder={placeholder} value={value} onChange={e => handleChange(e.target.value)} className="h-10 pr-8" />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      <AnimatePresence>
        {sugs.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 w-full mt-1 rounded-xl border bg-card shadow-xl overflow-hidden max-h-60 overflow-y-auto">
            {sugs.map((s, i) => (
              <button key={i} type="button"
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 transition-colors flex items-start gap-2 border-b last:border-0"
                onClick={() => { onSelect(s); onChange(s.label); setSugs([]); }}>
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

// ── Main Component ─────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [pickupText, setPickupText] = useState('');
  const [dropoffText, setDropoffText] = useState('');
  const [pickupCoords, setPickupCoords] = useState<GeocodedLocation | null>(null);
  const [dropoffCoords, setDropoffCoords] = useState<GeocodedLocation | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash'>('mpesa');
  const [gettingLocation, setGettingLocation] = useState(false);

  const [route, setRoute] = useState<ORSRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [bookingState, setBookingState] = useState<BookingState>('idle');
  const [currentRideId, setCurrentRideId] = useState<string | null>(null);
  const [foundDriver, setFoundDriver] = useState<FoundDriver | null>(null);
  const [mpesaTimer, setMpesaTimer] = useState(60);
  const mpesaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [rideHistory, setRideHistory] = useState<BackendRide[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [nearbyDrivers, setNearbyDrivers] = useState<NearbyDriverPreview[]>([]);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);

  // ── Fetch real ride history ─────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/rides/user/history?limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.status === 'success') setRideHistory(data.data.rides || []);
    } catch { /* use empty array */ }
    finally { setHistoryLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const socket = connectSocket(token);

    socket.on('ride:requested', (data: RideRequestedEvent) => {
      setCurrentRideId(data.rideId);
      setBookingState('searching');
    });

    socket.on('ride:accepted', (data: RideAcceptedEvent) => {
      const d = data.driver;
      setFoundDriver({
        id: d.id, name: d.name, phone: d.phone, rating: d.rating,
        vehicle: `${d.vehicle?.make ?? ''} ${d.vehicle?.model ?? ''}`.trim() || 'TukTuk',
        plate: d.vehicle?.plateNumber ?? '', eta: data.eta,
      });
      setBookingState('driver-found');
      toast({ title: `🛺 Driver found: ${d.name}`, description: `ETA ${data.eta}` });
    });

    socket.on('ride:location-update', (data: LocationUpdateEvent) => {
      if (data.location && layersRef.current) {
        updateDriverOnMap(data.location.latitude, data.location.longitude);
      }
    });

    socket.on('ride:completed', () => {
      toast({ title: '✅ Ride completed!', description: 'Thank you for riding TookRide!' });
      resetBooking();
      loadHistory();
    });

    socket.on('ride:cancelled', (d: { reason: string; cancelledBy: string }) => {
      toast({ title: 'Ride cancelled', description: `By ${d.cancelledBy}: ${d.reason}`, variant: 'destructive' });
      resetBooking();
    });

    socket.on('ride:error', (d: { message: string }) => {
      toast({ title: 'Error', description: d.message, variant: 'destructive' });
      setBookingState('idle');
    });

    return () => { socket.off('ride:requested'); socket.off('ride:accepted'); socket.off('ride:location-update'); socket.off('ride:completed'); socket.off('ride:cancelled'); socket.off('ride:error'); };
  }, []);

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([-1.2921, 36.8219], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
    mapInstanceRef.current = map;
    layersRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // ── Draw map markers/route ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;
    layers.clearLayers();

    if (pickupCoords) L.marker([pickupCoords.lat, pickupCoords.lng], { icon: mkIcon('#16a34a') }).bindPopup('📍 Pickup').addTo(layers);
    if (dropoffCoords) L.marker([dropoffCoords.lat, dropoffCoords.lng], { icon: mkIcon('#eab308') }).bindPopup('🏁 Dropoff').addTo(layers);

    if (route?.geometry?.coordinates?.length) {
      const latlngs: [number, number][] = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      L.polyline(latlngs, { color: '#16a34a', weight: 4, opacity: 0.85, dashArray: '8,5' }).addTo(layers);
      map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });
    } else if (pickupCoords && dropoffCoords) {
      map.fitBounds(L.latLngBounds([[pickupCoords.lat, pickupCoords.lng], [dropoffCoords.lat, dropoffCoords.lng]]), { padding: [50, 50] });
    }
  }, [pickupCoords, dropoffCoords, route]);

  const updateDriverOnMap = (lat: number, lng: number) => {
    if (!layersRef.current || !mapInstanceRef.current) return;
    layersRef.current.eachLayer((l: any) => { if (l._icon?.innerHTML?.includes('🛺')) layersRef.current!.removeLayer(l); });
    L.marker([lat, lng], { icon: driverIcon }).addTo(layersRef.current);
  };

  // ── Route fetch on coord change ─────────────────────────────────────────────
  useEffect(() => {
    if (!pickupCoords || !dropoffCoords) { setRoute(null); setRouteError(null); return; }
    setBookingState('routing');
    setRouteError(null);
    getRoute(pickupCoords, dropoffCoords)
      .then(r => { setRoute(r); setBookingState('idle'); })
      .catch(e => { setRouteError(e.message); setBookingState('idle'); });
  }, [pickupCoords, dropoffCoords]);

  useEffect(() => {
    if (!pickupCoords) {
      setNearbyDrivers([]);
      return;
    }

    rideApi.getNearbyDrivers(pickupCoords.lat, pickupCoords.lng)
      .then((res) => setNearbyDrivers(res.data.drivers || []))
      .catch(() => setNearbyDrivers([]));
  }, [pickupCoords]);

  // ── M-Pesa countdown ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (bookingState === 'mpesa-pending') {
      setMpesaTimer(60);
      mpesaTimerRef.current = setInterval(() => setMpesaTimer(t => { if (t <= 1) { clearInterval(mpesaTimerRef.current!); return 0; } return t - 1; }), 1000);
    }
    return () => { if (mpesaTimerRef.current) clearInterval(mpesaTimerRef.current); };
  }, [bookingState]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const label = await reverseGeocode(lat, lng);
          setPickupText(label);
          setPickupCoords({ lat, lng, label });
          toast({ title: '📍 Location detected', description: label });
        } finally { setGettingLocation(false); }
      },
      () => { setGettingLocation(false); toast({ title: 'Location denied', variant: 'destructive' }); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleBookRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickupCoords || !dropoffCoords || !route) {
      toast({ title: 'Missing info', description: 'Select pickup and dropoff locations from suggestions', variant: 'destructive' });
      return;
    }

    const socket = getSocket();
    if (socket?.connected) {
      emitRideRequest({
        pickup: { latitude: pickupCoords.lat, longitude: pickupCoords.lng, address: pickupCoords.label },
        destination: { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, address: dropoffCoords.label },
        paymentMethod,
      });
      setBookingState('searching');
    } else {
      // REST fallback
      const token = sessionStorage.getItem(TOKEN_KEY);
      setBookingState('searching');
      try {
        const res = await fetch(`${API}/rides/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            pickup: { latitude: pickupCoords.lat, longitude: pickupCoords.lng, address: pickupCoords.label },
            destination: { latitude: dropoffCoords.lat, longitude: dropoffCoords.lng, address: dropoffCoords.label },
            paymentMethod,
          }),
        });
        const data = await res.json();
        if (data.status === 'success') {
          setCurrentRideId(data.data.ride.id);
          toast({ title: '🔍 Looking for drivers...', description: `Estimated KES ${data.data.ride.fare}` });
        } else throw new Error(data.message);
      } catch (err: any) {
        toast({ title: 'Booking failed', description: err.message, variant: 'destructive' });
        setBookingState('idle');
      }
    }
  };

  const handleConfirmRide = () => {
    if (paymentMethod === 'mpesa') setBookingState('mpesa-pending');
    else { setBookingState('in-progress'); toast({ title: '🛺 Confirmed!', description: 'Driver is heading your way' }); }
  };

  const handleMpesaSuccess = () => {
    if (mpesaTimerRef.current) clearInterval(mpesaTimerRef.current);
    setBookingState('in-progress');
    toast({ title: '✅ Payment confirmed!', description: 'Driver is on the way' });
  };

  const resetBooking = useCallback(() => {
    if (currentRideId) emitCancelRide(currentRideId, 'Cancelled by user');
    if (mpesaTimerRef.current) clearInterval(mpesaTimerRef.current);
    setBookingState('idle'); setFoundDriver(null); setCurrentRideId(null);
    setPickupText(''); setDropoffText(''); setPickupCoords(null); setDropoffCoords(null); setRoute(null);
  }, [currentRideId]);

  const fare = route ? calculateFare(route.distance) : 0;
  const canBook = !!pickupCoords && !!dropoffCoords && !!route && bookingState === 'idle';

  // ── UI ──────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout title="Book a Ride" subtitle={`Welcome, ${user?.name} 👋`}>
      <div className="grid gap-6 lg:grid-cols-5">

        {/* ── BOOKING PANEL ── */}
        <div className="lg:col-span-2 space-y-4">
          <AnimatePresence mode="wait">

            {/* IDLE / ROUTING */}
            {(bookingState === 'idle' || bookingState === 'routing') && (
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
                          <Loader2 className="w-3 h-3 animate-spin" />Calculating...
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleBookRide} className="space-y-4">
                      {/* Pickup */}
                      <div className="space-y-2">
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <AddressInput label="Pickup" value={pickupText} onChange={setPickupText}
                              onSelect={loc => { setPickupCoords(loc); setPickupText(loc.label); }}
                              placeholder="Search area, street..." dotColor="bg-primary" />
                          </div>
                          <Button type="button" variant="outline" size="icon" className="h-10 w-10 flex-shrink-0 mb-0"
                            onClick={handleUseMyLocation} disabled={gettingLocation} title="Use my location">
                            {gettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4 text-primary" />}
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {QUICK_LOCS.slice(0, 4).map(loc => (
                            <button key={loc.label} type="button"
                              onClick={() => { setPickupText(loc.address); geocodeAddress(loc.address).then(r => r[0] && setPickupCoords(r[0])); }}
                              className="text-[10px] px-2 py-1 rounded-full border bg-muted/50 hover:bg-muted transition-colors flex items-center gap-1">
                              {loc.icon} {loc.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Dropoff */}
                      <div className="space-y-2">
                        <AddressInput label="Dropoff" value={dropoffText} onChange={setDropoffText}
                          onSelect={loc => { setDropoffCoords(loc); setDropoffText(loc.label); }}
                          placeholder="Where to?" dotColor="bg-secondary" />
                        <div className="flex flex-wrap gap-1">
                          {QUICK_LOCS.map(loc => (
                            <button key={loc.label} type="button"
                              onClick={() => { setDropoffText(loc.address); geocodeAddress(loc.address).then(r => r[0] && setDropoffCoords(r[0])); }}
                              className="text-[10px] px-2 py-1 rounded-full border bg-muted/50 hover:bg-muted transition-colors flex items-center gap-1">
                              {loc.icon} {loc.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Fare estimate */}
                      <AnimatePresence>
                        {route && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Estimated fare</span>
                                <span className="font-display font-bold text-2xl text-primary">KES {fare}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1"><Navigation className="w-3 h-3" />{formatDistance(route.distance)}</span>
                                <span>·</span>
                                <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{formatDuration(route.duration)}</span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                        {routeError && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-medium text-destructive">Could not calculate route</p>
                              <button type="button" onClick={() => pickupCoords && dropoffCoords && getRoute(pickupCoords, dropoffCoords).then(setRoute).catch(() => {})}
                                className="text-[11px] text-primary underline mt-1 flex items-center gap-1"><RefreshCw className="w-3 h-3" />Retry</button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Payment method */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium">Payment</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'mpesa', label: 'M-Pesa', icon: <CreditCard className="w-4 h-4" />, sub: 'STK push' },
                            { id: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" />, sub: 'Pay driver' },
                          ].map(m => (
                            <button key={m.id} type="button" onClick={() => setPaymentMethod(m.id as any)}
                              className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-left ${paymentMethod === m.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}>
                              <span className={paymentMethod === m.id ? 'text-primary' : 'text-muted-foreground'}>{m.icon}</span>
                              <div><p className="font-semibold text-sm leading-none">{m.label}</p><p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p></div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <Button type="submit" variant="hero" className="w-full h-11 gap-2 font-semibold" disabled={!canBook}>
                        {bookingState === 'routing'
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Calculating route...</>
                          : <><Zap className="w-4 h-4" />Request TukTuk<ChevronRight className="w-4 h-4 ml-auto" /></>}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* SEARCHING */}
            {bookingState === 'searching' && (
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
                      <p className="text-sm text-muted-foreground mt-1">{pickupText} → {dropoffText}</p>
                      {route && <p className="text-xs text-primary font-semibold mt-1.5">KES {fare} · {formatDistance(route.distance)}</p>}
                    </div>
                    <div className="flex gap-1">{[0,1,2].map(i => <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
                    <Button variant="outline" size="sm" onClick={resetBooking} className="gap-1.5"><X className="w-3.5 h-3.5" />Cancel</Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* DRIVER FOUND */}
            {bookingState === 'driver-found' && foundDriver && (
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

                    {route && (
                      <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Total fare</p>
                          <p className="font-display font-bold text-2xl text-primary">KES {fare}</p>
                          <p className="text-[10px] text-muted-foreground">{formatDistance(route.distance)} · {formatDuration(route.duration)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Payment</p>
                          <p className="font-semibold text-sm flex items-center gap-1.5">
                            {paymentMethod === 'mpesa' ? <><CreditCard className="w-3.5 h-3.5" />M-Pesa</> : <><Banknote className="w-3.5 h-3.5" />Cash</>}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button variant="hero" className="flex-1 h-11" onClick={handleConfirmRide}>Confirm Ride</Button>
                      <Button variant="outline" className="h-11 px-3" onClick={resetBooking}><X className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* M-PESA */}
            {bookingState === 'mpesa-pending' && (
              <motion.div key="mpesa" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Card className="border-2 border-green-600/30 overflow-hidden">
                  <div className="bg-green-600 px-5 py-3"><p className="font-display font-bold text-white text-sm">M-Pesa Payment</p></div>
                  <CardContent className="py-6 flex flex-col items-center gap-4 text-center">
                    <div className="w-16 h-16 rounded-full bg-green-50 border-4 border-green-600/20 flex items-center justify-center">
                      <Phone className="w-7 h-7 text-green-600" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-lg">Check your phone</p>
                      <p className="text-sm text-muted-foreground mt-1">Enter your M-Pesa PIN when prompted</p>
                    </div>
                    <div className="w-full rounded-xl bg-green-50 border border-green-200 p-4">
                      <p className="text-xs text-muted-foreground">Amount</p>
                      <p className="font-display font-bold text-3xl text-green-700">KES {fare}</p>
                    </div>
                    <div className="w-full">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                        <span>Expires in</span>
                        <span className={mpesaTimer < 15 ? 'text-destructive font-semibold' : ''}>{mpesaTimer}s</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <motion.div className="h-full bg-green-600 rounded-full" animate={{ width: `${(mpesaTimer / 60) * 100}%` }} transition={{ duration: 0.5 }} />
                      </div>
                    </div>
                    <div className="flex gap-2 w-full">
                      <Button className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white" onClick={handleMpesaSuccess}>
                        <CheckCircle className="w-4 h-4 mr-1.5" />Paid — Continue
                      </Button>
                      <Button variant="outline" className="h-10 px-3" onClick={resetBooking}><X className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* IN PROGRESS */}
            {bookingState === 'in-progress' && (
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
                        <div className="flex-1"><p className="font-semibold text-sm">{foundDriver.name} · {foundDriver.vehicle}</p><p className="text-xs text-muted-foreground">{foundDriver.plate}</p></div>
                        <a href={`tel:${foundDriver.phone}`} className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"><Phone className="w-4 h-4 text-primary" /></a>
                      </div>
                    )}
                    <div className="rounded-xl bg-muted/40 border p-3 text-sm space-y-1.5">
                      <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary" /><span className="truncate">{pickupText}</span></div>
                      <div className="flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-secondary" /><span className="truncate">{dropoffText}</span></div>
                    </div>
                    <Button variant="outline" className="w-full h-10 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={resetBooking}>Cancel Ride</Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── MAP + HISTORY PANEL ── */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Map className="w-4 h-4 text-primary" />
                <span className="font-display font-bold text-base">{route ? 'Route Preview' : 'Map'}</span>
                {route && <Badge variant="outline" className="ml-auto text-[10px] bg-primary/5 border-primary/20 text-primary">Live Route</Badge>}
              </div>
            </CardHeader>
            <CardContent>
              <div ref={mapRef} className="rounded-xl overflow-hidden border h-[320px]" />
              <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />Pickup</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" />Dropoff</span>
              </div>
            </CardContent>
          </Card>

          {/* Ride History */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <span className="font-display font-bold text-base">Recent Rides</span>
                </div>
                <Button variant="ghost" size="sm" onClick={loadHistory} className="h-7 text-xs gap-1">
                  <RefreshCw className="w-3 h-3" />Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />Loading rides...
                </div>
              ) : rideHistory.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  <Car className="w-8 h-8 mx-auto mb-2 opacity-30" />No rides yet. Book your first TukTuk!
                </div>
              ) : (
                <div className="space-y-3">
                  {rideHistory.map(r => (
                    <div key={r.id} className="flex items-start justify-between p-3.5 rounded-xl border hover:border-primary/20 hover:shadow-sm transition-all">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                            r.status === 'completed' ? 'bg-primary/10 text-primary border-primary/20' :
                            r.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                            'bg-secondary/20 text-secondary-foreground border-secondary/30'
                          }`}>{r.status}</Badge>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(r.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-primary flex-shrink-0" /><span className="truncate">{r.pickupLocation?.address || 'Pickup'}</span></div>
                          <div className="flex items-center gap-1.5"><Navigation className="w-3 h-3 text-secondary flex-shrink-0" /><span className="truncate">{r.destination?.address || 'Destination'}</span></div>
                        </div>
                      </div>
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className="font-display font-bold text-base">KES {r.fare}</p>
                        <p className="text-[10px] text-muted-foreground capitalize mt-0.5">{r.paymentMethod || 'cash'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <LocateFixed className="w-4 h-4 text-primary" />
                <span className="font-display font-bold text-base">Nearby Drivers</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {nearbyDrivers.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pick a pickup point to preview available tuktuks around you.</p>
              ) : nearbyDrivers.map((driver) => (
                <div key={driver.id} className="rounded-xl border p-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{driver.name}</p>
                    <p className="text-xs text-muted-foreground">{driver.vehicle?.make || 'TukTuk'} {driver.vehicle?.model || ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{driver.rating.toFixed(1)} ★</p>
                    <p className="text-[11px] text-muted-foreground">{driver.vehicle?.plateNumber || 'Nearby now'}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <RideChatPanel rideId={currentRideId} userRole="client" />
        </div>
      </div>
    </DashboardLayout>
  );
}
