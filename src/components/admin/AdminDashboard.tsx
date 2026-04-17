import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adminApi } from '@/lib/api';
import { Driver, PricingConfig, User } from '@/lib/types';
import {
  Users, Car, DollarSign, TrendingUp, Trash2, Ban, CheckCircle,
  Search, Download, RefreshCw, MapPin, Clock, Activity,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const emptyPricing: PricingConfig = {
  baseFare: 80,
  bookingFee: 30,
  perKm: 45,
  perMinute: 4,
  minimumFare: 150,
  surgePricing: 1,
  cancellationFee: 100,
  nightSurcharge: 40,
  cbdSurcharge: 30,
  trafficMultiplier: 1.15,
  demandMultiplier: 1,
};

const AdminDashboard = () => {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [clients, setClients] = useState<User[]>([]);
  const [pricing, setPricing] = useState<PricingConfig>(emptyPricing);
  const [dashboardStats, setDashboardStats] = useState({
    totalDrivers: 0,
    totalClients: 0,
    totalRides: 0,
    revenue: 0,
    pendingRides: 0,
    onlineDrivers: 0,
  });
  const [recentRides, setRecentRides] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [driverSearch, setDriverSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const mapBackendDriver = useCallback((driver: any): Driver => ({
    id: driver._id,
    name: driver.name,
    email: driver.email,
    phone: driver.phone,
    role: 'driver',
    avatar: driver.profilePhoto || undefined,
    profilePhoto: driver.profilePhoto || undefined,
    suspended: driver.status !== 'active',
    createdAt: driver.createdAt?.toString() || new Date().toISOString(),
    vehicle: `${driver.vehicle?.make || ''} ${driver.vehicle?.model || ''}`.trim(),
    licensePlate: driver.vehicle?.plateNumber || '',
    rating: driver.rating ?? 0,
    totalTrips: driver.totalRides ?? 0,
    earnings: driver.totalEarnings ?? 0,
    documents: [],
    online: !!driver.online,
    location: driver.currentLocation?.coordinates ? { lat: driver.currentLocation.coordinates[1], lng: driver.currentLocation.coordinates[0] } : undefined,
  }), []);

  const mapBackendClient = useCallback((client: any): User => ({
    id: client._id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    role: 'client',
    avatar: client.profilePhoto || undefined,
    profilePhoto: client.profilePhoto || undefined,
    suspended: !client.isActive,
    createdAt: client.createdAt?.toString() || new Date().toISOString(),
  }), []);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [driverRes, clientRes, dashboardRes, pricingRes] = await Promise.all([
        adminApi.getDrivers(),
        adminApi.getClients(),
        adminApi.getDashboard(),
        adminApi.getPricing(),
      ]);

      setDrivers(driverRes.data.drivers.map(mapBackendDriver));
      setClients(clientRes.data.clients.map(mapBackendClient));
      setDashboardStats(dashboardRes.data.stats);
      setRecentRides(dashboardRes.data.recentRides || []);
      setPricing({
        baseFare: pricingRes.data.pricing.baseFare,
        bookingFee: pricingRes.data.pricing.bookingFee,
        perKm: pricingRes.data.pricing.perKm,
        perMinute: pricingRes.data.pricing.perMinute,
        minimumFare: pricingRes.data.pricing.minimumFare,
        surgePricing: pricingRes.data.pricing.demandMultiplier,
        cancellationFee: pricingRes.data.pricing.cancellationFee,
        nightSurcharge: pricingRes.data.pricing.nightSurcharge,
        cbdSurcharge: pricingRes.data.pricing.cbdSurcharge,
        trafficMultiplier: pricingRes.data.pricing.trafficMultiplier,
        demandMultiplier: pricingRes.data.pricing.demandMultiplier,
      });
    } catch (error: any) {
      toast({ title: 'Failed to load admin dashboard', description: error?.message || 'Please try again', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [mapBackendClient, mapBackendDriver, toast]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const filteredDrivers = useMemo(() => drivers.filter((driver) => (
    driver.name.toLowerCase().includes(driverSearch.toLowerCase()) ||
    driver.email.toLowerCase().includes(driverSearch.toLowerCase()) ||
    driver.licensePlate.toLowerCase().includes(driverSearch.toLowerCase())
  )), [drivers, driverSearch]);

  const filteredClients = useMemo(() => clients.filter((client) => (
    client.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
    client.phone.toLowerCase().includes(clientSearch.toLowerCase())
  )), [clients, clientSearch]);

  const handleSuspendDriver = async (id: string) => {
    const target = drivers.find((driver) => driver.id === id);
    if (!target) return;
    const status = target.suspended ? 'active' : 'suspended';
    await adminApi.updateDriverStatus(id, status);
    setDrivers((prev) => prev.map((driver) => driver.id === id ? { ...driver, suspended: status !== 'active' } : driver));
    toast({ title: `Driver ${status === 'active' ? 'reactivated' : 'suspended'}` });
  };

  const handleSuspendClient = async (id: string) => {
    const target = clients.find((client) => client.id === id);
    if (!target) return;
    await adminApi.updateClientStatus(id, target.suspended);
    setClients((prev) => prev.map((client) => client.id === id ? { ...client, suspended: !client.suspended } : client));
    toast({ title: `Client ${target.suspended ? 'reactivated' : 'suspended'}` });
  };

  const handleDeleteDriver = async (id: string) => {
    await adminApi.deleteDriver(id);
    setDrivers((prev) => prev.filter((driver) => driver.id !== id));
    toast({ title: 'Driver deleted' });
  };

  const handleUpdatePricing = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await adminApi.updatePricing({
        baseFare: pricing.baseFare,
        bookingFee: pricing.bookingFee || 0,
        perKm: pricing.perKm,
        perMinute: pricing.perMinute,
        minimumFare: pricing.minimumFare,
        cancellationFee: pricing.cancellationFee || 0,
        nightSurcharge: pricing.nightSurcharge || 0,
        cbdSurcharge: pricing.cbdSurcharge || 0,
        trafficMultiplier: pricing.trafficMultiplier || 1,
        demandMultiplier: pricing.demandMultiplier || pricing.surgePricing,
      });
      toast({ title: 'Pricing updated', description: 'Kenyan fare configuration is live.' });
      loadAdminData();
    } catch (error: any) {
      toast({ title: 'Pricing update failed', description: error?.message || 'Please try again', variant: 'destructive' });
    }
  };

  const exportCsv = (label: string, rows: string[][]) => {
    const csv = rows.map((row) => row.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `${label}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const stats = [
    { label: 'Total Drivers', value: dashboardStats.totalDrivers, sub: `${dashboardStats.onlineDrivers} online`, icon: Car },
    { label: 'Total Clients', value: dashboardStats.totalClients, sub: 'Rider accounts', icon: Users },
    { label: 'Total Rides', value: dashboardStats.totalRides, sub: `${dashboardStats.pendingRides} active now`, icon: Activity },
    { label: 'Revenue', value: `KES ${dashboardStats.revenue.toLocaleString()}`, sub: 'Completed rides', icon: DollarSign },
  ];

  return (
    <DashboardLayout title="Admin Panel" subtitle="Real-time marketplace control for TookRide Kenya">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, index) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                  <stat.icon className="w-4 h-4 text-primary" />
                </div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-display font-bold">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Marketplace Activity
              </CardTitle>
              <Button variant="outline" size="sm" onClick={loadAdminData} disabled={loading}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentRides.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent rides yet.</p>
            ) : recentRides.map((ride) => (
              <div key={ride._id} className="rounded-xl border p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="capitalize">{ride.status}</Badge>
                    <span className="text-xs text-muted-foreground">{ride.userId?.name || 'Rider'} {ride.driverId?.name ? `with ${ride.driverId.name}` : ''}</span>
                  </div>
                  <p className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-primary" />
                    {ride.pickupLocation?.address || 'Pickup'} to {ride.destination?.address || 'Destination'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold">KES {ride.fare}</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ride.createdAt).toLocaleString('en-KE')}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Fare Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[3, 7, 12].map((km) => {
              const fare = Math.max(
                (pricing.baseFare + (pricing.bookingFee || 0) + km * pricing.perKm + km * pricing.perMinute) * (pricing.demandMultiplier || pricing.surgePricing),
                pricing.minimumFare
              );
              return (
                <div key={km} className="rounded-xl border p-3">
                  <p className="text-sm font-medium">{km} km Nairobi ride</p>
                  <p className="text-xs text-muted-foreground mt-1">Base {pricing.baseFare} + distance {pricing.perKm}/km + time {pricing.perMinute}/min</p>
                  <p className="text-xl font-display font-bold text-primary mt-2">KES {Math.round(fare)}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="drivers" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="drivers">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="font-display text-base">Driver Operations</CardTitle>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={driverSearch} onChange={(e) => setDriverSearch(e.target.value)} placeholder="Search drivers or plates" className="pl-8 h-9" />
                  </div>
                  <Button variant="outline" onClick={() => exportCsv('drivers', [['Name', 'Email', 'Phone', 'Vehicle', 'Plate', 'Status'], ...filteredDrivers.map((driver) => [driver.name, driver.email, driver.phone, driver.vehicle, driver.licensePlate, driver.suspended ? 'Suspended' : 'Active'])])}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredDrivers.map((driver) => (
                <div key={driver.id} className="rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{driver.name}</p>
                      <Badge variant="outline" className={driver.suspended ? 'text-destructive border-destructive/20 bg-destructive/10' : 'text-primary border-primary/20 bg-primary/10'}>
                        {driver.suspended ? 'Suspended' : driver.online ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{driver.email} • {driver.phone}</p>
                    <p className="text-sm mt-1">{driver.vehicle} • {driver.licensePlate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleSuspendDriver(driver.id)}>
                      {driver.suspended ? <CheckCircle className="w-4 h-4 mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                      {driver.suspended ? 'Unsuspend' : 'Suspend'}
                    </Button>
                    <Button variant="outline" className="text-destructive border-destructive/20" onClick={() => handleDeleteDriver(driver.id)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="font-display text-base">Client Accounts</CardTitle>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} placeholder="Search clients" className="pl-8 h-9" />
                  </div>
                  <Button variant="outline" onClick={() => exportCsv('clients', [['Name', 'Email', 'Phone', 'Status'], ...filteredClients.map((client) => [client.name, client.email, client.phone, client.suspended ? 'Suspended' : 'Active'])])}>
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {filteredClients.map((client) => (
                <div key={client.id} className="rounded-xl border p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{client.name}</p>
                      <Badge variant="outline" className={client.suspended ? 'text-destructive border-destructive/20 bg-destructive/10' : 'text-primary border-primary/20 bg-primary/10'}>
                        {client.suspended ? 'Suspended' : 'Active'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{client.email} • {client.phone}</p>
                  </div>
                  <Button variant="outline" onClick={() => handleSuspendClient(client.id)}>
                    {client.suspended ? <CheckCircle className="w-4 h-4 mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
                    {client.suspended ? 'Unsuspend' : 'Suspend'}
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Kenyan Pricing Controls</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePricing} className="space-y-4">
                  {[
                    ['Base Fare', 'baseFare'],
                    ['Booking Fee', 'bookingFee'],
                    ['Per Km', 'perKm'],
                    ['Per Minute', 'perMinute'],
                    ['Minimum Fare', 'minimumFare'],
                    ['Cancellation Fee', 'cancellationFee'],
                    ['Night Surcharge', 'nightSurcharge'],
                    ['CBD Surcharge', 'cbdSurcharge'],
                  ].map(([label, key]) => (
                    <div key={key} className="space-y-1.5">
                      <Label>{label}</Label>
                      <Input type="number" value={String((pricing as any)[key] ?? 0)} onChange={(e) => setPricing((prev) => ({ ...prev, [key]: Number(e.target.value) }))} />
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Traffic Multiplier</Label>
                      <Input type="number" step="0.01" value={String(pricing.trafficMultiplier ?? 1)} onChange={(e) => setPricing((prev) => ({ ...prev, trafficMultiplier: Number(e.target.value) }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Demand Multiplier</Label>
                      <Input type="number" step="0.01" value={String(pricing.demandMultiplier ?? pricing.surgePricing)} onChange={(e) => setPricing((prev) => ({ ...prev, demandMultiplier: Number(e.target.value), surgePricing: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <Button type="submit" className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Save Pricing
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-display text-base">Current Fare Logic</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Airport to CBD', km: 18, minutes: 35 },
                  { label: 'Westlands to Kilimani', km: 7, minutes: 22 },
                  { label: 'CBD short hop', km: 3, minutes: 12 },
                ].map((sample) => {
                  const estimate = Math.max(
                    pricing.minimumFare,
                    (
                      pricing.baseFare +
                      (pricing.bookingFee || 0) +
                      sample.km * pricing.perKm +
                      sample.minutes * pricing.perMinute +
                      (pricing.cbdSurcharge || 0)
                    ) * (pricing.demandMultiplier || pricing.surgePricing)
                  );
                  return (
                    <div key={sample.label} className="rounded-xl border p-4">
                      <p className="font-medium">{sample.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{sample.km} km • {sample.minutes} min</p>
                      <p className="text-2xl font-display font-bold text-primary mt-2">KES {Math.round(estimate)}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminDashboard;
