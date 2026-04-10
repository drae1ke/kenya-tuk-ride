import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockOrders } from '@/lib/mock-data';
import {
  MapPin, Navigation, CreditCard, Banknote, Clock, Star, Map,
  LocateFixed, Loader2, ChevronRight, X, Phone, CheckCircle,
  AlertCircle, Zap, Timer, TrendingUp, Car, History,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TukTukMap from '@/components/map/TukTukMap';

const PRICING = { baseFare: 100, perKm: 40, minimumFare: 150 };
const SAVED_LOCATIONS = [
  { label: 'Home', address: 'Kilimani, Nairobi', icon: '🏠' },
  { label: 'Work', address: 'Upper Hill, Nairobi', icon: '🏢' },
  { label: 'Westlands', address: 'Westlands Mall, Nairobi', icon: '🛍️' },
  { label: 'Karen', address: 'Karen, Nairobi', icon: '🌳' },
];

// Very rough km estimate from address strings (real app would use ORS)
function estimateDistance(pickup: string, dropoff: string): number {
  if (!pickup || !dropoff) return 0;
  const seed = (pickup.length + dropoff.length) % 10;
  return parseFloat((2 + seed * 0.7).toFixed(1));
}

function calcFare(km: number): number {
  const raw = PRICING.baseFare + km * PRICING.perKm;
  return Math.max(raw, PRICING.minimumFare);
}

type BookingState = 'idle' | 'searching' | 'driver-found' | 'confirmed' | 'mpesa-pending' | 'in-progress';

interface FoundDriver {
  name: string;
  vehicle: string;
  plate: string;
  rating: number;
  eta: string;
  phone: string;
}

const MOCK_DRIVER: FoundDriver = {
  name: 'James Ochieng',
  vehicle: 'Bajaj RE',
  plate: 'KBA 123A',
  rating: 4.8,
  eta: '4 min',
  phone: '+254711111111',
};

const statusColor = (status: string) => {
  switch (status) {
    case 'completed': return 'bg-primary/10 text-primary border-primary/20';
    case 'pending': return 'bg-secondary/20 text-secondary-foreground border-secondary/30';
    case 'in_progress': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
    default: return '';
  }
};

const ClientDashboard = () => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash'>('mpesa');
  const [bookingState, setBookingState] = useState<BookingState>('idle');
  const [foundDriver, setFoundDriver] = useState<FoundDriver | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState('0711 111 111');
  const [mpesaTimer, setMpesaTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const estimatedKm = estimateDistance(pickup, dropoff);
  const estimatedFare = pickup && dropoff ? calcFare(estimatedKm) : 0;
  const hasFareEstimate = pickup.length > 3 && dropoff.length > 3;

  // M-Pesa countdown
  useEffect(() => {
    if (bookingState === 'mpesa-pending') {
      setMpesaTimer(60);
      timerRef.current = setInterval(() => {
        setMpesaTimer(t => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [bookingState]);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Error', description: 'Geolocation not supported', variant: 'destructive' });
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then(r => r.json())
          .then(data => {
            const address = data.display_name?.split(',').slice(0, 3).join(',') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            setPickup(address);
            toast({ title: '📍 Location found', description: address });
          })
          .catch(() => setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`))
          .finally(() => setGettingLocation(false));
      },
      () => {
        setGettingLocation(false);
        toast({ title: 'Location denied', description: 'Enter pickup manually', variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleBookRide = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !dropoff) return;
    setBookingState('searching');
    setTimeout(() => {
      setFoundDriver(MOCK_DRIVER);
      setBookingState('driver-found');
    }, 2200);
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
    setBookingState('in-progress');
    if (timerRef.current) clearInterval(timerRef.current);
    toast({ title: '✅ Payment confirmed!', description: 'Driver is on the way' });
  };

  const handleCancelBooking = () => {
    setBookingState('idle');
    setFoundDriver(null);
    if (timerRef.current) clearInterval(timerRef.current);
    setPickup('');
    setDropoff('');
  };

  const trackingPickup = { lat: -1.2721, lng: 36.8110 };
  const trackingDropoff = { lat: -1.2890, lng: 36.7950 };

  return (
    <DashboardLayout title="Book a Ride" subtitle="Find a TukTuk near you in Nairobi">
      <div className="grid gap-6 lg:grid-cols-5">

        {/* ── LEFT PANEL: Booking Form ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* IDLE / FORM */}
          {(bookingState === 'idle') && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-2 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Navigation className="w-4 h-4 text-primary" />
                    </div>
                    New Ride
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleBookRide} className="space-y-4">
                    {/* Pickup */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        Pickup Location
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. Westlands, Nairobi"
                          value={pickup}
                          onChange={e => setPickup(e.target.value)}
                          required
                          className="flex-1 h-10"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 flex-shrink-0"
                          onClick={handleUseMyLocation}
                          disabled={gettingLocation}
                          title="Use current location"
                        >
                          {gettingLocation ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4 text-primary" />}
                        </Button>
                      </div>
                      {/* Saved locations quick-select */}
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {SAVED_LOCATIONS.map(loc => (
                          <button
                            key={loc.label}
                            type="button"
                            onClick={() => setPickup(loc.address)}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted hover:border-primary/40 transition-colors"
                          >
                            <span>{loc.icon}</span>
                            <span>{loc.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dropoff */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-secondary" />
                        Dropoff Location
                      </Label>
                      <Input
                        placeholder="e.g. CBD, Nairobi"
                        value={dropoff}
                        onChange={e => setDropoff(e.target.value)}
                        required
                        className="h-10"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {SAVED_LOCATIONS.map(loc => (
                          <button
                            key={loc.label}
                            type="button"
                            onClick={() => setDropoff(loc.address)}
                            className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-full border border-border bg-muted/50 hover:bg-muted hover:border-secondary/40 transition-colors"
                          >
                            <span>{loc.icon}</span>
                            <span>{loc.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Fare estimate */}
                    <AnimatePresence>
                      {hasFareEstimate && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground">Estimated fare</span>
                              <span className="font-display font-bold text-xl text-primary">
                                KES {Math.round(estimatedFare)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              <span>~{estimatedKm} km</span>
                              <span>·</span>
                              <span>Base KES {PRICING.baseFare} + KES {PRICING.perKm}/km</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 mt-1">Final fare may vary based on route</p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Payment method */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Payment Method</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'mpesa', label: 'M-Pesa', icon: <CreditCard className="w-4 h-4" />, sub: 'Pay with phone' },
                          { id: 'cash', label: 'Cash', icon: <Banknote className="w-4 h-4" />, sub: 'Pay driver' },
                        ].map(method => (
                          <button
                            key={method.id}
                            type="button"
                            onClick={() => setPaymentMethod(method.id as 'mpesa' | 'cash')}
                            className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                              paymentMethod === method.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/30'
                            }`}
                          >
                            <span className={paymentMethod === method.id ? 'text-primary' : 'text-muted-foreground'}>
                              {method.icon}
                            </span>
                            <div>
                              <p className="font-semibold text-sm leading-none">{method.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">{method.sub}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <Button type="submit" variant="hero" className="w-full h-11 gap-2 font-semibold">
                      <Zap className="w-4 h-4" />
                      Request TukTuk
                      <ChevronRight className="w-4 h-4 ml-auto" />
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* SEARCHING */}
          {bookingState === 'searching' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
                    <p className="text-sm text-muted-foreground mt-1">Searching {pickup} → {dropoff}</p>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleCancelBooking} className="gap-1.5">
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* DRIVER FOUND */}
          {bookingState === 'driver-found' && foundDriver && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-2 border-primary/30 overflow-hidden shadow-lg">
                <div className="bg-primary px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary-foreground" />
                    <span className="font-display font-bold text-primary-foreground text-sm">Driver found!</span>
                  </div>
                  <Badge className="bg-white/20 text-primary-foreground border-0 text-xs">
                    <Timer className="w-3 h-3 mr-1" />
                    ETA {foundDriver.eta}
                  </Badge>
                </div>
                <CardContent className="pt-5 space-y-4">
                  {/* Driver card */}
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

                  {/* Trip summary */}
                  <div className="rounded-xl border p-3 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center mt-0.5 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                      </div>
                      <div><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm">{pickup}</p></div>
                    </div>
                    <div className="ml-2 w-px h-3 bg-border" />
                    <div className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center mt-0.5 flex-shrink-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary-foreground/80" />
                      </div>
                      <div><p className="text-xs text-muted-foreground">Dropoff</p><p className="text-sm">{dropoff}</p></div>
                    </div>
                  </div>

                  {/* Fare */}
                  <div className="flex items-center justify-between rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Total fare</p>
                      <p className="font-display font-bold text-2xl text-primary">KES {Math.round(estimatedFare)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Payment</p>
                      <p className="font-semibold text-sm capitalize flex items-center gap-1.5">
                        {paymentMethod === 'mpesa' ? <><CreditCard className="w-3.5 h-3.5" />M-Pesa</> : <><Banknote className="w-3.5 h-3.5" />Cash</>}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="hero" className="flex-1 h-11" onClick={handleConfirmRide}>
                      Confirm Ride
                    </Button>
                    <Button variant="outline" className="h-11 px-3" onClick={handleCancelBooking}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* M-PESA STK PUSH */}
          {bookingState === 'mpesa-pending' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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
                    <p className="text-sm text-muted-foreground mt-1">
                      STK push sent to <span className="font-semibold text-foreground">{mpesaPhone}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Enter your M-Pesa PIN to confirm</p>
                  </div>

                  {/* Amount */}
                  <div className="w-full rounded-xl bg-green-50 border border-green-200 p-4">
                    <p className="text-xs text-muted-foreground">Amount to pay</p>
                    <p className="font-display font-bold text-3xl text-green-700">KES {Math.round(estimatedFare)}</p>
                    <p className="text-xs text-green-600 mt-1">TookRide · {new Date().toLocaleTimeString()}</p>
                  </div>

                  {/* Timer */}
                  <div className="w-full">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Request expires in</span>
                      <span className={mpesaTimer < 15 ? 'text-destructive font-semibold' : ''}>{mpesaTimer}s</span>
                    </div>
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-green-600 rounded-full"
                        animate={{ width: `${(mpesaTimer / 60) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 w-full">
                    <Button className="flex-1 h-10 bg-green-600 hover:bg-green-700 text-white" onClick={handleMpesaSuccess}>
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                      Paid — Continue
                    </Button>
                    <Button variant="outline" className="h-10 px-3" onClick={handleCancelBooking}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/70">Didn't receive the prompt? <button className="underline" onClick={() => toast({ title: 'STK push resent', description: 'Check your phone' })}>Resend</button></p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* IN PROGRESS */}
          {bookingState === 'in-progress' && (
            <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}>
              <Card className="border-2 border-primary/30 overflow-hidden">
                <div className="bg-primary px-5 py-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="font-display font-bold text-primary-foreground text-sm">Ride in progress</span>
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
                    <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary" /><span className="truncate">{pickup}</span></div>
                    <div className="flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-secondary" /><span className="truncate">{dropoff}</span></div>
                  </div>
                  <Button variant="outline" className="w-full h-10 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleCancelBooking}>
                    End Tracking
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* ── RIGHT PANEL: Map + History ── */}
        <div className="lg:col-span-3 space-y-6">
          {/* Map */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between font-display text-base">
                  <span className="flex items-center gap-2">
                    <Map className="w-4 h-4 text-primary" />
                    {bookingState === 'in-progress' ? 'Live Tracking' : 'TukTuks Near You'}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TukTukMap
                  className="h-[300px]"
                  showTukTuks={bookingState !== 'in-progress'}
                  showRoute={bookingState === 'in-progress'}
                  pickup={bookingState === 'in-progress' ? trackingPickup : null}
                  dropoff={bookingState === 'in-progress' ? trackingDropoff : null}
                  onTukTukSelect={t => toast({ title: `🛺 ${t.name}`, description: `${t.vehicle} — ★ ${t.rating}` })}
                />
                {bookingState === 'in-progress' && (
                  <div className="mt-2.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span>Your TukTuk is on the way — estimated arrival in 5 min</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

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
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <History className="w-4 h-4 text-muted-foreground" />
                  Recent Rides
                </CardTitle>
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
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                            <span className="truncate">{order.pickup}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Navigation className="w-3 h-3 text-secondary flex-shrink-0" />
                            <span className="truncate">{order.dropoff}</span>
                          </div>
                        </div>
                        {order.driverName && (
                          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-muted-foreground">
                            <Star className="w-3 h-3 text-secondary" />
                            <span>{order.driverName}</span>
                          </div>
                        )}
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
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ClientDashboard;