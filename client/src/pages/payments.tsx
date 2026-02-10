import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { DollarSign, CreditCard, RefreshCw, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface PaymentRecord {
  id: string;
  invoice_id: string | null;
  expense_id: string | null;
  amount: string;
  payment_method: string | null;
  payment_reference: string | null;
  stripe_payment_intent_id: string | null;
  stripe_status: string | null;
  paid_at: string;
  created_at: string;
  invoice_number: string | null;
  invoice_status: string | null;
  invoice_total: string | null;
  expense_description: string | null;
  expense_vendor: string | null;
}

const statusColors: Record<string, string> = {
  succeeded: "bg-green-500",
  pending: "bg-yellow-500",
  requires_payment_method: "bg-orange-500",
  failed: "bg-red-500",
};

export default function PaymentsPage() {
  const { toast } = useToast();
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const { data: payments = [], isLoading } = useQuery<PaymentRecord[]>({
    queryKey: ["/api/payments"],
  });

  const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || "0"), 0);
  const pendingCount = payments.filter((p) => p.stripe_status !== "succeeded").length;

  const handleCheckStatus = async (paymentIntentId: string, paymentId: string) => {
    setCheckingId(paymentId);
    try {
      const response = await apiRequest("GET", `/api/stripe/payment-status/${paymentIntentId}`);
      const data = await response.json();
      toast({
        title: "Payment Status",
        description: `Status: ${data.status || data.stripe_status || "unknown"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
    } catch {
      toast({
        title: "Failed to check payment status",
        variant: "destructive",
      });
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground">Track all Stripe payments for invoices and expenses</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-payments">
              {isLoading ? <Skeleton className="h-8 w-16" /> : payments.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-total-amount">
              {isLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                `$${totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-payments">
              {isLoading ? <Skeleton className="h-8 w-12" /> : pendingCount}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
          <CardDescription>All Stripe payment records for invoices and expenses</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payment records yet.</p>
              <p className="text-sm mt-1">Payments will appear here when invoices or expenses are paid via Stripe.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Stripe Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} data-testid={`row-payment-${payment.id}`}>
                    <TableCell data-testid={`text-type-${payment.id}`}>
                      <Badge variant={payment.invoice_id ? "default" : "secondary"}>
                        {payment.invoice_id ? "Invoice" : "Expense"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium" data-testid={`text-reference-${payment.id}`}>
                      {payment.invoice_id
                        ? (payment.invoice_number || "—")
                        : (payment.expense_description || payment.expense_vendor || "—")}
                    </TableCell>
                    <TableCell className="text-right" data-testid={`text-amount-${payment.id}`}>
                      ${parseFloat(payment.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell data-testid={`text-payment-method-${payment.id}`}>
                      {payment.payment_method || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={`${statusColors[payment.stripe_status || ""] || "bg-gray-500"} text-white`}
                        data-testid={`badge-status-${payment.id}`}
                      >
                        {payment.stripe_status || "unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-date-${payment.id}`}>
                      {payment.paid_at ? format(new Date(payment.paid_at), "MMM d, yyyy h:mm a") : "—"}
                    </TableCell>
                    <TableCell>
                      {payment.stripe_payment_intent_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={checkingId === payment.id}
                          onClick={() => handleCheckStatus(payment.stripe_payment_intent_id!, payment.id)}
                          data-testid={`button-refresh-status-${payment.id}`}
                        >
                          <RefreshCw className={`h-4 w-4 ${checkingId === payment.id ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
