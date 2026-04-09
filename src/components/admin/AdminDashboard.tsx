import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { mockDrivers, mockClients, mockPricing, mockOrders } from '@/lib/mock-data';
import { Driver, PricingConfig, User } from '@/lib/types';
import {
  Users, Car, DollarSign, TrendingUp, Shield, Trash2,
  Edit, Ban, CheckCircle, Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminDashboard = () => {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>(mockDrivers);
  const [clients, setClients] = useState<User[]>(mockClients);
  const [pricing, setPricing] = useState<PricingConfig>(mockPricing);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const stats = [
    { label: 'Total Drivers', value: drivers.length, icon: Car, color: 'text-primary' },
    { label: 'Total Clients', value: clients.length, icon: Users, color: 'text-secondary' },
    { label: 'Total Rides', value: mockOrders.length, icon: TrendingUp, color: 'text-primary' },
    { label: 'Revenue', value: `KES ${mockOrders.reduce((a, o) => a + o.fare, 0).toLocaleString()}`, icon: DollarSign, color: 'text-secondary' },
  ];

  const handleSuspendDriver = (id: string) => {
    setDrivers(prev => prev.map(d => d.id === id ? { ...d, suspended: !d.suspended } : d));
    toast({ title: 'Driver status updated' });
  };

  const handleDeleteDriver = (id: string) => {
    setDrivers(prev => prev.filter(d => d.id !== id));
    toast({ title: 'Driver removed', variant: 'destructive' });
  };

  const handleSuspendClient = (id: string) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, suspended: !c.suspended } : c));
    toast({ title: 'Client status updated' });
  };

  const handleUpdatePricing = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: 'Pricing updated!', description: 'New rates are now active' });
  };

  const handleSaveDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    setDrivers(prev => prev.map(d => d.id === editingDriver.id ? editingDriver : d));
    setEditingDriver(null);
    toast({ title: 'Driver updated!' });
  };

  return (
    <DashboardLayout title="Admin Panel" subtitle="Manage your TukTukGo platform">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="flex items-center gap-3 pt-6">
                <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-xl font-display font-bold">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="drivers" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          <TabsTrigger value="drivers">Drivers</TabsTrigger>
          <TabsTrigger value="clients">Clients</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
        </TabsList>

        <TabsContent value="drivers">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Car className="w-5 h-5" /> Manage Drivers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {drivers.map(driver => (
                  <div key={driver.id} className="flex items-center justify-between p-4 rounded-xl border hover:shadow-sm transition-shadow">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{driver.name}</p>
                        {driver.suspended && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                            Suspended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{driver.email} · {driver.phone}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {driver.vehicle} · {driver.licensePlate} · {driver.totalTrips} trips · ★ {driver.rating}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditingDriver({ ...driver })}>
                            <Edit className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Edit Driver</DialogTitle>
                          </DialogHeader>
                          {editingDriver && (
                            <form onSubmit={handleSaveDriver} className="space-y-4">
                              <div className="space-y-2">
                                <Label>Name</Label>
                                <Input value={editingDriver.name} onChange={e => setEditingDriver({ ...editingDriver, name: e.target.value })} />
                              </div>
                              <div className="space-y-2">
                                <Label>Email</Label>
                                <Input value={editingDriver.email} onChange={e => setEditingDriver({ ...editingDriver, email: e.target.value })} />
                              </div>
                              <div className="space-y-2">
                                <Label>Phone</Label>
                                <Input value={editingDriver.phone} onChange={e => setEditingDriver({ ...editingDriver, phone: e.target.value })} />
                              </div>
                              <div className="space-y-2">
                                <Label>Vehicle</Label>
                                <Input value={editingDriver.vehicle} onChange={e => setEditingDriver({ ...editingDriver, vehicle: e.target.value })} />
                              </div>
                              <Button type="submit" variant="hero" className="w-full">Save Changes</Button>
                            </form>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSuspendDriver(driver.id)}
                        title={driver.suspended ? 'Unsuspend' : 'Suspend'}
                      >
                        {driver.suspended ? <CheckCircle className="w-4 h-4 text-primary" /> : <Ban className="w-4 h-4 text-secondary" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteDriver(driver.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Users className="w-5 h-5" /> Manage Clients
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {clients.map(client => (
                  <div key={client.id} className="flex items-center justify-between p-4 rounded-xl border">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{client.name}</p>
                        {client.suspended && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                            Suspended
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{client.email} · {client.phone}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSuspendClient(client.id)}
                      className="gap-2"
                    >
                      {client.suspended ? (
                        <><CheckCircle className="w-4 h-4 text-primary" /> Unsuspend</>
                      ) : (
                        <><Ban className="w-4 h-4 text-secondary" /> Suspend</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricing">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Settings className="w-5 h-5" /> Pricing Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePricing} className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label>Base Fare (KES)</Label>
                  <Input type="number" value={pricing.baseFare} onChange={e => setPricing({ ...pricing, baseFare: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Per Kilometer (KES)</Label>
                  <Input type="number" value={pricing.perKm} onChange={e => setPricing({ ...pricing, perKm: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Per Minute (KES)</Label>
                  <Input type="number" value={pricing.perMinute} onChange={e => setPricing({ ...pricing, perMinute: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Minimum Fare (KES)</Label>
                  <Input type="number" value={pricing.minimumFare} onChange={e => setPricing({ ...pricing, minimumFare: +e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Surge Multiplier</Label>
                  <Input type="number" step="0.1" value={pricing.surgePricing} onChange={e => setPricing({ ...pricing, surgePricing: +e.target.value })} />
                </div>
                <Button type="submit" variant="hero" className="w-full">Update Pricing</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminDashboard;
