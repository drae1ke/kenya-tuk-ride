import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mockOrders, mockDrivers } from '@/lib/mock-data';
import { useAuth } from '@/lib/auth-context';
import {
  MapPin, Navigation, DollarSign, TrendingUp, FileText,
  CheckCircle, XCircle, Clock, AlertCircle, Car
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DriverDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(true);

  // Use first mock driver as fallback
  const driverData = mockDrivers[0];
  const pendingOrders = mockOrders.filter(o => o.status === 'pending');
  const myOrders = mockOrders.filter(o => o.driverId === driverData.id);

  const handleAcceptOrder = (orderId: string) => {
    toast({ title: 'Order Accepted! 🛺', description: 'Navigate to pickup location' });
  };

  const docStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="w-4 h-4 text-primary" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-secondary" />;
    }
  };

  const stats = [
    { label: 'Total Earnings', value: `KES ${driverData.earnings.toLocaleString()}`, icon: DollarSign, color: 'text-primary' },
    { label: 'Total Trips', value: driverData.totalTrips, icon: Car, color: 'text-secondary' },
    { label: 'Rating', value: `${driverData.rating} ★`, icon: TrendingUp, color: 'text-primary' },
  ];

  return (
    <DashboardLayout title="Driver Dashboard" subtitle={`Welcome, ${user?.name || driverData.name}`}>
      {/* Online toggle */}
      <div className="flex items-center justify-between mb-6 p-4 rounded-xl border bg-card">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
          <span className="font-semibold">{isOnline ? 'Online - Accepting rides' : 'Offline'}</span>
        </div>
        <Button
          variant={isOnline ? 'outline' : 'hero'}
          size="sm"
          onClick={() => setIsOnline(!isOnline)}
        >
          Go {isOnline ? 'Offline' : 'Online'}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
            <Card>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className={`w-12 h-12 rounded-xl bg-muted flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-display font-bold">{stat.value}</p>
                </div>
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
          <div className="space-y-4">
            {pendingOrders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-40" />
                  <p>No pending orders at the moment</p>
                </CardContent>
              </Card>
            ) : (
              pendingOrders.map(order => (
                <Card key={order.id} className="border-2 border-secondary/30">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="font-semibold">{order.clientName}</p>
                        <div className="flex items-center gap-2 text-sm">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                          <span>{order.pickup}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Navigation className="w-3.5 h-3.5 text-secondary" />
                          <span>{order.dropoff}</span>
                        </div>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span>{order.distance}</span>
                          <span>{order.duration}</span>
                          <span className="capitalize">{order.paymentMethod === 'mpesa' ? 'M-Pesa' : 'Cash'}</span>
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <p className="text-2xl font-display font-bold text-primary">KES {order.fare}</p>
                        <Button variant="hero" size="sm" onClick={() => handleAcceptOrder(order.id)}>
                          Accept
                        </Button>
                      </div>
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
                <CardContent className="flex items-center justify-between pt-6">
                  <div>
                    <p className="font-medium">{order.clientName}</p>
                    <p className="text-sm text-muted-foreground">{order.pickup} → {order.dropoff}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display font-bold">KES {order.fare}</p>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs">
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
              <CardTitle className="flex items-center gap-2 font-display">
                <FileText className="w-5 h-5" />
                My Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {driverData.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {docStatusIcon(doc.status)}
                      <div>
                        <p className="font-medium text-sm">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">Uploaded: {doc.uploadedAt}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        doc.status === 'approved' ? 'bg-primary/10 text-primary border-primary/20' :
                        doc.status === 'rejected' ? 'bg-destructive/10 text-destructive border-destructive/20' :
                        'bg-secondary/10 text-secondary-foreground border-secondary/20'
                      }
                    >
                      {doc.status}
                    </Badge>
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
