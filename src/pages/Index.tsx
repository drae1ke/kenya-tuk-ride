import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

const Index = () => {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/dashboard' : '/login'} />;
};

export default Index;
