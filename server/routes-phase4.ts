import type { Express, Request, Response, NextFunction } from "express";
import { storage, logAudit } from "./storage";
import crypto from "crypto";
import { z } from "zod";
import { insertVendorSchema, escrowAccounts } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { db } from "./db";

// Get user ID from session
function getUserId(req: Request): string {
  const user = req.user as any;
  return user?.claims?.sub;
}

// BondAI Webhook signature verification
function verifyBondAISignature(payload: Buffer, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function registerPhase4Routes(app: Express, isAuthenticated: (req: Request, res: Response, next: NextFunction) => void): void {
  
  // ============ INVOICING API ============

  // Get all invoices
  app.get("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const invoices = await (storage as any).getInvoices(userId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching invoices:", error);
      res.status(500).json({ message: "Failed to fetch invoices" });
    }
  });

  // Get single invoice
  app.get("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const invoice = await (storage as any).getInvoice(req.params.id, userId);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error) {
      console.error("Error fetching invoice:", error);
      res.status(500).json({ message: "Failed to fetch invoice" });
    }
  });

  // Get invoices by investor
  app.get("/api/investors/:investorId/invoices", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const invoices = await (storage as any).getInvoicesByInvestor(req.params.investorId, userId);
      res.json(invoices);
    } catch (error) {
      console.error("Error fetching investor invoices:", error);
      res.status(500).json({ message: "Failed to fetch investor invoices" });
    }
  });

  // Create invoice
  app.post("/api/invoices", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const invoiceNumber = await (storage as any).getNextInvoiceNumber(userId);
      const invoice = await (storage as any).createInvoice(userId, {
        ...req.body,
        invoiceNumber,
      });
      await logAudit(userId, "create", "invoice", invoice.id, `Created invoice ${invoiceNumber}`);
      res.status(201).json(invoice);
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ message: "Failed to create invoice" });
    }
  });

  // Update invoice
  app.patch("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const invoice = await (storage as any).updateInvoice(req.params.id, userId, req.body);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      await logAudit(userId, "update", "invoice", invoice.id, `Updated invoice ${invoice.invoiceNumber}`);
      res.json(invoice);
    } catch (error) {
      console.error("Error updating invoice:", error);
      res.status(500).json({ message: "Failed to update invoice" });
    }
  });

  // Delete invoice
  app.delete("/api/invoices/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await (storage as any).deleteInvoice(req.params.id, userId);
      await logAudit(userId, "delete", "invoice", req.params.id, "Deleted invoice");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invoice:", error);
      res.status(500).json({ message: "Failed to delete invoice" });
    }
  });

  // Invoice line items
  app.get("/api/invoices/:invoiceId/line-items", isAuthenticated, async (req, res) => {
    try {
      const lineItems = await (storage as any).getInvoiceLineItems(req.params.invoiceId);
      res.json(lineItems);
    } catch (error) {
      console.error("Error fetching invoice line items:", error);
      res.status(500).json({ message: "Failed to fetch invoice line items" });
    }
  });

  app.post("/api/invoices/:invoiceId/line-items", isAuthenticated, async (req, res) => {
    try {
      const lineItem = await (storage as any).createInvoiceLineItem({
        ...req.body,
        invoiceId: req.params.invoiceId,
      });
      res.status(201).json(lineItem);
    } catch (error) {
      console.error("Error creating invoice line item:", error);
      res.status(500).json({ message: "Failed to create invoice line item" });
    }
  });

  app.delete("/api/invoice-line-items/:id", isAuthenticated, async (req, res) => {
    try {
      await (storage as any).deleteInvoiceLineItem(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting invoice line item:", error);
      res.status(500).json({ message: "Failed to delete invoice line item" });
    }
  });

  // Invoice payments
  app.get("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const payments = await (storage as any).getInvoicePayments(req.params.invoiceId);
      res.json(payments);
    } catch (error) {
      console.error("Error fetching invoice payments:", error);
      res.status(500).json({ message: "Failed to fetch invoice payments" });
    }
  });

  app.post("/api/invoices/:invoiceId/payments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const payment = await (storage as any).createInvoicePayment({
        ...req.body,
        invoiceId: req.params.invoiceId,
      });
      
      // Update invoice paid amount and status
      const invoice = await (storage as any).getInvoice(req.params.invoiceId, userId);
      if (invoice) {
        const paidAmount = parseFloat(invoice.paidAmount || "0") + parseFloat(req.body.amount);
        const totalAmount = parseFloat(invoice.totalAmount);
        let status = invoice.status;
        
        if (paidAmount >= totalAmount) {
          status = "paid";
        } else if (paidAmount > 0) {
          status = "partial";
        }
        
        await (storage as any).updateInvoice(req.params.invoiceId, userId, {
          paidAmount: paidAmount.toFixed(2),
          status,
          paidAt: status === "paid" ? new Date() : null,
        });
      }
      
      await logAudit(userId, "create", "invoice_payment", payment.id, `Recorded payment of ${req.body.amount}`);
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating invoice payment:", error);
      res.status(500).json({ message: "Failed to create invoice payment" });
    }
  });

  // ============ QUOTES API ============

  app.get("/api/quotes", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const quotes = await (storage as any).getQuotes(userId);
      res.json(quotes);
    } catch (error) {
      console.error("Error fetching quotes:", error);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  app.get("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const quote = await (storage as any).getQuote(req.params.id, userId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error fetching quote:", error);
      res.status(500).json({ message: "Failed to fetch quote" });
    }
  });

  app.post("/api/quotes", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const quoteNumber = await (storage as any).getNextQuoteNumber(userId);
      const quote = await (storage as any).createQuote(userId, {
        ...req.body,
        quoteNumber,
      });
      await logAudit(userId, "create", "quote", quote.id, `Created quote ${quoteNumber}`);
      res.status(201).json(quote);
    } catch (error) {
      console.error("Error creating quote:", error);
      res.status(500).json({ message: "Failed to create quote" });
    }
  });

  app.patch("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const quote = await (storage as any).updateQuote(req.params.id, userId, req.body);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json(quote);
    } catch (error) {
      console.error("Error updating quote:", error);
      res.status(500).json({ message: "Failed to update quote" });
    }
  });

  app.delete("/api/quotes/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await (storage as any).deleteQuote(req.params.id, userId);
      await logAudit(userId, "delete", "quote", req.params.id, "Deleted quote");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting quote:", error);
      res.status(500).json({ message: "Failed to delete quote" });
    }
  });

  // Convert quote to invoice
  app.post("/api/quotes/:id/convert", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const quote = await (storage as any).getQuote(req.params.id, userId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Create invoice from quote
      const invoiceNumber = await (storage as any).getNextInvoiceNumber(userId);
      const invoice = await (storage as any).createInvoice(userId, {
        investorId: quote.investorId,
        invoiceNumber,
        status: "draft",
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        subtotal: quote.subtotal,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        discountAmount: quote.discountAmount,
        totalAmount: quote.totalAmount,
        currency: quote.currency,
        notes: quote.notes,
        terms: quote.terms,
      });
      
      // Copy line items
      const lineItems = await (storage as any).getQuoteLineItems(req.params.id);
      for (const item of lineItems) {
        await (storage as any).createInvoiceLineItem({
          invoiceId: invoice.id,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          sortOrder: item.sortOrder,
        });
      }
      
      // Update quote status
      await (storage as any).updateQuote(req.params.id, userId, {
        status: "converted",
        convertedToInvoiceId: invoice.id,
      });
      
      await logAudit(userId, "create", "invoice", invoice.id, `Converted quote ${quote.quoteNumber} to invoice ${invoiceNumber}`);
      res.json(invoice);
    } catch (error) {
      console.error("Error converting quote to invoice:", error);
      res.status(500).json({ message: "Failed to convert quote to invoice" });
    }
  });

  // ============ EXPENSES API ============

  app.get("/api/expenses", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const expenses = await (storage as any).getExpenses(userId);
      res.json(expenses);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const expense = await (storage as any).getExpense(req.params.id, userId);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Error fetching expense:", error);
      res.status(500).json({ message: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const expense = await (storage as any).createExpense(userId, req.body);
      await logAudit(userId, "create", "expense", expense.id, `Created expense: ${expense.description}`);
      res.status(201).json(expense);
    } catch (error) {
      console.error("Error creating expense:", error);
      res.status(500).json({ message: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const expense = await (storage as any).updateExpense(req.params.id, userId, req.body);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      console.error("Error updating expense:", error);
      res.status(500).json({ message: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await (storage as any).deleteExpense(req.params.id, userId);
      await logAudit(userId, "delete", "expense", req.params.id, "Deleted expense");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting expense:", error);
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  app.post("/api/expenses/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const expense = await (storage as any).approveExpense(req.params.id, userId, userId);
      if (!expense) {
        return res.status(404).json({ message: "Expense not found" });
      }
      await logAudit(userId, "update", "expense", expense.id, "Approved expense");
      res.json(expense);
    } catch (error) {
      console.error("Error approving expense:", error);
      res.status(500).json({ message: "Failed to approve expense" });
    }
  });

  // ============ HR - DEPARTMENTS API ============

  app.get("/api/departments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const departments = await (storage as any).getDepartments(userId);
      res.json(departments);
    } catch (error) {
      console.error("Error fetching departments:", error);
      res.status(500).json({ message: "Failed to fetch departments" });
    }
  });

  app.get("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const department = await (storage as any).getDepartment(req.params.id, userId);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      console.error("Error fetching department:", error);
      res.status(500).json({ message: "Failed to fetch department" });
    }
  });

  app.post("/api/departments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const department = await (storage as any).createDepartment(userId, req.body);
      await logAudit(userId, "create", "department", department.id, `Created department: ${department.name}`);
      res.status(201).json(department);
    } catch (error) {
      console.error("Error creating department:", error);
      res.status(500).json({ message: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const department = await (storage as any).updateDepartment(req.params.id, userId, req.body);
      if (!department) {
        return res.status(404).json({ message: "Department not found" });
      }
      res.json(department);
    } catch (error) {
      console.error("Error updating department:", error);
      res.status(500).json({ message: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await (storage as any).deleteDepartment(req.params.id, userId);
      await logAudit(userId, "delete", "department", req.params.id, "Deleted department");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting department:", error);
      res.status(500).json({ message: "Failed to delete department" });
    }
  });

  // ============ HR - EMPLOYEES API ============

  app.get("/api/employees", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const employees = await (storage as any).getEmployees(userId);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({ message: "Failed to fetch employees" });
    }
  });

  app.get("/api/employees/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const employee = await (storage as any).getEmployee(req.params.id, userId);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error fetching employee:", error);
      res.status(500).json({ message: "Failed to fetch employee" });
    }
  });

  app.get("/api/departments/:departmentId/employees", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const employees = await (storage as any).getEmployeesByDepartment(req.params.departmentId, userId);
      res.json(employees);
    } catch (error) {
      console.error("Error fetching department employees:", error);
      res.status(500).json({ message: "Failed to fetch department employees" });
    }
  });

  app.post("/api/employees", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const employeeNumber = await (storage as any).getNextEmployeeNumber(userId);
      const employee = await (storage as any).createEmployee(userId, {
        ...req.body,
        employeeNumber,
      });
      await logAudit(userId, "create", "employee", employee.id, `Created employee: ${employee.firstName} ${employee.lastName}`);
      res.status(201).json(employee);
    } catch (error) {
      console.error("Error creating employee:", error);
      res.status(500).json({ message: "Failed to create employee" });
    }
  });

  app.patch("/api/employees/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const employee = await (storage as any).updateEmployee(req.params.id, userId, req.body);
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      console.error("Error updating employee:", error);
      res.status(500).json({ message: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await (storage as any).deleteEmployee(req.params.id, userId);
      await logAudit(userId, "delete", "employee", req.params.id, "Deleted employee");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting employee:", error);
      res.status(500).json({ message: "Failed to delete employee" });
    }
  });

  // ============ HR - LEAVE REQUESTS API ============

  app.get("/api/leave-requests", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const requests = await (storage as any).getLeaveRequests(userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching leave requests:", error);
      res.status(500).json({ message: "Failed to fetch leave requests" });
    }
  });

  app.get("/api/employees/:employeeId/leave-requests", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const requests = await (storage as any).getLeaveRequestsByEmployee(req.params.employeeId, userId);
      res.json(requests);
    } catch (error) {
      console.error("Error fetching employee leave requests:", error);
      res.status(500).json({ message: "Failed to fetch employee leave requests" });
    }
  });

  app.post("/api/leave-requests", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const request = await (storage as any).createLeaveRequest(userId, req.body);
      await logAudit(userId, "create", "leave_request", request.id, `Created leave request for employee ${req.body.employeeId}`);
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating leave request:", error);
      res.status(500).json({ message: "Failed to create leave request" });
    }
  });

  app.patch("/api/leave-requests/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const request = await (storage as any).updateLeaveRequest(req.params.id, userId, req.body);
      if (!request) {
        return res.status(404).json({ message: "Leave request not found" });
      }
      res.json(request);
    } catch (error) {
      console.error("Error updating leave request:", error);
      res.status(500).json({ message: "Failed to update leave request" });
    }
  });

  app.post("/api/leave-requests/:id/approve", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const request = await (storage as any).approveLeaveRequest(req.params.id, userId, userId);
      if (!request) {
        return res.status(404).json({ message: "Leave request not found" });
      }
      await logAudit(userId, "update", "leave_request", request.id, "Approved leave request");
      res.json(request);
    } catch (error) {
      console.error("Error approving leave request:", error);
      res.status(500).json({ message: "Failed to approve leave request" });
    }
  });

  // ============ HR - PAYROLL API ============

  app.get("/api/payroll", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const records = await (storage as any).getPayrollRecords(userId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching payroll records:", error);
      res.status(500).json({ message: "Failed to fetch payroll records" });
    }
  });

  app.get("/api/employees/:employeeId/payroll", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const records = await (storage as any).getPayrollRecordsByEmployee(req.params.employeeId, userId);
      res.json(records);
    } catch (error) {
      console.error("Error fetching employee payroll records:", error);
      res.status(500).json({ message: "Failed to fetch employee payroll records" });
    }
  });

  app.post("/api/payroll", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const record = await (storage as any).createPayrollRecord(userId, req.body);
      await logAudit(userId, "create", "payroll", record.id, `Created payroll record for employee ${req.body.employeeId}`);
      res.status(201).json(record);
    } catch (error) {
      console.error("Error creating payroll record:", error);
      res.status(500).json({ message: "Failed to create payroll record" });
    }
  });

  app.patch("/api/payroll/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const record = await (storage as any).updatePayrollRecord(req.params.id, userId, req.body);
      if (!record) {
        return res.status(404).json({ message: "Payroll record not found" });
      }
      res.json(record);
    } catch (error) {
      console.error("Error updating payroll record:", error);
      res.status(500).json({ message: "Failed to update payroll record" });
    }
  });

  // ============ HR - TIME ENTRIES API ============

  app.get("/api/time-entries", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entries = await (storage as any).getTimeEntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching time entries:", error);
      res.status(500).json({ message: "Failed to fetch time entries" });
    }
  });

  app.get("/api/employees/:employeeId/time-entries", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entries = await (storage as any).getTimeEntriesByEmployee(req.params.employeeId, userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching employee time entries:", error);
      res.status(500).json({ message: "Failed to fetch employee time entries" });
    }
  });

  app.post("/api/time-entries", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entry = await (storage as any).createTimeEntry(userId, req.body);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating time entry:", error);
      res.status(500).json({ message: "Failed to create time entry" });
    }
  });

  app.patch("/api/time-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entry = await (storage as any).updateTimeEntry(req.params.id, userId, req.body);
      if (!entry) {
        return res.status(404).json({ message: "Time entry not found" });
      }
      res.json(entry);
    } catch (error) {
      console.error("Error updating time entry:", error);
      res.status(500).json({ message: "Failed to update time entry" });
    }
  });

  app.delete("/api/time-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await (storage as any).deleteTimeEntry(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting time entry:", error);
      res.status(500).json({ message: "Failed to delete time entry" });
    }
  });

  // ============ BONDAI INTEGRATION API ============

  // BondAI Webhook endpoint (public, signature-verified)
  app.post("/api/bondai/webhook", async (req, res) => {
    try {
      const signature = req.headers["x-bondai-signature"] as string || "";
      const webhookSecret = process.env.BONDAI_WEBHOOK_SECRET || "";
      
      // Get raw body for signature verification
      const rawBody = JSON.stringify(req.body);
      
      // Verify signature if secret is configured
      if (webhookSecret && !verifyBondAISignature(Buffer.from(rawBody), signature, webhookSecret)) {
        console.warn("BondAI webhook signature verification failed");
        return res.status(401).json({ error: "Invalid signature" });
      }
      
      const { eventId, eventType, correlationId, data } = req.body;
      
      if (!eventId || !eventType) {
        return res.status(400).json({ error: "Missing eventId or eventType" });
      }
      
      // Check for duplicate event
      const existingEvent = await (storage as any).getBondaiWebhookEvent(eventId);
      if (existingEvent) {
        await (storage as any).updateBondaiWebhookEventStatus(eventId, "duplicate");
        return res.json({ ok: true, status: "duplicate" });
      }
      
      // Store the event
      await (storage as any).createBondaiWebhookEvent({
        eventId,
        eventType,
        correlationId: correlationId || null,
        payload: rawBody,
        status: "received",
      });
      
      // Process the event based on type
      try {
        await (storage as any).updateBondaiWebhookEventStatus(eventId, "processing");
        
        switch (eventType) {
          case "investor_onboarding_submitted":
            // Handle investor onboarding from BondAI
            if (data?.email) {
              console.log(`Processing investor onboarding for ${data.email}`);
              // The actual investor creation/update would happen here
              // based on the data received from BondAI
            }
            break;
            
          case "payment.confirmed":
            // Handle payment confirmation from BondAI
            if (data?.tradeId) {
              console.log(`Processing payment confirmation for trade ${data.tradeId}`);
              // Update investor sync status, create journal entries, etc.
            }
            break;
            
          case "kyc.completed":
            // Handle KYC completion from BondAI
            if (data?.investorId) {
              console.log(`Processing KYC completion for investor ${data.investorId}`);
            }
            break;
            
          default:
            console.log(`Unhandled BondAI event type: ${eventType}`);
        }
        
        await (storage as any).updateBondaiWebhookEventStatus(eventId, "processed");
        res.json({ ok: true, status: "processed" });
      } catch (processingError: any) {
        await (storage as any).updateBondaiWebhookEventStatus(eventId, "failed", processingError.message);
        throw processingError;
      }
    } catch (error: any) {
      console.error("BondAI webhook error:", error);
      res.status(500).json({ error: "Webhook processing failed", details: error.message });
    }
  });

  // Get BondAI webhook events (for admin monitoring)
  app.get("/api/bondai/webhook-events", isAuthenticated, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const events = await (storage as any).getBondaiWebhookEvents(limit);
      res.json(events);
    } catch (error) {
      console.error("Error fetching BondAI webhook events:", error);
      res.status(500).json({ message: "Failed to fetch webhook events" });
    }
  });

  // BondAI integration health check
  app.get("/api/bondai/health", isAuthenticated, async (req, res) => {
    try {
      const events = await (storage as any).getBondaiWebhookEvents(10);
      const recentEvents = events.filter((e: any) => {
        const eventTime = new Date(e.createdAt).getTime();
        const now = Date.now();
        return now - eventTime < 24 * 60 * 60 * 1000; // Last 24 hours
      });
      
      const failedEvents = recentEvents.filter((e: any) => e.status === "failed");
      
      res.json({
        status: failedEvents.length === 0 ? "healthy" : "degraded",
        recentEventsCount: recentEvents.length,
        failedEventsCount: failedEvents.length,
        lastEventAt: events[0]?.createdAt || null,
        webhookConfigured: !!process.env.BONDAI_WEBHOOK_SECRET,
      });
    } catch (error) {
      console.error("Error checking BondAI health:", error);
      res.status(500).json({ message: "Failed to check integration health" });
    }
  });

  // BondAI investor sync status
  app.get("/api/investors/:investorId/bondai-sync", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const sync = await (storage as any).getBondaiInvestorSync(req.params.investorId, userId);
      res.json(sync || { status: "not_synced" });
    } catch (error) {
      console.error("Error fetching BondAI sync status:", error);
      res.status(500).json({ message: "Failed to fetch sync status" });
    }
  });

  // Manual sync trigger for investor
  app.post("/api/investors/:investorId/bondai-sync", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { investorId } = req.params;
      
      // Check if sync record exists
      let sync = await (storage as any).getBondaiInvestorSync(investorId, userId);
      
      if (sync) {
        sync = await (storage as any).updateBondaiInvestorSync(investorId, userId, {
          syncStatus: "pending",
          lastSyncAt: new Date(),
        });
      } else {
        sync = await (storage as any).createBondaiInvestorSync(userId, {
          investorId,
          syncStatus: "pending",
        });
      }
      
      await logAudit(userId, "update", "bondai_sync", investorId, "Triggered BondAI sync");
      res.json(sync);
    } catch (error) {
      console.error("Error triggering BondAI sync:", error);
      res.status(500).json({ message: "Failed to trigger sync" });
    }
  });

  // ============ ESCROW ACCOUNTS API ============

  const escrowCreateSchema = z.object({
    accountName: z.string().min(1),
    bankName: z.string().optional(),
    accountType: z.string().optional(),
    accountNumber: z.string().min(4),
    routingNumber: z.string().min(4),
    balance: z.string().optional(),
    currency: z.string().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    notes: z.string().optional().nullable(),
  });

  const escrowUpdateSchema = z.object({
    accountName: z.string().min(1).optional(),
    bankName: z.string().optional(),
    accountType: z.string().optional(),
    accountNumber: z.string().min(4).optional(),
    routingNumber: z.string().min(4).optional(),
    balance: z.string().optional(),
    currency: z.string().optional(),
    isActive: z.boolean().optional(),
    isDefault: z.boolean().optional(),
    notes: z.string().optional().nullable(),
  });

  function getEscrowEncryptionKey(): Buffer {
    const base64Key = process.env.JACE_ENCRYPTION_KEY_BASE64 || "";
    if (!base64Key) {
      return crypto.createHash("sha256").update("dev-jace-encryption-key").digest();
    }
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== 32) throw new Error("JACE_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
    return key;
  }

  function escrowEncrypt(value: string, key: Buffer): { ciphertextB64: string; ivHex: string; tagHex: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(value, "utf8")), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { ciphertextB64: ciphertext.toString("base64"), ivHex: iv.toString("hex"), tagHex: tag.toString("hex") };
  }

  function escrowDecrypt(ciphertextB64: string, ivHex: string, tagHex: string, key: Buffer): string {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]);
    return decrypted.toString("utf8");
  }

  function stripEscrowSensitiveFields(account: any) {
    const { accountNumberCiphertext, accountNumberIv, accountNumberTag, routingNumberCiphertext, routingNumberIv, routingNumberTag, ...safe } = account;
    return safe;
  }

  app.get("/api/escrow-accounts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const accounts = await (storage as any).getEscrowAccounts(userId);
      res.json(accounts.map(stripEscrowSensitiveFields));
    } catch (error) {
      console.error("Error fetching escrow accounts:", error);
      res.status(500).json({ message: "Failed to fetch escrow accounts" });
    }
  });

  app.get("/api/escrow-accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const account = await (storage as any).getEscrowAccount(req.params.id, userId);
      if (!account) {
        return res.status(404).json({ message: "Escrow account not found" });
      }
      res.json(stripEscrowSensitiveFields(account));
    } catch (error) {
      console.error("Error fetching escrow account:", error);
      res.status(500).json({ message: "Failed to fetch escrow account" });
    }
  });

  app.get("/api/escrow-accounts/:id/decrypt", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const account = await (storage as any).getEscrowAccount(req.params.id, userId);
      if (!account) {
        return res.status(404).json({ message: "Escrow account not found" });
      }
      const encKey = getEscrowEncryptionKey();
      let accountNumber: string | null = null;
      let routingNumber: string | null = null;
      if (account.accountNumberCiphertext && account.accountNumberIv && account.accountNumberTag) {
        accountNumber = escrowDecrypt(account.accountNumberCiphertext, account.accountNumberIv, account.accountNumberTag, encKey);
      }
      if (account.routingNumberCiphertext && account.routingNumberIv && account.routingNumberTag) {
        routingNumber = escrowDecrypt(account.routingNumberCiphertext, account.routingNumberIv, account.routingNumberTag, encKey);
      }
      const safe = stripEscrowSensitiveFields(account);
      res.json({ ...safe, accountNumber, routingNumber });
    } catch (error) {
      console.error("Error decrypting escrow account:", error);
      res.status(500).json({ message: "Failed to decrypt escrow account" });
    }
  });

  app.post("/api/escrow-accounts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const parsed = escrowCreateSchema.parse(req.body);
      const encKey = getEscrowEncryptionKey();

      const acctEnc = escrowEncrypt(parsed.accountNumber, encKey);
      const routeEnc = escrowEncrypt(parsed.routingNumber, encKey);

      if (parsed.isDefault) {
        await db.update(escrowAccounts).set({ isDefault: false }).where(and(eq(escrowAccounts.userId, userId), eq(escrowAccounts.isDefault, true)));
      }

      const { accountNumber, routingNumber, ...rest } = parsed;
      const account = await (storage as any).createEscrowAccount(userId, {
        ...rest,
        accountNumberLast4: accountNumber.slice(-4),
        accountNumberCiphertext: acctEnc.ciphertextB64,
        accountNumberIv: acctEnc.ivHex,
        accountNumberTag: acctEnc.tagHex,
        routingNumberLast4: routingNumber.slice(-4),
        routingNumberCiphertext: routeEnc.ciphertextB64,
        routingNumberIv: routeEnc.ivHex,
        routingNumberTag: routeEnc.tagHex,
      });
      await logAudit(userId, "create", "escrow_account", account.id, `Created escrow account: ${account.accountName}`);
      res.status(201).json(stripEscrowSensitiveFields(account));
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error creating escrow account:", error);
      res.status(500).json({ message: "Failed to create escrow account" });
    }
  });

  app.patch("/api/escrow-accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const parsed = escrowUpdateSchema.parse(req.body);
      const encKey = getEscrowEncryptionKey();

      const updateData: any = { ...parsed };
      delete updateData.accountNumber;
      delete updateData.routingNumber;

      if (parsed.accountNumber) {
        const enc = escrowEncrypt(parsed.accountNumber, encKey);
        updateData.accountNumberLast4 = parsed.accountNumber.slice(-4);
        updateData.accountNumberCiphertext = enc.ciphertextB64;
        updateData.accountNumberIv = enc.ivHex;
        updateData.accountNumberTag = enc.tagHex;
      }

      if (parsed.routingNumber) {
        const enc = escrowEncrypt(parsed.routingNumber, encKey);
        updateData.routingNumberLast4 = parsed.routingNumber.slice(-4);
        updateData.routingNumberCiphertext = enc.ciphertextB64;
        updateData.routingNumberIv = enc.ivHex;
        updateData.routingNumberTag = enc.tagHex;
      }

      if (parsed.isDefault) {
        await db.update(escrowAccounts).set({ isDefault: false }).where(and(eq(escrowAccounts.userId, userId), eq(escrowAccounts.isDefault, true)));
      }

      const account = await (storage as any).updateEscrowAccount(req.params.id, userId, updateData);
      if (!account) {
        return res.status(404).json({ message: "Escrow account not found" });
      }
      res.json(stripEscrowSensitiveFields(account));
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error updating escrow account:", error);
      res.status(500).json({ message: "Failed to update escrow account" });
    }
  });

  app.delete("/api/escrow-accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const account = await (storage as any).getEscrowAccount(req.params.id, userId);
      if (!account) {
        return res.status(404).json({ message: "Escrow account not found" });
      }
      await (storage as any).deleteEscrowAccount(req.params.id, userId);
      await logAudit(userId, "delete", "escrow_account", req.params.id, `Deleted escrow account: ${account.accountName}`);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting escrow account:", error);
      res.status(500).json({ message: "Failed to delete escrow account" });
    }
  });

  // Escrow transactions
  app.get("/api/escrow-accounts/:accountId/transactions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const transactions = await (storage as any).getEscrowTransactions(req.params.accountId, userId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching escrow transactions:", error);
      res.status(500).json({ message: "Failed to fetch escrow transactions" });
    }
  });

  app.post("/api/escrow-accounts/:accountId/transactions", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const transaction = await (storage as any).createEscrowTransaction(userId, {
        ...req.body,
        escrowAccountId: req.params.accountId,
      });
      
      // Update escrow account balance
      const account = await (storage as any).getEscrowAccount(req.params.accountId, userId);
      if (account) {
        const currentBalance = parseFloat(account.balance || "0");
        const amount = parseFloat(req.body.amount);
        const newBalance = req.body.transactionType === "deposit" 
          ? currentBalance + amount 
          : currentBalance - amount;
        
        await (storage as any).updateEscrowAccount(req.params.accountId, userId, {
          balance: newBalance.toFixed(2),
        });
      }
      
      await logAudit(userId, "create", "escrow_transaction", transaction.id, `${req.body.transactionType} of ${req.body.amount}`);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating escrow transaction:", error);
      res.status(500).json({ message: "Failed to create escrow transaction" });
    }
  });

  // ============ FINANCIAL REPORTS API ============

  app.get("/api/reports/trial-balance", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const trialBalance = await (storage as any).getTrialBalance(userId);
      res.json(trialBalance);
    } catch (error) {
      console.error("Error generating trial balance:", error);
      res.status(500).json({ message: "Failed to generate trial balance" });
    }
  });

  app.get("/api/reports/income-statement", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), 0, 1);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      const incomeStatement = await (storage as any).getIncomeStatement(userId, startDate, endDate);
      res.json(incomeStatement);
    } catch (error) {
      console.error("Error generating income statement:", error);
      res.status(500).json({ message: "Failed to generate income statement" });
    }
  });

  app.get("/api/reports/balance-sheet", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const balanceSheet = await (storage as any).getBalanceSheet(userId);
      res.json(balanceSheet);
    } catch (error) {
      console.error("Error generating balance sheet:", error);
      res.status(500).json({ message: "Failed to generate balance sheet" });
    }
  });

  // ============ VENDORS API ============

  // Get all vendors
  app.get("/api/vendors", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const vendors = await (storage as any).getVendors(userId);
      res.json(vendors);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      res.status(500).json({ message: "Failed to fetch vendors" });
    }
  });

  // Get single vendor
  app.get("/api/vendors/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const vendor = await (storage as any).getVendor(req.params.id, userId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      res.json(vendor);
    } catch (error) {
      console.error("Error fetching vendor:", error);
      res.status(500).json({ message: "Failed to fetch vendor" });
    }
  });

  // Get next vendor account number
  app.get("/api/vendors/next-account-number", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const accountNumber = await (storage as any).getNextVendorAccountNumber(userId);
      res.json({ accountNumber });
    } catch (error) {
      console.error("Error generating vendor account number:", error);
      res.status(500).json({ message: "Failed to generate account number" });
    }
  });

  // Create vendor
  app.post("/api/vendors", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const parsed = insertVendorSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid vendor data", errors: parsed.error.errors });
      }
      const vendor = await (storage as any).createVendor(userId, parsed.data);
      await logAudit(userId, "create", "vendor", vendor.id, `Created vendor: ${vendor.name}`);
      res.status(201).json(vendor);
    } catch (error) {
      console.error("Error creating vendor:", error);
      res.status(500).json({ message: "Failed to create vendor" });
    }
  });

  // Update vendor
  app.patch("/api/vendors/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const parsed = insertVendorSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid vendor data", errors: parsed.error.errors });
      }
      const vendor = await (storage as any).updateVendor(req.params.id, userId, parsed.data);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      await logAudit(userId, "update", "vendor", vendor.id, `Updated vendor: ${vendor.name}`);
      res.json(vendor);
    } catch (error) {
      console.error("Error updating vendor:", error);
      res.status(500).json({ message: "Failed to update vendor" });
    }
  });

  // Delete vendor
  app.delete("/api/vendors/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const vendor = await (storage as any).getVendor(req.params.id, userId);
      if (!vendor) {
        return res.status(404).json({ message: "Vendor not found" });
      }
      await (storage as any).deleteVendor(req.params.id, userId);
      await logAudit(userId, "delete", "vendor", req.params.id, `Deleted vendor: ${vendor.name}`);
      res.json({ message: "Vendor deleted successfully" });
    } catch (error) {
      console.error("Error deleting vendor:", error);
      res.status(500).json({ message: "Failed to delete vendor" });
    }
  });
}
