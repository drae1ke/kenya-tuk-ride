import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth-context';
import { Truck, User, Car, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'client' | 'driver'>('client');
  const [error, setError] = useState('');
  const { signup, isSubmitting } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const passwordMismatch = password && confirmPassword && password !== confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    const { success, error: err } = await signup(name, email, phone, password, role);
    if (success) {
      toast({ title: 'Account created!', description: 'Welcome to TookRide 🛺' });
      navigate('/dashboard');
    } else {
      setError(err || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Truck className="w-6 h-6 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold">Join Took<span className="text-secondary">Ride</span></h1>
          <p className="text-muted-foreground mt-2">Create your account</p>
        </div>

        <div className="bg-card rounded-2xl p-8 shadow-xl border">
          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
            </motion.div>
          )}

          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {[
              { id: 'client', label: 'Rider', sub: 'Book rides', icon: User },
              { id: 'driver', label: 'Driver', sub: 'Earn money', icon: Car },
            ].map(r => (
              <button key={r.id} type="button" onClick={() => { setRole(r.id as any); setError(''); }}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${role === r.id ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'}`}>
                <r.icon className={`w-5 h-5 ${role === r.id ? 'text-primary' : 'text-muted-foreground'}`} />
                <div className="text-left">
                  <p className="font-semibold text-sm">{r.label}</p>
                  <p className="text-xs text-muted-foreground">{r.sub}</p>
                </div>
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { id: 'name', label: 'Full Name', type: 'text', placeholder: 'Sydney Achieng', value: name, set: setName },
              { id: 'email', label: 'Email', type: 'email', placeholder: 'sydney@example.com', value: email, set: setEmail },
              { id: 'phone', label: 'Phone Number', type: 'tel', placeholder: '0712345678 or +254712345678', value: phone, set: setPhone },
            ].map(f => (
              <div key={f.id} className="space-y-2">
                <Label htmlFor={f.id}>{f.label}</Label>
                <Input id={f.id} type={f.type} placeholder={f.placeholder} value={f.value}
                  onChange={e => { f.set(e.target.value); setError(''); }} required className="h-12" disabled={isSubmitting} />
              </div>
            ))}

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="Min. 6 characters" value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }} required className="h-12" disabled={isSubmitting} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input id="confirm-password" type="password" placeholder="Repeat password" value={confirmPassword}
                  onChange={e => { setConfirmPassword(e.target.value); setError(''); }} required
                  className={`h-12 pr-10 ${passwordMismatch ? 'border-destructive' : passwordsMatch ? 'border-primary' : ''}`}
                  disabled={isSubmitting} />
                {passwordsMatch && <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary" />}
              </div>
              {passwordMismatch && <p className="text-xs text-destructive">Passwords don't match</p>}
            </div>

            {role === 'driver' && (
              <div className="p-3 rounded-lg bg-secondary/10 border border-secondary/20 text-xs text-muted-foreground">
                Driver accounts require admin review before activation. Admin accounts are created internally and are not available through signup.
              </div>
            )}

            <Button type="submit" variant="hero" className="w-full h-12 text-base gap-2" disabled={isSubmitting || !!passwordMismatch}>
              {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</> : 'Create Account'}
            </Button>
          </form>
        </div>

        <p className="text-center mt-6 text-muted-foreground">
          Already have an account?{' '}
          <Link to="/login" className="text-primary font-semibold hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
};

export default Signup;
