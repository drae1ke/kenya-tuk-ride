import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { mockOrders } from '@/lib/mock-data';
import { MapPin, Navigation, CreditCard, Banknote, Clock, Star, Map, LocateFixed, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import TukTukMap from '@/components/map/TukTukMap';

const ClientDashboard = () => {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'cash'>('mpesa');
  const [isTracking, setIsTracking] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const { toast } = useToast();

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Error', description: 'Geolocation is not supported by your browser', variant: 'destructive' });
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        // Reverse geocode using Nominatim (free, no API key)
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`)
          .then(res => res.json())
          .then(data => {
            const address = data.display_name?.split(',').slice(0, 3).join(',') || `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            setPickup(address);
            toast({ title: '📍 Location found', description: address });
          })
          .catch(() => {
            setPickup(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
          })
          .finally(() => setGettingLocation(false));
      },
      (error) => {
        setGettingLocation(false);
        toast({ title: 'Location access denied', description: 'Please enter your pickup location manually', variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Simulated pickup/dropoff coordinates for tracking
  const trackingPickup = { lat: -1.2721, lng: 36.8110 };
  const trackingDropoff = { lat: -1.2890, lng: 36.7950 };

  const handleBookRide = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: 'Ride Requested! 🛺',
      description: `Looking for a TukTuk from ${pickup} to ${dropoff}`,
    });
    setIsTracking(true);
    setPickup('');
    setDropoff('');
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-primary/10 text-primary border-primary/20';
      case 'pending': return 'bg-secondary/10 text-secondary-foreground border-secondary/20';
      case 'in_progress': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return '';
    }
  };

  return (
    <DashboardLayout title="Book a Ride" subtitle="Find a TukTuk near you">
      {/* Map View */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between font-display">
              <span className="flex items-center gap-2">
                <Map className="w-5 h-5 text-primary" />
                {isTracking ? 'Live Ride Tracking' : 'Available TukTuks Near You'}
              </span>
              {isTracking && (
                <Button variant="outline" size="sm" onClick={() => setIsTracking(false)}>
                  End Tracking
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TukTukMap
              className="h-[350px]"
              showTukTuks={!isTracking}
              showRoute={isTracking}
              pickup={isTracking ? trackingPickup : null}
              dropoff={isTracking ? trackingDropoff : null}
              onTukTukSelect={(tuktuk) =>
                toast({
                  title: `🛺 ${tuktuk.name}`,
                  description: `${tuktuk.vehicle} — ★ ${tuktuk.rating}`,
                })
              }
            />
            {isTracking && (
              <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span>Your TukTuk is on the way — estimated arrival in 5 min</span>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Booking card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-1"
        >
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Navigation className="w-5 h-5 text-primary" />
                New Ride
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleBookRide} className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    Pickup Location
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g. Westlands, Nairobi"
                      value={pickup}
                      onChange={(e) => setPickup(e.target.value)}
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleUseMyLocation}
                      disabled={gettingLocation}
                      title="Use my current location"
                      className="shrink-0"
                    >
                      {gettingLocation ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LocateFixed className="w-4 h-4 text-primary" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-secondary" />
                    Dropoff Location
                  </Label>
                  <Input
                    placeholder="e.g. CBD, Nairobi"
                    value={dropoff}
                    onChange={(e) => setDropoff(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mpesa')}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm ${
                        paymentMethod === 'mpesa' ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-primary" />
                      M-Pesa
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-sm ${
                        paymentMethod === 'cash' ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <Banknote className="w-4 h-4 text-primary" />
                      Cash
                    </button>
                  </div>
                </div>

                <Button type="submit" variant="hero" className="w-full h-12">
                  Request TukTuk 🛺
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent rides */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Clock className="w-5 h-5 text-muted-foreground" />
                Recent Rides
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-start justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className={statusColor(order.status)}>
                          {order.status.replace('_', ' ')}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                          <span>{order.pickup}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-secondary" />
                          <span>{order.dropoff}</span>
                        </div>
                      </div>
                      {order.driverName && (
                        <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                          <Star className="w-3 h-3 text-secondary" />
                          <span>Driver: {order.driverName}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-display font-bold text-lg">KES {order.fare}</p>
                      <p className="text-xs text-muted-foreground capitalize">{order.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default ClientDashboard;
