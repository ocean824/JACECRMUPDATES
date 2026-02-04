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
  // Phase 3 tables
  currencies,
  calendarEvents,
  taskRecurrences,
  customFields,
  customFieldValues,
  activityTimeline,
  emailTemplates,
  emailLogs,
  investorPortalUsers,
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
  // Phase 3 types
  type Currency,
  type InsertCurrency,
  type CalendarEvent,
  type InsertCalendarEvent,
  type TaskRecurrence,
  type InsertTaskRecurrence,
  type CustomField,
  type InsertCustomField,
  type CustomFieldValue,
  type InsertCustomFieldValue,
  type ActivityTimelineEntry,
  type InsertActivityTimelineEntry,
  type EmailTemplate,
  type InsertEmailTemplate,
  type EmailLog,
  type InsertEmailLog,
  type InvestorPortalUser,
  type InsertInvestorPortalUser,
  // Compliance types
  complianceDocuments,
  electronicSignatures,
  beneficialOwners,
  investorCompliance,
  complianceAuditEvents,
  type ComplianceDocument,
  type InsertComplianceDocument,
  type ElectronicSignature,
  type InsertElectronicSignature,
  type BeneficialOwner,
  type InsertBeneficialOwner,
  type InvestorCompliance,
  type InsertInvestorCompliance,
  type ComplianceAuditEvent,
  type InsertComplianceAuditEvent,
  // Phase 4 tables - Invoicing, Expenses, HR, BondAI
  invoices,
  invoiceLineItems,
  invoicePayments,
  quotes,
  quoteLineItems,
  expenses,
  departments,
  employees,
  leaveRequests,
  payrollRecords,
  timeEntries,
  bondaiWebhookEvents,
  bondaiInvestorSync,
  escrowAccounts,
  escrowTransactions,
  vendors,
  type Invoice,
  type InsertInvoice,
  type InvoiceLineItem,
  type InsertInvoiceLineItem,
  type InvoicePayment,
  type InsertInvoicePayment,
  type Quote,
  type InsertQuote,
  type QuoteLineItem,
  type InsertQuoteLineItem,
  type Expense,
  type InsertExpense,
  type Department,
  type InsertDepartment,
  type Employee,
  type InsertEmployee,
  type LeaveRequest,
  type InsertLeaveRequest,
  type PayrollRecord,
  type InsertPayrollRecord,
  type TimeEntry,
  type InsertTimeEntry,
  type BondaiWebhookEvent,
  type InsertBondaiWebhookEvent,
  type BondaiInvestorSync,
  type InsertBondaiInvestorSync,
  type EscrowAccount,
  type InsertEscrowAccount,
  type EscrowTransaction,
  type InsertEscrowTransaction,
  type Vendor,
  type InsertVendor,
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

  // ============ PHASE 3 ============

  // Currencies
  getCurrencies(): Promise<Currency[]>;
  getCurrency(id: string): Promise<Currency | undefined>;
  getCurrencyByCode(code: string): Promise<Currency | undefined>;
  createCurrency(currency: InsertCurrency): Promise<Currency>;
  updateCurrency(id: string, currency: Partial<InsertCurrency>): Promise<Currency | undefined>;
  deleteCurrency(id: string): Promise<boolean>;

  // Calendar Events (user-scoped)
  getCalendarEvents(userId: string): Promise<CalendarEvent[]>;
  getCalendarEventsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]>;
  getCalendarEvent(id: string, userId: string): Promise<CalendarEvent | undefined>;
  createCalendarEvent(userId: string, event: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: string, userId: string, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined>;
  deleteCalendarEvent(id: string, userId: string): Promise<boolean>;

  // Task Recurrences (user-scoped)
  getTaskRecurrences(userId: string): Promise<TaskRecurrence[]>;
  getTaskRecurrence(id: string, userId: string): Promise<TaskRecurrence | undefined>;
  createTaskRecurrence(userId: string, recurrence: InsertTaskRecurrence): Promise<TaskRecurrence>;
  updateTaskRecurrence(id: string, userId: string, recurrence: Partial<InsertTaskRecurrence>): Promise<TaskRecurrence | undefined>;
  deleteTaskRecurrence(id: string, userId: string): Promise<boolean>;

  // Custom Fields (user-scoped)
  getCustomFields(userId: string): Promise<CustomField[]>;
  getCustomField(id: string, userId: string): Promise<CustomField | undefined>;
  createCustomField(userId: string, field: InsertCustomField): Promise<CustomField>;
  updateCustomField(id: string, userId: string, field: Partial<InsertCustomField>): Promise<CustomField | undefined>;
  deleteCustomField(id: string, userId: string): Promise<boolean>;

  // Custom Field Values (user-scoped)
  getCustomFieldValues(investorId: string, userId: string): Promise<CustomFieldValue[]>;
  setCustomFieldValue(userId: string, value: InsertCustomFieldValue): Promise<CustomFieldValue>;
  deleteCustomFieldValue(id: string, userId: string): Promise<boolean>;

  // Activity Timeline (user-scoped)
  getActivityTimeline(investorId: string, userId: string): Promise<ActivityTimelineEntry[]>;
  createActivityTimelineEntry(userId: string, entry: InsertActivityTimelineEntry): Promise<ActivityTimelineEntry>;

  // Email Templates (user-scoped)
  getEmailTemplates(userId: string): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string, userId: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(userId: string, template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, userId: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: string, userId: string): Promise<boolean>;

  // Email Logs (user-scoped)
  getEmailLogs(userId: string): Promise<EmailLog[]>;
  getEmailLogsByInvestor(investorId: string, userId: string): Promise<EmailLog[]>;
  createEmailLog(userId: string, log: InsertEmailLog): Promise<EmailLog>;

  // Investor Portal Users
  getAllInvestorPortalUsers(): Promise<InvestorPortalUser[]>;
  getInvestorPortalUser(id: string): Promise<InvestorPortalUser | undefined>;
  getInvestorPortalUserByEmail(email: string): Promise<InvestorPortalUser | undefined>;
  getInvestorPortalUserByInvestor(investorId: string): Promise<InvestorPortalUser | undefined>;
  createInvestorPortalUser(user: InsertInvestorPortalUser): Promise<InvestorPortalUser>;
  updateInvestorPortalUser(id: string, user: Partial<InsertInvestorPortalUser>): Promise<InvestorPortalUser | undefined>;
  deleteInvestorPortalUser(id: string): Promise<boolean>;

  // Global Search
  globalSearch(userId: string, query: string): Promise<{
    investors: Investor[];
    tasks: Task[];
    bonds: BondSettlement[];
    documents: Document[];
  }>;

  // Bulk Operations
  bulkUpdateInvestors(userId: string, ids: string[], updates: Partial<InsertInvestor>): Promise<number>;
  bulkUpdateTasks(userId: string, ids: string[], updates: Partial<InsertTask>): Promise<number>;
  bulkDeleteInvestors(userId: string, ids: string[]): Promise<number>;
  bulkDeleteTasks(userId: string, ids: string[]): Promise<number>;

  // ============ COMPLIANCE ONBOARDING ============

  // Compliance Documents
  getComplianceDocuments(userId: string, investorId: string): Promise<ComplianceDocument[]>;
  getComplianceDocument(id: string, userId: string): Promise<ComplianceDocument | undefined>;
  createComplianceDocument(userId: string, doc: InsertComplianceDocument): Promise<ComplianceDocument>;
  
  // Electronic Signatures
  getElectronicSignatures(complianceDocumentId: string): Promise<ElectronicSignature[]>;
  createElectronicSignature(signature: InsertElectronicSignature): Promise<ElectronicSignature>;

  // Beneficial Owners
  getBeneficialOwners(investorId: string): Promise<BeneficialOwner[]>;
  createBeneficialOwner(owner: InsertBeneficialOwner): Promise<BeneficialOwner>;
  updateBeneficialOwner(id: string, owner: Partial<InsertBeneficialOwner>): Promise<BeneficialOwner | undefined>;
  deleteBeneficialOwner(id: string): Promise<boolean>;

  // Investor Compliance
  getInvestorCompliance(investorId: string): Promise<InvestorCompliance | undefined>;
  createInvestorCompliance(compliance: InsertInvestorCompliance): Promise<InvestorCompliance>;
  updateInvestorCompliance(investorId: string, compliance: Partial<InsertInvestorCompliance>): Promise<InvestorCompliance | undefined>;

  // Compliance Audit Events
  getComplianceAuditEvents(investorId: string): Promise<ComplianceAuditEvent[]>;
  createComplianceAuditEvent(userId: string, event: InsertComplianceAuditEvent): Promise<ComplianceAuditEvent>;
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

  // ============ PHASE 3 IMPLEMENTATIONS ============

  // Currencies
  async getCurrencies(): Promise<Currency[]> {
    return db.select().from(currencies).where(eq(currencies.isActive, true)).orderBy(currencies.code);
  }

  async getCurrency(id: string): Promise<Currency | undefined> {
    const [currency] = await db.select().from(currencies).where(eq(currencies.id, id));
    return currency;
  }

  async getCurrencyByCode(code: string): Promise<Currency | undefined> {
    const [currency] = await db.select().from(currencies).where(eq(currencies.code, code));
    return currency;
  }

  async createCurrency(currency: InsertCurrency): Promise<Currency> {
    const [created] = await db.insert(currencies).values(currency).returning();
    return created;
  }

  async updateCurrency(id: string, currency: Partial<InsertCurrency>): Promise<Currency | undefined> {
    const [updated] = await db
      .update(currencies)
      .set({ ...currency, updatedAt: new Date() })
      .where(eq(currencies.id, id))
      .returning();
    return updated;
  }

  async deleteCurrency(id: string): Promise<boolean> {
    const result = await db.delete(currencies).where(eq(currencies.id, id));
    return true;
  }

  // Calendar Events
  async getCalendarEvents(userId: string): Promise<CalendarEvent[]> {
    return db.select().from(calendarEvents).where(eq(calendarEvents.userId, userId)).orderBy(desc(calendarEvents.startTime));
  }

  async getCalendarEventsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    return db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.userId, userId), gte(calendarEvents.startTime, startDate), lte(calendarEvents.endTime, endDate)))
      .orderBy(calendarEvents.startTime);
  }

  async getCalendarEvent(id: string, userId: string): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)));
    return event;
  }

  async createCalendarEvent(userId: string, event: InsertCalendarEvent): Promise<CalendarEvent> {
    const [created] = await db.insert(calendarEvents).values({ ...event, userId }).returning();
    return created;
  }

  async updateCalendarEvent(id: string, userId: string, event: Partial<InsertCalendarEvent>): Promise<CalendarEvent | undefined> {
    const [updated] = await db
      .update(calendarEvents)
      .set({ ...event, updatedAt: new Date() })
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)))
      .returning();
    return updated;
  }

  async deleteCalendarEvent(id: string, userId: string): Promise<boolean> {
    await db.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, userId)));
    return true;
  }

  // Task Recurrences
  async getTaskRecurrences(userId: string): Promise<TaskRecurrence[]> {
    return db.select().from(taskRecurrences).where(eq(taskRecurrences.userId, userId)).orderBy(desc(taskRecurrences.createdAt));
  }

  async getTaskRecurrence(id: string, userId: string): Promise<TaskRecurrence | undefined> {
    const [recurrence] = await db.select().from(taskRecurrences).where(and(eq(taskRecurrences.id, id), eq(taskRecurrences.userId, userId)));
    return recurrence;
  }

  async createTaskRecurrence(userId: string, recurrence: InsertTaskRecurrence): Promise<TaskRecurrence> {
    const [created] = await db.insert(taskRecurrences).values({ ...recurrence, userId }).returning();
    return created;
  }

  async updateTaskRecurrence(id: string, userId: string, recurrence: Partial<InsertTaskRecurrence>): Promise<TaskRecurrence | undefined> {
    const [updated] = await db
      .update(taskRecurrences)
      .set({ ...recurrence, updatedAt: new Date() })
      .where(and(eq(taskRecurrences.id, id), eq(taskRecurrences.userId, userId)))
      .returning();
    return updated;
  }

  async deleteTaskRecurrence(id: string, userId: string): Promise<boolean> {
    await db.delete(taskRecurrences).where(and(eq(taskRecurrences.id, id), eq(taskRecurrences.userId, userId)));
    return true;
  }

  // Custom Fields
  async getCustomFields(userId: string): Promise<CustomField[]> {
    return db.select().from(customFields).where(eq(customFields.userId, userId)).orderBy(customFields.sortOrder);
  }

  async getCustomField(id: string, userId: string): Promise<CustomField | undefined> {
    const [field] = await db.select().from(customFields).where(and(eq(customFields.id, id), eq(customFields.userId, userId)));
    return field;
  }

  async createCustomField(userId: string, field: InsertCustomField): Promise<CustomField> {
    const [created] = await db.insert(customFields).values({ ...field, userId }).returning();
    return created;
  }

  async updateCustomField(id: string, userId: string, field: Partial<InsertCustomField>): Promise<CustomField | undefined> {
    const [updated] = await db
      .update(customFields)
      .set({ ...field, updatedAt: new Date() })
      .where(and(eq(customFields.id, id), eq(customFields.userId, userId)))
      .returning();
    return updated;
  }

  async deleteCustomField(id: string, userId: string): Promise<boolean> {
    await db.delete(customFields).where(and(eq(customFields.id, id), eq(customFields.userId, userId)));
    return true;
  }

  // Custom Field Values
  async getCustomFieldValues(investorId: string, userId: string): Promise<CustomFieldValue[]> {
    return db.select().from(customFieldValues).where(and(eq(customFieldValues.investorId, investorId), eq(customFieldValues.userId, userId)));
  }

  async setCustomFieldValue(userId: string, value: InsertCustomFieldValue): Promise<CustomFieldValue> {
    const existing = await db
      .select()
      .from(customFieldValues)
      .where(and(eq(customFieldValues.customFieldId, value.customFieldId), eq(customFieldValues.investorId, value.investorId), eq(customFieldValues.userId, userId)));

    if (existing.length > 0) {
      const [updated] = await db
        .update(customFieldValues)
        .set({ value: value.value, updatedAt: new Date() })
        .where(eq(customFieldValues.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(customFieldValues).values({ ...value, userId }).returning();
    return created;
  }

  async deleteCustomFieldValue(id: string, userId: string): Promise<boolean> {
    await db.delete(customFieldValues).where(and(eq(customFieldValues.id, id), eq(customFieldValues.userId, userId)));
    return true;
  }

  // Activity Timeline
  async getActivityTimeline(investorId: string, userId: string): Promise<ActivityTimelineEntry[]> {
    return db
      .select()
      .from(activityTimeline)
      .where(and(eq(activityTimeline.investorId, investorId), eq(activityTimeline.userId, userId)))
      .orderBy(desc(activityTimeline.createdAt))
      .limit(100);
  }

  async createActivityTimelineEntry(userId: string, entry: InsertActivityTimelineEntry): Promise<ActivityTimelineEntry> {
    const [created] = await db.insert(activityTimeline).values({ ...entry, userId }).returning();
    return created;
  }

  // Email Templates
  async getEmailTemplates(userId: string): Promise<EmailTemplate[]> {
    return db.select().from(emailTemplates).where(eq(emailTemplates.userId, userId)).orderBy(emailTemplates.name);
  }

  async getEmailTemplate(id: string, userId: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)));
    return template;
  }

  async createEmailTemplate(userId: string, template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [created] = await db.insert(emailTemplates).values({ ...template, userId }).returning();
    return created;
  }

  async updateEmailTemplate(id: string, userId: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const [updated] = await db
      .update(emailTemplates)
      .set({ ...template, updatedAt: new Date() })
      .where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)))
      .returning();
    return updated;
  }

  async deleteEmailTemplate(id: string, userId: string): Promise<boolean> {
    await db.delete(emailTemplates).where(and(eq(emailTemplates.id, id), eq(emailTemplates.userId, userId)));
    return true;
  }

  // Email Logs
  async getEmailLogs(userId: string): Promise<EmailLog[]> {
    return db.select().from(emailLogs).where(eq(emailLogs.userId, userId)).orderBy(desc(emailLogs.sentAt));
  }

  async getEmailLogsByInvestor(investorId: string, userId: string): Promise<EmailLog[]> {
    return db
      .select()
      .from(emailLogs)
      .where(and(eq(emailLogs.investorId, investorId), eq(emailLogs.userId, userId)))
      .orderBy(desc(emailLogs.sentAt));
  }

  async createEmailLog(userId: string, log: InsertEmailLog): Promise<EmailLog> {
    const [created] = await db.insert(emailLogs).values({ ...log, userId }).returning();
    return created;
  }

  // Investor Portal Users
  async getAllInvestorPortalUsers(): Promise<InvestorPortalUser[]> {
    return db.select().from(investorPortalUsers).orderBy(desc(investorPortalUsers.createdAt));
  }

  async getInvestorPortalUser(id: string): Promise<InvestorPortalUser | undefined> {
    const [user] = await db.select().from(investorPortalUsers).where(eq(investorPortalUsers.id, id));
    return user;
  }

  async getInvestorPortalUserByEmail(email: string): Promise<InvestorPortalUser | undefined> {
    const [user] = await db.select().from(investorPortalUsers).where(eq(investorPortalUsers.email, email));
    return user;
  }

  async getInvestorPortalUserByInvestor(investorId: string): Promise<InvestorPortalUser | undefined> {
    const [user] = await db.select().from(investorPortalUsers).where(eq(investorPortalUsers.investorId, investorId));
    return user;
  }

  async createInvestorPortalUser(user: InsertInvestorPortalUser): Promise<InvestorPortalUser> {
    const [created] = await db.insert(investorPortalUsers).values(user).returning();
    return created;
  }

  async updateInvestorPortalUser(id: string, user: Partial<InsertInvestorPortalUser>): Promise<InvestorPortalUser | undefined> {
    const [updated] = await db
      .update(investorPortalUsers)
      .set({ ...user, updatedAt: new Date() })
      .where(eq(investorPortalUsers.id, id))
      .returning();
    return updated;
  }

  async deleteInvestorPortalUser(id: string): Promise<boolean> {
    await db.delete(investorPortalUsers).where(eq(investorPortalUsers.id, id));
    return true;
  }

  // Global Search
  async globalSearch(userId: string, query: string): Promise<{
    investors: Investor[];
    tasks: Task[];
    bonds: BondSettlement[];
    documents: Document[];
  }> {
    const searchPattern = `%${query.toLowerCase()}%`;

    const investorResults = await db
      .select()
      .from(investors)
      .where(
        and(
          eq(investors.userId, userId),
          sql`(LOWER(${investors.firstName}) LIKE ${searchPattern} OR LOWER(${investors.lastName}) LIKE ${searchPattern} OR LOWER(${investors.email}) LIKE ${searchPattern} OR LOWER(${investors.company}) LIKE ${searchPattern})`
        )
      )
      .limit(20);

    const taskResults = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, userId), sql`LOWER(${tasks.title}) LIKE ${searchPattern}`))
      .limit(20);

    const bondResults = await db
      .select()
      .from(bondSettlements)
      .where(
        and(
          eq(bondSettlements.userId, userId),
          sql`(LOWER(${bondSettlements.bondName}) LIKE ${searchPattern} OR LOWER(${bondSettlements.isin}) LIKE ${searchPattern})`
        )
      )
      .limit(20);

    const documentResults = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          sql`(LOWER(${documents.originalName}) LIKE ${searchPattern} OR LOWER(${documents.description}) LIKE ${searchPattern})`
        )
      )
      .limit(20);

    return {
      investors: investorResults,
      tasks: taskResults,
      bonds: bondResults,
      documents: documentResults,
    };
  }

  // Bulk Operations
  async bulkUpdateInvestors(userId: string, ids: string[], updates: Partial<InsertInvestor>): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await db
      .update(investors)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(investors.userId, userId), sql`${investors.id} = ANY(${ids})`));
    return ids.length;
  }

  async bulkUpdateTasks(userId: string, ids: string[], updates: Partial<InsertTask>): Promise<number> {
    if (ids.length === 0) return 0;
    await db
      .update(tasks)
      .set(updates)
      .where(and(eq(tasks.userId, userId), sql`${tasks.id} = ANY(${ids})`));
    return ids.length;
  }

  async bulkDeleteInvestors(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    await db.delete(investors).where(and(eq(investors.userId, userId), sql`${investors.id} = ANY(${ids})`));
    return ids.length;
  }

  async bulkDeleteTasks(userId: string, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    await db.delete(tasks).where(and(eq(tasks.userId, userId), sql`${tasks.id} = ANY(${ids})`));
    return ids.length;
  }

  // ============ COMPLIANCE ONBOARDING ============

  // Compliance Documents
  async getComplianceDocuments(userId: string, investorId: string): Promise<ComplianceDocument[]> {
    return db
      .select()
      .from(complianceDocuments)
      .where(and(eq(complianceDocuments.userId, userId), eq(complianceDocuments.investorId, investorId)))
      .orderBy(desc(complianceDocuments.createdAt));
  }

  async getComplianceDocument(id: string, userId: string): Promise<ComplianceDocument | undefined> {
    const [doc] = await db
      .select()
      .from(complianceDocuments)
      .where(and(eq(complianceDocuments.id, id), eq(complianceDocuments.userId, userId)));
    return doc;
  }

  async createComplianceDocument(userId: string, doc: InsertComplianceDocument): Promise<ComplianceDocument> {
    const [newDoc] = await db
      .insert(complianceDocuments)
      .values({ ...doc, userId })
      .returning();
    return newDoc;
  }

  // Electronic Signatures
  async getElectronicSignatures(complianceDocumentId: string): Promise<ElectronicSignature[]> {
    return db
      .select()
      .from(electronicSignatures)
      .where(eq(electronicSignatures.complianceDocumentId, complianceDocumentId))
      .orderBy(desc(electronicSignatures.signedAt));
  }

  async createElectronicSignature(signature: InsertElectronicSignature): Promise<ElectronicSignature> {
    const [newSig] = await db
      .insert(electronicSignatures)
      .values(signature)
      .returning();
    return newSig;
  }

  // Beneficial Owners
  async getBeneficialOwners(investorId: string): Promise<BeneficialOwner[]> {
    return db
      .select()
      .from(beneficialOwners)
      .where(eq(beneficialOwners.investorId, investorId))
      .orderBy(beneficialOwners.fullName);
  }

  async createBeneficialOwner(owner: InsertBeneficialOwner): Promise<BeneficialOwner> {
    const [newOwner] = await db
      .insert(beneficialOwners)
      .values(owner)
      .returning();
    return newOwner;
  }

  async updateBeneficialOwner(id: string, owner: Partial<InsertBeneficialOwner>): Promise<BeneficialOwner | undefined> {
    const [updated] = await db
      .update(beneficialOwners)
      .set({ ...owner, updatedAt: new Date() })
      .where(eq(beneficialOwners.id, id))
      .returning();
    return updated;
  }

  async deleteBeneficialOwner(id: string): Promise<boolean> {
    const result = await db.delete(beneficialOwners).where(eq(beneficialOwners.id, id));
    return true;
  }

  // Investor Compliance
  async getInvestorCompliance(investorId: string): Promise<InvestorCompliance | undefined> {
    const [compliance] = await db
      .select()
      .from(investorCompliance)
      .where(eq(investorCompliance.investorId, investorId));
    return compliance;
  }

  async createInvestorCompliance(compliance: InsertInvestorCompliance): Promise<InvestorCompliance> {
    const [newCompliance] = await db
      .insert(investorCompliance)
      .values(compliance)
      .returning();
    return newCompliance;
  }

  async updateInvestorCompliance(investorId: string, compliance: Partial<InsertInvestorCompliance>): Promise<InvestorCompliance | undefined> {
    const [updated] = await db
      .update(investorCompliance)
      .set({ ...compliance, updatedAt: new Date() })
      .where(eq(investorCompliance.investorId, investorId))
      .returning();
    return updated;
  }

  // Compliance Audit Events
  async getComplianceAuditEvents(investorId: string): Promise<ComplianceAuditEvent[]> {
    return db
      .select()
      .from(complianceAuditEvents)
      .where(eq(complianceAuditEvents.investorId, investorId))
      .orderBy(desc(complianceAuditEvents.createdAt));
  }

  async createComplianceAuditEvent(userId: string, event: InsertComplianceAuditEvent): Promise<ComplianceAuditEvent> {
    const [newEvent] = await db
      .insert(complianceAuditEvents)
      .values({ ...event, userId })
      .returning();
    return newEvent;
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


// ============ PHASE 4: INVOICING, EXPENSES, HR, AND BONDAI INTEGRATION ============

// Extended Storage Interface
export interface IStorageExtended extends IStorage {
  // Invoices
  getInvoices(userId: string): Promise<Invoice[]>;
  getInvoice(id: string, userId: string): Promise<Invoice | undefined>;
  getInvoicesByInvestor(investorId: string, userId: string): Promise<Invoice[]>;
  createInvoice(userId: string, invoice: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, userId: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  deleteInvoice(id: string, userId: string): Promise<boolean>;
  getNextInvoiceNumber(userId: string): Promise<string>;

  // Invoice Line Items
  getInvoiceLineItems(invoiceId: string): Promise<InvoiceLineItem[]>;
  createInvoiceLineItem(item: InsertInvoiceLineItem): Promise<InvoiceLineItem>;
  updateInvoiceLineItem(id: string, item: Partial<InsertInvoiceLineItem>): Promise<InvoiceLineItem | undefined>;
  deleteInvoiceLineItem(id: string): Promise<boolean>;

  // Invoice Payments
  getInvoicePayments(invoiceId: string): Promise<InvoicePayment[]>;
  createInvoicePayment(payment: InsertInvoicePayment): Promise<InvoicePayment>;

  // Quotes
  getQuotes(userId: string): Promise<Quote[]>;
  getQuote(id: string, userId: string): Promise<Quote | undefined>;
  createQuote(userId: string, quote: InsertQuote): Promise<Quote>;
  updateQuote(id: string, userId: string, quote: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string, userId: string): Promise<boolean>;
  getNextQuoteNumber(userId: string): Promise<string>;
  convertQuoteToInvoice(quoteId: string, userId: string): Promise<Invoice | undefined>;

  // Quote Line Items
  getQuoteLineItems(quoteId: string): Promise<QuoteLineItem[]>;
  createQuoteLineItem(item: InsertQuoteLineItem): Promise<QuoteLineItem>;

  // Expenses
  getExpenses(userId: string): Promise<Expense[]>;
  getExpense(id: string, userId: string): Promise<Expense | undefined>;
  getExpensesByInvestor(investorId: string, userId: string): Promise<Expense[]>;
  createExpense(userId: string, expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, userId: string, expense: Partial<InsertExpense>): Promise<Expense | undefined>;
  deleteExpense(id: string, userId: string): Promise<boolean>;
  approveExpense(id: string, userId: string, approvedBy: string): Promise<Expense | undefined>;

  // Departments
  getDepartments(userId: string): Promise<Department[]>;
  getDepartment(id: string, userId: string): Promise<Department | undefined>;
  createDepartment(userId: string, dept: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, userId: string, dept: Partial<InsertDepartment>): Promise<Department | undefined>;
  deleteDepartment(id: string, userId: string): Promise<boolean>;

  // Employees
  getEmployees(userId: string): Promise<Employee[]>;
  getEmployee(id: string, userId: string): Promise<Employee | undefined>;
  getEmployeesByDepartment(departmentId: string, userId: string): Promise<Employee[]>;
  createEmployee(userId: string, employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: string, userId: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined>;
  deleteEmployee(id: string, userId: string): Promise<boolean>;
  getNextEmployeeNumber(userId: string): Promise<string>;

  // Leave Requests
  getLeaveRequests(userId: string): Promise<LeaveRequest[]>;
  getLeaveRequestsByEmployee(employeeId: string, userId: string): Promise<LeaveRequest[]>;
  createLeaveRequest(userId: string, request: InsertLeaveRequest): Promise<LeaveRequest>;
  updateLeaveRequest(id: string, userId: string, request: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined>;
  approveLeaveRequest(id: string, userId: string, approvedBy: string): Promise<LeaveRequest | undefined>;

  // Payroll Records
  getPayrollRecords(userId: string): Promise<PayrollRecord[]>;
  getPayrollRecordsByEmployee(employeeId: string, userId: string): Promise<PayrollRecord[]>;
  createPayrollRecord(userId: string, record: InsertPayrollRecord): Promise<PayrollRecord>;
  updatePayrollRecord(id: string, userId: string, record: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined>;

  // Time Entries
  getTimeEntries(userId: string): Promise<TimeEntry[]>;
  getTimeEntriesByEmployee(employeeId: string, userId: string): Promise<TimeEntry[]>;
  createTimeEntry(userId: string, entry: InsertTimeEntry): Promise<TimeEntry>;
  updateTimeEntry(id: string, userId: string, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined>;
  deleteTimeEntry(id: string, userId: string): Promise<boolean>;

  // BondAI Webhook Events
  getBondaiWebhookEvents(limit?: number): Promise<BondaiWebhookEvent[]>;
  getBondaiWebhookEvent(eventId: string): Promise<BondaiWebhookEvent | undefined>;
  createBondaiWebhookEvent(event: InsertBondaiWebhookEvent): Promise<BondaiWebhookEvent>;
  updateBondaiWebhookEventStatus(eventId: string, status: string, errorMessage?: string): Promise<BondaiWebhookEvent | undefined>;

  // BondAI Investor Sync
  getBondaiInvestorSync(investorId: string, userId: string): Promise<BondaiInvestorSync | undefined>;
  createBondaiInvestorSync(userId: string, sync: InsertBondaiInvestorSync): Promise<BondaiInvestorSync>;
  updateBondaiInvestorSync(investorId: string, userId: string, sync: Partial<InsertBondaiInvestorSync>): Promise<BondaiInvestorSync | undefined>;

  // Escrow Accounts
  getEscrowAccounts(userId: string): Promise<EscrowAccount[]>;
  getEscrowAccount(id: string, userId: string): Promise<EscrowAccount | undefined>;
  createEscrowAccount(userId: string, account: InsertEscrowAccount): Promise<EscrowAccount>;
  updateEscrowAccount(id: string, userId: string, account: Partial<InsertEscrowAccount>): Promise<EscrowAccount | undefined>;

  // Escrow Transactions
  getEscrowTransactions(escrowAccountId: string, userId: string): Promise<EscrowTransaction[]>;
  createEscrowTransaction(userId: string, transaction: InsertEscrowTransaction): Promise<EscrowTransaction>;

  // Vendors
  getVendors(userId: string): Promise<Vendor[]>;
  getVendor(id: string, userId: string): Promise<Vendor | undefined>;
  createVendor(userId: string, vendor: InsertVendor): Promise<Vendor>;
  updateVendor(id: string, userId: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined>;
  deleteVendor(id: string, userId: string): Promise<boolean>;
  getNextVendorAccountNumber(userId: string): Promise<string>;

  // Financial Reports
  getTrialBalance(userId: string): Promise<{ accountId: string; accountName: string; accountType: string; debitTotal: string; creditTotal: string; balance: string }[]>;
  getIncomeStatement(userId: string, startDate: Date, endDate: Date): Promise<{ revenues: any[]; expenses: any[]; totalRevenue: string; totalExpenses: string; netIncome: string }>;
  getBalanceSheet(userId: string): Promise<{ assets: any[]; liabilities: any[]; equity: any[]; totalAssets: string; totalLiabilities: string; totalEquity: string }>;
}

// Extended DatabaseStorage class methods
DatabaseStorage.prototype.getInvoices = async function(userId: string): Promise<Invoice[]> {
  return db.select().from(invoices).where(eq(invoices.userId, userId)).orderBy(desc(invoices.createdAt));
};

DatabaseStorage.prototype.getInvoice = async function(id: string, userId: string): Promise<Invoice | undefined> {
  const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  return invoice;
};

DatabaseStorage.prototype.getInvoicesByInvestor = async function(investorId: string, userId: string): Promise<Invoice[]> {
  return db.select().from(invoices).where(and(eq(invoices.investorId, investorId), eq(invoices.userId, userId))).orderBy(desc(invoices.createdAt));
};

DatabaseStorage.prototype.createInvoice = async function(userId: string, invoice: InsertInvoice): Promise<Invoice> {
  const [created] = await db.insert(invoices).values({ ...invoice, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateInvoice = async function(id: string, userId: string, invoice: Partial<InsertInvoice>): Promise<Invoice | undefined> {
  const [updated] = await db.update(invoices).set({ ...invoice, updatedAt: new Date() }).where(and(eq(invoices.id, id), eq(invoices.userId, userId))).returning();
  return updated;
};

DatabaseStorage.prototype.deleteInvoice = async function(id: string, userId: string): Promise<boolean> {
  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.userId, userId)));
  return true;
};

DatabaseStorage.prototype.getNextInvoiceNumber = async function(userId: string): Promise<string> {
  const result = await db.select({ count: count() }).from(invoices).where(eq(invoices.userId, userId));
  const num = (result[0]?.count || 0) + 1;
  return `INV-${String(num).padStart(5, '0')}`;
};

DatabaseStorage.prototype.getInvoiceLineItems = async function(invoiceId: string): Promise<InvoiceLineItem[]> {
  return db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId)).orderBy(invoiceLineItems.sortOrder);
};

DatabaseStorage.prototype.createInvoiceLineItem = async function(item: InsertInvoiceLineItem): Promise<InvoiceLineItem> {
  const [created] = await db.insert(invoiceLineItems).values(item).returning();
  return created;
};

DatabaseStorage.prototype.updateInvoiceLineItem = async function(id: string, item: Partial<InsertInvoiceLineItem>): Promise<InvoiceLineItem | undefined> {
  const [updated] = await db.update(invoiceLineItems).set(item).where(eq(invoiceLineItems.id, id)).returning();
  return updated;
};

DatabaseStorage.prototype.deleteInvoiceLineItem = async function(id: string): Promise<boolean> {
  await db.delete(invoiceLineItems).where(eq(invoiceLineItems.id, id));
  return true;
};

DatabaseStorage.prototype.getInvoicePayments = async function(invoiceId: string): Promise<InvoicePayment[]> {
  return db.select().from(invoicePayments).where(eq(invoicePayments.invoiceId, invoiceId)).orderBy(desc(invoicePayments.paidAt));
};

DatabaseStorage.prototype.createInvoicePayment = async function(payment: InsertInvoicePayment): Promise<InvoicePayment> {
  const [created] = await db.insert(invoicePayments).values(payment).returning();
  return created;
};

// Quotes
DatabaseStorage.prototype.getQuotes = async function(userId: string): Promise<Quote[]> {
  return db.select().from(quotes).where(eq(quotes.userId, userId)).orderBy(desc(quotes.createdAt));
};

DatabaseStorage.prototype.getQuote = async function(id: string, userId: string): Promise<Quote | undefined> {
  const [quote] = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
  return quote;
};

DatabaseStorage.prototype.createQuote = async function(userId: string, quote: InsertQuote): Promise<Quote> {
  const [created] = await db.insert(quotes).values({ ...quote, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateQuote = async function(id: string, userId: string, quote: Partial<InsertQuote>): Promise<Quote | undefined> {
  const [updated] = await db.update(quotes).set({ ...quote, updatedAt: new Date() }).where(and(eq(quotes.id, id), eq(quotes.userId, userId))).returning();
  return updated;
};

DatabaseStorage.prototype.deleteQuote = async function(id: string, userId: string): Promise<boolean> {
  await db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.userId, userId)));
  return true;
};

DatabaseStorage.prototype.getNextQuoteNumber = async function(userId: string): Promise<string> {
  const result = await db.select({ count: count() }).from(quotes).where(eq(quotes.userId, userId));
  const num = (result[0]?.count || 0) + 1;
  return `QT-${String(num).padStart(5, '0')}`;
};

DatabaseStorage.prototype.getQuoteLineItems = async function(quoteId: string): Promise<QuoteLineItem[]> {
  return db.select().from(quoteLineItems).where(eq(quoteLineItems.quoteId, quoteId)).orderBy(quoteLineItems.sortOrder);
};

DatabaseStorage.prototype.createQuoteLineItem = async function(item: InsertQuoteLineItem): Promise<QuoteLineItem> {
  const [created] = await db.insert(quoteLineItems).values(item).returning();
  return created;
};

// Expenses
DatabaseStorage.prototype.getExpenses = async function(userId: string): Promise<Expense[]> {
  return db.select().from(expenses).where(eq(expenses.userId, userId)).orderBy(desc(expenses.expenseDate));
};

DatabaseStorage.prototype.getExpense = async function(id: string, userId: string): Promise<Expense | undefined> {
  const [expense] = await db.select().from(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  return expense;
};

DatabaseStorage.prototype.getExpensesByInvestor = async function(investorId: string, userId: string): Promise<Expense[]> {
  return db.select().from(expenses).where(and(eq(expenses.investorId, investorId), eq(expenses.userId, userId))).orderBy(desc(expenses.expenseDate));
};

DatabaseStorage.prototype.createExpense = async function(userId: string, expense: InsertExpense): Promise<Expense> {
  const [created] = await db.insert(expenses).values({ ...expense, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateExpense = async function(id: string, userId: string, expense: Partial<InsertExpense>): Promise<Expense | undefined> {
  const [updated] = await db.update(expenses).set({ ...expense, updatedAt: new Date() }).where(and(eq(expenses.id, id), eq(expenses.userId, userId))).returning();
  return updated;
};

DatabaseStorage.prototype.deleteExpense = async function(id: string, userId: string): Promise<boolean> {
  await db.delete(expenses).where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
  return true;
};

DatabaseStorage.prototype.approveExpense = async function(id: string, userId: string, approvedBy: string): Promise<Expense | undefined> {
  const [updated] = await db.update(expenses).set({ status: 'approved' as any, approvedBy, approvedAt: new Date(), updatedAt: new Date() }).where(and(eq(expenses.id, id), eq(expenses.userId, userId))).returning();
  return updated;
};

// Departments
DatabaseStorage.prototype.getDepartments = async function(userId: string): Promise<Department[]> {
  return db.select().from(departments).where(eq(departments.userId, userId)).orderBy(departments.name);
};

DatabaseStorage.prototype.getDepartment = async function(id: string, userId: string): Promise<Department | undefined> {
  const [dept] = await db.select().from(departments).where(and(eq(departments.id, id), eq(departments.userId, userId)));
  return dept;
};

DatabaseStorage.prototype.createDepartment = async function(userId: string, dept: InsertDepartment): Promise<Department> {
  const [created] = await db.insert(departments).values({ ...dept, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateDepartment = async function(id: string, userId: string, dept: Partial<InsertDepartment>): Promise<Department | undefined> {
  const [updated] = await db.update(departments).set({ ...dept, updatedAt: new Date() }).where(and(eq(departments.id, id), eq(departments.userId, userId))).returning();
  return updated;
};

DatabaseStorage.prototype.deleteDepartment = async function(id: string, userId: string): Promise<boolean> {
  await db.delete(departments).where(and(eq(departments.id, id), eq(departments.userId, userId)));
  return true;
};

// Employees
DatabaseStorage.prototype.getEmployees = async function(userId: string): Promise<Employee[]> {
  return db.select().from(employees).where(eq(employees.userId, userId)).orderBy(employees.lastName, employees.firstName);
};

DatabaseStorage.prototype.getEmployee = async function(id: string, userId: string): Promise<Employee | undefined> {
  const [emp] = await db.select().from(employees).where(and(eq(employees.id, id), eq(employees.userId, userId)));
  return emp;
};

DatabaseStorage.prototype.getEmployeesByDepartment = async function(departmentId: string, userId: string): Promise<Employee[]> {
  return db.select().from(employees).where(and(eq(employees.departmentId, departmentId), eq(employees.userId, userId))).orderBy(employees.lastName);
};

DatabaseStorage.prototype.createEmployee = async function(userId: string, employee: InsertEmployee): Promise<Employee> {
  const [created] = await db.insert(employees).values({ ...employee, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateEmployee = async function(id: string, userId: string, employee: Partial<InsertEmployee>): Promise<Employee | undefined> {
  const [updated] = await db.update(employees).set({ ...employee, updatedAt: new Date() }).where(and(eq(employees.id, id), eq(employees.userId, userId))).returning();
  return updated;
};

DatabaseStorage.prototype.deleteEmployee = async function(id: string, userId: string): Promise<boolean> {
  await db.delete(employees).where(and(eq(employees.id, id), eq(employees.userId, userId)));
  return true;
};

DatabaseStorage.prototype.getNextEmployeeNumber = async function(userId: string): Promise<string> {
  const result = await db.select({ count: count() }).from(employees).where(eq(employees.userId, userId));
  const num = (result[0]?.count || 0) + 1;
  return `EMP-${String(num).padStart(4, '0')}`;
};

// Leave Requests
DatabaseStorage.prototype.getLeaveRequests = async function(userId: string): Promise<LeaveRequest[]> {
  return db.select().from(leaveRequests).where(eq(leaveRequests.userId, userId)).orderBy(desc(leaveRequests.createdAt));
};

DatabaseStorage.prototype.getLeaveRequestsByEmployee = async function(employeeId: string, userId: string): Promise<LeaveRequest[]> {
  return db.select().from(leaveRequests).where(and(eq(leaveRequests.employeeId, employeeId), eq(leaveRequests.userId, userId))).orderBy(desc(leaveRequests.startDate));
};

DatabaseStorage.prototype.createLeaveRequest = async function(userId: string, request: InsertLeaveRequest): Promise<LeaveRequest> {
  const [created] = await db.insert(leaveRequests).values({ ...request, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateLeaveRequest = async function(id: string, userId: string, request: Partial<InsertLeaveRequest>): Promise<LeaveRequest | undefined> {
  const [updated] = await db.update(leaveRequests).set({ ...request, updatedAt: new Date() }).where(and(eq(leaveRequests.id, id), eq(leaveRequests.userId, userId))).returning();
  return updated;
};

DatabaseStorage.prototype.approveLeaveRequest = async function(id: string, userId: string, approvedBy: string): Promise<LeaveRequest | undefined> {
  const [updated] = await db.update(leaveRequests).set({ status: 'approved' as any, approvedBy, approvedAt: new Date(), updatedAt: new Date() }).where(and(eq(leaveRequests.id, id), eq(leaveRequests.userId, userId))).returning();
  return updated;
};

// Payroll Records
DatabaseStorage.prototype.getPayrollRecords = async function(userId: string): Promise<PayrollRecord[]> {
  return db.select().from(payrollRecords).where(eq(payrollRecords.userId, userId)).orderBy(desc(payrollRecords.payPeriodEnd));
};

DatabaseStorage.prototype.getPayrollRecordsByEmployee = async function(employeeId: string, userId: string): Promise<PayrollRecord[]> {
  return db.select().from(payrollRecords).where(and(eq(payrollRecords.employeeId, employeeId), eq(payrollRecords.userId, userId))).orderBy(desc(payrollRecords.payPeriodEnd));
};

DatabaseStorage.prototype.createPayrollRecord = async function(userId: string, record: InsertPayrollRecord): Promise<PayrollRecord> {
  const [created] = await db.insert(payrollRecords).values({ ...record, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updatePayrollRecord = async function(id: string, userId: string, record: Partial<InsertPayrollRecord>): Promise<PayrollRecord | undefined> {
  const [updated] = await db.update(payrollRecords).set({ ...record, updatedAt: new Date() }).where(and(eq(payrollRecords.id, id), eq(payrollRecords.userId, userId))).returning();
  return updated;
};

// Time Entries
DatabaseStorage.prototype.getTimeEntries = async function(userId: string): Promise<TimeEntry[]> {
  return db.select().from(timeEntries).where(eq(timeEntries.userId, userId)).orderBy(desc(timeEntries.date));
};

DatabaseStorage.prototype.getTimeEntriesByEmployee = async function(employeeId: string, userId: string): Promise<TimeEntry[]> {
  return db.select().from(timeEntries).where(and(eq(timeEntries.employeeId, employeeId), eq(timeEntries.userId, userId))).orderBy(desc(timeEntries.date));
};

DatabaseStorage.prototype.createTimeEntry = async function(userId: string, entry: InsertTimeEntry): Promise<TimeEntry> {
  const [created] = await db.insert(timeEntries).values({ ...entry, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateTimeEntry = async function(id: string, userId: string, entry: Partial<InsertTimeEntry>): Promise<TimeEntry | undefined> {
  const [updated] = await db.update(timeEntries).set({ ...entry, updatedAt: new Date() }).where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId))).returning();
  return updated;
};

DatabaseStorage.prototype.deleteTimeEntry = async function(id: string, userId: string): Promise<boolean> {
  await db.delete(timeEntries).where(and(eq(timeEntries.id, id), eq(timeEntries.userId, userId)));
  return true;
};

// BondAI Webhook Events
DatabaseStorage.prototype.getBondaiWebhookEvents = async function(limit: number = 100): Promise<BondaiWebhookEvent[]> {
  return db.select().from(bondaiWebhookEvents).orderBy(desc(bondaiWebhookEvents.createdAt)).limit(limit);
};

DatabaseStorage.prototype.getBondaiWebhookEvent = async function(eventId: string): Promise<BondaiWebhookEvent | undefined> {
  const [event] = await db.select().from(bondaiWebhookEvents).where(eq(bondaiWebhookEvents.eventId, eventId));
  return event;
};

DatabaseStorage.prototype.createBondaiWebhookEvent = async function(event: InsertBondaiWebhookEvent): Promise<BondaiWebhookEvent> {
  const [created] = await db.insert(bondaiWebhookEvents).values(event).returning();
  return created;
};

DatabaseStorage.prototype.updateBondaiWebhookEventStatus = async function(eventId: string, status: string, errorMessage?: string): Promise<BondaiWebhookEvent | undefined> {
  const [updated] = await db.update(bondaiWebhookEvents).set({ status: status as any, processedAt: new Date(), errorMessage }).where(eq(bondaiWebhookEvents.eventId, eventId)).returning();
  return updated;
};

// BondAI Investor Sync
DatabaseStorage.prototype.getBondaiInvestorSync = async function(investorId: string, userId: string): Promise<BondaiInvestorSync | undefined> {
  const [sync] = await db.select().from(bondaiInvestorSync).where(and(eq(bondaiInvestorSync.investorId, investorId), eq(bondaiInvestorSync.userId, userId)));
  return sync;
};

DatabaseStorage.prototype.createBondaiInvestorSync = async function(userId: string, sync: InsertBondaiInvestorSync): Promise<BondaiInvestorSync> {
  const [created] = await db.insert(bondaiInvestorSync).values({ ...sync, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateBondaiInvestorSync = async function(investorId: string, userId: string, sync: Partial<InsertBondaiInvestorSync>): Promise<BondaiInvestorSync | undefined> {
  const [updated] = await db.update(bondaiInvestorSync).set({ ...sync, updatedAt: new Date() }).where(and(eq(bondaiInvestorSync.investorId, investorId), eq(bondaiInvestorSync.userId, userId))).returning();
  return updated;
};

// Escrow Accounts
DatabaseStorage.prototype.getEscrowAccounts = async function(userId: string): Promise<EscrowAccount[]> {
  return db.select().from(escrowAccounts).where(eq(escrowAccounts.userId, userId)).orderBy(escrowAccounts.accountName);
};

DatabaseStorage.prototype.getEscrowAccount = async function(id: string, userId: string): Promise<EscrowAccount | undefined> {
  const [account] = await db.select().from(escrowAccounts).where(and(eq(escrowAccounts.id, id), eq(escrowAccounts.userId, userId)));
  return account;
};

DatabaseStorage.prototype.createEscrowAccount = async function(userId: string, account: InsertEscrowAccount): Promise<EscrowAccount> {
  const [created] = await db.insert(escrowAccounts).values({ ...account, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateEscrowAccount = async function(id: string, userId: string, account: Partial<InsertEscrowAccount>): Promise<EscrowAccount | undefined> {
  const [updated] = await db.update(escrowAccounts).set({ ...account, updatedAt: new Date() }).where(and(eq(escrowAccounts.id, id), eq(escrowAccounts.userId, userId))).returning();
  return updated;
};

// Escrow Transactions
DatabaseStorage.prototype.getEscrowTransactions = async function(escrowAccountId: string, userId: string): Promise<EscrowTransaction[]> {
  return db.select().from(escrowTransactions).where(and(eq(escrowTransactions.escrowAccountId, escrowAccountId), eq(escrowTransactions.userId, userId))).orderBy(desc(escrowTransactions.createdAt));
};

DatabaseStorage.prototype.createEscrowTransaction = async function(userId: string, transaction: InsertEscrowTransaction): Promise<EscrowTransaction> {
  const [created] = await db.insert(escrowTransactions).values({ ...transaction, userId }).returning();
  return created;
};

// Vendors
DatabaseStorage.prototype.getVendors = async function(userId: string): Promise<Vendor[]> {
  return db.select().from(vendors).where(eq(vendors.userId, userId)).orderBy(vendors.name);
};

DatabaseStorage.prototype.getVendor = async function(id: string, userId: string): Promise<Vendor | undefined> {
  const [vendor] = await db.select().from(vendors).where(and(eq(vendors.id, id), eq(vendors.userId, userId)));
  return vendor;
};

DatabaseStorage.prototype.createVendor = async function(userId: string, vendor: InsertVendor): Promise<Vendor> {
  const [created] = await db.insert(vendors).values({ ...vendor, userId }).returning();
  return created;
};

DatabaseStorage.prototype.updateVendor = async function(id: string, userId: string, vendor: Partial<InsertVendor>): Promise<Vendor | undefined> {
  const [updated] = await db.update(vendors).set({ ...vendor, updatedAt: new Date() }).where(and(eq(vendors.id, id), eq(vendors.userId, userId))).returning();
  return updated;
};

DatabaseStorage.prototype.deleteVendor = async function(id: string, userId: string): Promise<boolean> {
  const result = await db.delete(vendors).where(and(eq(vendors.id, id), eq(vendors.userId, userId)));
  return (result.rowCount || 0) > 0;
};

DatabaseStorage.prototype.getNextVendorAccountNumber = async function(userId: string): Promise<string> {
  const vendorsList = await db.select().from(vendors).where(eq(vendors.userId, userId));
  const nextNumber = vendorsList.length + 1;
  return `VND-${String(nextNumber).padStart(5, '0')}`;
};

// Financial Reports
DatabaseStorage.prototype.getTrialBalance = async function(userId: string): Promise<any[]> {
  const accountsList = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const journalLines = await db.select().from(journalEntryLines);
  
  const balances = accountsList.map(account => {
    const lines = journalLines.filter(line => line.accountId === account.id);
    const debitTotal = lines.reduce((sum, line) => sum + parseFloat(line.debit || '0'), 0);
    const creditTotal = lines.reduce((sum, line) => sum + parseFloat(line.credit || '0'), 0);
    const balance = debitTotal - creditTotal;
    
    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.accountType,
      debitTotal: debitTotal.toFixed(2),
      creditTotal: creditTotal.toFixed(2),
      balance: balance.toFixed(2),
    };
  });
  
  return balances;
};

DatabaseStorage.prototype.getIncomeStatement = async function(userId: string, startDate: Date, endDate: Date): Promise<any> {
  const accountsList = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const journalEntriesList = await db.select().from(journalEntries).where(and(eq(journalEntries.userId, userId), gte(journalEntries.date, startDate), lte(journalEntries.date, endDate)));
  const journalEntryIds = journalEntriesList.map(e => e.id);
  
  const allLines = await db.select().from(journalEntryLines);
  const relevantLines = allLines.filter(line => journalEntryIds.includes(line.journalEntryId));
  
  const revenueAccounts = accountsList.filter(a => a.accountType === 'revenue');
  const expenseAccounts = accountsList.filter(a => a.accountType === 'expense');
  
  const revenues = revenueAccounts.map(account => {
    const lines = relevantLines.filter(line => line.accountId === account.id);
    const total = lines.reduce((sum, line) => sum + parseFloat(line.credit || '0') - parseFloat(line.debit || '0'), 0);
    return { accountId: account.id, accountName: account.name, amount: total.toFixed(2) };
  });
  
  const expensesList = expenseAccounts.map(account => {
    const lines = relevantLines.filter(line => line.accountId === account.id);
    const total = lines.reduce((sum, line) => sum + parseFloat(line.debit || '0') - parseFloat(line.credit || '0'), 0);
    return { accountId: account.id, accountName: account.name, amount: total.toFixed(2) };
  });
  
  const totalRevenue = revenues.reduce((sum, r) => sum + parseFloat(r.amount), 0);
  const totalExpenses = expensesList.reduce((sum, e) => sum + parseFloat(e.amount), 0);
  const netIncome = totalRevenue - totalExpenses;
  
  return {
    revenues,
    expenses: expensesList,
    totalRevenue: totalRevenue.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    netIncome: netIncome.toFixed(2),
  };
};

DatabaseStorage.prototype.getBalanceSheet = async function(userId: string): Promise<any> {
  const accountsList = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const journalLines = await db.select().from(journalEntryLines);
  
  const calculateBalance = (accountId: string, accountType: string) => {
    const lines = journalLines.filter(line => line.accountId === accountId);
    const debitTotal = lines.reduce((sum, line) => sum + parseFloat(line.debit || '0'), 0);
    const creditTotal = lines.reduce((sum, line) => sum + parseFloat(line.credit || '0'), 0);
    
    if (accountType === 'asset' || accountType === 'expense') {
      return debitTotal - creditTotal;
    } else {
      return creditTotal - debitTotal;
    }
  };
  
  const assets = accountsList.filter(a => a.accountType === 'asset').map(account => ({
    accountId: account.id,
    accountName: account.name,
    balance: calculateBalance(account.id, account.accountType).toFixed(2),
  }));
  
  const liabilities = accountsList.filter(a => a.accountType === 'liability').map(account => ({
    accountId: account.id,
    accountName: account.name,
    balance: calculateBalance(account.id, account.accountType).toFixed(2),
  }));
  
  const equity = accountsList.filter(a => a.accountType === 'equity').map(account => ({
    accountId: account.id,
    accountName: account.name,
    balance: calculateBalance(account.id, account.accountType).toFixed(2),
  }));
  
  const totalAssets = assets.reduce((sum, a) => sum + parseFloat(a.balance), 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + parseFloat(l.balance), 0);
  const totalEquity = equity.reduce((sum, e) => sum + parseFloat(e.balance), 0);
  
  return {
    assets,
    liabilities,
    equity,
    totalAssets: totalAssets.toFixed(2),
    totalLiabilities: totalLiabilities.toFixed(2),
    totalEquity: totalEquity.toFixed(2),
  };
};
