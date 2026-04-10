import { useState, useEffect } from 'react';
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
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TukTukMap from '@/components/map/TukTukMap';
import { RideOrder } from '@/lib/types';

// Open Google Maps with directions to a coordinate or address
const navigateToPickup = (address: string, coords?: { lat: number; lng: number }) => {
  let url: string;
  if (coords) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${coords.lat},${coords.lng}&travelmode=driving`;
  } else {
    const encoded = encodeURIComponent(address);
    url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
};

// Countdown timer hook
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

interface ActiveRideRequest extends RideOrder {
  pickupCoords?: { lat: number; lng: number };
  distanceToPickup?: string;
  etaToPickup?: string;
}

const PENDING_RIDE: ActiveRideRequest = {
  ...mockOrders[2],
  id: 'order-pending-live',
  status: 'pending',
  clientName: 'Sydney Achieng',
  pickup: 'Westlands Mall, Nairobi',
  dropoff: 'Nairobi CBD',
  fare: 350,
  distance: '5.2 km',
  duration: '18 min',
  paymentMethod: 'mpesa',
  pickupCoords: { lat: -1.2677, lng: 36.8062 },
  distanceToPickup: '1.3 km away',
  etaToPickup: '4 min',
  createdAt: new Date().toISOString(),
};

const DriverDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);
  const [activeRequest, setActiveRequest] = useState<ActiveRideRequest | null>(PENDING_RIDE);
  const [acceptedRide, setAcceptedRide] = useState<ActiveRideRequest | null>(null);
  const [rideStage, setRideStage] = useState<'idle' | 'navigating' | 'arrived' | 'inprogress'>('idle');

  const countdown = useCountdown(30, !!activeRequest);

  const driverData = mockDrivers[0];
  const pendingOrders = mockOrders.filter(o => o.status === 'pending');
  const myOrders = mockOrders.filter(o => o.driverId === driverData.id);

  const orderMapMarkers = pendingOrders.map((order, i) => ({
    id: order.id,
    pickup: { lat: -1.270 - i * 0.008, lng: 36.810 + i * 0.005 },
    dropoff: { lat: -1.285 - i * 0.005, lng: 36.795 + i * 0.008 },
    label: `${order.clientName}: ${order.pickup} → ${order.dropoff}`,
  }));

  const handleAcceptRide = (order: ActiveRideRequest) => {
    setAcceptedRide(order);
    setActiveRequest(null);
    setRideStage('navigating');
    toast({
      title: '🛺 Ride accepted!',
      description: `Navigate to ${order.pickup}`,
    });
  };

  const handleDeclineRequest = () => {
    setActiveRequest(null);
    toast({ title: 'Request declined', description: 'You declined this ride request.' });
  };

  const handleNavigateToPickup = (ride: ActiveRideRequest) => {
    navigateToPickup(ride.pickup, ride.pickupCoords);
    toast({
      title: '🗺️ Opening Google Maps',
      description: `Directions to ${ride.pickup}`,
    });
  };

  const handleArrivedAtPickup = () => {
    setRideStage('arrived');
    toast({ title: '📍 Marked as arrived', description: 'Waiting for rider...' });
  };

  const handleStartRide = () => {
    setRideStage('inprogress');
    toast({ title: '🚀 Ride started!', description: 'Drive safely!' });
  };

  const handleCompleteRide = () => {
    toast({ title: '✅ Ride completed!', description: `KES ${acceptedRide?.fare} earned` });
    setAcceptedRide(null);
    setRideStage('idle');
  };

  const docStatusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle className="w-4 h-4 text-primary" />;
    if (status === 'rejected') return <XCircle className="w-4 h-4 text-destructive" />;
    return <Clock className="w-4 h-4 text-yellow-500" />;
  };

  const stats = [
    { label: "Today's earnings", value: 'KES 2,340', sub: '▲ 14% vs yesterday', icon: DollarSign, good: true },
    { label: 'Trips today', value: '8', sub: '+2 above avg', icon: Car, good: true },
    { label: 'Rating', value: `${driverData.rating} ★`, sub: `${driverData.totalTrips} reviews`, icon: TrendingUp, good: true },
    { label: 'Acceptance rate', value: '68%', sub: 'Target: 75%', icon: Target, good: false },
  ];

  return (
    <DashboardLayout title="Driver Dashboard" subtitle={`Welcome back, ${user?.name || driverData.name}`}>

      {/* Online Status Bar */}
      <div className={`flex items-center justify-between mb-6 p-4 rounded-xl border-2 transition-all ${
        isOnline
          ? 'bg-primary/5 border-primary/20'
          : 'bg-muted/50 border-border'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <div>
            <p className="font-semibold text-sm">{isOnline ? 'Online — accepting rides' : 'Offline'}</p>
            <p className="text-xs text-muted-foreground">{isOnline ? 'You are visible to riders nearby' : 'Go online to start earning'}</p>
          </div>
        </div>
        <Button
          variant={isOnline ? 'outline' : 'hero'}
          size="sm"
          onClick={() => {
            setIsOnline(!isOnline);
            if (isOnline) setActiveRequest(null);
            else setActiveRequest(PENDING_RIDE);
          }}
        >
          Go {isOnline ? 'Offline' : 'Online'}
        </Button>
      </div>

      {/* INCOMING RIDE REQUEST BANNER */}
      <AnimatePresence>
        {activeRequest && isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="mb-6"
          >
            <div className="rounded-2xl border-2 border-secondary/60 bg-secondary/5 overflow-hidden shadow-lg">
              {/* Countdown bar */}
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
                    <p className="font-display font-bold text-2xl text-primary">KES {activeRequest.fare}</p>
                    <p className="text-xs text-muted-foreground capitalize">{activeRequest.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}</p>
                  </div>
                </div>

                {/* Rider info */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold text-sm">
                    {activeRequest.clientName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{activeRequest.clientName}</p>
                    <div className="flex gap-2 mt-0.5">
                      <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/30 text-primary bg-primary/5">
                        {activeRequest.distanceToPickup}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-2 py-0">
                        <Timer className="w-2.5 h-2.5 mr-1" />{activeRequest.etaToPickup}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Route */}
                <div className="bg-background/60 rounded-xl p-3 mb-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-white" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="text-sm font-medium">{activeRequest.pickup}</p>
                    </div>
                  </div>
                  <div className="ml-2.5 w-px h-4 bg-border" />
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-5 h-5 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-secondary-foreground/80" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Dropoff</p>
                      <p className="text-sm font-medium">{activeRequest.dropoff}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{activeRequest.distance} ride · {activeRequest.duration}</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="hero"
                    className="flex-1 h-11 gap-2"
                    onClick={() => handleAcceptRide(activeRequest)}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Accept Ride
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 px-4"
                    onClick={handleDeclineRequest}
                  >
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
        {acceptedRide && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-6"
          >
            <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3 bg-primary text-primary-foreground">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <p className="font-display font-bold text-sm">
                  {rideStage === 'navigating' && 'Navigating to pickup...'}
                  {rideStage === 'arrived' && 'Arrived — waiting for rider'}
                  {rideStage === 'inprogress' && 'Ride in progress'}
                </p>
                <Badge className="ml-auto bg-white/20 text-white border-0 text-xs">
                  KES {acceptedRide.fare}
                </Badge>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-semibold">
                    {acceptedRide.clientName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{acceptedRide.clientName}</p>
                    <p className="text-xs text-muted-foreground">{acceptedRide.pickup} → {acceptedRide.dropoff}</p>
                  </div>
                  {rideStage === 'navigating' && (
                    <a
                      href={`tel:+254700000000`}
                      className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center"
                    >
                      <Phone className="w-4 h-4 text-primary" />
                    </a>
                  )}
                </div>

                {/* Step progress */}
                <div className="flex items-center gap-1 mb-5">
                  {['navigating', 'arrived', 'inprogress'].map((stage, i) => (
                    <div key={stage} className="flex items-center gap-1 flex-1">
                      <div className={`h-1.5 w-full rounded-full transition-all ${
                        ['navigating', 'arrived', 'inprogress'].indexOf(rideStage) >= i
                          ? 'bg-primary'
                          : 'bg-muted'
                      }`} />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-4 -mt-3 px-0.5">
                  <span>Navigating</span>
                  <span>Arrived</span>
                  <span>In progress</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Navigate button — always show during navigating */}
                  {rideStage === 'navigating' && (
                    <>
                      <Button
                        variant="hero"
                        className="h-11 gap-2 col-span-2"
                        onClick={() => handleNavigateToPickup(acceptedRide)}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Navigate to Pickup
                        <ChevronRight className="w-3.5 h-3.5 ml-auto" />
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 gap-1.5 text-sm col-span-2"
                        onClick={handleArrivedAtPickup}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        Mark as Arrived
                      </Button>
                    </>
                  )}
                  {rideStage === 'arrived' && (
                    <>
                      <Button
                        variant="outline"
                        className="h-10 gap-1.5 text-sm"
                        onClick={() => handleNavigateToPickup(acceptedRide)}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Reopen Maps
                      </Button>
                      <Button variant="hero" className="h-10 gap-1.5 text-sm" onClick={handleStartRide}>
                        <Zap className="w-3.5 h-3.5" />
                        Start Ride
                      </Button>
                    </>
                  )}
                  {rideStage === 'inprogress' && (
                    <Button
                      variant="hero"
                      className="h-11 gap-2 col-span-2"
                      onClick={handleCompleteRide}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Complete Ride
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="relative overflow-hidden">
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
          {/* Map */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-display text-base">
                <Map className="w-4 h-4 text-primary" />
                Nearby Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TukTukMap className="h-[260px]" showTukTuks={false} orderMarkers={orderMapMarkers} />
              <p className="mt-2 text-xs text-muted-foreground">🟢 Pickup · 🟡 Dropoff</p>
            </CardContent>
          </Card>

          <div className="space-y-3">
            {pendingOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No pending orders right now</p>
                </CardContent>
              </Card>
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
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="truncate">{order.pickup}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Navigation className="w-3.5 h-3.5 text-secondary flex-shrink-0" />
                        <span className="truncate">{order.dropoff}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="hero" size="sm" className="flex-1 gap-1.5" onClick={() => handleAcceptRide({ ...order, pickupCoords: { lat: -1.2677, lng: 36.8062 } })}>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Accept
                      </Button>
                      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                        navigateToPickup(order.pickup);
                        toast({ title: 'Opening Maps', description: `Directions to ${order.pickup}` });
                      }}>
                        <ExternalLink className="w-3.5 h-3.5" />
                        Preview Route
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
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                      {order.status}
                    </Badge>
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
                <FileText className="w-4 h-4" />
                My Documents
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
                          <AlertTriangle className="w-3 h-3" />
                          <span>Under review</span>
                        </div>
                      )}
                      <Badge
                        variant="outline"
                        className={
                          doc.status === 'approved' ? 'bg-primary/10 text-primary border-primary/20 text-[10px]' :
                          doc.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20 text-[10px]' :
                          'bg-yellow-500/10 text-yellow-700 border-yellow-500/20 text-[10px]'
                        }
                      >
                        {doc.status}
                      </Badge>
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
};

export default DriverDashboard;