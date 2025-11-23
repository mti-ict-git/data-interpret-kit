import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import RegisterVault from "./pages/RegisterVault";
import UpdateVaultCard from "./pages/UpdateVaultCard";
import UserManagement from "./pages/UserManagement";
import Login from "./pages/Login";

const queryClient = new QueryClient();

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'ok' | 'no'>('loading');
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        setStatus(res.ok ? 'ok' : 'no');
      } catch {
        setStatus('no');
      }
    })();
  }, []);
  if (status === 'loading') return <div className="p-6">Checking authentication…</div>;
  if (status === 'no') return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/card-processor" element={<RequireAuth><Index /></RequireAuth>} />
          <Route path="/" element={<Navigate to="/card-processor" replace />} />
          <Route path="/register-vault" element={<RequireAuth><RegisterVault /></RequireAuth>} />
          <Route path="/update-vault" element={<RequireAuth><UpdateVaultCard /></RequireAuth>} />
          <Route path="/activity-log" element={<RequireAuth><ActivityLog /></RequireAuth>} />
          <Route path="/users" element={<RequireAuth><UserManagement /></RequireAuth>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
import ActivityLog from "./pages/ActivityLog";
