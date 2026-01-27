import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, logAudit } from "./storage";
import { getSession } from "./replit_integrations/auth";
import { setupLocalAuth, isLocalAuthenticated } from "./local-auth";
import { handleHelpChat } from "./help-assistant";
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
  app.set("trust proxy", 1);
  app.use(getSession());
  setupLocalAuth(app);

  // Alias for middleware
  const isAuthenticated = isLocalAuthenticated;

  // AI Help Assistant
  app.post("/api/help-chat", isAuthenticated, handleHelpChat);

  // User Role API
  app.get("/api/user/role", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const userSession = (req.session as any)?.user;
      
      // Check if user is admin from session first
      if (userSession?.isAdmin === "true") {
        return res.json({ userId, role: "admin" });
      }
      
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

  // Bulk Investors API
  app.patch("/api/investors/bulk", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ids, updates } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No investor IDs provided" });
      }
      
      const results = [];
      for (const id of ids) {
        const investor = await storage.updateInvestor(id, userId, updates);
        if (investor) {
          results.push(investor);
          await logAudit(userId, "update", "investor", id, 
            `Bulk updated investor ${investor.firstName} ${investor.lastName}`);
        }
      }
      
      res.json({ updated: results.length, investors: results });
    } catch (error) {
      console.error("Error bulk updating investors:", error);
      res.status(500).json({ message: "Failed to bulk update investors" });
    }
  });

  app.delete("/api/investors/bulk", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No investor IDs provided" });
      }
      
      let deleted = 0;
      for (const id of ids) {
        const investor = await storage.getInvestor(id, userId);
        if (investor) {
          await storage.deleteInvestor(id, userId);
          await logAudit(userId, "delete", "investor", id, 
            `Bulk deleted investor ${investor.firstName} ${investor.lastName}`);
          deleted++;
        }
      }
      
      res.json({ deleted });
    } catch (error) {
      console.error("Error bulk deleting investors:", error);
      res.status(500).json({ message: "Failed to bulk delete investors" });
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

  // Bulk Tasks API
  app.patch("/api/tasks/bulk", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ids, updates } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No task IDs provided" });
      }
      
      const results = [];
      for (const id of ids) {
        const task = await storage.updateTask(id, userId, updates);
        if (task) {
          results.push(task);
          await logAudit(userId, "update", "task", id, 
            `Bulk updated task: ${task.title}`);
        }
      }
      
      res.json({ updated: results.length, tasks: results });
    } catch (error) {
      console.error("Error bulk updating tasks:", error);
      res.status(500).json({ message: "Failed to bulk update tasks" });
    }
  });

  app.delete("/api/tasks/bulk", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No task IDs provided" });
      }
      
      let deleted = 0;
      for (const id of ids) {
        const task = await storage.getTask(id, userId);
        if (task) {
          await storage.deleteTask(id, userId);
          await logAudit(userId, "delete", "task", id, 
            `Bulk deleted task: ${task.title}`);
          deleted++;
        }
      }
      
      res.json({ deleted });
    } catch (error) {
      console.error("Error bulk deleting tasks:", error);
      res.status(500).json({ message: "Failed to bulk delete tasks" });
    }
  });

  // ============ PHASE 2 API ROUTES ============

  // Analytics API
  app.get("/api/analytics", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const analytics = await storage.getAnalytics(userId);
      res.json(analytics);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // KYC Checklist API
  app.get("/api/kyc-checklist", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const investorId = typeof req.query.investorId === "string" ? req.query.investorId : undefined;
      
      const items = investorId
        ? await storage.getKycChecklistByInvestor(investorId, userId)
        : await storage.getKycChecklist(userId);
      
      res.json(items);
    } catch (error) {
      console.error("Error fetching KYC checklist:", error);
      res.status(500).json({ message: "Failed to fetch KYC checklist" });
    }
  });

  app.get("/api/kyc-checklist/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const item = await storage.getKycChecklistItem(req.params.id, userId);
      if (!item) {
        return res.status(404).json({ message: "KYC item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching KYC item:", error);
      res.status(500).json({ message: "Failed to fetch KYC item" });
    }
  });

  app.post("/api/kyc-checklist", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const itemData = {
        investorId: req.body.investorId,
        itemName: req.body.itemName,
        description: req.body.description || null,
        status: req.body.status || "pending",
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : null,
        documentId: req.body.documentId || null,
        notes: req.body.notes || null,
      };
      
      const item = await storage.createKycChecklistItem(userId, itemData);
      
      await logAudit(userId, "create", "kyc_item", item.id, 
        `Created KYC item: ${itemData.itemName}`);
      
      res.status(201).json(item);
    } catch (error) {
      console.error("Error creating KYC item:", error);
      res.status(500).json({ message: "Failed to create KYC item" });
    }
  });

  app.patch("/api/kyc-checklist/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const item = await storage.updateKycChecklistItem(req.params.id, userId, req.body);
      if (!item) {
        return res.status(404).json({ message: "KYC item not found" });
      }
      
      await logAudit(userId, "update", "kyc_item", req.params.id, 
        `Updated KYC item: ${item.itemName}`);
      
      res.json(item);
    } catch (error) {
      console.error("Error updating KYC item:", error);
      res.status(500).json({ message: "Failed to update KYC item" });
    }
  });

  app.delete("/api/kyc-checklist/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const item = await storage.getKycChecklistItem(req.params.id, userId);
      
      await storage.deleteKycChecklistItem(req.params.id, userId);
      
      if (item) {
        await logAudit(userId, "delete", "kyc_item", req.params.id, 
          `Deleted KYC item: ${item.itemName}`);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting KYC item:", error);
      res.status(500).json({ message: "Failed to delete KYC item" });
    }
  });

  // Bond Settlements API
  app.get("/api/bond-settlements", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const settlements = await storage.getBondSettlements(userId);
      res.json(settlements);
    } catch (error) {
      console.error("Error fetching bond settlements:", error);
      res.status(500).json({ message: "Failed to fetch bond settlements" });
    }
  });

  app.get("/api/bond-settlements/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const settlement = await storage.getBondSettlement(req.params.id, userId);
      if (!settlement) {
        return res.status(404).json({ message: "Bond settlement not found" });
      }
      res.json(settlement);
    } catch (error) {
      console.error("Error fetching bond settlement:", error);
      res.status(500).json({ message: "Failed to fetch bond settlement" });
    }
  });

  app.post("/api/bond-settlements", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const settlementData = {
        investorId: req.body.investorId || null,
        bondName: req.body.bondName,
        isin: req.body.isin || null,
        faceValue: req.body.faceValue,
        purchasePrice: req.body.purchasePrice || null,
        couponRate: req.body.couponRate || null,
        purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : null,
        settlementDate: req.body.settlementDate ? new Date(req.body.settlementDate) : null,
        maturityDate: req.body.maturityDate ? new Date(req.body.maturityDate) : null,
        status: req.body.status || "pending",
        notes: req.body.notes || null,
      };
      
      const settlement = await storage.createBondSettlement(userId, settlementData);
      
      await logAudit(userId, "create", "bond_settlement", settlement.id, 
        `Created bond: ${settlementData.bondName}`);
      
      res.status(201).json(settlement);
    } catch (error) {
      console.error("Error creating bond settlement:", error);
      res.status(500).json({ message: "Failed to create bond settlement" });
    }
  });

  app.patch("/api/bond-settlements/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const settlement = await storage.updateBondSettlement(req.params.id, userId, req.body);
      if (!settlement) {
        return res.status(404).json({ message: "Bond settlement not found" });
      }
      
      await logAudit(userId, "update", "bond_settlement", req.params.id, 
        `Updated bond: ${settlement.bondName}`);
      
      res.json(settlement);
    } catch (error) {
      console.error("Error updating bond settlement:", error);
      res.status(500).json({ message: "Failed to update bond settlement" });
    }
  });

  app.delete("/api/bond-settlements/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const settlement = await storage.getBondSettlement(req.params.id, userId);
      
      await storage.deleteBondSettlement(req.params.id, userId);
      
      if (settlement) {
        await logAudit(userId, "delete", "bond_settlement", req.params.id, 
          `Deleted bond: ${settlement.bondName}`);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting bond settlement:", error);
      res.status(500).json({ message: "Failed to delete bond settlement" });
    }
  });

  // Communications API
  app.get("/api/communications", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const investorId = typeof req.query.investorId === "string" ? req.query.investorId : undefined;
      
      const comms = investorId
        ? await storage.getCommunicationsByInvestor(investorId, userId)
        : await storage.getCommunications(userId);
      
      res.json(comms);
    } catch (error) {
      console.error("Error fetching communications:", error);
      res.status(500).json({ message: "Failed to fetch communications" });
    }
  });

  app.post("/api/communications", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const commData = {
        investorId: req.body.investorId,
        type: req.body.type,
        subject: req.body.subject || null,
        content: req.body.content,
        contactedAt: req.body.contactedAt ? new Date(req.body.contactedAt) : new Date(),
      };
      
      const comm = await storage.createCommunication(userId, commData);
      
      await logAudit(userId, "create", "communication", comm.id, 
        `Logged ${commData.type}: ${commData.subject || "No subject"}`);
      
      res.status(201).json(comm);
    } catch (error) {
      console.error("Error creating communication:", error);
      res.status(500).json({ message: "Failed to create communication" });
    }
  });

  app.delete("/api/communications/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const comm = await storage.getCommunication(req.params.id, userId);
      
      await storage.deleteCommunication(req.params.id, userId);
      
      if (comm) {
        await logAudit(userId, "delete", "communication", req.params.id, 
          `Deleted ${comm.type}`);
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting communication:", error);
      res.status(500).json({ message: "Failed to delete communication" });
    }
  });

  // Notifications API
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const unreadOnly = req.query.unread === "true";
      
      const notifs = unreadOnly
        ? await storage.getUnreadNotifications(userId)
        : await storage.getNotifications(userId);
      
      res.json(notifs);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const notifData = {
        userId,
        type: req.body.type,
        title: req.body.title,
        message: req.body.message || null,
        entityType: req.body.entityType || null,
        entityId: req.body.entityId || null,
        isRead: false,
      };
      
      const notif = await storage.createNotification(notifData);
      res.status(201).json(notif);
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ message: "Failed to create notification" });
    }
  });

  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const notif = await storage.markNotificationRead(req.params.id, userId);
      if (!notif) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json(notif);
    } catch (error) {
      console.error("Error marking notification read:", error);
      res.status(500).json({ message: "Failed to mark notification read" });
    }
  });

  app.post("/api/notifications/read-all", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.markAllNotificationsRead(userId);
      res.json({ message: "All notifications marked as read" });
    } catch (error) {
      console.error("Error marking all notifications read:", error);
      res.status(500).json({ message: "Failed to mark all notifications read" });
    }
  });

  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteNotification(req.params.id, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting notification:", error);
      res.status(500).json({ message: "Failed to delete notification" });
    }
  });

  // Export API
  app.get("/api/export/investors", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const investorsList = await storage.getInvestors(userId);
      
      const csv = [
        ["First Name", "Last Name", "Email", "Phone", "Company", "Type", "Pipeline Stage", "KYC Status", "Investment Amount", "Created At"],
        ...investorsList.map((i) => [
          i.firstName,
          i.lastName,
          i.email,
          i.phone || "",
          i.company || "",
          i.investorType,
          i.pipelineStage,
          i.kycStatus || "",
          i.investmentAmount || "",
          i.createdAt ? new Date(i.createdAt).toISOString() : "",
        ]),
      ]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=investors.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting investors:", error);
      res.status(500).json({ message: "Failed to export investors" });
    }
  });

  app.get("/api/export/accounts", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const accountsList = await storage.getAccounts(userId);
      
      const csv = [
        ["Code", "Name", "Type", "Description", "Balance", "Active", "Created At"],
        ...accountsList.map((a) => [
          a.code,
          a.name,
          a.accountType,
          a.description || "",
          a.balance || "0",
          a.isActive ? "Yes" : "No",
          a.createdAt ? new Date(a.createdAt).toISOString() : "",
        ]),
      ]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=accounts.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting accounts:", error);
      res.status(500).json({ message: "Failed to export accounts" });
    }
  });

  app.get("/api/export/bonds", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const bondsList = await storage.getBondSettlements(userId);
      
      const csv = [
        ["Bond Name", "ISIN", "Face Value", "Purchase Price", "Coupon Rate", "Purchase Date", "Settlement Date", "Maturity Date", "Status", "Created At"],
        ...bondsList.map((b) => [
          b.bondName,
          b.isin || "",
          b.faceValue,
          b.purchasePrice || "",
          b.couponRate || "",
          b.purchaseDate ? new Date(b.purchaseDate).toISOString().split("T")[0] : "",
          b.settlementDate ? new Date(b.settlementDate).toISOString().split("T")[0] : "",
          b.maturityDate ? new Date(b.maturityDate).toISOString().split("T")[0] : "",
          b.status,
          b.createdAt ? new Date(b.createdAt).toISOString() : "",
        ]),
      ]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");
      
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=bonds.csv");
      res.send(csv);
    } catch (error) {
      console.error("Error exporting bonds:", error);
      res.status(500).json({ message: "Failed to export bonds" });
    }
  });

  // ============ PHASE 3 ROUTES ============

  // Currencies
  app.get("/api/currencies", isAuthenticated, async (req, res) => {
    try {
      const currenciesList = await storage.getCurrencies();
      res.json(currenciesList);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      res.status(500).json({ message: "Failed to fetch currencies" });
    }
  });

  app.post("/api/currencies", isAuthenticated, async (req, res) => {
    try {
      const currency = await storage.createCurrency(req.body);
      res.status(201).json(currency);
    } catch (error) {
      console.error("Error creating currency:", error);
      res.status(500).json({ message: "Failed to create currency" });
    }
  });

  // Calendar Events
  app.get("/api/calendar-events", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { startDate, endDate } = req.query;
      
      let events;
      if (startDate && endDate) {
        events = await storage.getCalendarEventsByDateRange(
          userId,
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        events = await storage.getCalendarEvents(userId);
      }
      res.json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ message: "Failed to fetch calendar events" });
    }
  });

  app.get("/api/calendar-events/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const event = await storage.getCalendarEvent(req.params.id, userId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching calendar event:", error);
      res.status(500).json({ message: "Failed to fetch calendar event" });
    }
  });

  app.post("/api/calendar-events", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const event = await storage.createCalendarEvent(userId, req.body);
      await logAudit(userId, "create", "calendar_event", event.id, `Created event: ${event.title}`);
      res.status(201).json(event);
    } catch (error) {
      console.error("Error creating calendar event:", error);
      res.status(500).json({ message: "Failed to create calendar event" });
    }
  });

  app.patch("/api/calendar-events/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const event = await storage.updateCalendarEvent(req.params.id, userId, req.body);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      await logAudit(userId, "update", "calendar_event", event.id, `Updated event: ${event.title}`);
      res.json(event);
    } catch (error) {
      console.error("Error updating calendar event:", error);
      res.status(500).json({ message: "Failed to update calendar event" });
    }
  });

  app.delete("/api/calendar-events/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteCalendarEvent(req.params.id, userId);
      await logAudit(userId, "delete", "calendar_event", req.params.id, "Deleted calendar event");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      res.status(500).json({ message: "Failed to delete calendar event" });
    }
  });

  // Task Recurrences
  app.get("/api/task-recurrences", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const recurrences = await storage.getTaskRecurrences(userId);
      res.json(recurrences);
    } catch (error) {
      console.error("Error fetching task recurrences:", error);
      res.status(500).json({ message: "Failed to fetch task recurrences" });
    }
  });

  app.post("/api/task-recurrences", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const recurrence = await storage.createTaskRecurrence(userId, req.body);
      await logAudit(userId, "create", "task_recurrence", recurrence.id, `Created recurring task: ${recurrence.taskTemplateTitle}`);
      res.status(201).json(recurrence);
    } catch (error) {
      console.error("Error creating task recurrence:", error);
      res.status(500).json({ message: "Failed to create task recurrence" });
    }
  });

  app.patch("/api/task-recurrences/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const recurrence = await storage.updateTaskRecurrence(req.params.id, userId, req.body);
      if (!recurrence) {
        return res.status(404).json({ message: "Recurrence not found" });
      }
      res.json(recurrence);
    } catch (error) {
      console.error("Error updating task recurrence:", error);
      res.status(500).json({ message: "Failed to update task recurrence" });
    }
  });

  app.delete("/api/task-recurrences/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteTaskRecurrence(req.params.id, userId);
      await logAudit(userId, "delete", "task_recurrence", req.params.id, "Deleted recurring task");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting task recurrence:", error);
      res.status(500).json({ message: "Failed to delete task recurrence" });
    }
  });

  // Custom Fields
  app.get("/api/custom-fields", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const fields = await storage.getCustomFields(userId);
      res.json(fields);
    } catch (error) {
      console.error("Error fetching custom fields:", error);
      res.status(500).json({ message: "Failed to fetch custom fields" });
    }
  });

  app.post("/api/custom-fields", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const field = await storage.createCustomField(userId, req.body);
      await logAudit(userId, "create", "custom_field", field.id, `Created custom field: ${field.label}`);
      res.status(201).json(field);
    } catch (error) {
      console.error("Error creating custom field:", error);
      res.status(500).json({ message: "Failed to create custom field" });
    }
  });

  app.patch("/api/custom-fields/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const field = await storage.updateCustomField(req.params.id, userId, req.body);
      if (!field) {
        return res.status(404).json({ message: "Custom field not found" });
      }
      res.json(field);
    } catch (error) {
      console.error("Error updating custom field:", error);
      res.status(500).json({ message: "Failed to update custom field" });
    }
  });

  app.delete("/api/custom-fields/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteCustomField(req.params.id, userId);
      await logAudit(userId, "delete", "custom_field", req.params.id, "Deleted custom field");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting custom field:", error);
      res.status(500).json({ message: "Failed to delete custom field" });
    }
  });

  // Custom Field Values
  app.get("/api/investors/:investorId/custom-fields", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const values = await storage.getCustomFieldValues(req.params.investorId, userId);
      res.json(values);
    } catch (error) {
      console.error("Error fetching custom field values:", error);
      res.status(500).json({ message: "Failed to fetch custom field values" });
    }
  });

  app.post("/api/custom-field-values", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const value = await storage.setCustomFieldValue(userId, req.body);
      res.status(201).json(value);
    } catch (error) {
      console.error("Error setting custom field value:", error);
      res.status(500).json({ message: "Failed to set custom field value" });
    }
  });

  // Activity Timeline
  app.get("/api/investors/:investorId/timeline", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const timeline = await storage.getActivityTimeline(req.params.investorId, userId);
      res.json(timeline);
    } catch (error) {
      console.error("Error fetching activity timeline:", error);
      res.status(500).json({ message: "Failed to fetch activity timeline" });
    }
  });

  app.post("/api/activity-timeline", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const entry = await storage.createActivityTimelineEntry(userId, req.body);
      res.status(201).json(entry);
    } catch (error) {
      console.error("Error creating timeline entry:", error);
      res.status(500).json({ message: "Failed to create timeline entry" });
    }
  });

  // Email Templates
  app.get("/api/email-templates", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const templates = await storage.getEmailTemplates(userId);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      res.status(500).json({ message: "Failed to fetch email templates" });
    }
  });

  app.get("/api/email-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const template = await storage.getEmailTemplate(req.params.id, userId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error fetching email template:", error);
      res.status(500).json({ message: "Failed to fetch email template" });
    }
  });

  app.post("/api/email-templates", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const template = await storage.createEmailTemplate(userId, req.body);
      await logAudit(userId, "create", "email_template", template.id, `Created email template: ${template.name}`);
      res.status(201).json(template);
    } catch (error) {
      console.error("Error creating email template:", error);
      res.status(500).json({ message: "Failed to create email template" });
    }
  });

  app.patch("/api/email-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const template = await storage.updateEmailTemplate(req.params.id, userId, req.body);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      console.error("Error updating email template:", error);
      res.status(500).json({ message: "Failed to update email template" });
    }
  });

  app.delete("/api/email-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      await storage.deleteEmailTemplate(req.params.id, userId);
      await logAudit(userId, "delete", "email_template", req.params.id, "Deleted email template");
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting email template:", error);
      res.status(500).json({ message: "Failed to delete email template" });
    }
  });

  // Email Logs
  app.get("/api/email-logs", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const logs = await storage.getEmailLogs(userId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching email logs:", error);
      res.status(500).json({ message: "Failed to fetch email logs" });
    }
  });

  app.post("/api/send-email", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { investorId, templateId, toEmail, subject, body } = req.body;
      
      const log = await storage.createEmailLog(userId, {
        investorId: investorId || null,
        templateId: templateId || null,
        toEmail,
        subject,
        body,
        status: "sent",
      });
      
      await logAudit(userId, "create", "email", log.id, `Sent email to ${toEmail}: ${subject}`);
      
      if (investorId) {
        await storage.createActivityTimelineEntry(userId, {
          investorId,
          activityType: "email_sent",
          title: `Email sent: ${subject}`,
          description: `Email sent to ${toEmail}`,
          entityType: "email",
          entityId: log.id,
        });
      }
      
      res.status(201).json(log);
    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ message: "Failed to send email" });
    }
  });

  // Global Search
  app.get("/api/search", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const query = req.query.q as string;
      
      if (!query || query.length < 2) {
        return res.json({ investors: [], tasks: [], bonds: [], documents: [] });
      }
      
      const results = await storage.globalSearch(userId, query);
      res.json(results);
    } catch (error) {
      console.error("Error performing search:", error);
      res.status(500).json({ message: "Failed to perform search" });
    }
  });

  // Bulk Operations
  app.patch("/api/investors/bulk", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ids, updates } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No IDs provided" });
      }
      
      const count = await storage.bulkUpdateInvestors(userId, ids, updates);
      await logAudit(userId, "update", "investors", null, `Bulk updated ${count} investors`);
      res.json({ updated: count });
    } catch (error) {
      console.error("Error bulk updating investors:", error);
      res.status(500).json({ message: "Failed to bulk update investors" });
    }
  });

  app.patch("/api/tasks/bulk", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ids, updates } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No IDs provided" });
      }
      
      const count = await storage.bulkUpdateTasks(userId, ids, updates);
      await logAudit(userId, "update", "tasks", null, `Bulk updated ${count} tasks`);
      res.json({ updated: count });
    } catch (error) {
      console.error("Error bulk updating tasks:", error);
      res.status(500).json({ message: "Failed to bulk update tasks" });
    }
  });

  app.delete("/api/investors/bulk", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No IDs provided" });
      }
      
      const count = await storage.bulkDeleteInvestors(userId, ids);
      await logAudit(userId, "delete", "investors", null, `Bulk deleted ${count} investors`);
      res.json({ deleted: count });
    } catch (error) {
      console.error("Error bulk deleting investors:", error);
      res.status(500).json({ message: "Failed to bulk delete investors" });
    }
  });

  app.delete("/api/tasks/bulk", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { ids } = req.body;
      
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "No IDs provided" });
      }
      
      const count = await storage.bulkDeleteTasks(userId, ids);
      await logAudit(userId, "delete", "tasks", null, `Bulk deleted ${count} tasks`);
      res.json({ deleted: count });
    } catch (error) {
      console.error("Error bulk deleting tasks:", error);
      res.status(500).json({ message: "Failed to bulk delete tasks" });
    }
  });

  // Data Import (CSV)
  app.post("/api/import/investors", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const userId = getUserId(req);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file provided" });
      }
      
      const content = fs.readFileSync(file.path, "utf-8");
      const lines = content.split("\n").filter(line => line.trim());
      
      if (lines.length < 2) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "CSV file must have headers and at least one data row" });
      }
      
      const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
      const results = { success: 0, errors: [] as string[] };
      
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(",").map(v => v.trim().replace(/^"|"$/g, ""));
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] || "";
          });
          
          await storage.createInvestor(userId, {
            firstName: row["first name"] || row["firstname"] || row["first_name"] || "",
            lastName: row["last name"] || row["lastname"] || row["last_name"] || "",
            email: row["email"] || "",
            phone: row["phone"] || null,
            company: row["company"] || null,
            investorType: (row["type"] || row["investor_type"] || "individual") as any,
            pipelineStage: (row["stage"] || row["pipeline_stage"] || "lead") as any,
            investmentAmount: row["investment"] || row["investment_amount"] || null,
            notes: row["notes"] || null,
          });
          results.success++;
        } catch (err: any) {
          results.errors.push(`Row ${i + 1}: ${err.message}`);
        }
      }
      
      fs.unlinkSync(file.path);
      await logAudit(userId, "create", "import", null, `Imported ${results.success} investors from CSV`);
      res.json(results);
    } catch (error) {
      console.error("Error importing investors:", error);
      res.status(500).json({ message: "Failed to import investors" });
    }
  });

  // Investor Portal Users
  app.get("/api/investor-portal-users", isAuthenticated, async (req, res) => {
    try {
      const portalUsers = await storage.getAllInvestorPortalUsers();
      res.json(portalUsers);
    } catch (error) {
      console.error("Error fetching portal users:", error);
      res.status(500).json({ message: "Failed to fetch portal users" });
    }
  });

  app.post("/api/investor-portal-users", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { investorId, email } = req.body;
      
      const portalUser = await storage.createInvestorPortalUser({
        investorId,
        email,
        isActive: true,
      });
      
      await logAudit(userId, "create", "portal_user", portalUser.id, `Created portal access for ${email}`);
      res.status(201).json(portalUser);
    } catch (error) {
      console.error("Error creating portal user:", error);
      res.status(500).json({ message: "Failed to create portal user" });
    }
  });

  // CSV Import API for investors
  app.post("/api/import/investors", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const mappingsStr = req.body.mappings;
      if (!mappingsStr) {
        return res.status(400).json({ message: "Column mappings are required" });
      }
      
      let mappings: Array<{ csvColumn: string; mappedTo: string }>;
      try {
        mappings = JSON.parse(mappingsStr);
      } catch {
        return res.status(400).json({ message: "Invalid mappings format" });
      }
      
      const fileContent = fs.readFileSync(file.path, "utf-8");
      const lines = fileContent.split(/\r?\n/).filter((line: string) => line.trim());
      
      if (lines.length < 2) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "CSV file must have headers and at least one data row" });
      }
      
      const parseRow = (row: string): string[] => {
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            if (inQuotes && row[i + 1] === '"') {
              current += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      };
      
      const headers = parseRow(lines[0]);
      const dataRows = lines.slice(1).map(parseRow);
      
      const columnIndexMap: Record<string, number> = {};
      mappings.forEach((m) => {
        if (m.mappedTo !== "skip") {
          const idx = headers.indexOf(m.csvColumn);
          if (idx !== -1) {
            columnIndexMap[m.mappedTo] = idx;
          }
        }
      });
      
      let successCount = 0;
      const errors: string[] = [];
      
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const rowNum = i + 2;
        
        try {
          const firstName = columnIndexMap.firstName !== undefined ? row[columnIndexMap.firstName]?.trim() : "";
          const lastName = columnIndexMap.lastName !== undefined ? row[columnIndexMap.lastName]?.trim() : "";
          const email = columnIndexMap.email !== undefined ? row[columnIndexMap.email]?.trim() : "";
          
          if (!firstName || !lastName || !email) {
            errors.push(`Row ${rowNum}: Missing required field (firstName, lastName, or email)`);
            continue;
          }
          
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            errors.push(`Row ${rowNum}: Invalid email format "${email}"`);
            continue;
          }
          
          const investorData: any = {
            firstName,
            lastName,
            email,
            phone: columnIndexMap.phone !== undefined ? row[columnIndexMap.phone]?.trim() || null : null,
            company: columnIndexMap.company !== undefined ? row[columnIndexMap.company]?.trim() || null : null,
            investorType: "individual",
            pipelineStage: "lead",
            kycStatus: "pending",
            investmentAmount: null,
            notes: columnIndexMap.notes !== undefined ? row[columnIndexMap.notes]?.trim() || null : null,
          };
          
          if (columnIndexMap.investorType !== undefined) {
            const typeValue = row[columnIndexMap.investorType]?.trim().toLowerCase();
            if (["individual", "institutional", "fund"].includes(typeValue)) {
              investorData.investorType = typeValue;
            }
          }
          
          if (columnIndexMap.pipelineStage !== undefined) {
            const stageValue = row[columnIndexMap.pipelineStage]?.trim().toLowerCase().replace(/\s+/g, "_");
            if (["lead", "contacted", "kyc_pending", "documents", "ready", "closed"].includes(stageValue)) {
              investorData.pipelineStage = stageValue;
            }
          }
          
          if (columnIndexMap.investmentAmount !== undefined) {
            const amountStr = row[columnIndexMap.investmentAmount]?.trim().replace(/[,$]/g, "");
            const amount = parseFloat(amountStr);
            if (!isNaN(amount) && amount > 0) {
              investorData.investmentAmount = amountStr;
            }
          }
          
          await storage.createInvestor(userId, investorData);
          successCount++;
        } catch (error: any) {
          if (error.code === "23505") {
            errors.push(`Row ${rowNum}: Email already exists`);
          } else {
            errors.push(`Row ${rowNum}: ${error.message || "Unknown error"}`);
          }
        }
      }
      
      fs.unlinkSync(file.path);
      
      await logAudit(
        userId,
        "create",
        "import",
        null,
        `Imported ${successCount} investors from CSV (${errors.length} failed)`
      );
      
      res.json({
        success: successCount,
        failed: errors.length,
        errors,
      });
    } catch (error) {
      console.error("Error importing investors:", error);
      res.status(500).json({ message: "Failed to import investors" });
    }
  });

  // ============ COMPLIANCE ONBOARDING API ============

  // Get compliance documents for an investor
  app.get("/api/compliance/documents/:investorId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { investorId } = req.params;
      const docs = await storage.getComplianceDocuments(userId, investorId);
      res.json(docs);
    } catch (error) {
      console.error("Error fetching compliance documents:", error);
      res.status(500).json({ message: "Failed to fetch compliance documents" });
    }
  });

  // Get single compliance document
  app.get("/api/compliance/document/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const doc = await storage.getComplianceDocument(id, userId);
      if (!doc) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      // Log view event
      await storage.createComplianceAuditEvent(userId, {
        investorId: doc.investorId,
        eventType: "document_viewed",
        documentId: doc.id,
        description: `Viewed ${doc.documentType} document`,
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
        metadata: null,
      });
      
      res.json(doc);
    } catch (error) {
      console.error("Error fetching compliance document:", error);
      res.status(500).json({ message: "Failed to fetch compliance document" });
    }
  });

  // Submit signed compliance document
  app.post("/api/compliance/documents", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { investorId, documentType, formData, signature, onboardingSessionId } = req.body;

      if (!investorId || !documentType || !formData || !signature) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Create compliance document
      const doc = await storage.createComplianceDocument(userId, {
        investorId,
        documentType,
        formData: JSON.stringify(formData),
        onboardingSessionId: onboardingSessionId || null,
        status: "signed",
        signedAt: new Date(),
      });

      // Create electronic signature
      await storage.createElectronicSignature({
        complianceDocumentId: doc.id,
        signatoryName: signature.name,
        signatoryTitle: signature.title || null,
        signatureValue: signature.value,
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
        timezone: signature.timezone || "America/New_York",
        signedAt: new Date(),
      });

      // Update investor compliance status
      const existingCompliance = await storage.getInvestorCompliance(investorId);
      const updateData: any = { updatedAt: new Date() };

      if (documentType === "AML_CERTIFICATION") {
        updateData.amlCertificationSigned = true;
      } else if (documentType === "PRIVACY_CIP_KYC_NOTICE_CONSENT") {
        updateData.privacyNoticeSigned = true;
        if (formData.privacySharingTier) {
          updateData.privacySharingTier = formData.privacySharingTier;
        }
        if (formData.electronicDeliveryConsent !== undefined) {
          updateData.electronicDeliveryConsent = formData.electronicDeliveryConsent;
        }
      } else if (documentType === "PRIVACY_NOTICE_SHORTFORM") {
        updateData.shortFormPrivacySigned = true;
      }

      if (existingCompliance) {
        await storage.updateInvestorCompliance(investorId, updateData);
      } else {
        await storage.createInvestorCompliance({
          investorId,
          ...updateData,
        });
      }

      // Log audit event
      await storage.createComplianceAuditEvent(userId, {
        investorId,
        eventType: "document_signed",
        documentId: doc.id,
        description: `Signed ${documentType} document`,
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
        metadata: JSON.stringify({ signatoryName: signature.name }),
      });

      await logAudit(userId, "create", "compliance_document", doc.id, `Signed ${documentType} for investor ${investorId}`);

      res.json(doc);
    } catch (error) {
      console.error("Error submitting compliance document:", error);
      res.status(500).json({ message: "Failed to submit compliance document" });
    }
  });

  // Get investor compliance status
  app.get("/api/compliance/status/:investorId", isAuthenticated, async (req, res) => {
    try {
      const { investorId } = req.params;
      const compliance = await storage.getInvestorCompliance(investorId);
      res.json(compliance || { 
        investorId, 
        isActivated: false,
        amlCertificationSigned: false,
        privacyNoticeSigned: false,
        shortFormPrivacySigned: false,
      });
    } catch (error) {
      console.error("Error fetching compliance status:", error);
      res.status(500).json({ message: "Failed to fetch compliance status" });
    }
  });

  // Update investor compliance preferences
  app.patch("/api/compliance/preferences/:investorId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { investorId } = req.params;
      const { privacySharingTier, electronicDeliveryConsent } = req.body;

      const existingCompliance = await storage.getInvestorCompliance(investorId);
      const updateData: any = {};

      if (privacySharingTier) {
        updateData.privacySharingTier = privacySharingTier;
      }
      if (electronicDeliveryConsent !== undefined) {
        updateData.electronicDeliveryConsent = electronicDeliveryConsent;
      }

      let compliance;
      if (existingCompliance) {
        compliance = await storage.updateInvestorCompliance(investorId, updateData);
      } else {
        compliance = await storage.createInvestorCompliance({
          investorId,
          ...updateData,
        });
      }

      // Log preference change
      await storage.createComplianceAuditEvent(userId, {
        investorId,
        eventType: "preference_changed",
        documentId: null,
        description: `Updated privacy preferences`,
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
        metadata: JSON.stringify(updateData),
      });

      res.json(compliance);
    } catch (error) {
      console.error("Error updating compliance preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Activate investor (requires all documents signed)
  app.post("/api/compliance/activate/:investorId", isAuthenticated, async (req, res) => {
    try {
      const userId = getUserId(req);
      const { investorId } = req.params;

      const compliance = await storage.getInvestorCompliance(investorId);
      
      if (!compliance) {
        return res.status(400).json({ message: "No compliance record found for investor" });
      }

      // Check if all required documents are signed
      if (!compliance.amlCertificationSigned || !compliance.privacyNoticeSigned) {
        return res.status(400).json({ 
          message: "All required compliance documents must be signed before activation",
          required: {
            amlCertificationSigned: compliance.amlCertificationSigned,
            privacyNoticeSigned: compliance.privacyNoticeSigned,
          }
        });
      }

      const updated = await storage.updateInvestorCompliance(investorId, {
        isActivated: true,
        activatedAt: new Date(),
      });

      // Update investor pipeline stage to ready
      await storage.updateInvestor(investorId, userId, {
        pipelineStage: "ready",
      });

      // Log activation
      await storage.createComplianceAuditEvent(userId, {
        investorId,
        eventType: "investor_activated",
        documentId: null,
        description: "Investor activated after completing compliance onboarding",
        ipAddress: req.ip || null,
        userAgent: req.get("User-Agent") || null,
        metadata: null,
      });

      await logAudit(userId, "update", "investor", investorId, "Investor activated after compliance completion");

      res.json(updated);
    } catch (error) {
      console.error("Error activating investor:", error);
      res.status(500).json({ message: "Failed to activate investor" });
    }
  });

  // Get compliance audit events
  app.get("/api/compliance/audit/:investorId", isAuthenticated, async (req, res) => {
    try {
      const { investorId } = req.params;
      const events = await storage.getComplianceAuditEvents(investorId);
      res.json(events);
    } catch (error) {
      console.error("Error fetching compliance audit events:", error);
      res.status(500).json({ message: "Failed to fetch audit events" });
    }
  });

  // Beneficial owners CRUD
  app.get("/api/compliance/beneficial-owners/:investorId", isAuthenticated, async (req, res) => {
    try {
      const { investorId } = req.params;
      const owners = await storage.getBeneficialOwners(investorId);
      res.json(owners);
    } catch (error) {
      console.error("Error fetching beneficial owners:", error);
      res.status(500).json({ message: "Failed to fetch beneficial owners" });
    }
  });

  app.post("/api/compliance/beneficial-owners", isAuthenticated, async (req, res) => {
    try {
      const owner = await storage.createBeneficialOwner(req.body);
      res.json(owner);
    } catch (error) {
      console.error("Error creating beneficial owner:", error);
      res.status(500).json({ message: "Failed to create beneficial owner" });
    }
  });

  app.patch("/api/compliance/beneficial-owners/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const owner = await storage.updateBeneficialOwner(id, req.body);
      if (!owner) {
        return res.status(404).json({ message: "Beneficial owner not found" });
      }
      res.json(owner);
    } catch (error) {
      console.error("Error updating beneficial owner:", error);
      res.status(500).json({ message: "Failed to update beneficial owner" });
    }
  });

  app.delete("/api/compliance/beneficial-owners/:id", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteBeneficialOwner(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting beneficial owner:", error);
      res.status(500).json({ message: "Failed to delete beneficial owner" });
    }
  });

  return httpServer;
}
