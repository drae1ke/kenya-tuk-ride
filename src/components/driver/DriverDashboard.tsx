import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { driverApi } from '@/lib/api';
import {
  MapPin, Navigation, DollarSign, TrendingUp, FileText,
  CheckCircle, XCircle, Clock, AlertCircle, Car, Map,
  ExternalLink, Phone, Zap, Target, ChevronRight,
  AlertTriangle, Wifi, WifiOff, Loader2, RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TukTukMap from '@/components/map/TukTukMap';
import RideChatPanel from '@/components/ride/RideChatPanel';
import {
  connectSocket, getSocket,
  emitDriverOnline, emitDriverOffline, emitDriverLocation,
  emitAcceptRide, emitArrivedAtPickup, emitStartRide, emitCompleteRide,
  emitCancelRide,
  type RideNewRequestEvent,
} from '@/lib/socket-service';

const TOKEN_KEY = 'tookride.auth.token';
const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

interface IncomingRequest {
  rideId: string;
  pickup: { coordinates: [number, number]; address: string };
  destination: { coordinates: [number, number]; address: string };
  fare: number;
  distance: number;
  duration: number;
  receivedAt: number;
}

interface BackendRide {
  _id: string; fare: number; distance: number; duration: number; status: string;
  createdAt: string; pickupLocation?: { address: string }; destination?: { address: string };
  userId?: { name: string; phone: string; rating: number };
}

interface DriverStats {
  totalRides: number; totalEarnings: number; rating: number;
  acceptanceRate: number; cancellationRate: number;
}

type ActiveStage = 'navigating' | 'arrived' | 'inprogress';

function useCountdown(seconds: number, active: boolean) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    if (!active) { setRemaining(seconds); return; }
    if (remaining <= 0) return;
    const t = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, active, seconds]);
  return remaining;
}

