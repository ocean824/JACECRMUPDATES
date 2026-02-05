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
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, CreditCard, Building2, DollarSign, Calendar, User, Shield } from "lucide-react";

interface SettlementSession {
  sessionId: string;
  tradeId: number;
  bondId?: number;
  amount: string;
  bondName?: string;
  investorEmail?: string;
  status: string;
  expiresAt?: string;
  createdAt: string;
}

function notifyParent(type: string, data?: Record<string, unknown>) {
  if (window.parent !== window) {
    window.parent.postMessage({ type, ...data }, "*");
  }
}

export default function SettlementPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [paymentReference, setPaymentReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [settlementComplete, setSettlementComplete] = useState(false);
  const [settlementCancelled, setSettlementCancelled] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("session") || "";

  const { data: session, isLoading, error } = useQuery<SettlementSession>({
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
      });
      return res.json();
    },
    onSuccess: () => {
      setSettlementComplete(true);
      notifyParent("JACE_SETTLEMENT_COMPLETE", {
        sessionId: session?.sessionId,
        paymentReference,
      });
      toast({
        title: "Settlement Complete",
        description: "Your payment has been processed successfully.",
      });
    },
    onError: (err: Error) => {
      notifyParent("JACE_SETTLEMENT_FAILED", {
        sessionId: session?.sessionId,
        reason: err.message,
      });
      toast({
        title: "Settlement Failed",
        description: err.message,
        variant: "destructive",
      });
    },
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
        title: "Settlement Cancelled",
        description: "The settlement has been cancelled.",
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

  const handlePayment = async () => {
    if (!session?.sessionId) return;
    
    setIsProcessing(true);
    
    // Simulate payment processing (in production, this would integrate with a payment gateway)
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Generate a payment reference if not provided
    const ref = paymentReference || `JACE-PAY-${Date.now()}`;
    setPaymentReference(ref);
    
    completeMutation.mutate({ sessionId: session.sessionId, paymentRef: ref, token });
    setIsProcessing(false);
  };

  const handleCancel = () => {
    if (!session?.sessionId || !token) return;
    cancelMutation.mutate({ sessionId: session.sessionId, reason: "User cancelled", token });
  };

  // Notify parent when loaded
  useEffect(() => {
    if (session) {
      notifyParent("JACE_SETTLEMENT_LOADED", { sessionId: session.sessionId });
    }
  }, [session]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="settlement-no-token">
        <Card className="w-full max-w-md border-red-500/50 bg-slate-800/80 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
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
            <CardTitle className="flex items-center gap-2 text-red-400">
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
        <Card className="w-full max-w-md border-emerald-500/50 bg-slate-800/80 text-white">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <CardTitle className="text-emerald-400">Settlement Complete</CardTitle>
            <CardDescription className="text-slate-300">
              Your payment has been processed successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-700/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Trade ID</span>
                <span className="text-white font-medium">{session?.tradeId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount</span>
                <span className="text-emerald-400 font-medium">${Number(session?.amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Reference</span>
                <span className="text-white font-mono text-xs">{paymentReference}</span>
              </div>
            </div>
            <p className="text-center text-slate-400 text-sm">
              You may close this window. Your settlement has been recorded.
            </p>
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
            <CardTitle className="text-amber-400">Settlement Cancelled</CardTitle>
            <CardDescription className="text-slate-300">
              Your settlement has been cancelled
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">JACE CRM Settlement</h1>
          <p className="text-slate-400 mt-1">Complete your bond purchase settlement</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/80 text-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-400" />
                Settlement Details
              </CardTitle>
              <Badge variant="outline" className="border-indigo-500 text-indigo-400">
                Trade #{session?.tradeId}
              </Badge>
            </div>
            <CardDescription className="text-slate-400">
              Review and confirm your settlement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="rounded-lg bg-slate-700/50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="text-xs text-slate-400">Bond Name</p>
                    <p className="text-white font-medium">{session?.bondName || "Bond Purchase"}</p>
                  </div>
                </div>
                <Separator className="bg-slate-600" />
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-xs text-slate-400">Settlement Amount</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      ${Number(session?.amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Separator className="bg-slate-600" />
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Investor Email</p>
                    <p className="text-white">{session?.investorEmail || "N/A"}</p>
                  </div>
                </div>
                <Separator className="bg-slate-600" />
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Session Expires</p>
                    <p className="text-white">
                      {session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
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

            <Alert className="bg-indigo-900/30 border-indigo-500/50">
              <Shield className="h-4 w-4 text-indigo-400" />
              <AlertDescription className="text-slate-300">
                Your payment is secured by JACE CRM. All transactions are encrypted and logged for compliance.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-700"
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
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handlePayment}
              disabled={isProcessing || completeMutation.isPending}
              data-testid="button-confirm-payment"
            >
              {isProcessing || completeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Confirm Payment
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-slate-500 text-xs">
          Session ID: {session?.sessionId} | Created: {session?.createdAt ? new Date(session.createdAt).toLocaleString() : "N/A"}
        </p>
      </div>
    </div>
  );
}
