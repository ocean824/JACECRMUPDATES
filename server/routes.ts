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

  return httpServer;
}
