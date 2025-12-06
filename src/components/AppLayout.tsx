import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Link, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileImage, Shield, PenSquare, Users } from "lucide-react";

type AppLayoutProps = {
  title?: string;
  children: React.ReactNode;
};

export const AppLayout: React.FC<AppLayoutProps> = ({ title, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isActive = (path: string) => location.pathname === path;
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string; name?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const u = data?.user;
          if (u && u.id) setCurrentUser({ id: u.id, role: u.role, name: u.name });
        }
      } catch { void 0; }
    })();
  }, []);

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCurrentUser(null);
      toast({ title: 'Logged out' });
      navigate('/login');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Logout failed', description: msg, variant: 'destructive' });
    }
  };

  const routeLabels: Record<string, string> = {
    "/card-processor": "ID Card Processor",
    "/register-vault": "Register Vault",
    "/update-vault": "Update Vault Card",
    "/users": "User Management",
    "/activity-log": "Activity Log",
  };
  const pageLabel = routeLabels[location.pathname] || title || "Dashboard";

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="offcanvas" side="left">
        <SidebarHeader>
          <div className="px-2 py-1">
            <span className="text-sm font-semibold">Data Interpret Kit</span>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Link to="/card-processor" className="contents">
                <SidebarMenuButton isActive={isActive("/card-processor")}> 
                  <FileImage />
                  <span>ID Card Processor</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link to="/register-vault" className="contents">
                <SidebarMenuButton isActive={isActive("/register-vault")}> 
                  <Shield />
                  <span>Register Vault</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <Link to="/update-vault" className="contents">
                <SidebarMenuButton isActive={isActive("/update-vault")}> 
                  <PenSquare />
                  <span>Update Vault Card</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
            {currentUser?.role === 'Admin' && (
              <SidebarMenuItem>
                <Link to="/users" className="contents">
                  <SidebarMenuButton isActive={isActive("/users")}>
                    <Users />
                    <span>User Management</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}
            {currentUser?.role === 'Admin' && (
              <SidebarMenuItem>
                <Link to="/activity-log" className="contents">
                  <SidebarMenuButton isActive={isActive("/activity-log")}>
                    <Users />
                    <span>Activity Log</span>
                  </SidebarMenuButton>
                </Link>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>

      <SidebarInset>
        <header className={cn("bg-background sticky top-0 flex h-16 shrink-0 items-center gap-2 border-b px-4")}> 
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="hidden md:block">
                <BreadcrumbLink href="/">Home</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator className="hidden md:block" />
              <BreadcrumbItem>
                <BreadcrumbPage>{pageLabel}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-3">
            {currentUser && (
              <span className="text-sm text-muted-foreground">{currentUser.name || 'User'} ({currentUser.role})</span>
            )}
            <Button variant="outline" size="sm" onClick={handleLogout}>Logout</Button>
          </div>
        </header>
        <div className="container mx-auto px-4 py-6">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppLayout;
