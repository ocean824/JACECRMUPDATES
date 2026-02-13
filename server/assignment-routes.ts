import type { Express, Request, Response, NextFunction } from "express";
import { storage, logAudit } from "./storage";
import { insertAssignmentSchema, insertAssignmentPayoutSchema } from "@shared/schema";
import { z } from "zod";

function getUserId(req: Request): string {
  const user = req.user as any;
  return user?.claims?.sub;
}

export function registerAssignmentRoutes(app: Express, isAuthenticated: (req: Request, res: Response, next: NextFunction) => void): void {

  app.get("/api/assignments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const result = await (storage as any).getAssignments(userId);
      res.json(result);
    } catch (error) {
      console.error("Error fetching assignments:", error);
      res.status(500).json({ message: "Failed to fetch assignments" });
    }
  });

  app.get("/api/assignments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignment = await (storage as any).getAssignment(req.params.id, userId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      const payouts = await (storage as any).getAssignmentPayouts(req.params.id, userId);
      res.json({ ...assignment, payouts });
    } catch (error) {
      console.error("Error fetching assignment:", error);
      res.status(500).json({ message: "Failed to fetch assignment" });
    }
  });

  app.post("/api/assignments", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const parsed = insertAssignmentSchema.safeParse({ ...req.body, userId });
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.errors });
      }
      const assignment = await (storage as any).createAssignment(userId, parsed.data);
      await logAudit(userId, "create", "assignment", assignment.id, `Created assignment: ${assignment.bondName || assignment.id}`);
      res.status(201).json(assignment);
    } catch (error) {
      console.error("Error creating assignment:", error);
      res.status(500).json({ message: "Failed to create assignment" });
    }
  });

  app.patch("/api/assignments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { userId: _, createdAt: _c, updatedAt: _u, id: _i, ...safeBody } = req.body;
      const parsed = insertAssignmentSchema.partial().safeParse(safeBody);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.errors });
      }
      const assignment = await (storage as any).updateAssignment(req.params.id, userId, parsed.data);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      await logAudit(userId, "update", "assignment", assignment.id, `Updated assignment: ${assignment.bondName || assignment.id}`);
      res.json(assignment);
    } catch (error) {
      console.error("Error updating assignment:", error);
      res.status(500).json({ message: "Failed to update assignment" });
    }
  });

  app.delete("/api/assignments/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignment = await (storage as any).getAssignment(req.params.id, userId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      const payouts = await (storage as any).getAssignmentPayouts(req.params.id, userId);
      const hasPaidPayouts = payouts.some((p: any) => p.status === "paid");
      if (hasPaidPayouts) {
        return res.status(400).json({ message: "Cannot delete assignment with paid payouts" });
      }
      await (storage as any).deleteAssignment(req.params.id, userId);
      await logAudit(userId, "delete", "assignment", req.params.id, `Deleted assignment: ${assignment.bondName || req.params.id}`);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting assignment:", error);
      res.status(500).json({ message: "Failed to delete assignment" });
    }
  });

  app.get("/api/assignments/:id/payouts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignment = await (storage as any).getAssignment(req.params.id, userId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      const payouts = await (storage as any).getAssignmentPayouts(req.params.id, userId);
      res.json(payouts);
    } catch (error) {
      console.error("Error fetching assignment payouts:", error);
      res.status(500).json({ message: "Failed to fetch assignment payouts" });
    }
  });

  app.post("/api/assignments/:id/payouts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignment = await (storage as any).getAssignment(req.params.id, userId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      const parsed = insertAssignmentPayoutSchema.safeParse({
        ...req.body,
        assignmentId: req.params.id,
        payoutDate: req.body.payoutDate ? new Date(req.body.payoutDate) : undefined,
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.errors });
      }
      const payout = await (storage as any).createAssignmentPayout(userId, parsed.data);
      await logAudit(userId, "create", "assignment_payout", payout.id, `Created payout for assignment ${req.params.id}`);
      res.status(201).json(payout);
    } catch (error) {
      console.error("Error creating assignment payout:", error);
      res.status(500).json({ message: "Failed to create assignment payout" });
    }
  });

  app.patch("/api/assignments/:id/payouts/:payoutId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignment = await (storage as any).getAssignment(req.params.id, userId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      const { assignmentId: _a, createdAt: _c, updatedAt: _u, id: _i, ...safeBody } = req.body;
      const parsed = insertAssignmentPayoutSchema.partial().safeParse({
        ...safeBody,
        ...(safeBody.payoutDate !== undefined && { payoutDate: new Date(safeBody.payoutDate) }),
      });
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation failed", errors: parsed.error.errors });
      }
      const payout = await (storage as any).updateAssignmentPayout(req.params.payoutId, userId, parsed.data);
      if (!payout) {
        return res.status(404).json({ message: "Payout not found" });
      }
      await logAudit(userId, "update", "assignment_payout", req.params.payoutId, `Updated payout for assignment ${req.params.id}`);
      res.json(payout);
    } catch (error) {
      console.error("Error updating assignment payout:", error);
      res.status(500).json({ message: "Failed to update assignment payout" });
    }
  });

  app.get("/api/assignment-payouts/all", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const allPayouts = await (storage as any).getAllAssignmentPayouts(userId);
      res.json(allPayouts);
    } catch (error) {
      console.error("Error fetching all payouts:", error);
      res.status(500).json({ message: "Failed to fetch payouts" });
    }
  });

  app.delete("/api/assignments/:id/payouts/:payoutId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignment = await (storage as any).getAssignment(req.params.id, userId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      const payouts = await (storage as any).getAssignmentPayouts(req.params.id, userId);
      const payout = payouts.find((p: any) => p.id === req.params.payoutId);
      if (!payout) {
        return res.status(404).json({ message: "Payout not found" });
      }
      if (payout.status !== "scheduled") {
        return res.status(400).json({ message: "Can only delete payouts with 'scheduled' status" });
      }
      await (storage as any).deleteAssignmentPayout(req.params.payoutId, userId);
      await logAudit(userId, "delete", "assignment_payout", req.params.payoutId, `Deleted payout for assignment ${req.params.id}`);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting assignment payout:", error);
      res.status(500).json({ message: "Failed to delete assignment payout" });
    }
  });

  app.post("/api/assignments/:id/settle", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const assignment = await (storage as any).getAssignment(req.params.id, userId);
      if (!assignment) {
        return res.status(404).json({ message: "Assignment not found" });
      }
      if (assignment.status === "settled") {
        return res.status(400).json({ message: "Assignment is already settled" });
      }
      if (assignment.status === "closed" || assignment.status === "defaulted") {
        return res.status(400).json({ message: `Cannot settle an assignment with status '${assignment.status}'` });
      }

      const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
      const paymentReference = typeof req.body?.paymentReference === "string" ? req.body.paymentReference : undefined;
      const now = new Date();

      let tradeId = assignment.tradeId;
      let bondaiSessionId: string | null = null;

      if (assignment.settlementSessionId) {
        try {
          const { db } = await import("./db");
          const { settlementSessions } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          const [session] = await db
            .select({ sessionId: settlementSessions.sessionId, tradeId: settlementSessions.tradeId })
            .from(settlementSessions)
            .where(eq(settlementSessions.id, assignment.settlementSessionId))
            .limit(1);
          if (session) {
            bondaiSessionId = session.sessionId;
            if (!tradeId) tradeId = session.tradeId;
          }
        } catch (err) {
          console.error("Failed to load settlement session for webhook:", err);
        }
      }

      if (!tradeId) {
        return res.status(400).json({ message: "Cannot settle: no trade ID linked to this assignment. BondAI webhook notification is required." });
      }

      const updated = await (storage as any).updateAssignment(req.params.id, userId, {
        status: "settled",
        notes: notes ? (assignment.notes ? `${assignment.notes}\n\n[Settled ${now.toISOString()}] ${notes}` : `[Settled ${now.toISOString()}] ${notes}`) : assignment.notes,
      });

      if (assignment.settlementSessionId) {
        try {
          const { db } = await import("./db");
          const { settlementSessions } = await import("@shared/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(settlementSessions)
            .set({ status: "settled", settledAt: now, updatedAt: now, paymentReference: paymentReference || undefined })
            .where(eq(settlementSessions.id, assignment.settlementSessionId));
        } catch (err) {
          console.error("Failed to update linked settlement session:", err);
        }
      }

      try {
        const { sendBondAISettlementWebhook } = await import("./services/bondaiSettlementWebhook");
        await sendBondAISettlementWebhook("settlement.completed", tradeId, bondaiSessionId || req.params.id, {
          investorEmail: assignment.investorEmail,
          amount: assignment.totalAmount,
          paymentReference: paymentReference || null,
          paidAt: now.toISOString(),
          bondName: assignment.bondName,
          issuerName: assignment.issuerName,
          unitCount: assignment.unitCount,
          unitPrice: assignment.unitPrice,
          manualSettlement: true,
        });
      } catch (err: any) {
        console.error("[JACE WEBHOOK] Manual settlement webhook error:", err?.message);
      }

      await logAudit(userId, "update", "assignment", req.params.id, `Manually settled assignment: ${assignment.bondName || req.params.id}`, { paymentReference, notes });
      res.json({ success: true, assignment: updated });
    } catch (error) {
      console.error("Error settling assignment:", error);
      res.status(500).json({ message: "Failed to settle assignment" });
    }
  });
}
