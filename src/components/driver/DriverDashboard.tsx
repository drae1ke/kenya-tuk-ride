import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockOrders, mockDrivers } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth-context';
import {
  MapPin, Navigation, DollarSign, TrendingUp, FileText,
  CheckCircle, XCircle, Clock, AlertCircle, Car, Map,
  ExternalLink, Phone, Timer, Zap, Target, ChevronRight,
  AlertTriangle, Wifi, WifiOff,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TukTukMap from '@/components/map/TukTukMap';
import { RideOrder } from '@/lib/types';
import {
  connectSocket, getSocket,
  emitDriverOnline, emitDriverOffline, emitDriverLocation,
  emitAcceptRide, emitArrivedAtPickup, emitStartRide, emitCompleteRide,
  emitCancelRide,
  type RideNewRequestEvent,
} from '@/lib/socket-service';
import { formatDistance, formatDuration } from '@/lib/ors-service';

const TOKEN_STORAGE_KEY = 'tookride.auth.token';

interface IncomingRequest {
  rideId: string;
  pickup: { coordinates: [number, number]; address: string };
  destination: { coordinates: [number, number]; address: string };
  fare: number;
  distance: number;   // km
  duration: number;   // minutes
  clientName?: string;
  paymentMethod?: string;
  receivedAt: number;
}

type ActiveRideStage = 'navigating' | 'arrived' | 'inprogress';

const docStatusIcon = (status: string) => {
  if (status === 'approved') return <CheckCircle className="w-4 h-4 text-primary" />;
  if (status === 'rejected') return <XCircle className="w-4 h-4 text-destructive" />;
  return <Clock className="w-4 h-4 text-yellow-500" />;
};

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
  const [activeRideStage, setActiveRideStage] = useState<ActiveRideStage>('navigating');
  const [activeRideData, setActiveRideData] = useState<IncomingRequest | null>(null);

  const locationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverData = mockDrivers[0];
  const pendingOrders = mockOrders.filter(o => o.status === 'pending');
  const myOrders = mockOrders.filter(o => o.driverId === driverData.id);

  const countdown = useCountdown(30, !!incomingRequest);

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return;

    const socket = connectSocket(token);

    socket.on('connect', () => setSocketConnected(true));
    socket.on('disconnect', () => setSocketConnected(false));

    // Incoming ride request from a client
    socket.on('ride:new-request', (data: RideNewRequestEvent) => {
      // Ignore if already on a ride
      if (activeRideId) return;

      setIncomingRequest({
        rideId: data.rideId,
        pickup: data.pickup,
        destination: data.destination,
        fare: data.fare,
        distance: data.distance,
        duration: data.duration,
        receivedAt: Date.now(),
      });

      // Show OS notification if possible
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('New ride request!', {
          body: `${data.pickup.address} → ${data.destination.address} — KES ${data.fare}`,
        });
      }
    });

    socket.on('ride:accepted-confirmation', (data: { rideId: string; pickup: any; destination: any; fare: number }) => {
      toast({ title: '✅ Ride accepted', description: `Navigate to pickup` });
    });

    socket.on('ride:cancelled', (data: { rideId: string; reason: string }) => {
      if (data.rideId === activeRideId) {
        toast({ title: 'Ride cancelled by rider', description: data.reason, variant: 'destructive' });
        setActiveRideId(null); setActiveRideData(null); setActiveRideStage('navigating');
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('ride:new-request');
      socket.off('ride:accepted-confirmation');
      socket.off('ride:cancelled');
    };
  }, [activeRideId]);

  // ── Auto-expire incoming request after 30s ───────────────────────────────────
  useEffect(() => {
    if (countdown === 0 && incomingRequest) {
      setIncomingRequest(null);
      toast({ title: 'Request expired', description: 'The ride request timed out.' });
    }
  }, [countdown, incomingRequest]);

  // ── Location broadcast when online ──────────────────────────────────────────
  useEffect(() => {
    if (isOnline && socketConnected) {
      emitDriverOnline();
      // Broadcast GPS every 10s
      locationIntervalRef.current = setInterval(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(pos => {
          emitDriverLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.heading ?? undefined, pos.coords.speed ?? undefined);
        }, () => {});
      }, 10_000);
    } else {
      if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
      if (!isOnline && socketConnected) emitDriverOffline();
    }
    return () => { if (locationIntervalRef.current) clearInterval(locationIntervalRef.current); };
  }, [isOnline, socketConnected]);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleAcceptRide = (req: IncomingRequest) => {
    const socket = getSocket();
    if (socket?.connected) {
      emitAcceptRide(req.rideId);
    } else {
      // Fallback REST
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/rides/${req.rideId}/accept`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setIncomingRequest(null);
    setActiveRideId(req.rideId);
    setActiveRideData(req);
    setActiveRideStage('navigating');
    toast({ title: '🛺 Ride accepted!', description: `Navigate to ${req.pickup.address}` });
  };

  const handleDeclineRequest = () => {
    setIncomingRequest(null);
    toast({ title: 'Request declined' });
  };

  const handleNavigateToPickup = (req: IncomingRequest) => {
    const [lng, lat] = req.pickup.coordinates;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`, '_blank', 'noopener');
  };

  const handleArrivedAtPickup = () => {
    if (!activeRideId) return;
    const socket = getSocket();
    if (socket?.connected) emitArrivedAtPickup(activeRideId);
    else {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/rides/${activeRideId}/arrive`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setActiveRideStage('arrived');
    toast({ title: '📍 Marked as arrived', description: 'Waiting for rider...' });
  };

  const handleStartRide = () => {
    if (!activeRideId) return;
    const socket = getSocket();
    if (socket?.connected) emitStartRide(activeRideId);
    else {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/rides/${activeRideId}/start`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    setActiveRideStage('inprogress');
    toast({ title: '🚀 Ride started!', description: 'Drive safely!' });
  };

  const handleCompleteRide = () => {
    if (!activeRideId) return;
    const socket = getSocket();
    if (socket?.connected) emitCompleteRide(activeRideId);
    else {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);
      fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/rides/${activeRideId}/complete`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    toast({ title: '✅ Ride completed!', description: `KES ${activeRideData?.fare} earned` });
    setActiveRideId(null); setActiveRideData(null); setActiveRideStage('navigating');
  };

  const handleToggleOnline = () => {
    if (!isOnline) {
      // Request notification permission
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
    setIsOnline(!isOnline);
    if (isOnline) setIncomingRequest(null);
  };

  const orderMapMarkers = pendingOrders.map((order, i) => ({
    id: order.id,
    pickup: { lat: -1.270 - i * 0.008, lng: 36.810 + i * 0.005 },
    dropoff: { lat: -1.285 - i * 0.005, lng: 36.795 + i * 0.008 },
    label: `${order.clientName}: ${order.pickup} → ${order.dropoff}`,
  }));

  const stats = [
    { label: "Today's earnings", value: 'KES 2,340', sub: '▲ 14% vs yesterday', icon: DollarSign, good: true },
    { label: 'Trips today', value: '8', sub: '+2 above avg', icon: Car, good: true },
    { label: 'Rating', value: `${driverData.rating} ★`, sub: `${driverData.totalTrips} reviews`, icon: TrendingUp, good: true },
    { label: 'Acceptance rate', value: '68%', sub: 'Target: 75%', icon: Target, good: false },
  ];

  return (
    <DashboardLayout title="Driver Dashboard" subtitle={`Welcome back, ${user?.name ?? driverData.name}`}>

      {/* Online Status Bar */}
      <div className={`flex items-center justify-between mb-6 p-4 rounded-xl border-2 transition-all ${
        isOnline ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-border'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <div>
            <p className="font-semibold text-sm flex items-center gap-2">
              {isOnline ? 'Online — accepting rides' : 'Offline'}
              <span className={`flex items-center gap-1 text-xs font-normal ${socketConnected ? 'text-primary' : 'text-muted-foreground'}`}>
                {socketConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {socketConnected ? 'Socket connected' : 'Socket offline'}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {isOnline ? 'Broadcasting your location to nearby riders' : 'Go online to start earning'}
            </p>
          </div>
        </div>
        <Button variant={isOnline ? 'outline' : 'hero'} size="sm" onClick={handleToggleOnline}>
          Go {isOnline ? 'Offline' : 'Online'}
        </Button>
      </div>

      {/* INCOMING REQUEST */}
      <AnimatePresence>
        {incomingRequest && isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="mb-6"
          >
            <div className="rounded-2xl border-2 border-secondary/60 bg-secondary/5 overflow-hidden shadow-lg">
              <div className="h-1.5 bg-muted overflow-hidden">
                <motion.div
                  className="h-full bg-secondary"
                  initial={{ width: '100%' }}
                  animate={{ width: `${(countdown / 30) * 100}%` }}
                  transition={{ duration: 0.5 }}
                />
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
                    <p className="text-xs text-muted-foreground">{incomingRequest.paymentMethod ?? 'Cash'}</p>
                  </div>
                </div>

                <div className="bg-background/60 rounded-xl p-3 mb-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="text-sm font-medium line-clamp-2">{incomingRequest.pickup.address}</p>
                    </div>
                  </div>
                  <div className="ml-2.5 w-px h-4 bg-border" />
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-secondary-foreground/80" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dropoff</p>
                      <p className="text-sm font-medium line-clamp-2">{incomingRequest.destination.address}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{(incomingRequest.distance).toFixed(1)} km · {Math.round(incomingRequest.duration)} min</span>
                </div>

                <div className="flex gap-2">
                  <Button variant="hero" className="flex-1 h-11 gap-2" onClick={() => handleAcceptRide(incomingRequest)}>
                    <CheckCircle className="w-4 h-4" />Accept Ride
                  </Button>
                  <Button variant="outline" className="h-11 px-4" onClick={handleDeclineRequest}>
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACTIVE RIDE TRACKER */}
      <AnimatePresence>
        {activeRideData && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-6">
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 bg-primary text-primary-foreground">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <p className="font-display font-bold text-sm">
                  {activeRideStage === 'navigating' && 'Navigating to pickup...'}
                  {activeRideStage === 'arrived' && 'Arrived — waiting for rider'}
                  {activeRideStage === 'inprogress' && 'Ride in progress'}
                </p>
                <Badge className="ml-auto bg-white/20 text-white border-0 text-xs">KES {activeRideData.fare}</Badge>
              </div>
              <div className="p-5">
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary" /><span className="line-clamp-1">{activeRideData.pickup.address}</span></div>
                  <div className="flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-secondary" /><span className="line-clamp-1">{activeRideData.destination.address}</span></div>
                </div>

                {/* Step progress */}
                <div className="flex items-center gap-1 mb-2">
                  {(['navigating', 'arrived', 'inprogress'] as const).map((stage, i) => (
                    <div key={stage} className={`flex-1 h-1.5 rounded-full transition-all ${
                      (['navigating', 'arrived', 'inprogress'] as const).indexOf(activeRideStage) >= i ? 'bg-primary' : 'bg-muted'
                    }`} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-4 px-0.5">
                  <span>Navigate</span><span>Arrived</span><span>In progress</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {activeRideStage === 'navigating' && (
                    <>
                      <Button variant="hero" className="h-11 gap-2 col-span-2" onClick={() => handleNavigateToPickup(activeRideData)}>
                        <ExternalLink className="w-4 h-4" />Navigate to Pickup<ChevronRight className="w-3.5 h-3.5 ml-auto" />
                      </Button>
                      <Button variant="outline" className="h-10 gap-1.5 text-sm col-span-2" onClick={handleArrivedAtPickup}>
                        <MapPin className="w-3.5 h-3.5" />Mark as Arrived
                      </Button>
                    </>
                  )}
                  {activeRideStage === 'arrived' && (
                    <>
                      <Button variant="outline" className="h-10 gap-1.5 text-sm" onClick={() => handleNavigateToPickup(activeRideData)}>
                        <ExternalLink className="w-3.5 h-3.5" />Reopen Maps
                      </Button>
                      <Button variant="hero" className="h-10 gap-1.5 text-sm" onClick={handleStartRide}>
                        <Zap className="w-3.5 h-3.5" />Start Ride
                      </Button>
                    </>
                  )}
                  {activeRideStage === 'inprogress' && (
                    <Button variant="hero" className="h-11 gap-2 col-span-2" onClick={handleCompleteRide}>
                      <CheckCircle className="w-4 h-4" />Complete Ride
                    </Button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs text-destructive hover:bg-destructive/5"
                  onClick={() => {
                    if (activeRideId) emitCancelRide(activeRideId, 'Cancelled by driver');
                    setActiveRideId(null); setActiveRideData(null);
                  }}
                >
                  Cancel Ride
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${stat.good ? 'bg-primary/10' : 'bg-yellow-500/10'}`}>
                  <stat.icon className={`w-4 h-4 ${stat.good ? 'text-primary' : 'text-yellow-600'}`} />
                </div>
                <p className="text-xs text-muted-foreground mb-0.5">{stat.label}</p>
                <p className="text-xl font-display font-bold">{stat.value}</p>
                <p className={`text-[11px] mt-1 ${stat.good ? 'text-primary' : 'text-yellow-600'}`}>{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="orders" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-md">
          <TabsTrigger value="orders">Available Orders</TabsTrigger>
          <TabsTrigger value="history">My Rides</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Map className="w-4 h-4 text-primary" />Nearby Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TukTukMap className="h-[260px]" showTukTuks={false} orderMarkers={orderMapMarkers} />
              <p className="mt-2 text-xs text-muted-foreground">🟢 Pickup · 🟡 Dropoff</p>
            </CardContent>
          </Card>

          {!isOnline && (
            <div className="rounded-xl border-2 border-dashed border-border p-8 text-center mb-4">
              <WifiOff className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Go online to receive ride requests in real-time</p>
            </div>
          )}

          <div className="space-y-3">
            {pendingOrders.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">
                <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No pending orders right now</p>
              </CardContent></Card>
            ) : (
              pendingOrders.map(order => (
                <Card key={order.id} className="border-2 border-secondary/20 hover:border-secondary/40 transition-colors">
                  <CardContent className="pt-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm">{order.clientName}</p>
                        <div className="flex gap-1.5 mt-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{order.distance}</Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{order.duration}</Badge>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                            {order.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xl font-display font-bold text-primary">KES {order.fare}</p>
                    </div>
                    <div className="space-y-1.5 mb-3 text-sm">
                      <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" /><span className="truncate">{order.pickup}</span></div>
                      <div className="flex items-center gap-2"><Navigation className="w-3.5 h-3.5 text-secondary flex-shrink-0" /><span className="truncate">{order.dropoff}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="hero" size="sm" className="flex-1 gap-1.5"
                        onClick={() => handleAcceptRide({
                          rideId: order.id,
                          pickup: { coordinates: [-1.2677, 36.8062], address: order.pickup },
                          destination: { coordinates: [-1.2890, 36.7950], address: order.dropoff },
                          fare: order.fare,
                          distance: parseFloat(order.distance),
                          duration: parseFloat(order.duration),
                          receivedAt: Date.now(),
                        })}
                        disabled={!!activeRideId}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />Accept
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5"
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.pickup)}`, '_blank')}>
                        <ExternalLink className="w-3.5 h-3.5" />Preview Route
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="space-y-3">
            {myOrders.map(order => (
              <Card key={order.id}>
                <CardContent className="flex items-center justify-between pt-5">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{order.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{order.pickup} → {order.dropoff}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-display font-bold">KES {order.fare}</p>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">{order.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <FileText className="w-4 h-4" />My Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {driverData.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3">
                      {docStatusIcon(doc.status)}
                      <div>
                        <p className="font-medium text-sm">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">Uploaded: {doc.uploadedAt}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.status === 'pending' && (
                        <div className="flex items-center gap-1 text-xs text-yellow-600">
                          <AlertTriangle className="w-3 h-3" /><span>Under review</span>
                        </div>
                      )}
                      <Badge variant="outline" className={
                        doc.status === 'approved' ? 'bg-primary/10 text-primary border-primary/20 text-[10px]' :
                        doc.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20 text-[10px]' :
                        'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 text-[10px]'
                      }>{doc.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}