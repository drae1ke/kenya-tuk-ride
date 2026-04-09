import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { Zap, Leaf } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      toast({ title: 'Welcome back!', description: 'Login successful' });
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-primary-foreground/20"
              style={{
                width: `${200 + i * 120}px`,
                height: `${200 + i * 120}px`,
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center"
        >
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
              <Zap className="w-8 h-8 text-secondary-foreground" />
            </div>
          </div>
          <h1 className="text-5xl font-display font-bold text-primary-foreground mb-4">
            TukTuk<span className="text-secondary">Go</span>
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Kenya's first green energy TukTuk ride-hailing platform. Affordable, eco-friendly rides at your fingertips.
          </p>
          <div className="flex items-center justify-center gap-2 mt-8 text-primary-foreground/60">
            <Leaf className="w-4 h-4" />
            <span className="text-sm">Powered by green energy</span>
          </div>
        </motion.div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-display font-bold">
              TukTuk<span className="text-secondary">Go</span>
            </span>
          </div>

          <h2 className="text-3xl font-display font-bold mb-2">Welcome back</h2>
          <p className="text-muted-foreground mb-8">Sign in to your account to continue</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="sydney@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12"
              />
            </div>

            <Button type="submit" variant="hero" className="w-full h-12 text-base">
              Sign In
            </Button>
          </form>

          <p className="text-center mt-6 text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary font-semibold hover:underline">
              Sign up
            </Link>
          </p>

          <div className="mt-8 p-4 rounded-lg bg-muted/50 border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Demo Accounts:</p>
            <div className="space-y-1 text-xs text-muted-foreground">
              <p><span className="font-medium">Client:</span> sydney@example.com</p>
              <p><span className="font-medium">Driver:</span> james@tuktuk.co.ke</p>
              <p><span className="font-medium">Admin:</span> admin@tuktuk.co.ke</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