export default function DriverDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [isOnline, setIsOnline] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);

  const [incomingRequest, setIncomingRequest] = useState<IncomingRequest | null>(null);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<ActiveStage>('navigating');
  const [activeRide, setActiveRide] = useState<IncomingRequest | null>(null);

  const [rideHistory, setRideHistory] = useState<BackendRide[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stats, setStats] = useState<DriverStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [driverProfile, setDriverProfile] = useState<any>(null);

  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdown = useCountdown(30, !!incomingRequest);

  const authFetch = useCallback(async (path: string, opts?: RequestInit) => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    return fetch(`${API}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(opts?.headers || {}) },
    });
  }, []);

  // ── Load real history + stats ────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await authFetch('/rides/driver/history?limit=10');
      const data = await res.json();
      if (data.status === 'success') setRideHistory(data.data.rides || []);
    } catch { }
    finally { setHistoryLoading(false); }
  }, [authFetch]);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await authFetch('/drivers/stats');
      const data = await res.json();
      if (data.status === 'success') setStats(data.data);
    } catch { }
    finally { setStatsLoading(false); }
  }, [authFetch]);

  useEffect(() => { loadHistory(); loadStats(); }, [loadHistory, loadStats]);

  useEffect(() => {
    driverApi.getProfile()
      .then((res) => setDriverProfile(res.data))
      .catch(() => setDriverProfile(null));
  }, []);

  // ── Socket setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return;
    const socket = connectSocket(token);

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));

    socket.on('ride:new-request', (data: RideNewRequestEvent) => {
      if (activeRideId) return;
      setIncomingRequest({ rideId: data.rideId, pickup: data.pickup, destination: data.destination, fare: data.fare, distance: data.distance, duration: data.duration, receivedAt: Date.now() });
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New ride request!', { body: `${data.pickup.address} → ${data.destination.address} — KES ${data.fare}` });
      }
    });

    socket.on('ride:accepted-confirmation', () => toast({ title: '✅ Ride accepted', description: 'Navigate to pickup' }));

    socket.on('ride:cancelled', (data: { rideId: string }) => {
      if (data.rideId === activeRideId) {
        toast({ title: 'Rider cancelled the trip', variant: 'destructive' });
        setActiveRideId(null); setActiveRide(null); setActiveStage('navigating');
        loadStats();
      }
    });

    return () => { socket.off('connect'); socket.off('disconnect'); socket.off('ride:new-request'); socket.off('ride:accepted-confirmation'); socket.off('ride:cancelled'); };
  }, [activeRideId]);

  // ── Auto-expire request ──────────────────────────────────────────────────────
  useEffect(() => {
    if (countdown === 0 && incomingRequest) {
      setIncomingRequest(null);
      toast({ title: 'Request expired', description: 'No response in time' });
    }
  }, [countdown, incomingRequest]);

  // ── Location broadcast ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isOnline && socketConnected) {
      emitDriverOnline();
      const broadcast = () => {
        navigator.geolocation?.getCurrentPosition(pos => {
          emitDriverLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.heading ?? undefined, pos.coords.speed ?? undefined);
          // Also update via REST
          authFetch('/drivers/location', { method: 'PATCH', body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }) }).catch(() => {});
        }, () => {});
      };
      broadcast();
      locationIntervalRef.current = setInterval(broadcast, 15_000);
    } else {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (!isOnline && socketConnected) emitDriverOffline();
    }
    return () => { if (locationIntervalRef.current) clearInterval(locationIntervalRef.current); };
  }, [isOnline, socketConnected]);

  // ── REST fallback for ride actions ───────────────────────────────────────────
  const rideAction = useCallback(async (rideId: string, action: string) => {
    try {
      const res = await authFetch(`/rides/${rideId}/${action}`, { method: 'PATCH' });
      return res.ok;
    } catch { return false; }
  }, [authFetch]);

  const handleAccept = (req: IncomingRequest) => {
    const socket = getSocket();
    if (socket?.connected) emitAcceptRide(req.rideId);
    else rideAction(req.rideId, 'accept');
    setIncomingRequest(null);
    setActiveRideId(req.rideId);
    setActiveRide(req);
    setActiveStage('navigating');
    toast({ title: '🛺 Ride accepted!', description: `Head to ${req.pickup.address}` });
  };

  const handleDecline = () => { setIncomingRequest(null); toast({ title: 'Request declined' }); };

  const handleArrived = () => {
    if (!activeRideId) return;
    const socket = getSocket();
    if (socket?.connected) emitArrivedAtPickup(activeRideId);
    else rideAction(activeRideId, 'arrive');
    setActiveStage('arrived');
    toast({ title: '📍 Marked arrived', description: 'Waiting for rider...' });
  };

  const handleStart = () => {
    if (!activeRideId) return;
    const socket = getSocket();
    if (socket?.connected) emitStartRide(activeRideId);
    else rideAction(activeRideId, 'start');
    setActiveStage('inprogress');
    toast({ title: '🚀 Ride started!', description: 'Drive safely!' });
  };

  const handleComplete = () => {
    if (!activeRideId) return;
    const socket = getSocket();
    if (socket?.connected) emitCompleteRide(activeRideId);
    else rideAction(activeRideId, 'complete');
    toast({ title: '✅ Ride complete!', description: `KES ${activeRide?.fare} earned` });
    setActiveRideId(null); setActiveRide(null); setActiveStage('navigating');
    loadHistory(); loadStats();
  };

  const handleToggleOnline = () => {
    if (!isOnline && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    // Update online status via REST
    authFetch('/drivers/online-status', { method: 'PATCH', body: JSON.stringify({ online: !isOnline }) }).catch(() => {});
    setIsOnline(o => !o);
    if (isOnline) setIncomingRequest(null);
  };

  const statCards = [
    { label: "Today's earnings", value: stats ? `KES ${stats.totalEarnings.toLocaleString()}` : '—', sub: `${stats?.totalRides ?? 0} total rides`, icon: DollarSign, good: true },
    { label: 'Rating', value: stats ? `${stats.rating.toFixed(1)} ★` : '—', sub: 'Rider score', icon: TrendingUp, good: true },
    { label: 'Acceptance rate', value: stats ? `${stats.acceptanceRate.toFixed(0)}%` : '—', sub: 'Target: 75%', icon: Target, good: (stats?.acceptanceRate ?? 0) >= 75 },
    { label: 'Total rides', value: stats ? stats.totalRides : '—', sub: 'Completed', icon: Car, good: true },
  ];

  return (
    <DashboardLayout title="Driver Dashboard" subtitle={`Welcome back, ${user?.name}`}>

      {/* Online status bar */}
      <div className={`flex items-center justify-between mb-6 p-4 rounded-xl border-2 transition-all ${isOnline ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-border'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full transition-colors ${isOnline ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              {isOnline ? 'Online — accepting rides' : 'Offline'}
              <span className={`flex items-center gap-1 text-xs font-normal ${socketConnected ? 'text-primary' : 'text-muted-foreground'}`}>
                {socketConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {socketConnected ? 'Connected' : 'Socket offline'}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {isOnline ? 'Broadcasting location · receiving requests' : 'Go online to start earning'}
            </p>
          </div>
        </div>
        <Button variant={isOnline ? 'outline' : 'hero'} size="sm" onClick={handleToggleOnline}>
          Go {isOnline ? 'Offline' : 'Online'}
        </Button>
      </div>

      {/* Incoming request popup */}
      <AnimatePresence>
        {incomingRequest && isOnline && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20 }} className="mb-6">
            <div className="rounded-2xl border-2 border-secondary/60 bg-secondary/5 overflow-hidden shadow-xl">
              <div className="h-1.5 bg-muted overflow-hidden">
                <motion.div className="h-full bg-secondary" initial={{ width: '100%' }} animate={{ width: `${(countdown / 30) * 100}%` }} transition={{ duration: 0.5 }} />
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-secondary-foreground" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-sm">New ride request!</p>
                      <p className="text-xs text-muted-foreground">Expires in {countdown}s</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold text-2xl text-primary">KES {incomingRequest.fare}</p>
                    <p className="text-xs text-muted-foreground">Cash / M-Pesa</p>
                  </div>
                </div>

                <div className="bg-background/60 rounded-xl p-3 mb-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0"><div className="w-2 h-2 rounded-full bg-white" /></div>
                    <div><p className="text-xs text-muted-foreground">Pickup</p><p className="text-sm font-medium line-clamp-2">{incomingRequest.pickup.address}</p></div>
                  </div>
                  <div className="ml-2.5 w-px h-4 bg-border" />
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"><div className="w-2 h-2 rounded-full bg-secondary-foreground/80" /></div>
                    <div><p className="text-xs text-muted-foreground">Dropoff</p><p className="text-sm font-medium line-clamp-2">{incomingRequest.destination.address}</p></div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{incomingRequest.distance.toFixed(1)} km · {Math.round(incomingRequest.duration)} min</span>
                </div>

                <div className="flex gap-2">
                  <Button variant="hero" className="flex-1 h-11 gap-2" onClick={() => handleAccept(incomingRequest)}>
                    <CheckCircle className="w-4 h-4" />Accept
                  </Button>
                  <Button variant="outline" className="h-11 px-4" onClick={handleDecline}><XCircle className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active ride tracker */}
      <AnimatePresence>
        {activeRide && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 bg-primary text-primary-foreground">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <p className="font-display font-bold text-sm">
                  {activeStage === 'navigating' && 'Navigating to pickup...'}
                  {activeStage === 'arrived' && 'Arrived — waiting for rider'}
                  {activeStage === 'inprogress' && 'Ride in progress'}
                </p>
                <Badge className="ml-auto bg-white/20 text-white border-0 text-xs">KES {activeRide.fare}</Badge>
              </div>
              <div className="p-5">
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary" /><span className="line-clamp-1">{activeRide.pickup.address}</span></div>
                  <div className="flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-secondary" /><span className="line-clamp-1">{activeRide.destination.address}</span></div>
                </div>

                {/* Progress bar */}
                <div className="flex items-center gap-1 mb-2">
                  {(['navigating', 'arrived', 'inprogress'] as const).map((s, i) => (
                    <div key={s} className={`flex-1 h-1.5 rounded-full transition-all ${(['navigating', 'arrived', 'inprogress'] as const).indexOf(activeStage) >= i ? 'bg-primary' : 'bg-muted'}`} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-4 px-0.5"><span>Navigate</span><span>Arrived</span><span>In progress</span></div>

                <div className="grid grid-cols-2 gap-2">
                  {activeStage === 'navigating' && (
                    <>
                      <Button variant="hero" className="h-11 gap-2 col-span-2"
                        onClick={() => { const [lng, lat] = activeRide.pickup.coordinates; window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank', 'noopener'); }}>
                        <ExternalLink className="w-4 h-4" />Open in Google Maps<ChevronRight className="w-3.5 h-3.5 ml-auto" />
                      </Button>
                      <Button variant="outline" className="h-10 gap-1.5 text-sm col-span-2" onClick={handleArrived}>
                        <MapPin className="w-3.5 h-3.5" />Mark as Arrived
                      </Button>
                    </>
                  )}
                  {activeStage === 'arrived' && (
                    <>
                      <Button variant="outline" className="h-10 gap-1.5 text-sm"
                        onClick={() => { const [lng, lat] = activeRide.pickup.coordinates; window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank'); }}>
                        <ExternalLink className="w-3.5 h-3.5" />Maps
                      </Button>
                      <Button variant="hero" className="h-10 gap-1.5 text-sm" onClick={handleStart}>
                        <Zap className="w-3.5 h-3.5" />Start Ride
                      </Button>
                    </>
                  )}
                  {activeStage === 'inprogress' && (
                    <Button variant="hero" className="h-11 gap-2 col-span-2" onClick={handleComplete}>
                      <CheckCircle className="w-4 h-4" />Complete Ride
                    </Button>
                  )}
                </div>

                <Button variant="ghost" size="sm" className="w-full mt-2 text-xs text-destructive hover:bg-destructive/5"
                  onClick={() => { if (activeRideId) emitCancelRide(activeRideId, 'Cancelled by driver'); setActiveRideId(null); setActiveRide(null); }}>
                  Cancel Ride
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                {statsLoading ? (
                  <div className="flex items-center justify-center h-16"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : (
                  <>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.good ? 'bg-primary/10' : 'bg-yellow-500/10'}`}>
                      <s.icon className={`w-4 h-4 ${s.good ? 'text-primary' : 'text-yellow-600'}`} />
                    </div>
                    <p className="text-xs text-muted-foreground mb-0.5">{s.label}</p>
                    <p className="text-xl font-display font-bold">{s.value}</p>
                    <p className={`text-[11px] mt-1 ${s.good ? 'text-primary' : 'text-yellow-600'}`}>{s.sub}</p>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="map" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="map">Live Map</TabsTrigger>
          <TabsTrigger value="history">My Rides</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="map">
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <Map className="w-4 h-4 text-primary" />Live Area Map
                </CardTitle>
                {!isOnline && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <WifiOff className="w-3 h-3" />Go online to receive requests
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <TukTukMap className="h-[300px]" showTukTuks={true} showRoute={false} />
              <p className="mt-2 text-xs text-muted-foreground">Showing available TukTuks near Nairobi. Real driver locations update every 15s when online.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-display text-base">Ride History</CardTitle>
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
                <div className="text-center py-12 text-muted-foreground text-sm">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  No rides yet. Go online to start receiving requests!
                </div>
              ) : (
                <div className="space-y-3">
                  {rideHistory.map(r => (
                    <Card key={r._id}>
                      <CardContent className="flex items-center justify-between pt-4 pb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${
                              r.status === 'completed' ? 'bg-primary/10 text-primary border-primary/20' :
                              r.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                              'bg-muted text-muted-foreground'
                            }`}>{r.status}</Badge>
                            {r.userId && <span className="text-xs text-muted-foreground">{r.userId.name}</span>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{r.pickupLocation?.address || 'Pickup'} → {r.destination?.address || 'Destination'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(r.createdAt).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p className="font-display font-bold">KES {r.fare}</p>
                          <p className="text-xs text-muted-foreground">{(r.distance).toFixed(1)} km</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <FileText className="w-4 h-4" />Profile & Compliance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Operating city</p>
                  <p className="font-medium mt-1">{driverProfile?.driver?.operatingCity || 'Nairobi'}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">M-Pesa payout number</p>
                  <p className="font-medium mt-1">{driverProfile?.driver?.mpesaNumber || user?.phone || 'Not set'}</p>
                </div>
                <div className="rounded-xl border p-4">
                  <p className="text-xs text-muted-foreground">Verification</p>
                  <p className="font-medium mt-1">{driverProfile?.driver?.documents?.isVerified ? 'Verified and active' : 'Pending admin approval'}</p>
                </div>
                <p className="text-xs text-muted-foreground p-3 rounded-lg bg-muted/40 border">
                  These values now come from the backend profile, so driver/account updates can be managed centrally by ops.
                </p>
              </CardContent>
            </Card>

            <RideChatPanel rideId={activeRideId} userRole="driver" />
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
