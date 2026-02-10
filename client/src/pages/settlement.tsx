import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { SettlementComplianceWizard } from "@/components/SettlementComplianceWizard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CreditCard,
  Building2,
  DollarSign,
  Calendar,
  User,
  Shield,
  FileText,
  Download,
  Hash,
  Percent,
  Mail,
  Clock,
  Tag,
  Layers,
} from "lucide-react";

interface SettlementSession {
  sessionId: string;
  tradeId: number;
  bondId?: number | null;
  amount: number;
  bondName?: string | null;
  issuerName?: string | null;
  assignmentType?: string | null;
  cusip?: string | null;
  unitCount?: number | null;
  unitPrice?: number | null;
  couponRate?: number | null;
  maturityDate?: string | null;
  investorEmail?: string | null;
  status: string;
  paymentReference?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  complianceStatus?: string | null;
  complianceCompletedAt?: string | null;
  acknowledgedAt?: string | null;
  receiptDocumentId?: string | null;
}

function notifyParent(type: string, data?: Record<string, unknown>) {
  if (window.parent !== window) {
    window.parent.postMessage({ type, ...data }, "*");
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatPercentage(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return `${Number(value).toFixed(3)}%`;
}

export default function SettlementPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [paymentReference, setPaymentReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [settlementComplete, setSettlementComplete] = useState(false);
  const [settlementCancelled, setSettlementCancelled] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("session") || "";

  const { data: session, isLoading, error, refetch: refetchSession } = useQuery<SettlementSession>({
    queryKey: ["/api/settlement/session", token],
    queryFn: async () => {
      if (!token) throw new Error("No session token provided");
      const res = await fetch(`/api/settlement/session?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load settlement session");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const completeMutation = useMutation({
    mutationFn: async ({ sessionId, paymentRef, token: sessionToken }: { sessionId: string; paymentRef: string; token: string }) => {
      const res = await apiRequest("POST", "/api/settlement/complete", {
        sessionId,
        paymentReference: paymentRef,
        token: sessionToken,
        acknowledged: true,
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setSettlementComplete(true);
      const ref = variables.paymentRef;
      notifyParent("JACE_SETTLEMENT_SUBMITTED", {
        sessionId: session?.sessionId,
        paymentReference: ref,
      });
      toast({
        title: "Purchase Confirmed",
        description: "Your assignment unit purchase has been confirmed successfully.",
      });
    },
    onError: (err: Error) => {
      notifyParent("JACE_SETTLEMENT_FAILED", {
        sessionId: session?.sessionId,
        reason: err.message,
      });
      toast({
        title: "Purchase Failed",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => { setIsProcessing(false); },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ sessionId, reason, token: sessionToken }: { sessionId: string; reason?: string; token: string }) => {
      const res = await apiRequest("POST", "/api/settlement/cancel", {
        sessionId,
        reason,
        token: sessionToken,
      });
      return res.json();
    },
    onSuccess: () => {
      setSettlementCancelled(true);
      notifyParent("JACE_SETTLEMENT_CANCELLED", {
        sessionId: session?.sessionId,
      });
      toast({
        title: "Purchase Cancelled",
        description: "The assignment unit purchase has been cancelled.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirm = async () => {
    if (!session?.sessionId) return;
    setIsProcessing(true);
    const ref = paymentReference || `JACE-PAY-${Date.now()}`;
    setPaymentReference(ref);
    completeMutation.mutate({ sessionId: session.sessionId, paymentRef: ref, token });
  };

  const handleCancel = () => {
    if (!session?.sessionId || !token) return;
    cancelMutation.mutate({ sessionId: session.sessionId, reason: "User cancelled", token });
  };

  useEffect(() => {
    if (session) {
      notifyParent("JACE_SETTLEMENT_LOADED", { sessionId: session.sessionId });
    }
  }, [session]);

  const complianceComplete = session?.complianceStatus === "complete";
  const canConfirm = acknowledged && complianceComplete && !isProcessing && !completeMutation.isPending;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="settlement-no-token">
        <Card className="w-full max-w-md border-red-500/50 bg-slate-800/80 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Invalid Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">No settlement session token was provided. Please return to BondAI and try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="settlement-loading">
        <Card className="w-full max-w-md bg-slate-800/80 border-slate-700 text-white">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
            <p className="text-slate-300">Loading settlement session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="settlement-error">
        <Card className="w-full max-w-md border-red-500/50 bg-slate-800/80 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap text-red-400">
              <XCircle className="h-5 w-5" />
              Session Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">{(error as Error).message}</p>
            <p className="text-slate-400 text-sm mt-2">Please return to BondAI and start a new settlement session.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (settlementComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6" data-testid="settlement-complete">
        <Card className="w-full max-w-3xl border-emerald-500/50 bg-slate-800/80 text-white">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            </div>
            <CardTitle className="text-2xl text-emerald-400" data-testid="text-purchase-confirmed">Purchase Confirmed</CardTitle>
            <CardDescription className="text-slate-300">
              Your assignment unit purchase has been confirmed and is being processed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg bg-slate-700/50 p-5 space-y-3">
              <div className="flex justify-between flex-wrap gap-1 text-sm">
                <span className="text-slate-400">Bond/Assignment</span>
                <span className="text-white font-medium" data-testid="text-confirmed-bond-name">{session?.bondName || "N/A"}</span>
              </div>
              <Separator className="bg-slate-600" />
              <div className="flex justify-between flex-wrap gap-1 text-sm">
                <span className="text-slate-400">Trade ID</span>
                <span className="text-white font-medium" data-testid="text-confirmed-trade-id">{session?.tradeId}</span>
              </div>
              <Separator className="bg-slate-600" />
              <div className="flex justify-between flex-wrap gap-1 text-sm">
                <span className="text-slate-400">Units</span>
                <span className="text-white font-medium">{session?.unitCount ?? "N/A"}</span>
              </div>
              <Separator className="bg-slate-600" />
              <div className="flex justify-between flex-wrap gap-1 text-sm">
                <span className="text-slate-400">Price Per Unit</span>
                <span className="text-white font-medium">{formatCurrency(session?.unitPrice)}</span>
              </div>
              <Separator className="bg-slate-600" />
              <div className="flex justify-between flex-wrap gap-1 text-sm">
                <span className="text-slate-400">Total Purchase Amount</span>
                <span className="text-emerald-400 font-bold text-lg" data-testid="text-confirmed-amount">{formatCurrency(session?.amount)}</span>
              </div>
              <Separator className="bg-slate-600" />
              <div className="flex justify-between flex-wrap gap-1 text-sm">
                <span className="text-slate-400">Payment Reference</span>
                <span className="text-white font-mono text-xs" data-testid="text-confirmed-reference">{paymentReference}</span>
              </div>
            </div>

            <p className="text-center text-slate-300 text-sm">
              Your purchase confirmation receipt is now available in your Investor Portal.
            </p>

            <div className="flex justify-center">
              <Button
                variant="outline"
                className="border-emerald-500/50 text-emerald-400"
                onClick={() => window.open(`/api/settlement/receipt?token=${encodeURIComponent(token)}`, "_blank")}
                data-testid="button-download-receipt"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Receipt
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (settlementCancelled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 p-6" data-testid="settlement-cancelled">
        <Card className="w-full max-w-md border-amber-500/50 bg-slate-800/80 text-white">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-amber-400" />
            </div>
            <CardTitle className="text-amber-400" data-testid="text-purchase-cancelled">Purchase Cancelled</CardTitle>
            <CardDescription className="text-slate-300">
              Your assignment unit purchase has been cancelled. No charges have been applied.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-slate-400 text-sm">
              You may close this window and return to BondAI.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="settlement-page">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* SECTION 1: HEADER */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-white" data-testid="text-page-title">Assignment Unit Purchase Confirmation</h1>
          <p className="text-slate-400">JACE Management, LLC - Settlement Services</p>
          <div className="flex justify-center mt-3">
            <Badge variant="outline" className="border-indigo-500 text-indigo-400" data-testid="badge-trade-reference">
              <Hash className="h-3 w-3 mr-1" />
              Trade Ref: {session?.tradeId}
            </Badge>
          </div>
        </div>

        {/* SECTION 2: ASSIGNMENT PURCHASE DETAILS */}
        <Card className="border-slate-700 bg-slate-800/80 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <FileText className="h-5 w-5 text-indigo-400" />
              Assignment Purchase Details
            </CardTitle>
            <CardDescription className="text-slate-400">
              Review the details of your assignment unit purchase below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            <div className="rounded-lg bg-slate-700/50 p-5 space-y-3">
              <DetailRow icon={<Building2 className="h-4 w-4 text-indigo-400" />} label="Bond/Assignment Name" value={session?.bondName || "N/A"} testId="text-bond-name" />
              <Separator className="bg-slate-600" />
              <DetailRow icon={<Building2 className="h-4 w-4 text-slate-400" />} label="Issuer Name" value={session?.issuerName || "N/A"} testId="text-issuer-name" />
              <Separator className="bg-slate-600" />
              <DetailRow icon={<Tag className="h-4 w-4 text-slate-400" />} label="Assignment Type" value={session?.assignmentType || "N/A"} testId="text-assignment-type" />
              <Separator className="bg-slate-600" />
              <DetailRow icon={<Hash className="h-4 w-4 text-slate-400" />} label="CUSIP" value={session?.cusip || "N/A"} testId="text-cusip" mono />
              <Separator className="bg-slate-600" />
              <DetailRow icon={<Hash className="h-4 w-4 text-slate-400" />} label="Trade ID" value={String(session?.tradeId ?? "N/A")} testId="text-trade-id" />
              <Separator className="bg-slate-600" />
              <DetailRow icon={<Layers className="h-4 w-4 text-slate-400" />} label="Number of Units" value={session?.unitCount != null ? String(session.unitCount) : "N/A"} testId="text-unit-count" />
              <Separator className="bg-slate-600" />
              <DetailRow icon={<DollarSign className="h-4 w-4 text-slate-400" />} label="Price Per Unit" value={formatCurrency(session?.unitPrice)} testId="text-unit-price" />
              <Separator className="bg-slate-600" />

              <div className="flex items-start gap-3 py-1">
                <DollarSign className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-slate-400">Total Purchase Amount</p>
                  <p className="text-2xl font-bold text-emerald-400" data-testid="text-total-amount">{formatCurrency(session?.amount)}</p>
                </div>
              </div>

              <Separator className="bg-slate-600" />
              <DetailRow icon={<Percent className="h-4 w-4 text-slate-400" />} label="Coupon Rate" value={formatPercentage(session?.couponRate)} testId="text-coupon-rate" />
              <Separator className="bg-slate-600" />
              <DetailRow icon={<Calendar className="h-4 w-4 text-slate-400" />} label="Maturity Date" value={session?.maturityDate ? new Date(session.maturityDate).toLocaleDateString() : "N/A"} testId="text-maturity-date" />
              <Separator className="bg-slate-600" />
              <DetailRow icon={<Mail className="h-4 w-4 text-slate-400" />} label="Investor Email" value={session?.investorEmail || "N/A"} testId="text-investor-email" />
              <Separator className="bg-slate-600" />
              <DetailRow icon={<Clock className="h-4 w-4 text-slate-400" />} label="Session Expires" value={session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : "N/A"} testId="text-session-expires" />
            </div>
          </CardContent>
        </Card>

        {/* SECTION 3: COMPLIANCE STATUS */}
        {!complianceComplete ? (
          <SettlementComplianceWizard token={token} onComplete={() => refetchSession()} />
        ) : (
          <Card className="border-slate-700 bg-slate-800/80 text-white">
            <CardContent className="pt-6 pb-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-emerald-400 font-semibold" data-testid="text-compliance-complete">Compliance Verification Complete</p>
                <p className="text-slate-400 text-sm">All required compliance checks have been satisfied.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SECTION 4: LEGAL DISCLAIMERS & DISCLOSURES */}
        <Card className="border-slate-700 bg-slate-800/80 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap text-amber-400">
              <Shield className="h-5 w-5" />
              IMPORTANT DISCLOSURES
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-slate-300 text-sm leading-relaxed">
            <p data-testid="text-disclosure-market-risk">
              Assignment units are subject to market risk, including the possible loss of principal. The value of assignment units may fluctuate based on market conditions, creditworthiness of the issuer, interest rate changes, and other factors. There is no guarantee that any assignment unit will maintain its value or generate expected returns.
            </p>
            <Separator className="bg-slate-600" />
            <p data-testid="text-disclosure-past-performance">
              Past performance does not guarantee future results. Any historical returns, expected yields, or projected performance figures are provided for informational purposes only and should not be construed as a guarantee of future performance.
            </p>
            <Separator className="bg-slate-600" />
            <p data-testid="text-disclosure-hold-harmless">
              By confirming this purchase, you agree to hold harmless and indemnify JACE Management, LLC, its officers, directors, employees, and agents from and against any and all claims, damages, losses, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to this assignment unit purchase transaction.
            </p>
            <Separator className="bg-slate-600" />
            <p data-testid="text-disclosure-tax">
              The investor is solely responsible for all tax implications arising from this assignment unit purchase, including but not limited to income taxes, capital gains taxes, and any applicable state or local taxes. JACE Management, LLC does not provide tax advice. Investors are encouraged to consult with a qualified tax professional.
            </p>
            <Separator className="bg-slate-600" />
            <p data-testid="text-disclosure-finality">
              All confirmed transactions are final. Once a purchase is confirmed, it cannot be reversed, cancelled, or refunded except as required by applicable law or at the sole discretion of JACE Management, LLC.
            </p>
          </CardContent>
        </Card>

        {/* SECTION 5: ACKNOWLEDGEMENT CHECKBOX */}
        <Card className="border-slate-700 bg-slate-800/80 text-white">
          <CardContent className="pt-6 pb-6">
            <div className="flex items-start gap-3">
              <Checkbox
                id="acknowledgement"
                checked={acknowledged}
                onCheckedChange={(checked) => setAcknowledged(!!checked)}
                className="mt-1 border-slate-500 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                data-testid="checkbox-acknowledgement"
              />
              <Label htmlFor="acknowledgement" className="text-slate-300 text-sm leading-relaxed cursor-pointer">
                I have read and understand the above disclosures and disclaimers. I acknowledge that this assignment unit purchase is final upon confirmation and I accept all terms, conditions, and risks associated with this transaction. I further agree to the hold harmless and indemnification provisions stated above.
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* SECTION 6: CONFIRMATION ACTIONS */}
        <Card className="border-slate-700 bg-slate-800/80 text-white">
          <CardContent className="pt-6 space-y-4">
            {!complianceComplete && (
              <Alert className="bg-amber-900/30 border-amber-500/50">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <AlertDescription className="text-slate-300">
                  Purchase confirmation is locked until compliance verification is complete.
                </AlertDescription>
              </Alert>
            )}

            {complianceComplete && !acknowledged && (
              <Alert className="bg-indigo-900/30 border-indigo-500/50">
                <Shield className="h-4 w-4 text-indigo-400" />
                <AlertDescription className="text-slate-300">
                  Please review and accept the disclosures above to enable purchase confirmation.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="paymentRef" className="text-slate-300">Payment Reference (Optional)</Label>
              <Input
                id="paymentRef"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Enter a reference for your records"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                data-testid="input-payment-reference"
              />
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300"
              onClick={handleCancel}
              disabled={isProcessing || cancelMutation.isPending}
              data-testid="button-cancel-settlement"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Cancel
            </Button>
            <Button
              className="flex-1 bg-emerald-600 text-white"
              onClick={handleConfirm}
              disabled={!canConfirm}
              data-testid="button-confirm-purchase"
            >
              {isProcessing || completeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Confirm Purchase
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-slate-500 text-xs">
          Session ID: {session?.sessionId}
        </p>
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  testId,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  testId: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-slate-400">{label}</p>
        <p className={`text-white ${mono ? "font-mono text-sm" : ""}`} data-testid={testId}>{value}</p>
      </div>
    </div>
  );
}
