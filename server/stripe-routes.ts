import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { getUncachableStripeClient, getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";

function getUserId(req: Request): string {
  const user = req.user as any;
  return user?.claims?.sub;
}

export function registerStripeRoutes(
  app: Express,
  isAuthenticated: (req: Request, res: Response, next: NextFunction) => void
): void {
  app.get("/api/stripe/publishable-key", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error: any) {
      console.error("Error fetching Stripe publishable key:", error);
      res.status(500).json({ message: "Failed to fetch Stripe publishable key" });
    }
  });

  app.post("/api/payments/invoice/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const invoiceId = req.params.id;

      const invoice = await (storage as any).getInvoice(invoiceId, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const totalAmount = parseFloat(invoice.totalAmount || "0");
      const paidAmount = parseFloat(invoice.paidAmount || "0");
      const remainingBalance = totalAmount - paidAmount;

      if (remainingBalance <= 0) {
        return res.status(400).json({ message: "Invoice is already fully paid" });
      }

      const amountInCents = Math.round(remainingBalance * 100);

      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        metadata: {
          type: "invoice",
          invoiceId: String(invoiceId),
          userId: String(userId),
        },
      });

      await (storage as any).createInvoicePayment({
        invoiceId,
        amount: remainingBalance.toFixed(2),
        paymentMethod: "stripe",
        paymentReference: paymentIntent.id,
        stripePaymentIntentId: paymentIntent.id,
        stripeStatus: "pending",
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: remainingBalance,
      });
    } catch (error: any) {
      console.error("Error creating invoice payment:", error);
      res.status(500).json({ message: "Failed to create invoice payment" });
    }
  });

  app.post("/api/payments/expense/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const expenseId = req.params.id;

      const expense = await (storage as any).getExpense(expenseId, userId);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }

      const amount = parseFloat(expense.amount || "0");
      if (amount <= 0) {
        return res.status(400).json({ message: "Invalid expense amount" });
      }

      const amountInCents = Math.round(amount * 100);

      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        metadata: {
          type: "expense",
          expenseId: String(expenseId),
          userId: String(userId),
        },
      });

      await (storage as any).createInvoicePayment({
        invoiceId: null,
        expenseId: expense.id,
        amount: amount.toFixed(2),
        paymentMethod: "stripe",
        stripePaymentIntentId: paymentIntent.id,
        stripeStatus: "pending",
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
      });
    } catch (error: any) {
      console.error("Error creating expense payment:", error);
      res.status(500).json({ message: "Failed to create expense payment" });
    }
  });

  app.get("/api/payments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const result = await db.execute(sql`
        SELECT
          ip.id,
          ip.invoice_id,
          ip.expense_id,
          ip.amount,
          ip.payment_method,
          ip.payment_reference,
          ip.stripe_payment_intent_id,
          ip.stripe_status,
          ip.paid_at,
          ip.created_at,
          i.invoice_number,
          i.status as invoice_status,
          i.total_amount as invoice_total,
          e.description as expense_description,
          e.vendor as expense_vendor
        FROM invoice_payments ip
        LEFT JOIN invoices i ON ip.invoice_id = i.id
        LEFT JOIN expenses e ON ip.expense_id = e.id
        WHERE i.user_id = ${userId} OR e.user_id = ${userId}
        ORDER BY ip.created_at DESC
      `);
      res.json(result.rows);
    } catch (error: any) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.get("/api/stripe/payment-status/:paymentIntentId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const piId = req.params.paymentIntentId as string;
      const userId = (req.session as any)?.userId || (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.retrieve(piId);
      if (paymentIntent.metadata?.userId && paymentIntent.metadata.userId !== userId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json({
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    } catch (error: any) {
      console.error("Error fetching payment status:", error);
      res.status(500).json({ message: "Failed to fetch payment status" });
    }
  });
}
