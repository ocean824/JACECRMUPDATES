import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

let stripePromise: ReturnType<typeof loadStripe> | null = null;

function getStripePromise() {
  if (!stripePromise) {
    stripePromise = fetch("/api/stripe/publishable-key", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => loadStripe(data.publishableKey));
  }
  return stripePromise;
}

interface StripePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSecret: string;
  amount: number;
  description: string;
  onSuccess?: () => void;
}

function PaymentForm({ onSuccess, onOpenChange }: { onSuccess?: () => void; onOpenChange: (open: boolean) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
      },
      redirect: "if_required",
    });

    if (error) {
      setErrorMessage(error.message || "Payment failed. Please try again.");
      toast({
        title: "Payment failed",
        description: error.message || "An error occurred during payment.",
        variant: "destructive",
      });
      setIsProcessing(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      toast({ title: "Payment successful", description: "Your payment has been processed." });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      onSuccess?.();
      onOpenChange(false);
    } else {
      toast({ title: "Payment processing", description: "Your payment is being processed." });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      onOpenChange(false);
    }

    setIsProcessing(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement data-testid="stripe-payment-element" />
      {errorMessage && (
        <p className="text-sm text-destructive" data-testid="text-payment-error">
          {errorMessage}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isProcessing}
          data-testid="button-cancel-payment"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || !elements || isProcessing}
          data-testid="button-confirm-payment"
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            "Confirm Payment"
          )}
        </Button>
      </div>
    </form>
  );
}

export function StripePaymentDialog({
  open,
  onOpenChange,
  clientSecret,
  amount,
  description,
  onSuccess,
}: StripePaymentDialogProps) {
  const [stripeReady, setStripeReady] = useState(false);

  useEffect(() => {
    if (open) {
      getStripePromise().then(() => setStripeReady(true));
    }
  }, [open]);

  if (!open || !clientSecret) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="dialog-stripe-payment">
        <DialogHeader>
          <DialogTitle data-testid="text-payment-title">Complete Payment</DialogTitle>
          <DialogDescription data-testid="text-payment-description">
            {description} — ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </DialogDescription>
        </DialogHeader>
        {stripeReady ? (
          <Elements
            stripe={getStripePromise()}
            options={{ clientSecret, appearance: { theme: "stripe" } }}
          >
            <PaymentForm onSuccess={onSuccess} onOpenChange={onOpenChange} />
          </Elements>
        ) : (
          <div className="flex items-center justify-center py-8" data-testid="loading-stripe">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
