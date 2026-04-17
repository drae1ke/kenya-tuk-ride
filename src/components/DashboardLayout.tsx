import { ReactNode } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Truck, LogOut, User, Monitor, ShieldCheck } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

const DashboardLayout = ({ children, title, subtitle }: DashboardLayoutProps) => {
  const { user, logout, sessions } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const roleBadge = user?.role === 'admin' ? 'Admin' : user?.role === 'driver' ? 'Driver' : 'Rider';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-display font-bold">
              Took<span className="text-secondary">Ride</span>
            </span>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {roleBadge}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border">
              <Monitor className="w-3.5 h-3.5" />
              <span>{sessions.length || 1} active session{(sessions.length || 1) > 1 ? 's' : ''}</span>
            </div>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <span className="font-medium block leading-none">{user?.name}</span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                  <ShieldCheck className="w-3 h-3" />
                  {user?.phone}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
        </div>
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
