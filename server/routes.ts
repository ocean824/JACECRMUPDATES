import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, logAudit } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

function getUserId(req: Request): string {
  const user = req.user as any;
  return user?.claims?.sub;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);

  // User Role API
  app.get("/api/user/role", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const role = await storage.getUserRole(userId);
      res.json(role || { userId, role: "investor_relations" });
    } catch (error) {
      console.error("Error fetching user role:", error);
      res.status(500).json({ message: "Failed to fetch user role" });
    }
  });

  app.get("/api/admin/roles", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const userRole = await storage.getUserRole(userId);
      if (userRole?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const roles = await storage.getAllUserRoles();
      res.json(roles);
    } catch (error) {
      console.error("Error fetching all roles:", error);
      res.status(500).json({ message: "Failed to fetch roles" });
    }
  });

  app.post("/api/admin/roles", isAuthenticated, async (req, res) => {
    try {
      const adminId = getUserId(req);
      const adminRole = await storage.getUserRole(adminId);
      if (adminRole?.role !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const { userId, role } = req.body;
      const result = await storage.setUserRole({ userId, role });
      
      await logAudit(adminId, "update", "user_role", userId, `Set role to ${role}`);
      
      res.status(201).json(result);
    } catch (error) {
      console.error("Error setting role:", error);
      res.status(500).json({ message: "Failed to set role" });
    }
  });

  // Audit Logs API
  app.get("/api/audit-logs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const userRole = await storage.getUserRole(userId);
      
      const limitStr = req.query.limit;
      const limit = typeof limitStr === "string" ? parseInt(limitStr) : 100;
      const logs = userRole?.role === "admin"
        ? await storage.getAllAuditLogs(limit)
        : await storage.getAuditLogs(userId, limit);
      
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ message: "Failed to fetch audit logs" });
    }
  });

  // Documents API
  app.get("/api/documents", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const investorId = typeof req.query.investorId === "string" ? req.query.investorId : undefined;
      
      const docs = investorId
        ? await storage.getDocumentsByInvestor(investorId, userId)
        : await storage.getDocuments(userId);
      
      res.json(docs);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const docData = {
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        investorId: req.body.investorId || null,
        category: req.body.category || null,
        description: req.body.description || null,
      };
      
      const doc = await storage.createDocument(userId, docData);
      
      await logAudit(userId, "create", "document", doc.id, `Uploaded ${file.originalname}`);
      
      res.status(201).json(doc);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  app.get("/api/documents/:id/download", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const doc = await storage.getDocument(req.params.id, userId);
      
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const filePath = path.join(uploadDir, doc.filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      
      res.download(filePath, doc.originalName);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  app.delete("/api/documents/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const doc = await storage.getDocument(req.params.id, userId);
      
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      const filePath = path.join(uploadDir, doc.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      await storage.deleteDocument(req.params.id, userId);
      await logAudit(userId, "delete", "document", req.params.id, `Deleted ${doc.originalName}`);
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: "Failed to delete document" });
    }
  });

  // Investors API
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
      
      const investorData = {
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone || null,
        company: req.body.company || null,
        investorType: req.body.investorType || "individual",
        pipelineStage: req.body.pipelineStage || "lead",
        kycStatus: req.body.kycStatus || "pending",
        investmentAmount: req.body.investmentAmount || null,
        notes: req.body.notes || null,
      };
      
      const investor = await storage.createInvestor(userId, investorData);
      
      await logAudit(userId, "create", "investor", investor.id, 
        `Created investor ${investorData.firstName} ${investorData.lastName}`);
      
      res.status(201).json(investor);
    } catch (error: any) {
      console.error("Error creating investor:", error.message);
      if (error.code === "23505") {
        return res.status(400).json({ message: "Email already exists" });
      }
      res.status(500).json({ message: "Failed to create investor" });
    }
  });

  app.patch("/api/investors/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const investor = await storage.updateInvestor(req.params.id, userId, req.body);
      if (!investor) {
        return res.status(404).json({ message: "Investor not found" });
      }
      
      await logAudit(userId, "update", "investor", req.params.id, 
        `Updated investor ${investor.firstName} ${investor.lastName}`);
      
      res.json(investor);
    } catch (error) {
      console.error("Error updating investor:", error);
      res.status(500).json({ message: "Failed to update investor" });
    }
  });

  app.delete("/api/investors/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const investor = await storage.getInvestor(req.params.id, userId);
      
      await storage.deleteInvestor(req.params.id, userId);
      
      if (investor) {
        await logAudit(userId, "delete", "investor", req.params.id, 
          `Deleted investor ${investor.firstName} ${investor.lastName}`);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting investor:", error);
      res.status(500).json({ message: "Failed to delete investor" });
    }
  });

  // Accounts API
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
      
      await logAudit(userId, "create", "account", account.id, 
        `Created account ${accountData.code} - ${accountData.name}`);
      
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
      
      await logAudit(userId, "update", "account", req.params.id, 
        `Updated account ${account.code}`);
      
      res.json(account);
    } catch (error) {
      console.error("Error updating account:", error);
      res.status(500).json({ message: "Failed to update account" });
    }
  });

  app.delete("/api/accounts/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const account = await storage.getAccount(req.params.id, userId);
      
      await storage.deleteAccount(req.params.id, userId);
      
      if (account) {
        await logAudit(userId, "delete", "account", req.params.id, 
          `Deleted account ${account.code}`);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting account:", error);
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Journal Entries API
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
      const entryData = {
        entryNumber: req.body.entryNumber,
        description: req.body.description,
        date: req.body.date ? new Date(req.body.date) : new Date(),
      };
      const entry = await storage.createJournalEntry(userId, entryData);
      
      await logAudit(userId, "create", "journal_entry", entry.id, 
        `Created journal entry ${entryData.entryNumber}`);
      
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
      const entry = await storage.getJournalEntry(req.params.id, userId);
      
      await storage.deleteJournalEntry(req.params.id, userId);
      
      if (entry) {
        await logAudit(userId, "delete", "journal_entry", req.params.id, 
          `Deleted journal entry ${entry.entryNumber}`);
      }
      
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

  // Tasks API
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
      
      await logAudit(userId, "create", "task", task.id, 
        `Created task: ${taskData.title}`);
      
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
      
      await logAudit(userId, "update", "task", req.params.id, 
        `Updated task: ${task.title}`);
      
      res.json(task);
    } catch (error) {
      console.error("Error updating task:", error);
      res.status(500).json({ message: "Failed to update task" });
    }
  });

  app.delete("/api/tasks/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const task = await storage.getTask(req.params.id, userId);
      
      await storage.deleteTask(req.params.id, userId);
      
      if (task) {
        await logAudit(userId, "delete", "task", req.params.id, 
          `Deleted task: ${task.title}`);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task:", error);
      res.status(500).json({ message: "Failed to delete task" });
    }
  });

  return httpServer;
}
