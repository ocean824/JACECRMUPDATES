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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, XCircle, Download, RefreshCw, Inbox, FileText, IdCard, ShieldCheck, Landmark, Eye, Send, Loader2 } from "lucide-react";

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
  complianceStatus?: string;
  complianceCompletedAt?: string | null;
  entityType?: string | null;
  entityLegalName?: string | null;
  taxIdType?: string | null;
  taxIdLast4?: string | null;
  idPrimaryDocumentId?: string | null;
  idSecondaryDocumentId?: string | null;
  creditReportDocumentId?: string | null;
  creditProvider?: string | null;
  creditReference?: string | null;
  creditStatus?: string | null;
  compliancePacketDocumentId?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  settledAt: string | null;
  cancelledAt: string | null;
  failureReason: string | null;
  escrowAccountId: string | null;
  webhookStatus?: string | null;
  webhookAttemptCount?: number | null;
  webhookLastError?: string | null;
};

type EscrowAccountSummary = {
  id: string;
  accountName: string;
  bankName: string | null;
  accountNumberLast4: string | null;
  routingNumberLast4: string | null;
  isDefault: boolean;
  isActive: boolean;
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
  const [selectedEscrowId, setSelectedEscrowId] = useState<string>("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const escrowAccounts = useQuery<EscrowAccountSummary[]>({
    queryKey: ["/api/escrow-accounts"],
  });

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

  useEffect(() => {
    if (!location.startsWith("/settlements")) return;
    if (inbox.isLoading) return;
    if ((summary.data?.submittedCount || inboxCount) > 0) {
      setOpen(true);
    }
  }, [location, inbox.isLoading, inboxCount, summary.data?.submittedCount]);

  const confirmMutation = useMutation({
    mutationFn: async ({ sessionId, notes, escrowAccountId }: { sessionId: string; notes: string; escrowAccountId?: string }) => {
      return apiRequest("POST", `/api/admin/settlements/${sessionId}/confirm`, { notes, escrowAccountId: escrowAccountId || undefined });
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

  const resendWebhookMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      return apiRequest("POST", `/api/admin/webhooks/${sessionId}/resend`);
    },
    onSuccess: async () => {
      toast({ title: "Webhook queued", description: "The webhook has been re-queued for delivery." });
      await qc.invalidateQueries({ queryKey: ["settlements"] });
    },
    onError: (err: any) => {
      toast({ title: "Resend failed", description: err?.message || "Unable to resend webhook", variant: "destructive" });
    },
  });

  const active = useMemo(() => {
    if (!activeSessionId) return null;
    return (inbox.data || []).find((s) => s.sessionId === activeSessionId) || (recent.data || []).find((s) => s.sessionId === activeSessionId) || null;
  }, [activeSessionId, inbox.data, recent.data]);

  function openConfirm(sessionId: string) {
    setActiveSessionId(sessionId);
    setMode("confirm");
    const defaultAccount = (escrowAccounts.data || []).find((a) => a.isDefault && a.isActive);
    setSelectedEscrowId(defaultAccount?.id || "");
  }

  function openCancel(sessionId: string) {
    setActiveSessionId(sessionId);
    setMode("cancel");
  }

  function receiptUrl(sessionId: string) {
    return `/api/admin/settlements/${sessionId}/receipt`;
  }

  async function openPreview(sessionId: string) {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/settlements/${sessionId}/preview-token`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to generate preview");
      const data = await res.json();
      setPreviewUrl(data.url);
      setPreviewOpen(true);
    } catch (err: any) {
      toast({ title: "Preview failed", description: err?.message || "Unable to load preview", variant: "destructive" });
    } finally {
      setPreviewLoading(false);
    }
  }

  function adminDocUrl(docId: string) {
    return `/api/admin/documents/${docId}/download`;
  }

  function complianceLabel(status?: string) {
    const s = (status || "not_started").toLowerCase();
    if (s === "complete") return "Complete";
    if (s === "in_progress") return "In Progress";
    return "Not Started";
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
            <TableHead>Compliance</TableHead>
            <TableHead>Docs</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Webhook</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                No settlements in this view.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((s) => (
              <TableRow key={s.sessionId}>
                <TableCell>{new Date(s.createdAt).toLocaleString()}</TableCell>
                <TableCell>#{s.tradeId}</TableCell>
                <TableCell>{s.bondName || "\u2014"}</TableCell>
                <TableCell>{s.investorEmail || s.investorName || "\u2014"}</TableCell>
                <TableCell>{formatMoney(s.amount)}</TableCell>
                <TableCell className="max-w-[220px] truncate" title={s.paymentReference || ""}>
                  {s.paymentReference || "\u2014"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium" data-testid={`compliance-status-${s.sessionId}`}>{complianceLabel(s.complianceStatus)}</span>
                    {s.entityType ? (
                      <span className="text-xs text-muted-foreground">
                        {String(s.entityType).toUpperCase()}
                        {s.taxIdType && s.taxIdLast4 ? ` \u00b7 ${s.taxIdType} \u2022\u2022\u2022\u2022${s.taxIdLast4}` : ""}
                      </span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {s.idPrimaryDocumentId ? (
                      <Button asChild size="icon" variant="ghost" title="Primary ID" data-testid={`doc-primary-id-${s.sessionId}`}>
                        <a href={adminDocUrl(s.idPrimaryDocumentId)} target="_blank" rel="noreferrer">
                          <IdCard className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">ID1</span>
                    )}

                    {s.idSecondaryDocumentId ? (
                      <Button asChild size="icon" variant="ghost" title="Secondary ID" data-testid={`doc-secondary-id-${s.sessionId}`}>
                        <a href={adminDocUrl(s.idSecondaryDocumentId)} target="_blank" rel="noreferrer">
                          <IdCard className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">ID2</span>
                    )}

                    {s.creditReportDocumentId ? (
                      <Button asChild size="icon" variant="ghost" title="Tri-merge / Credit Report" data-testid={`doc-credit-report-${s.sessionId}`}>
                        <a href={adminDocUrl(s.creditReportDocumentId)} target="_blank" rel="noreferrer">
                          <FileText className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : s.creditReference ? (
                      <span className="text-xs text-muted-foreground" title={`Credit ref: ${s.creditReference}`}>CR</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">CR</span>
                    )}

                    {s.compliancePacketDocumentId ? (
                      <Button asChild size="icon" variant="ghost" title="Compliance Packet PDF" data-testid={`doc-compliance-packet-${s.sessionId}`}>
                        <a href={adminDocUrl(s.compliancePacketDocumentId)} target="_blank" rel="noreferrer">
                          <ShieldCheck className="h-4 w-4" />
                        </a>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">PKT</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{s.status}</TableCell>
                <TableCell>
                  {s.status === "settled" ? (
                    <div className="flex items-center gap-1">
                      {s.webhookStatus === "SENT" ? (
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium" data-testid={`webhook-status-${s.sessionId}`}>Delivered</span>
                      ) : s.webhookStatus === "DEAD" ? (
                        <span className="text-xs text-red-600 dark:text-red-400 font-medium" data-testid={`webhook-status-${s.sessionId}`}>Failed</span>
                      ) : s.webhookStatus === "PENDING" ? (
                        <span className="text-xs text-yellow-600 dark:text-yellow-400 font-medium" data-testid={`webhook-status-${s.sessionId}`}>Pending</span>
                      ) : (
                        <span className="text-xs text-muted-foreground" data-testid={`webhook-status-${s.sessionId}`}>N/A</span>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => resendWebhookMutation.mutate(s.sessionId)}
                        disabled={resendWebhookMutation.isPending}
                        title="Resend webhook"
                        data-testid={`resend-webhook-${s.sessionId}`}
                      >
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="outline" disabled={previewLoading} onClick={() => openPreview(s.sessionId)} data-testid={`preview-${s.sessionId}`}>
                    <Eye className="h-4 w-4 mr-1" /> Preview
                  </Button>
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
                      \u2014
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
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["settlements"] })} data-testid="button-refresh-settlements">
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          <Button onClick={() => setOpen(true)} data-testid="button-open-inbox">
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
            <div className="text-3xl font-bold" data-testid="text-submitted-count">{summary.data?.submittedCount ?? inboxCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Pending (Opened, not submitted)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-pending-count">{summary.data?.pendingCount ?? 0}</div>
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
                    <div className="text-sm">{active.investorEmail || active.investorName || "\u2014"}</div>
                  </div>
                  <div>
                    <Label>Amount</Label>
                    <div className="text-sm">{formatMoney(active.amount)}</div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Escrow Account</Label>
                  {(escrowAccounts.data || []).filter((a) => a.isActive).length > 0 ? (
                    <Select value={selectedEscrowId} onValueChange={setSelectedEscrowId}>
                      <SelectTrigger data-testid="select-escrow-account">
                        <SelectValue placeholder="Select escrow account..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(escrowAccounts.data || []).filter((a) => a.isActive).map((a) => (
                          <SelectItem key={a.id} value={a.id} data-testid={`select-escrow-${a.id}`}>
                            <span className="flex items-center gap-2">
                              <Landmark className="h-3 w-3" />
                              {a.accountName}
                              {a.bankName ? ` (${a.bankName})` : ""}
                              {a.accountNumberLast4 ? ` ****${a.accountNumberLast4}` : ""}
                              {a.isDefault ? " [Default]" : ""}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-sm text-destructive font-medium">No escrow accounts configured. <a href="/escrow" className="underline">Create one first</a> and mark it as default.</div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmNotes">Notes (optional)</Label>
                  <Input id="confirmNotes" value={confirmNotes} onChange={(e) => setConfirmNotes(e.target.value)} placeholder="Escrow confirmation details\u2026" data-testid="input-confirm-notes" />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => confirmMutation.mutate({ sessionId: active.sessionId, notes: confirmNotes, escrowAccountId: selectedEscrowId || undefined })}
                    disabled={confirmMutation.isPending || !selectedEscrowId}
                    data-testid="button-confirm-settlement"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Confirm
                  </Button>
                  <Button variant="outline" onClick={() => { setMode(null); setActiveSessionId(null); }} data-testid="button-close-confirm">
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
                  <Input id="cancelReason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Reason for cancellation\u2026" data-testid="input-cancel-reason" />
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={() => cancelMutation.mutate({ sessionId: active.sessionId, reason: cancelReason || "Cancelled by internal user" })}
                    disabled={cancelMutation.isPending}
                    data-testid="button-cancel-settlement"
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Cancel
                  </Button>
                  <Button variant="outline" onClick={() => { setMode(null); setActiveSessionId(null); }} data-testid="button-close-cancel">
                    Close
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={(v) => { setPreviewOpen(v); if (!v) setPreviewUrl(null); }}>
        <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Settlement Page Preview</DialogTitle>
            <DialogDescription>This is the settlement page as the investor sees it from BondAI. Read-only admin preview.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full rounded-md border"
                title="Settlement Preview"
                data-testid="iframe-settlement-preview"
                sandbox="allow-scripts allow-same-origin allow-forms"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">Loading preview...</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
