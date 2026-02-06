import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CheckCircle, XCircle, Download, RefreshCw, Inbox } from "lucide-react";

type SettlementSession = {
  id: string;
  sessionId: string;
  tradeId: number;
  bondId: number | null;
  bondaiInvestorId: number | null;
  investorId: string | null;
  investorName: string | null;
  investorEmail: string | null;
  amount: string;
  bondName: string | null;
  paymentReference: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  settledAt: string | null;
  cancelledAt: string | null;
  failureReason: string | null;
};

function formatMoney(value: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return value;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
  } catch {
    return `$${n.toFixed(2)}`;
  }
}

export default function SettlementsPage() {
  const [location] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [confirmNotes, setConfirmNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<"confirm" | "cancel" | null>(null);

  const summary = useQuery<{ submittedCount: number; pendingCount: number }>({
    queryKey: ["settlements", "summary"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settlements/summary", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settlement summary");
      return res.json();
    },
  });

  const inbox = useQuery<SettlementSession[]>({
    queryKey: ["settlements", "inbox"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settlements?status=submitted&limit=200", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settlements");
      return res.json();
    },
  });

  const recent = useQuery<SettlementSession[]>({
    queryKey: ["settlements", "recent"],
    queryFn: async () => {
      const res = await fetch("/api/admin/settlements?limit=50", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settlements");
      return res.json();
    },
  });

  const inboxCount = inbox.data?.length || 0;

  // Open popup automatically when user visits /settlements and there is inbox work
  useEffect(() => {
    if (!location.startsWith("/settlements")) return;
    if (inbox.isLoading) return;
    if ((summary.data?.submittedCount || inboxCount) > 0) {
      setOpen(true);
    }
  }, [location, inbox.isLoading, inboxCount, summary.data?.submittedCount]);

  const confirmMutation = useMutation({
    mutationFn: async ({ sessionId, notes }: { sessionId: string; notes: string }) => {
      return apiRequest("POST", `/api/admin/settlements/${sessionId}/confirm`, { notes });
    },
    onSuccess: async () => {
      toast({ title: "Settlement confirmed", description: "Receipt generated and BondAI notified." });
      setOpen(true);
      setActiveSessionId(null);
      setMode(null);
      setConfirmNotes("");
      await qc.invalidateQueries({ queryKey: ["settlements"] });
    },
    onError: (err: any) => {
      toast({ title: "Confirm failed", description: err?.message || "Unable to confirm settlement", variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ sessionId, reason }: { sessionId: string; reason: string }) => {
      return apiRequest("POST", `/api/admin/settlements/${sessionId}/cancel`, { reason });
    },
    onSuccess: async () => {
      toast({ title: "Settlement cancelled", description: "The settlement request was cancelled." });
      setActiveSessionId(null);
      setMode(null);
      setCancelReason("");
      await qc.invalidateQueries({ queryKey: ["settlements"] });
    },
    onError: (err: any) => {
      toast({ title: "Cancel failed", description: err?.message || "Unable to cancel settlement", variant: "destructive" });
    },
  });

  const active = useMemo(() => {
    if (!activeSessionId) return null;
    return (inbox.data || []).find((s) => s.sessionId === activeSessionId) || (recent.data || []).find((s) => s.sessionId === activeSessionId) || null;
  }, [activeSessionId, inbox.data, recent.data]);

  function openConfirm(sessionId: string) {
    setActiveSessionId(sessionId);
    setMode("confirm");
  }

  function openCancel(sessionId: string) {
    setActiveSessionId(sessionId);
    setMode("cancel");
  }

  function receiptUrl(sessionId: string) {
    return `/api/admin/settlements/${sessionId}/receipt`;
  }

  const InboxTable = ({ rows }: { rows: SettlementSession[] }) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Created</TableHead>
            <TableHead>Trade</TableHead>
            <TableHead>Bond</TableHead>
            <TableHead>Investor</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                No settlements in this view.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((s) => (
              <TableRow key={s.sessionId}>
                <TableCell>{new Date(s.createdAt).toLocaleString()}</TableCell>
                <TableCell>#{s.tradeId}</TableCell>
                <TableCell>{s.bondName || "—"}</TableCell>
                <TableCell>{s.investorEmail || s.investorName || "—"}</TableCell>
                <TableCell>{formatMoney(s.amount)}</TableCell>
                <TableCell className="max-w-[220px] truncate" title={s.paymentReference || ""}>
                  {s.paymentReference || "—"}
                </TableCell>
                <TableCell>{s.status}</TableCell>
                <TableCell className="text-right space-x-2">
                  {s.status === "submitted" ? (
                    <>
                      <Button size="sm" onClick={() => openConfirm(s.sessionId)} data-testid={`confirm-${s.sessionId}`}>
                        <CheckCircle className="h-4 w-4 mr-1" /> Confirm
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openCancel(s.sessionId)} data-testid={`cancel-${s.sessionId}`}>
                        <XCircle className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </>
                  ) : s.status === "settled" ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={receiptUrl(s.sessionId)} target="_blank" rel="noreferrer">
                        <Download className="h-4 w-4 mr-1" /> Receipt
                      </a>
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled>
                      —
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settlements</h1>
          <p className="text-muted-foreground">Internal settlement inbox. Confirm only after escrow/wire verification.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["settlements"] })}>
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Inbox className="h-4 w-4 mr-1" /> Open Inbox
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Submitted (Needs confirmation)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.data?.submittedCount ?? inboxCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending (Opened, not submitted)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.data?.pendingCount ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inbox (Submitted)</CardTitle>
        </CardHeader>
        <CardContent>
          <InboxTable rows={inbox.data || []} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          <InboxTable rows={recent.data || []} />
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Settlement Inbox</DialogTitle>
            <DialogDescription>New settlement submissions appear here. Confirm only after internal escrow verification.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">{inboxCount} submitted settlement(s) awaiting confirmation.</div>
            <InboxTable rows={inbox.data || []} />

            {mode === "confirm" && active ? (
              <div className="rounded-md border p-4 space-y-3">
                <div className="font-semibold">Confirm Trade #{active.tradeId}</div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <Label>Investor</Label>
                    <div className="text-sm">{active.investorEmail || active.investorName || "—"}</div>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <div className="text-sm">{formatMoney(active.amount)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNotes">Notes (optional)</Label>
                  <Input id="confirmNotes" value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} placeholder="Escrow confirmation details…" />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => confirmMutation.mutate({ sessionId: active.sessionId, notes: confirmNotes })}
                    disabled={confirmMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Confirm
                  </Button>
                  <Button variant="outline" onClick={() => { setMode(null); setActiveSessionId(null); }}>
                    Close
                  </Button>
                </div>
              </div>
            ) : null}

            {mode === "cancel" && active ? (
              <div className="rounded-md border p-4 space-y-3">
                <div className="font-semibold">Cancel Trade #{active.tradeId}</div>
                <div className="space-y-2">
                  <Label htmlFor="cancelReason">Reason</Label>
                  <Input id="cancelReason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation…" />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate({ sessionId: active.sessionId, reason: cancelReason || "Cancelled by internal user" })}
                    disabled={cancelMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button variant="outline" onClick={() => { setMode(null); setActiveSessionId(null); }}>
                    Close
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
