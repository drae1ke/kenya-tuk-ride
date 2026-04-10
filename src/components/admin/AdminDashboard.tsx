import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { mockDrivers, mockClients, mockPricing, mockOrders } from '@/lib/mock-data';
import { Driver, PricingConfig, User } from '@/lib/types';
import {
  Users, Car, DollarSign, TrendingUp, Trash2, Edit, Ban,
  CheckCircle, Settings, Search, Download, MoreHorizontal,
  Star, AlertTriangle, ChevronUp, ChevronDown, RefreshCw,
  MapPin, Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type SortField = 'name' | 'totalTrips' | 'rating' | 'earnings';
type SortDir = 'asc' | 'desc';

const AdminDashboard = () => {
  const { toast } = useToast();
  const [drivers, setDrivers] = useState<Driver[]>(mockDrivers);
  const [clients, setClients] = useState<User[]>(mockClients);
  const [pricing, setPricing] = useState<PricingConfig>(mockPricing);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  // Table state
  const [driverSearch, setDriverSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedDrivers, setSelectedDrivers] = useState<Set<string>>(new Set());
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  const [driverSort, setDriverSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'totalTrips', dir: 'desc' });

  // Live fare preview
  const PREVIEW_DISTANCE = 5; // km
  const previewFare = Math.max(
    pricing.baseFare + PREVIEW_DISTANCE * pricing.perKm,
    pricing.minimumFare
  );

  const filteredDrivers = useMemo(() => {
    let list = drivers.filter(d =>
      d.name.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.email.toLowerCase().includes(driverSearch.toLowerCase()) ||
      d.licensePlate.toLowerCase().includes(driverSearch.toLowerCase())
    );
    list = [...list].sort((a, b) => {
      const v = (x: Driver) => {
        if (driverSort.field === 'name') return x.name;
        if (driverSort.field === 'totalTrips') return x.totalTrips;
        if (driverSort.field === 'rating') return x.rating;
        return x.earnings;
      };
      const av = v(a), bv = v(b);
      if (typeof av === 'string') return driverSort.dir === 'asc' ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return driverSort.dir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return list;
  }, [drivers, driverSearch, driverSort]);

  const filteredClients = useMemo(() =>
    clients.filter(c =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(clientSearch.toLowerCase())
    ), [clients, clientSearch]);

  const toggleSort = (field: SortField) => {
    setDriverSort(prev => prev.field === field ? { field, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'desc' });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (driverSort.field !== field) return <ChevronUp className="w-3 h-3 opacity-20" />;
    return driverSort.dir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  // Actions
  const handleSuspendDriver = (id: string) => {
    setDrivers(prev => prev.map(d => d.id === id ? { ...d, suspended: !d.suspended } : d));
    toast({ title: 'Driver status updated' });
  };

  const handleDeleteDriver = (id: string) => {
    setDrivers(prev => prev.filter(d => d.id !== id));
    setSelectedDrivers(prev => { const s = new Set(prev); s.delete(id); return s; });
    toast({ title: 'Driver removed', variant: 'destructive' });
  };

  const handleBulkSuspendDrivers = () => {
    setDrivers(prev => prev.map(d => selectedDrivers.has(d.id) ? { ...d, suspended: true } : d));
    toast({ title: `${selectedDrivers.size} driver(s) suspended` });
    setSelectedDrivers(new Set());
  };

  const handleBulkDeleteDrivers = () => {
    setDrivers(prev => prev.filter(d => !selectedDrivers.has(d.id)));
    toast({ title: `${selectedDrivers.size} driver(s) removed`, variant: 'destructive' });
    setSelectedDrivers(new Set());
  };

  const handleSuspendClient = (id: string) => {
    setClients(prev => prev.map(c => c.id === id ? { ...c, suspended: !c.suspended } : c));
    toast({ title: 'Client status updated' });
  };

  const handleBulkSuspendClients = () => {
    setClients(prev => prev.map(c => selectedClients.has(c.id) ? { ...c, suspended: true } : c));
    toast({ title: `${selectedClients.size} client(s) suspended` });
    setSelectedClients(new Set());
  };

  const handleUpdatePricing = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: '✅ Pricing updated!', description: 'New rates are now live' });
  };

  const handleSaveDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;
    setDrivers(prev => prev.map(d => d.id === editingDriver.id ? editingDriver : d));
    setEditingDriver(null);
    toast({ title: 'Driver updated!' });
  };

  const handleExportCSV = (type: 'drivers' | 'clients') => {
    const data = type === 'drivers' ? filteredDrivers : filteredClients;
    const headers = type === 'drivers'
      ? ['Name', 'Email', 'Phone', 'Vehicle', 'Plate', 'Trips', 'Rating', 'Earnings', 'Status']
      : ['Name', 'Email', 'Phone', 'Status', 'Joined'];
    const rows = type === 'drivers'
      ? (data as Driver[]).map(d => [d.name, d.email, d.phone, d.vehicle, d.licensePlate, d.totalTrips, d.rating, d.earnings, d.suspended ? 'Suspended' : 'Active'])
      : (data as User[]).map(c => [c.name, c.email, c.phone, c.suspended ? 'Suspended' : 'Active', c.createdAt]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
    a.download = `${type}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    toast({ title: `${type} exported`, description: `${data.length} records` });
  };

  const stats = [
    {
      label: 'Total Drivers', value: drivers.length,
      sub: `${drivers.filter(d => d.online).length} online now`,
      icon: Car, color: 'text-primary', bg: 'bg-primary/10'
    },
    {
      label: 'Total Clients', value: clients.length,
      sub: `${clients.filter(c => !c.suspended).length} active`,
      icon: Users, color: 'text-blue-600', bg: 'bg-blue-500/10'
    },
    {
      label: 'Total Rides', value: mockOrders.length,
      sub: `${mockOrders.filter(o => o.status === 'pending').length} pending`,
      icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-500/10'
    },
    {
      label: 'Revenue', value: `KES ${mockOrders.reduce((a, o) => a + o.fare, 0).toLocaleString()}`,
      sub: `Avg KES ${Math.round(mockOrders.reduce((a, o) => a + o.fare, 0) / mockOrders.length)} / ride`,
      icon: DollarSign, color: 'text-secondary-foreground', bg: 'bg-secondary/20'
    },
  ];

  return (
    <DashboardLayout title="Admin Panel" subtitle="Manage your TookRide platform">

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-xl font-display font-bold mt-0.5">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground mt-1">{stat.sub}</p>
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

        {/* ── DRIVERS TAB ── */}
        <TabsContent value="drivers">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <Car className="w-4 h-4" /> Manage Drivers
                  <Badge variant="outline" className="font-normal text-xs ml-1">{filteredDrivers.length}</Badge>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => handleExportCSV('drivers')}>
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </Button>
                </div>
              </div>

              {/* Search + Filters */}
              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, plate..."
                    value={driverSearch}
                    onChange={e => setDriverSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>

              {/* Bulk actions */}
              {selectedDrivers.size > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">{selectedDrivers.size} selected</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleBulkSuspendDrivers}>
                    <Ban className="w-3 h-3" /> Suspend
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30" onClick={handleBulkDeleteDrivers}>
                    <Trash2 className="w-3 h-3" /> Delete
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedDrivers(new Set())}>
                    Clear
                  </Button>
                </motion.div>
              )}
            </CardHeader>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-muted/30">
                    <th className="w-10 px-4 py-2.5">
                      <Checkbox
                        checked={selectedDrivers.size === filteredDrivers.length && filteredDrivers.length > 0}
                        onCheckedChange={checked => {
                          setSelectedDrivers(checked ? new Set(filteredDrivers.map(d => d.id)) : new Set());
                        }}
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">
                      <button className="flex items-center gap-1" onClick={() => toggleSort('name')}>
                        Driver <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Vehicle</th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('totalTrips')}>
                        Trips <SortIcon field="totalTrips" />
                      </button>
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('rating')}>
                        Rating <SortIcon field="rating" />
                      </button>
                    </th>
                    <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">
                      <button className="flex items-center gap-1 ml-auto" onClick={() => toggleSort('earnings')}>
                        Earnings <SortIcon field="earnings" />
                      </button>
                    </th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2.5 w-24" />
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map(driver => (
                    <tr key={driver.id} className="border-b hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedDrivers.has(driver.id)}
                          onCheckedChange={checked => {
                            setSelectedDrivers(prev => {
                              const s = new Set(prev);
                              checked ? s.add(driver.id) : s.delete(driver.id);
                              return s;
                            });
                          }}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-xs text-primary flex-shrink-0">
                            {driver.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm leading-none">{driver.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{driver.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <p className="text-xs">{driver.vehicle}</p>
                        <p className="text-[11px] text-muted-foreground">{driver.licensePlate}</p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <p className="font-medium text-sm">{driver.totalTrips.toLocaleString()}</p>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Star className="w-3 h-3 text-secondary fill-secondary" />
                          <span className="font-medium text-sm">{driver.rating}</span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right hidden lg:table-cell">
                        <p className="font-medium text-sm">KES {driver.earnings.toLocaleString()}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {driver.online && !driver.suspended && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                          )}
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${driver.suspended
                              ? 'bg-destructive/10 text-destructive border-destructive/20'
                              : driver.online
                                ? 'bg-primary/10 text-primary border-primary/20'
                                : 'bg-muted text-muted-foreground'
                              }`}
                          >
                            {driver.suspended ? 'Suspended' : driver.online ? 'Online' : 'Offline'}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="w-7 h-7" onClick={() => setEditingDriver({ ...driver })}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm">
                              <DialogHeader>
                                <DialogTitle>Edit Driver</DialogTitle>
                              </DialogHeader>
                              {editingDriver && (
                                <form onSubmit={handleSaveDriver} className="space-y-3">
                                  {[
                                    { label: 'Name', key: 'name' as const },
                                    { label: 'Email', key: 'email' as const },
                                    { label: 'Phone', key: 'phone' as const },
                                    { label: 'Vehicle', key: 'vehicle' as const },
                                  ].map(field => (
                                    <div key={field.key} className="space-y-1.5">
                                      <Label className="text-xs">{field.label}</Label>
                                      <Input
                                        value={editingDriver[field.key] as string}
                                        onChange={e => setEditingDriver({ ...editingDriver, [field.key]: e.target.value })}
                                        className="h-9"
                                      />
                                    </div>
                                  ))}
                                  <Button type="submit" variant="hero" className="w-full h-9">Save Changes</Button>
                                </form>
                              )}
                            </DialogContent>
                          </Dialog>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7"
                            onClick={() => handleSuspendDriver(driver.id)}
                            title={driver.suspended ? 'Unsuspend' : 'Suspend'}
                          >
                            {driver.suspended
                              ? <CheckCircle className="w-3.5 h-3.5 text-primary" />
                              : <Ban className="w-3.5 h-3.5 text-yellow-600" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7"
                            onClick={() => handleDeleteDriver(driver.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredDrivers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">
                        No drivers found matching "{driverSearch}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── CLIENTS TAB ── */}
        <TabsContent value="clients">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <Users className="w-4 h-4" /> Manage Clients
                  <Badge variant="outline" className="font-normal text-xs ml-1">{filteredClients.length}</Badge>
                </CardTitle>
                <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={() => handleExportCSV('clients')}>
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search clients..."
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>
              {selectedClients.size > 0 && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex items-center gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">{selectedClients.size} selected</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleBulkSuspendClients}>
                    <Ban className="w-3 h-3" /> Suspend Selected
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedClients(new Set())}>
                    Clear
                  </Button>
                </motion.div>
              )}
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b bg-muted/30">
                    <th className="w-10 px-4 py-2.5">
                      <Checkbox
                        checked={selectedClients.size === filteredClients.length && filteredClients.length > 0}
                        onCheckedChange={checked => setSelectedClients(checked ? new Set(filteredClients.map(c => c.id)) : new Set())}
                      />
                    </th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden md:table-cell">Phone</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground hidden lg:table-cell">Joined</th>
                    <th className="text-center px-3 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2.5 w-20" />
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map(client => (
                    <tr key={client.id} className="border-b hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedClients.has(client.id)}
                          onCheckedChange={checked => {
                            setSelectedClients(prev => {
                              const s = new Set(prev);
                              checked ? s.add(client.id) : s.delete(client.id);
                              return s;
                            });
                          }}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center font-semibold text-xs text-blue-600 flex-shrink-0">
                            {client.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-sm leading-none">{client.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{client.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs hidden md:table-cell">{client.phone}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground hidden lg:table-cell">{client.createdAt}</td>
                      <td className="px-3 py-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${client.suspended
                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                            : 'bg-primary/10 text-primary border-primary/20'
                            }`}
                        >
                          {client.suspended ? 'Suspended' : 'Active'}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={() => handleSuspendClient(client.id)}
                          >
                            {client.suspended
                              ? <><CheckCircle className="w-3 h-3 text-primary" /> Unsuspend</>
                              : <><Ban className="w-3 h-3 text-yellow-600" /> Suspend</>}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* ── PRICING TAB ── */}
        <TabsContent value="pricing">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-base">
                  <Settings className="w-4 h-4" />
                  Pricing Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdatePricing} className="space-y-4">
                  {[
                    { label: 'Base Fare (KES)', key: 'baseFare' as const, min: 0, step: 10 },
                    { label: 'Per Kilometer (KES)', key: 'perKm' as const, min: 0, step: 5 },
                    { label: 'Per Minute (KES)', key: 'perMinute' as const, min: 0, step: 1 },
                    { label: 'Minimum Fare (KES)', key: 'minimumFare' as const, min: 0, step: 10 },
                    { label: 'Surge Multiplier', key: 'surgePricing' as const, min: 1, step: 0.1 },
                  ].map(field => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs font-medium">{field.label}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={field.min}
                          step={field.step}
                          value={pricing[field.key]}
                          onChange={e => setPricing({ ...pricing, [field.key]: parseFloat(e.target.value) || 0 })}
                          className="h-9"
                        />
                        {field.key === 'surgePricing' && pricing.surgePricing > 1.5 && (
                          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" title="High surge — may deter riders" />
                        )}
                      </div>
                    </div>
                  ))}
                  <Button type="submit" variant="hero" className="w-full h-10 gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Update Pricing
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Live Fare Preview */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 font-display text-base">
                    <MapPin className="w-4 h-4 text-primary" />
                    Live Fare Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">Preview how fares will change with your new rates.</p>
                  <div className="space-y-3">
                    {[2, 5, 10, 15].map(km => {
                      const fare = Math.max(pricing.baseFare + km * pricing.perKm, pricing.minimumFare) * pricing.surgePricing;
                      return (
                        <div key={km} className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
                          <div>
                            <p className="font-medium text-sm">{km} km ride</p>
                            <p className="text-[11px] text-muted-foreground">
                              KES {pricing.baseFare} base + {km} × KES {pricing.perKm}
                              {pricing.surgePricing > 1 && ` × ${pricing.surgePricing}x surge`}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-display font-bold text-lg text-primary">KES {Math.round(fare)}</p>
                            {fare <= pricing.minimumFare * pricing.surgePricing && (
                              <p className="text-[10px] text-muted-foreground">min. fare applied</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {pricing.surgePricing > 1 && (
                    <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-700">Surge pricing is active at {pricing.surgePricing}×. All fares are multiplied.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Revenue impact */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="font-display text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    Revenue Snapshot
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: 'Total rides processed', value: mockOrders.length },
                      { label: 'Total platform revenue', value: `KES ${mockOrders.reduce((a, o) => a + o.fare, 0).toLocaleString()}` },
                      { label: 'Avg fare per ride', value: `KES ${Math.round(mockOrders.reduce((a, o) => a + o.fare, 0) / mockOrders.length)}` },
                      { label: 'Completed rides', value: mockOrders.filter(o => o.status === 'completed').length },
                      { label: 'Cancellation rate', value: `${Math.round((mockOrders.filter(o => o.status === 'cancelled').length / mockOrders.length) * 100)}%` },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <span className="font-semibold text-sm">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminDashboard;