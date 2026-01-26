import {
  investors,
  accounts,
  journalEntries,
  journalEntryLines,
  tasks,
  userRoles,
  auditLogs,
  documents,
  kycChecklist,
  bondSettlements,
  communications,
  notifications,
  type Investor,
  type InsertInvestor,
  type Account,
  type InsertAccount,
  type JournalEntry,
  type InsertJournalEntry,
  type JournalEntryLine,
  type InsertJournalEntryLine,
  type Task,
  type InsertTask,
  type UserRole,
  type InsertUserRole,
  type AuditLog,
  type InsertAuditLog,
  type Document,
  type InsertDocument,
  type KycChecklistItem,
  type InsertKycChecklistItem,
  type BondSettlement,
  type InsertBondSettlement,
  type Communication,
  type InsertCommunication,
  type Notification,
  type InsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, count, sum, gte, lte } from "drizzle-orm";

export interface IStorage {
  // User Roles
  getUserRole(userId: string): Promise<UserRole | undefined>;
  setUserRole(role: InsertUserRole): Promise<UserRole>;
  updateUserRole(userId: string, role: string): Promise<UserRole | undefined>;
  getAllUserRoles(): Promise<UserRole[]>;

  // Audit Logs
  getAuditLogs(userId: string, limit?: number): Promise<AuditLog[]>;
  getAllAuditLogs(limit?: number): Promise<AuditLog[]>;
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;

  // Documents
  getDocuments(userId: string): Promise<Document[]>;
  getDocumentsByInvestor(investorId: string, userId: string): Promise<Document[]>;
  getDocument(id: string, userId: string): Promise<Document | undefined>;
  createDocument(userId: string, doc: InsertDocument): Promise<Document>;
  deleteDocument(id: string, userId: string): Promise<boolean>;

  // Investors (user-scoped)
  getInvestors(userId: string): Promise<Investor[]>;
  getInvestor(id: string, userId: string): Promise<Investor | undefined>;
  createInvestor(userId: string, investor: InsertInvestor): Promise<Investor>;
  updateInvestor(id: string, userId: string, investor: Partial<InsertInvestor>): Promise<Investor | undefined>;
  deleteInvestor(id: string, userId: string): Promise<boolean>;

  // Accounts (user-scoped)
  getAccounts(userId: string): Promise<Account[]>;
  getAccount(id: string, userId: string): Promise<Account | undefined>;
  createAccount(userId: string, account: InsertAccount): Promise<Account>;
  updateAccount(id: string, userId: string, account: Partial<InsertAccount>): Promise<Account | undefined>;
  deleteAccount(id: string, userId: string): Promise<boolean>;

  // Journal Entries (user-scoped)
  getJournalEntries(userId: string): Promise<JournalEntry[]>;
  getJournalEntry(id: string, userId: string): Promise<JournalEntry | undefined>;
  createJournalEntry(userId: string, entry: InsertJournalEntry): Promise<JournalEntry>;
  deleteJournalEntry(id: string, userId: string): Promise<boolean>;

  // Journal Entry Lines
  getJournalEntryLines(journalEntryId: string): Promise<JournalEntryLine[]>;
  createJournalEntryLine(line: InsertJournalEntryLine): Promise<JournalEntryLine>;

  // Tasks (user-scoped)
  getTasks(userId: string): Promise<Task[]>;
  getTask(id: string, userId: string): Promise<Task | undefined>;
  createTask(userId: string, task: InsertTask): Promise<Task>;
  updateTask(id: string, userId: string, task: Partial<InsertTask>): Promise<Task | undefined>;
  deleteTask(id: string, userId: string): Promise<boolean>;

  // ============ PHASE 2 ============

  // KYC Checklist (user-scoped)
  getKycChecklist(userId: string): Promise<KycChecklistItem[]>;
  getKycChecklistByInvestor(investorId: string, userId: string): Promise<KycChecklistItem[]>;
  getKycChecklistItem(id: string, userId: string): Promise<KycChecklistItem | undefined>;
  createKycChecklistItem(userId: string, item: InsertKycChecklistItem): Promise<KycChecklistItem>;
  updateKycChecklistItem(id: string, userId: string, item: Partial<InsertKycChecklistItem>): Promise<KycChecklistItem | undefined>;
  deleteKycChecklistItem(id: string, userId: string): Promise<boolean>;

  // Bond Settlements (user-scoped)
  getBondSettlements(userId: string): Promise<BondSettlement[]>;
  getBondSettlement(id: string, userId: string): Promise<BondSettlement | undefined>;
  createBondSettlement(userId: string, settlement: InsertBondSettlement): Promise<BondSettlement>;
  updateBondSettlement(id: string, userId: string, settlement: Partial<InsertBondSettlement>): Promise<BondSettlement | undefined>;
  deleteBondSettlement(id: string, userId: string): Promise<boolean>;

  // Communications (user-scoped)
  getCommunications(userId: string): Promise<Communication[]>;
  getCommunicationsByInvestor(investorId: string, userId: string): Promise<Communication[]>;
  getCommunication(id: string, userId: string): Promise<Communication | undefined>;
  createCommunication(userId: string, comm: InsertCommunication): Promise<Communication>;
  deleteCommunication(id: string, userId: string): Promise<boolean>;

  // Notifications (user-scoped)
  getNotifications(userId: string): Promise<Notification[]>;
  getUnreadNotifications(userId: string): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string, userId: string): Promise<Notification | undefined>;
  markAllNotificationsRead(userId: string): Promise<void>;
  deleteNotification(id: string, userId: string): Promise<boolean>;

  // Analytics
  getAnalytics(userId: string): Promise<{
    investorsByStage: { stage: string; count: number }[];
    investorsByType: { type: string; count: number }[];
    totalPipelineValue: number;
    tasksByStatus: { status: string; count: number }[];
    tasksByPriority: { priority: string; count: number }[];
    bondsByStatus: { status: string; count: number; totalValue: number }[];
    recentActivity: AuditLog[];
  }>;
}

export class DatabaseStorage implements IStorage {
  // User Roles
  async getUserRole(userId: string): Promise<UserRole | undefined> {
    const [role] = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
    return role;
  }

