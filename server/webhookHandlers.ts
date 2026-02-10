import { getStripeSync } from './stripeClient';
import { db } from './db';
import { invoicePayments, invoices, expenses } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error('Payload must be a Buffer');
    }
    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
  }

  static async handlePaymentIntentSucceeded(paymentIntent: any): Promise<void> {
    const piId = paymentIntent.id;

    const [payment] = await db
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.stripePaymentIntentId, piId));

    if (!payment) {
      console.warn(`Payment intent succeeded but no matching record found: ${piId}`);
      return;
    }

    if (payment.stripeStatus !== 'pending') {
      console.warn(`Payment ${piId} already processed with status: ${payment.stripeStatus}, skipping`);
      return;
    }

    await db
      .update(invoicePayments)
      .set({ stripeStatus: 'succeeded' })
      .where(eq(invoicePayments.id, payment.id));

    if (payment.invoiceId) {
      const [invoice] = await db
        .select()
        .from(invoices)
        .where(eq(invoices.id, payment.invoiceId));

      if (invoice) {
        const paidAmount = parseFloat(invoice.paidAmount || '0') + parseFloat(payment.amount);
        const totalAmount = parseFloat(invoice.totalAmount);
        const status = paidAmount >= totalAmount ? 'paid' : 'partial';

        await db
          .update(invoices)
          .set({
            paidAmount: paidAmount.toFixed(2),
            status: status as any,
            paidAt: status === 'paid' ? new Date() : invoice.paidAt,
            updatedAt: new Date(),
          })
          .where(eq(invoices.id, payment.invoiceId));
      }

      console.log(`Invoice payment succeeded: ${piId}`);
    } else if (payment.expenseId) {
      await db
        .update(expenses)
        .set({
          status: 'reimbursed' as any,
          reimbursedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(expenses.id, payment.expenseId));

      console.log(`Expense payment succeeded: ${piId}, expenseId: ${payment.expenseId}`);
    }
  }

  static async handlePaymentIntentFailed(paymentIntent: any): Promise<void> {
    const piId = paymentIntent.id;

    const [payment] = await db
      .select()
      .from(invoicePayments)
      .where(eq(invoicePayments.stripePaymentIntentId, piId));

    if (payment) {
      if (payment.stripeStatus !== 'pending') {
        console.warn(`Payment ${piId} already processed with status: ${payment.stripeStatus}, skipping`);
        return;
      }

      await db
        .update(invoicePayments)
        .set({ stripeStatus: 'failed' })
        .where(eq(invoicePayments.id, payment.id));
    }

    console.log(`Payment intent failed: ${piId}`);
  }
}
