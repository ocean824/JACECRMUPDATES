import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import {
  insertInvestorSchema,
  insertAccountSchema,
  insertJournalEntrySchema,
  insertJournalEntryLineSchema,
  insertTaskSchema,
} from "@shared/schema";

// Helper to get user ID from request
function getUserId(req: Request): string {
  const user = req.user as any;
  return user?.claims?.sub;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);
  registerAuthRoutes(app);

  // Investors API (user-scoped)
  app.get("/api/investors", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const investors = await storage.getInvestors(userId);
      res.json(investors);
    } catch (error) {
      console.error("Error fetching investors:", error);
      res.status(500).json({ message: "Failed to fetch investors" });
    }
  });

  app.get("/api/investors/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const investor = await storage.getInvestor(req.params.id, userId);
      if (!investor) {
        return res.status(404).json({ message: "Investor not found" });
      }
      res.json(investor);
    } catch (error) {
      console.error("Error fetching investor:", error);
      res.status(500).json({ message: "Failed to fetch investor" });
    }
  });

  app.post("/api/investors", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      console.log("Creating investor for user:", userId, "Data:", JSON.stringify(req.body));
      
      // Validate and transform the data
      const investorData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone || null,
        company: req.body.company || null,
        pipelineStage: req.body.pipelineStage || "lead",
        kycStatus: req.body.kycStatus || "pending",
        investmentAmount: req.body.investmentAmount || null,
        notes: req.body.notes || null,
      };
      
      console.log("Processed investor data:", JSON.stringify(investorData));
      const investor = await storage.createInvestor(userId, investorData);
      res.status(201).json(investor);
    } catch (error: any) {
      console.error("Error creating investor:", error.message, error.stack);
      if (error.code === "23505") {
        return res.status(400).json({ message: "Email already exists" });
      }
      res.status(500).json({ message: "Failed to create investor", details: error.message });
    }
  });

  app.patch("/api/investors/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const investor = await storage.updateInvestor(req.params.id, userId, req.body);
      if (!investor) {
        return res.status(404).json({ message: "Investor not found" });
      }
      res.json(investor);
    } catch (error) {
      console.error("Error updating investor:", error);
      res.status(500).json({ message: "Failed to update investor" });
    }
  });

  app.delete("/api/investors/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteInvestor(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting investor:", error);
      res.status(500).json({ message: "Failed to delete investor" });
    }
  });

  // Accounts API (user-scoped)
  app.get("/api/accounts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const accounts = await storage.getAccounts(userId);
      res.json(accounts);
    } catch (error) {
      console.error("Error fetching accounts:", error);
      res.status(500).json({ message: "Failed to fetch accounts" });
    }
  });

  app.get("/api/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const account = await storage.getAccount(req.params.id, userId);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error fetching account:", error);
      res.status(500).json({ message: "Failed to fetch account" });
    }
  });

  app.post("/api/accounts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const accountData = {
        code: req.body.code,
        name: req.body.name,
        accountType: req.body.accountType,
        description: req.body.description || null,
        balance: req.body.balance || "0",
        isActive: req.body.isActive !== false,
      };
      const account = await storage.createAccount(userId, accountData);
      res.status(201).json(account);
    } catch (error: any) {
      console.error("Error creating account:", error);
      if (error.code === "23505") {
        return res.status(400).json({ message: "Account code already exists" });
      }
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.patch("/api/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const account = await storage.updateAccount(req.params.id, userId, req.body);
      if (!account) {
        return res.status(404).json({ message: "Account not found" });
      }
      res.json(account);
    } catch (error) {
      console.error("Error updating account:", error);
      res.status(500).json({ message: "Failed to update account" });
    }
  });

  app.delete("/api/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteAccount(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Journal Entries API (user-scoped)
  app.get("/api/journal-entries", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entries = await storage.getJournalEntries(userId);
      res.json(entries);
    } catch (error) {
      console.error("Error fetching journal entries:", error);
      res.status(500).json({ message: "Failed to fetch journal entries" });
    }
  });

  app.get("/api/journal-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entry = await storage.getJournalEntry(req.params.id, userId);
      if (!entry) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      const lines = await storage.getJournalEntryLines(req.params.id);
      res.json({ ...entry, lines });
    } catch (error) {
      console.error("Error fetching journal entry:", error);
      res.status(500).json({ message: "Failed to fetch journal entry" });
    }
  });

  app.post("/api/journal-entries", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const parsed = insertJournalEntrySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid data", errors: parsed.error.errors });
      }
      const entry = await storage.createJournalEntry(userId, parsed.data);
      res.status(201).json(entry);
    } catch (error: any) {
      console.error("Error creating journal entry:", error);
      if (error.code === "23505") {
        return res.status(400).json({ message: "Entry number already exists" });
      }
      res.status(500).json({ message: "Failed to create journal entry" });
    }
  });

  app.delete("/api/journal-entries/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteJournalEntry(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting journal entry:", error);
      res.status(500).json({ message: "Failed to delete journal entry" });
    }
  });

  // Journal Entry Lines API
  app.post("/api/journal-entry-lines", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { journalEntryId, accountId, debit, credit, description } = req.body;
      
      // Validate that the journal entry and account belong to the authenticated user
      const entry = await storage.getJournalEntry(journalEntryId, userId);
      if (!entry) {
        return res.status(403).json({ message: "Journal entry not found or access denied" });
      }
      
      const account = await storage.getAccount(accountId, userId);
      if (!account) {
        return res.status(403).json({ message: "Account not found or access denied" });
      }
      
      const lineData = {
        journalEntryId,
        accountId,
        debit: debit || "0",
        credit: credit || "0",
        description: description || null,
      };
      
      const line = await storage.createJournalEntryLine(lineData);
      res.status(201).json(line);
    } catch (error) {
      console.error("Error creating journal entry line:", error);
      res.status(500).json({ message: "Failed to create journal entry line" });
    }
  });

  // Tasks API (user-scoped)
  app.get("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const tasks = await storage.getTasks(userId);
      res.json(tasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      res.status(500).json({ message: "Failed to fetch tasks" });
    }
  });

  app.get("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const task = await storage.getTask(req.params.id, userId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error fetching task:", error);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  app.post("/api/tasks", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const taskData = {
        title: req.body.title,
        description: req.body.description || null,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        priority: req.body.priority || "medium",
        status: req.body.status || "pending",
        investorId: req.body.investorId || null,
        assignedTo: req.body.assignedTo || null,
      };
      const task = await storage.createTask(userId, taskData);
      res.status(201).json(task);
    } catch (error) {
      console.error("Error creating task:", error);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.patch("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const task = await storage.updateTask(req.params.id, userId, req.body);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteTask(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  return httpServer;
}
