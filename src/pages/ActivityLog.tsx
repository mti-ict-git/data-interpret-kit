import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type AuditRow = {
  id: string;
  userId: string | null;
  userName?: string | null;
  userEmail?: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  oldValues?: string | null;
  newValues?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: string | null;
  createdAt: string;
};

const ActivityLog: React.FC = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    if (search.trim()) qs.set("search", search.trim());
    if (start.trim()) qs.set("start", start.trim());
    if (end.trim()) qs.set("end", end.trim());
    if (limit) qs.set("limit", String(limit));
    if (offset) qs.set("offset", String(offset));
    return qs.toString();
  }, [search, start, end, limit, offset]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/audit-trail?${queryString}`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const r: AuditRow[] = Array.isArray(data.rows) ? data.rows : [];
      setRows(r);
      setTotal(Number(data.total || r.length));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast({ title: "Load Activity Log failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [queryString, toast]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  return (
    <AppLayout title="Activity Log">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail</CardTitle>
            <CardDescription>Filter and inspect application activity recorded in the database.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <Input placeholder="User, action, entity, IP, details" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start</label>
                <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">End</label>
                <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Page size</label>
                <Select value={String(limit)} onValueChange={(v) => { setLimit(Number(v)); setOffset(0); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select page size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={fetchRows} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
              </div>
            </div>

            <div className="overflow-x-auto border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left font-medium p-2">Time</th>
                    <th className="text-left font-medium p-2">User</th>
                    <th className="text-left font-medium p-2">Action</th>
                    <th className="text-left font-medium p-2">Entity</th>
                    <th className="text-left font-medium p-2">IP</th>
                    <th className="text-left font-medium p-2">Details</th>
                    <th className="text-left font-medium p-2">View</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td className="p-3 text-center text-muted-foreground" colSpan={7}>No records</td>
                    </tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={r.id} className="border-b">
                        <td className="p-2">{new Date(r.createdAt).toLocaleString()}</td>
                        <td className="p-2">{r.userName || r.userEmail || r.userId || '-'}</td>
                        <td className="p-2">{r.action}</td>
                        <td className="p-2">{`${r.entityType}${r.entityId ? ` (${String(r.entityId).slice(0, 8)})` : ''}`}</td>
                        <td className="p-2">{r.ipAddress || '-'}</td>
                        <td className="p-2 max-w-[300px] truncate">{r.details || '-'}</td>
                        <td className="p-2">
                          <Button variant="outline" size="sm" onClick={() => { setSelected(r); setOpenDetail(true); }}>Open</Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div className="text-muted-foreground">{total > 0 ? `Showing ${offset + 1}–${offset + rows.length} of ${total}` : 'No results'}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Prev</Button>
                <Button variant="outline" size="sm" disabled={offset + rows.length >= total} onClick={() => setOffset(offset + limit)}>Next</Button>
                <Button size="sm" onClick={async () => {
                  try {
                    const res = await fetch(`/api/audit-trail/export?${queryString}`, { credentials: 'include' });
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'audit-trail.csv';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (err) {
                    const msg = err instanceof Error ? err.message : String(err);
                    toast({ title: 'Export failed', description: msg, variant: 'destructive' });
                  }
                }}>Export CSV</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Dialog open={openDetail} onOpenChange={(v) => { setOpenDetail(v); if (!v) setSelected(null); }}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Entry Detail</DialogTitle>
            </DialogHeader>
            {selected && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-muted-foreground">Time</div>
                    <div>{new Date(selected.createdAt).toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">User</div>
                    <div>{selected.userName || selected.userEmail || selected.userId || '-'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Action</div>
                    <div>{selected.action}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Entity</div>
                    <div>{`${selected.entityType}${selected.entityId ? ` (${selected.entityId})` : ''}`}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">IP</div>
                    <div>{selected.ipAddress || '-'}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">User Agent</div>
                    <div className="break-all">{selected.userAgent || '-'}</div>
                  </div>
                </div>
                {(() => {
                  const parse = (val: unknown) => {
                    const s = String(val || '').trim();
                    if (!s) return null;
                    try { return JSON.parse(s); } catch { return null; }
                  };
                  const pretty = (val: unknown) => {
                    const s = String(val || '').trim();
                    if (!s) return '-';
                    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
                  };
                  const renderKV = (obj: Record<string, unknown>) => (
                    <table className="w-full text-xs">
                      <tbody>
                        {Object.entries(obj).map(([k, v]) => (
                          <tr key={k} className="border-b">
                            <td className="py-1 pr-4 text-muted-foreground align-top">{k}</td>
                            <td className="py-1 font-mono break-all">{typeof v === 'string' ? v : JSON.stringify(v)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                  const Section = ({ title, raw }: { title: string; raw: unknown }) => {
                    const obj = parse(raw);
                    const content = obj ? renderKV(obj as Record<string, unknown>) : (
                      <pre className="p-3 bg-muted rounded overflow-auto max-h-48 text-xs">{pretty(raw)}</pre>
                    );
                    const copyText = obj ? JSON.stringify(obj, null, 2) : String(raw || '').trim();
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-medium">{title}</div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { try { navigator.clipboard.writeText(copyText); } catch (e) { console.warn(e); } }}
                          >
                            Copy
                          </Button>
                        </div>
                        {content}
                      </div>
                    );
                  };
                  return (
                    <>
                      <Section title="Old Values" raw={selected.oldValues} />
                      <Section title="New Values" raw={selected.newValues} />
                      <Section title="Details" raw={selected.details} />
                    </>
                  );
                })()}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default ActivityLog;