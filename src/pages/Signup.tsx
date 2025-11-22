import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";

const Signup: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!name || !email || !password) {
      toast({ title: "Missing fields", description: "Please fill name, email, and password.", variant: "destructive" });
      return;
    }
    if (password.length < 8) {
      toast({ title: "Weak password", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords mismatch", description: "Confirm password does not match.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Sign up failed');
      toast({ title: 'Account created', description: 'Welcome!' });
      navigate('/card-processor');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Sign up failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Sign up to access the dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Password</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Confirm Password</label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button className="w-full" onClick={onSubmit} disabled={loading || !name || !email || !password || !confirm}>{loading ? 'Creating…' : 'Sign Up'}</Button>
          <div className="text-sm text-center text-muted-foreground">Already have an account? <Link to="/login" className="underline">Sign in</Link></div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;