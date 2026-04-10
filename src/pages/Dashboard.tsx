import { useAuth } from '@/lib/auth-context';
import { Navigate } from 'react-router-dom';
import ClientDashboard from '@/components/client/ClientDashboard';
import DriverDashboard from '@/components/driver/DriverDashboard';
import AdminDashboard from '@/components/admin/AdminDashboard';

const Dashboard = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAuthenticated || !user) return <Navigate to="/login" />;

  switch (user.role) {
    case 'client':
      return <ClientDashboard />;
    case 'driver':
      return <DriverDashboard />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <Navigate to="/login" />;
  }
};

export default Dashboard;
