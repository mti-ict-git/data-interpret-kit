import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, GalleryVerticalEnd, Mail } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const Login: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const coverImgRef = useRef<HTMLImageElement | null>(null);

  const validate = () => {
    const nextErrors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) nextErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) nextErrors.email = "Enter a valid email";
    if (!password) nextErrors.password = "Password is required";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      if (!validate()) return;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password, remember }),
        credentials: 'include'
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Login failed');
      setServerError(null);
      toast({ title: 'Login successful' });
      navigate('/card-processor');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setServerError(msg);
      toast({ title: 'Login failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const el = coverImgRef.current;
    if (!el) return;
    const prevSrc = el.getAttribute("src") || "";
    const candidates = [
      "/images/wallpaperflare.com_wallpaper.jpg",
      "/images/auth/wallpaperflare.com_wallpaper.jpg",
      "/placeholder.svg",
    ];
    let idx = 0;

    const handleError = () => {
      if (idx < candidates.length - 1) {
        idx += 1;
        el.setAttribute("src", candidates[idx]);
      }
    };

    el.addEventListener("error", handleError);
    el.setAttribute("src", candidates[idx]);

    return () => {
      el.removeEventListener("error", handleError);
      el.setAttribute("src", prevSrc);
    };
  }, []);

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            Data Processor.
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            {serverError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertTitle>Authentication Error</AlertTitle>
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!loading) onSubmit();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <h1 className="text-xl font-semibold">Login to your account</h1>
                <p className="text-sm text-muted-foreground">Enter your email below to login to your account</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={errors.email ? "pl-9 border-destructive focus-visible:ring-destructive" : "pl-9"}
                    aria-invalid={Boolean(errors.email)}
                  />
                  <Mail className="absolute left-2.5 top-2.5 h-5 w-5 text-muted-foreground" />
                </div>
                {errors.email ? (
                  <p className="text-sm text-destructive">{errors.email}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
                    className={errors.password ? "border-destructive focus-visible:ring-destructive" : undefined}
                    aria-invalid={Boolean(errors.password)}
                  />
                </div>
                {capsLock ? (
                  <p className="text-xs text-muted-foreground">Caps Lock is on</p>
                ) : null}
                {errors.password ? (
                  <p className="text-sm text-destructive">{errors.password}</p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(Boolean(v))} />
                <Label htmlFor="remember">Remember me</Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Login
                  </span>
                ) : (
                  'Login'
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By clicking continue, you agree to our
                {' '}
                <Link to="/terms" className="underline underline-offset-4">Terms of Service</Link>
                {' '}and{' '}
                <Link to="/privacy" className="underline underline-offset-4">Privacy Policy</Link>.
              </p>
            </form>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          ref={coverImgRef}
          src="/placeholder.svg"
          alt="Cover"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
};

export default Login;
