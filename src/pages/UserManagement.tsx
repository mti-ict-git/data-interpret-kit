import React, { useEffect, useMemo, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
};

const UserManagement: React.FC = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<{ name: string; email: string; role: string; status: string; password?: string }>({ name: "", email: "", role: "User", status: "Active" });
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Load users failed', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          const u = data?.user;
          if (u && u.id) setCurrentUser({ id: u.id, role: u.role });
        }
      } catch { void 0; }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => [u.name, u.email, u.role, u.status].some(v => (v || '').toLowerCase().includes(q)));
  }, [users, search]);

  const startCreate = () => {
    setEditing(null);
    setForm({ name: "", email: "", role: "User", status: "Active", password: "" });
    setOpenEdit(true);
  };

  const startEdit = (u: User) => {
    setEditing(u);
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status, password: "" });
    setOpenEdit(true);
  };

  const submitForm = async () => {
    try {
      const body = { ...form };
      if (!editing && !(body.password && body.password.length >= 8)) {
        throw new Error('Password must be at least 8 characters');
      }
      if (editing && !body.password) {
        delete body.password;
      }
      if (editing && body.password && body.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      const isAdmin = currentUser?.role === 'Admin';
      if (!isAdmin) {
        delete body.role;
        delete body.status;
      }
      const url = editing ? `/api/users/${editing.id}` : '/api/users';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'include' });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          const m = data?.error || data?.message || message;
          message = typeof m === 'string' ? m : message;
        } catch { void 0; }
        throw new Error(message);
      }
      await fetchUsers();
      setOpenEdit(false);
      toast({ title: editing ? 'User updated' : 'User created' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Save failed', description: msg, variant: 'destructive' });
    }
  };

  const deleteUser = async (id: string) => {
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          const m = data?.error || data?.message || message;
          message = typeof m === 'string' ? m : message;
        } catch { void 0; }
        throw new Error(message);
      }
      await fetchUsers();
      toast({ title: 'User deleted' });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: 'Delete failed', description: msg, variant: 'destructive' });
    }
  };

  return (
    <AppLayout title="User Management">
      <TooltipProvider>
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">Manage application users, roles, and status.</p>
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>Search, create, edit, and delete users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Search name, email, role, status" value={search} onChange={e => setSearch(e.target.value)} />
              <Button variant="outline" onClick={fetchUsers} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
              {currentUser?.role === 'Admin' && (
                <Button onClick={startCreate}>New User</Button>
              )}
            </div>
            <Separator />
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2 pr-4">Role</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td className="py-3 text-muted-foreground" colSpan={5}>No users found</td></tr>
                  ) : (
                    filtered.map(u => (
                      <tr key={u.id} className="border-b">
                        <td className="py-2 pr-4">{u.name}</td>
                        <td className="py-2 pr-4 font-mono">{u.email}</td>
                        <td className="py-2 pr-4">{u.role}</td>
                        <td className="py-2 pr-4">{u.status}</td>
                        <td className="py-2 pr-4">
                          <div className="flex gap-2">
                            { (currentUser?.role === 'Admin' || currentUser?.id === u.id) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => startEdit(u)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit</TooltipContent>
                              </Tooltip>
                            )}
                            { (currentUser?.role === 'Admin' && currentUser?.id !== u.id) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Delete"
                                    onClick={() => { setConfirmDeleteId(u.id); setOpenConfirm(true); }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Delete</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={openConfirm} onOpenChange={(v) => { setOpenConfirm(v); if (!v) setConfirmDeleteId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete user?</AlertDialogTitle>
              <AlertDialogDescription>
                This action is irreversible. The user will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setOpenConfirm(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  if (confirmDeleteId) {
                    await deleteUser(confirmDeleteId);
                  }
                  setOpenConfirm(false);
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit User' : 'New User'}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Name</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Email</label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Password {editing ? '(leave blank to keep current)' : ''}</label>
                <Input type="password" value={form.password || ''} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {currentUser?.role === 'Admin' && (
                <>
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Admin">Admin</SelectItem>
                        <SelectItem value="User">User</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancel</Button>
              <Button onClick={submitForm}>{editing ? 'Save' : 'Create'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      </TooltipProvider>
    </AppLayout>
  );
};

export default UserManagement;