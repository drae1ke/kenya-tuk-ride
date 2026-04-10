import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { Truck, User, Car } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'client' | 'driver'>('client');
  const { signup } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both password fields are identical.',
      });
      return;
    }

    if (signup(name, email, phone, password, role)) {
      toast({ title: 'Account created!', description: 'Welcome to TukTukGo' });
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Truck className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold">
            Join Took<span className="text-secondary">Ride</span>
          </h1>
          <p className="text-muted-foreground mt-2">Create your account</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-xl border">
          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole('client')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                role === 'client'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <User className={`w-5 h-5 ${role === 'client' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="text-left">
                <p className="font-semibold text-sm">Rider</p>
                <p className="text-xs text-muted-foreground">Book rides</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRole('driver')}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                role === 'driver'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted-foreground/30'
              }`}
            >
              <Car className={`w-5 h-5 ${role === 'driver' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div className="text-left">
                <p className="font-semibold text-sm">Driver</p>
                <p className="text-xs text-muted-foreground">Earn money</p>
              </div>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="Sydney Achieng" value={name} onChange={(e) => setName(e.target.value)} required className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="sydney@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" placeholder="+254712345678" value={phone} onChange={(e) => setPhone(e.target.value)} required className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="h-12"
              />
            </div>
            <Button type="submit" variant="hero" className="w-full h-12 text-base">
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Signup;