  async setUserRole(role: InsertUserRole): Promise<UserRole> {
    const existing = await this.getUserRole(role.userId);
    if (existing) {
      const [updated] = await db
        .update(userRoles)
        .set({ role: role.role, updatedAt: new Date() })
        .where(eq(userRoles.userId, role.userId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userRoles).values(role).returning();
    return created;
  }

  async updateUserRole(userId: string, role: string): Promise<UserRole | undefined> {
    const [updated] = await db
      .update(userRoles)
      .set({ role: role as any, updatedAt: new Date() })
      .where(eq(userRoles.userId, userId))
      .returning();
    return updated;
  }

  async getAllUserRoles(): Promise<UserRole[]> {
    return db.select().from(userRoles).orderBy(desc(userRoles.createdAt));
  }

  // Audit Logs
  async getAuditLogs(userId: string, limit: number = 100): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async getAllAuditLogs(limit: number = 100): Promise<AuditLog[]> {
    return db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit);
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  // Documents
  async getDocuments(userId: string): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentsByInvestor(investorId: string, userId: string): Promise<Document[]> {
    return db
      .select()
      .from(documents)
      .where(and(eq(documents.investorId, investorId), eq(documents.userId, userId)))
      .orderBy(desc(documents.createdAt));
  }

  async getDocument(id: string, userId: string): Promise<Document | undefined> {
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.userId, userId)));
    return doc;
  }

  async createDocument(userId: string, doc: InsertDocument): Promise<Document> {
    const [created] = await db.insert(documents).values({ ...doc, userId }).returning();
    return created;
  }

  async deleteDocument(id: string, userId: string): Promise<boolean> {
    await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
    return true;
  }

  // Investors (user-scoped)
  async getInvestors(userId: string): Promise<Investor[]> {
    return db.select().from(investors).where(eq(investors.userId, userId)).orderBy(desc(investors.createdAt));
  }

  async getInvestor(id: string, userId: string): Promise<Investor | undefined> {
    const [investor] = await db.select().from(investors).where(and(eq(investors.id, id), eq(investors.userId, userId)));
    return investor;
  }

  async createInvestor(userId: string, investor: InsertInvestor): Promise<Investor> {
    const [created] = await db.insert(investors).values({ ...investor, userId }).returning();
    return created;
  }

  async updateInvestor(id: string, userId: string, investor: Partial<InsertInvestor>): Promise<Investor | undefined> {
    const [updated] = await db
      .update(investors)
      .set({ ...investor, updatedAt: new Date() })
      .where(and(eq(investors.id, id), eq(investors.userId, userId)))
      .returning();
    return updated;
  }

  async deleteInvestor(id: string, userId: string): Promise<boolean> {
    await db.delete(investors).where(and(eq(investors.id, id), eq(investors.userId, userId)));
    return true;
  }

  // Accounts (user-scoped)
  async getAccounts(userId: string): Promise<Account[]> {
    return db.select().from(accounts).where(eq(accounts.userId, userId)).orderBy(accounts.code);
  }

  async getAccount(id: string, userId: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    return account;
  }

  async createAccount(userId: string, account: InsertAccount): Promise<Account> {
    const [created] = await db.insert(accounts).values({ ...account, userId }).returning();
    return created;
  }

  async updateAccount(id: string, userId: string, account: Partial<InsertAccount>): Promise<Account | undefined> {
    const [updated] = await db
      .update(accounts)
      .set(account)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .returning();
    return updated;
  }

  async deleteAccount(id: string, userId: string): Promise<boolean> {
    await db.delete(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId)));
    return true;
  }

  // Journal Entries (user-scoped)
  async getJournalEntries(userId: string): Promise<JournalEntry[]> {
    return db.select().from(journalEntries).where(eq(journalEntries.userId, userId)).orderBy(desc(journalEntries.date));
  }

  async getJournalEntry(id: string, userId: string): Promise<JournalEntry | undefined> {
    const [entry] = await db.select().from(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
    return entry;
  }

  async createJournalEntry(userId: string, entry: InsertJournalEntry): Promise<JournalEntry> {
    const [created] = await db.insert(journalEntries).values({ ...entry, userId }).returning();
    return created;
  }

  async deleteJournalEntry(id: string, userId: string): Promise<boolean> {
    const entry = await this.getJournalEntry(id, userId);
    if (entry) {
      await db.delete(journalEntryLines).where(eq(journalEntryLines.journalEntryId, id));
      await db.delete(journalEntries).where(and(eq(journalEntries.id, id), eq(journalEntries.userId, userId)));
    }
    return true;
  }

  // Journal Entry Lines
  async getJournalEntryLines(journalEntryId: string): Promise<JournalEntryLine[]> {
    return db
      .select()
      .from(journalEntryLines)
      .where(eq(journalEntryLines.journalEntryId, journalEntryId));
  }

  async createJournalEntryLine(line: InsertJournalEntryLine): Promise<JournalEntryLine> {
    const [created] = await db.insert(journalEntryLines).values(line).returning();
    return created;
  }

  // Tasks (user-scoped)
  async getTasks(userId: string): Promise<Task[]> {
    return db.select().from(tasks).where(eq(tasks.userId, userId)).orderBy(desc(tasks.createdAt));
  }

  async getTask(id: string, userId: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return task;
  }

  async createTask(userId: string, task: InsertTask): Promise<Task> {
    const [created] = await db.insert(tasks).values({ ...task, userId }).returning();
    return created;
  }

  async updateTask(id: string, userId: string, task: Partial<InsertTask>): Promise<Task | undefined> {
    const updateData: any = { ...task };
    if (task.status === "completed") {
      updateData.completedAt = new Date();
    }
    const [updated] = await db
      .update(tasks)
      .set(updateData)
      .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
      .returning();
    return updated;
  }

  async deleteTask(id: string, userId: string): Promise<boolean> {
    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
    return true;
  }

  // ============ PHASE 2 IMPLEMENTATIONS ============

  // KYC Checklist
  async getKycChecklist(userId: string): Promise<KycChecklistItem[]> {
    return db.select().from(kycChecklist).where(eq(kycChecklist.userId, userId)).orderBy(desc(kycChecklist.createdAt));
  }

  async getKycChecklistByInvestor(investorId: string, userId: string): Promise<KycChecklistItem[]> {
    return db
      .select()
      .from(kycChecklist)
      .where(and(eq(kycChecklist.investorId, investorId), eq(kycChecklist.userId, userId)))
      .orderBy(desc(kycChecklist.createdAt));
  }

  async getKycChecklistItem(id: string, userId: string): Promise<KycChecklistItem | undefined> {
    const [item] = await db
      .select()
      .from(kycChecklist)
      .where(and(eq(kycChecklist.id, id), eq(kycChecklist.userId, userId)));
    return item;
  }

  async createKycChecklistItem(userId: string, item: InsertKycChecklistItem): Promise<KycChecklistItem> {
    const [created] = await db.insert(kycChecklist).values({ ...item, userId }).returning();
    return created;
  }

  async updateKycChecklistItem(id: string, userId: string, item: Partial<InsertKycChecklistItem>): Promise<KycChecklistItem | undefined> {
    const updateData: any = { ...item, updatedAt: new Date() };
    if (item.status === "approved") {
      updateData.completedAt = new Date();
    }
    const [updated] = await db
      .update(kycChecklist)
      .set(updateData)
      .where(and(eq(kycChecklist.id, id), eq(kycChecklist.userId, userId)))
      .returning();
    return updated;
  }

  async deleteKycChecklistItem(id: string, userId: string): Promise<boolean> {
    await db.delete(kycChecklist).where(and(eq(kycChecklist.id, id), eq(kycChecklist.userId, userId)));
    return true;
  }

  // Bond Settlements
  async getBondSettlements(userId: string): Promise<BondSettlement[]> {
    return db.select().from(bondSettlements).where(eq(bondSettlements.userId, userId)).orderBy(desc(bondSettlements.createdAt));
  }

  async getBondSettlement(id: string, userId: string): Promise<BondSettlement | undefined> {
    const [settlement] = await db
      .select()
      .from(bondSettlements)
      .where(and(eq(bondSettlements.id, id), eq(bondSettlements.userId, userId)));
    return settlement;
  }

  async createBondSettlement(userId: string, settlement: InsertBondSettlement): Promise<BondSettlement> {
    const [created] = await db.insert(bondSettlements).values({ ...settlement, userId }).returning();
    return created;
  }

  async updateBondSettlement(id: string, userId: string, settlement: Partial<InsertBondSettlement>): Promise<BondSettlement | undefined> {
    const [updated] = await db
      .update(bondSettlements)
      .set({ ...settlement, updatedAt: new Date() })
      .where(and(eq(bondSettlements.id, id), eq(bondSettlements.userId, userId)))
      .returning();
    return updated;
  }

  async deleteBondSettlement(id: string, userId: string): Promise<boolean> {
    await db.delete(bondSettlements).where(and(eq(bondSettlements.id, id), eq(bondSettlements.userId, userId)));
    return true;
  }

  // Communications
  async getCommunications(userId: string): Promise<Communication[]> {
    return db.select().from(communications).where(eq(communications.userId, userId)).orderBy(desc(communications.contactedAt));
  }

  async getCommunicationsByInvestor(investorId: string, userId: string): Promise<Communication[]> {
    return db
      .select()
      .from(communications)
      .where(and(eq(communications.investorId, investorId), eq(communications.userId, userId)))
      .orderBy(desc(communications.contactedAt));
  }

  async getCommunication(id: string, userId: string): Promise<Communication | undefined> {
    const [comm] = await db
      .select()
      .from(communications)
      .where(and(eq(communications.id, id), eq(communications.userId, userId)));
    return comm;
  }

  async createCommunication(userId: string, comm: InsertCommunication): Promise<Communication> {
    const [created] = await db.insert(communications).values({ ...comm, userId }).returning();
    return created;
  }

  async deleteCommunication(id: string, userId: string): Promise<boolean> {
    await db.delete(communications).where(and(eq(communications.id, id), eq(communications.userId, userId)));
    return true;
  }

  // Notifications
  async getNotifications(userId: string): Promise<Notification[]> {
    return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(50);
  }

  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [created] = await db.insert(notifications).values(notification).returning();
    return created;
  }

  async markNotificationRead(id: string, userId: string): Promise<Notification | undefined> {
    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return updated;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
  }

  async deleteNotification(id: string, userId: string): Promise<boolean> {
    await db.delete(notifications).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return true;
  }

  // Analytics
  async getAnalytics(userId: string): Promise<{
    investorsByStage: { stage: string; count: number }[];
    investorsByType: { type: string; count: number }[];
    totalPipelineValue: number;
    tasksByStatus: { status: string; count: number }[];
    tasksByPriority: { priority: string; count: number }[];
    bondsByStatus: { status: string; count: number; totalValue: number }[];
    recentActivity: AuditLog[];
  }> {
    // Get investors by stage
    const investorsByStage = await db
      .select({
        stage: investors.pipelineStage,
        count: count(),
      })
      .from(investors)
      .where(eq(investors.userId, userId))
      .groupBy(investors.pipelineStage);

    // Get investors by type
    const investorsByType = await db
      .select({
        type: investors.investorType,
        count: count(),
      })
      .from(investors)
      .where(eq(investors.userId, userId))
      .groupBy(investors.investorType);

    // Get total pipeline value
    const [pipelineValue] = await db
      .select({
        total: sum(investors.investmentAmount),
      })
      .from(investors)
      .where(eq(investors.userId, userId));

    // Get tasks by status
    const tasksByStatus = await db
      .select({
        status: tasks.status,
        count: count(),
      })
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .groupBy(tasks.status);

    // Get tasks by priority
    const tasksByPriority = await db
      .select({
        priority: tasks.priority,
        count: count(),
      })
      .from(tasks)
      .where(eq(tasks.userId, userId))
      .groupBy(tasks.priority);

    // Get bonds by status
    const bondsByStatus = await db
      .select({
        status: bondSettlements.status,
        count: count(),
        totalValue: sum(bondSettlements.faceValue),
      })
      .from(bondSettlements)
      .where(eq(bondSettlements.userId, userId))
      .groupBy(bondSettlements.status);

    // Get recent activity
    const recentActivity = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.userId, userId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(10);

    return {
      investorsByStage: investorsByStage.map((r) => ({ stage: r.stage, count: Number(r.count) })),
      investorsByType: investorsByType.map((r) => ({ type: r.type, count: Number(r.count) })),
      totalPipelineValue: Number(pipelineValue?.total || 0),
      tasksByStatus: tasksByStatus.map((r) => ({ status: r.status || "pending", count: Number(r.count) })),
      tasksByPriority: tasksByPriority.map((r) => ({ priority: r.priority || "medium", count: Number(r.count) })),
      bondsByStatus: bondsByStatus.map((r) => ({
        status: r.status,
        count: Number(r.count),
        totalValue: Number(r.totalValue || 0),
      })),
      recentActivity,
    };
  }
}

export const storage = new DatabaseStorage();

// Audit log helper function
export async function logAudit(
  userId: string,
  action: "create" | "update" | "delete",
  entityType: string,
  entityId: string | null,
  description: string,
  metadata?: Record<string, any>,
  ipAddress?: string
): Promise<void> {
  try {
    await storage.createAuditLog({
      userId,
      action,
      entityType,
      entityId,
      description,
      metadata: metadata ? JSON.stringify(metadata) : null,
      ipAddress: ipAddress || null,
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}
