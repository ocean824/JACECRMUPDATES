import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models
export * from "./models/auth";

// Role enum for user permissions
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "accounting",
  "investor_relations",
  "ops"
]);

// Investor type enum for segmentation
export const investorTypeEnum = pgEnum("investor_type", [
  "individual",
  "institutional",
  "fund"
]);

// Audit action enum
export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete"
]);

// Pipeline stage enum
export const pipelineStageEnum = pgEnum("pipeline_stage", [
  "lead",
  "contacted",
  "kyc_pending",
  "documents",
  "ready",
  "closed"
]);

// Account type enum for chart of accounts
export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense"
]);

// User Roles table (for role-based permissions)
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  role: userRoleEnum("role").notNull().default("investor_relations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Audit Logs table (tracks all user actions)
export const auditLogs = pgTable("audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  action: auditActionEnum("action").notNull(),
  entityType: varchar("entity_type", { length: 50 }).notNull(),
  entityId: varchar("entity_id"),
  description: text("description"),
  metadata: text("metadata"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Documents table (for document repository)
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investorId: varchar("investor_id").references(() => investors.id),
  filename: varchar("filename", { length: 255 }).notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  size: integer("size"),
  category: varchar("category", { length: 50 }),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Investors table (user-scoped with investor type segmentation)
export const investors = pgTable("investors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investorType: investorTypeEnum("investor_type").default("individual").notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 50 }),
  company: varchar("company", { length: 200 }),
  pipelineStage: pipelineStageEnum("pipeline_stage").default("lead").notNull(),
  kycStatus: varchar("kyc_status", { length: 50 }).default("pending"),
  investmentAmount: decimal("investment_amount", { precision: 15, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Accounts (Chart of Accounts) - user-scoped
export const accounts = pgTable("accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  code: varchar("code", { length: 20 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  accountType: accountTypeEnum("account_type").notNull(),
  description: text("description"),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Journal Entries - user-scoped
export const journalEntries = pgTable("journal_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  entryNumber: varchar("entry_number", { length: 50 }).notNull(),
  description: text("description").notNull(),
  date: timestamp("date").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Journal Entry Lines (for double-entry)
export const journalEntryLines = pgTable("journal_entry_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  journalEntryId: varchar("journal_entry_id").notNull().references(() => journalEntries.id),
  accountId: varchar("account_id").notNull().references(() => accounts.id),
  debit: decimal("debit", { precision: 15, scale: 2 }).default("0"),
  credit: decimal("credit", { precision: 15, scale: 2 }).default("0"),
  description: text("description"),
});

// Tasks/Activities - user-scoped
export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  priority: varchar("priority", { length: 20 }).default("medium"),
  status: varchar("status", { length: 50 }).default("pending"),
  investorId: varchar("investor_id").references(() => investors.id),
  assignedTo: varchar("assigned_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Relations
export const investorRelations = relations(investors, ({ many }) => ({
  tasks: many(tasks),
  documents: many(documents),
}));

export const journalEntryRelations = relations(journalEntries, ({ many }) => ({
  lines: many(journalEntryLines),
}));

export const journalEntryLineRelations = relations(journalEntryLines, ({ one }) => ({
  journalEntry: one(journalEntries, {
    fields: [journalEntryLines.journalEntryId],
    references: [journalEntries.id],
  }),
  account: one(accounts, {
    fields: [journalEntryLines.accountId],
    references: [accounts.id],
  }),
}));

export const taskRelations = relations(tasks, ({ one }) => ({
  investor: one(investors, {
    fields: [tasks.investorId],
    references: [investors.id],
  }),
}));

export const documentRelations = relations(documents, ({ one }) => ({
  investor: one(investors, {
    fields: [documents.investorId],
    references: [investors.id],
  }),
}));

// Insert schemas - omit auto-generated fields
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertInvestorSchema = createInsertSchema(investors).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAccountSchema = createInsertSchema(accounts).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertJournalEntryLineSchema = createInsertSchema(journalEntryLines).omit({
  id: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  userId: true,
  createdAt: true,
  completedAt: true,
});

// Types
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Investor = typeof investors.$inferSelect;
export type InsertInvestor = z.infer<typeof insertInvestorSchema>;

export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;

export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;

export type JournalEntryLine = typeof journalEntryLines.$inferSelect;
export type InsertJournalEntryLine = z.infer<typeof insertJournalEntryLineSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

// Pipeline stage labels for UI
export const pipelineStages = [
  { value: "lead", label: "Lead", color: "bg-slate-500" },
  { value: "contacted", label: "Contacted", color: "bg-blue-500" },
  { value: "kyc_pending", label: "KYC Pending", color: "bg-yellow-500" },
  { value: "documents", label: "Documents", color: "bg-orange-500" },
  { value: "ready", label: "Ready", color: "bg-emerald-500" },
  { value: "closed", label: "Closed", color: "bg-green-600" },
] as const;

export type PipelineStage = typeof pipelineStages[number]["value"];

// Investor type labels for UI
export const investorTypes = [
  { value: "individual", label: "Individual" },
  { value: "institutional", label: "Institutional" },
  { value: "fund", label: "Fund" },
] as const;

export type InvestorType = typeof investorTypes[number]["value"];

// Role labels for UI
export const userRoleLabels = [
  { value: "admin", label: "Admin/Ops", description: "Full system access" },
  { value: "accounting", label: "Accounting", description: "Accounting, ledger, and financial access" },
  { value: "investor_relations", label: "Investor Relations", description: "Investor, pipeline, and document access" },
  { value: "ops", label: "Operations", description: "Task and workflow management" },
] as const;

export type UserRoleType = typeof userRoleLabels[number]["value"];

// ============ PHASE 2 ADDITIONS ============

// Communication type enum
export const communicationTypeEnum = pgEnum("communication_type", [
  "note",
  "email",
  "call",
  "meeting"
]);

// KYC status enum for detailed tracking
export const kycItemStatusEnum = pgEnum("kyc_item_status", [
  "pending",
  "submitted",
  "approved",
  "rejected"
]);

// Notification type enum
export const notificationTypeEnum = pgEnum("notification_type", [
  "task_due",
  "kyc_deadline",
  "pipeline_change",
  "document_uploaded",
  "bond_settlement",
  "system"
]);

// Bond status enum
export const bondStatusEnum = pgEnum("bond_status", [
  "pending",
  "settled",
  "matured",
  "cancelled"
]);

// KYC Checklist Items - tracks compliance items per investor
export const kycChecklist = pgTable("kyc_checklist", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investorId: varchar("investor_id").notNull().references(() => investors.id),
  itemName: varchar("item_name", { length: 200 }).notNull(),
  description: text("description"),
  status: kycItemStatusEnum("status").default("pending").notNull(),
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  documentId: varchar("document_id").references(() => documents.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Bond Settlements - tracks bond transactions
export const bondSettlements = pgTable("bond_settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investorId: varchar("investor_id").references(() => investors.id),
  bondName: varchar("bond_name", { length: 200 }).notNull(),
  isin: varchar("isin", { length: 20 }),
  faceValue: decimal("face_value", { precision: 15, scale: 2 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 15, scale: 2 }),
  couponRate: decimal("coupon_rate", { precision: 5, scale: 2 }),
  currencyCode: varchar("currency_code", { length: 3 }).default("USD"),
  purchaseDate: timestamp("purchase_date"),
  settlementDate: timestamp("settlement_date"),
  maturityDate: timestamp("maturity_date"),
  status: bondStatusEnum("status").default("pending").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Communications - notes, emails, calls with investors
export const communications = pgTable("communications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investorId: varchar("investor_id").notNull().references(() => investors.id),
  type: communicationTypeEnum("type").notNull(),
  subject: varchar("subject", { length: 500 }),
  content: text("content").notNull(),
  contactedAt: timestamp("contacted_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Notifications - user alerts
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message"),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: varchar("entity_id"),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Phase 2 Relations
export const kycChecklistRelations = relations(kycChecklist, ({ one }) => ({
  investor: one(investors, {
    fields: [kycChecklist.investorId],
    references: [investors.id],
  }),
  document: one(documents, {
    fields: [kycChecklist.documentId],
    references: [documents.id],
  }),
}));

export const bondSettlementRelations = relations(bondSettlements, ({ one }) => ({
  investor: one(investors, {
    fields: [bondSettlements.investorId],
    references: [investors.id],
  }),
}));

export const communicationRelations = relations(communications, ({ one }) => ({
  investor: one(investors, {
    fields: [communications.investorId],
    references: [investors.id],
  }),
}));

// Phase 2 Insert schemas
export const insertKycChecklistSchema = createInsertSchema(kycChecklist).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBondSettlementSchema = createInsertSchema(bondSettlements).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCommunicationSchema = createInsertSchema(communications).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

// Phase 2 Types
export type KycChecklistItem = typeof kycChecklist.$inferSelect;
export type InsertKycChecklistItem = z.infer<typeof insertKycChecklistSchema>;

export type BondSettlement = typeof bondSettlements.$inferSelect;
export type InsertBondSettlement = z.infer<typeof insertBondSettlementSchema>;

export type Communication = typeof communications.$inferSelect;
export type InsertCommunication = z.infer<typeof insertCommunicationSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

// Communication type labels for UI
export const communicationTypes = [
  { value: "note", label: "Note", icon: "FileText" },
  { value: "email", label: "Email", icon: "Mail" },
  { value: "call", label: "Phone Call", icon: "Phone" },
  { value: "meeting", label: "Meeting", icon: "Users" },
] as const;

export type CommunicationType = typeof communicationTypes[number]["value"];

// KYC item status labels for UI
export const kycItemStatuses = [
  { value: "pending", label: "Pending", color: "bg-yellow-500" },
  { value: "submitted", label: "Submitted", color: "bg-blue-500" },
  { value: "approved", label: "Approved", color: "bg-green-500" },
  { value: "rejected", label: "Rejected", color: "bg-red-500" },
] as const;

export type KycItemStatus = typeof kycItemStatuses[number]["value"];

// Bond status labels for UI
export const bondStatuses = [
  { value: "pending", label: "Pending Settlement", color: "bg-yellow-500" },
  { value: "settled", label: "Settled", color: "bg-green-500" },
  { value: "matured", label: "Matured", color: "bg-blue-500" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-500" },
] as const;

export type BondStatus = typeof bondStatuses[number]["value"];

// ============ PHASE 3 ADDITIONS ============

// Recurrence frequency enum
export const recurrenceFrequencyEnum = pgEnum("recurrence_frequency", [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly"
]);

// Calendar event type enum
export const calendarEventTypeEnum = pgEnum("calendar_event_type", [
  "meeting",
  "call",
  "deadline",
  "reminder",
  "other"
]);

// Custom field type enum
export const customFieldTypeEnum = pgEnum("custom_field_type", [
  "text",
  "number",
  "date",
  "boolean",
  "select",
  "multiselect"
]);

// Activity type enum for timeline
export const activityTypeEnum = pgEnum("activity_type", [
  "investor_created",
  "investor_updated",
  "pipeline_changed",
  "task_created",
  "task_completed",
  "document_uploaded",
  "communication_logged",
  "bond_created",
  "kyc_updated",
  "email_sent",
  "meeting_scheduled"
]);

// Currencies table - reference for multi-currency support
export const currencies = pgTable("currencies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 3 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  symbol: varchar("symbol", { length: 10 }).notNull(),
  exchangeRate: decimal("exchange_rate", { precision: 15, scale: 6 }).default("1"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Calendar Events - for scheduling meetings and appointments
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investorId: varchar("investor_id").references(() => investors.id),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  eventType: calendarEventTypeEnum("event_type").default("meeting").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: varchar("location", { length: 500 }),
  isAllDay: boolean("is_all_day").default(false),
  reminderMinutes: integer("reminder_minutes").default(30),
  attendees: text("attendees"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Task Recurrence - for recurring tasks
export const taskRecurrences = pgTable("task_recurrences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  taskTemplateTitle: varchar("task_template_title", { length: 500 }).notNull(),
  taskTemplateDescription: text("task_template_description"),
  frequency: recurrenceFrequencyEnum("frequency").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  investorId: varchar("investor_id").references(() => investors.id),
  priority: varchar("priority", { length: 20 }).default("medium"),
  isActive: boolean("is_active").default(true),
  lastGeneratedAt: timestamp("last_generated_at"),
  nextGenerationAt: timestamp("next_generation_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Custom Fields - for dynamic fields on investors
export const customFields = pgTable("custom_fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  label: varchar("label", { length: 200 }).notNull(),
  fieldType: customFieldTypeEnum("field_type").notNull(),
  options: text("options"),
  isRequired: boolean("is_required").default(false),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Custom Field Values - stores values for custom fields per investor
export const customFieldValues = pgTable("custom_field_values", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  customFieldId: varchar("custom_field_id").notNull().references(() => customFields.id),
  investorId: varchar("investor_id").notNull().references(() => investors.id),
  value: text("value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Activity Timeline - unified activity tracking per investor
export const activityTimeline = pgTable("activity_timeline", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investorId: varchar("investor_id").notNull().references(() => investors.id),
  activityType: activityTypeEnum("activity_type").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  metadata: text("metadata"),
  entityType: varchar("entity_type", { length: 50 }),
  entityId: varchar("entity_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Email Templates - for email integration
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email Logs - tracks sent emails
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  investorId: varchar("investor_id").references(() => investors.id),
  templateId: varchar("template_id").references(() => emailTemplates.id),
  toEmail: varchar("to_email", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 50 }).default("sent"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Investor Portal Users - for investor portal access
export const investorPortalUsers = pgTable("investor_portal_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  investorId: varchar("investor_id").notNull().references(() => investors.id),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Phase 3 Relations
export const calendarEventRelations = relations(calendarEvents, ({ one }) => ({
  investor: one(investors, {
    fields: [calendarEvents.investorId],
    references: [investors.id],
  }),
}));

export const taskRecurrenceRelations = relations(taskRecurrences, ({ one }) => ({
  investor: one(investors, {
    fields: [taskRecurrences.investorId],
    references: [investors.id],
  }),
}));

export const customFieldValueRelations = relations(customFieldValues, ({ one }) => ({
  customField: one(customFields, {
    fields: [customFieldValues.customFieldId],
    references: [customFields.id],
  }),
  investor: one(investors, {
    fields: [customFieldValues.investorId],
    references: [investors.id],
  }),
}));

export const activityTimelineRelations = relations(activityTimeline, ({ one }) => ({
  investor: one(investors, {
    fields: [activityTimeline.investorId],
    references: [investors.id],
  }),
}));

export const emailLogRelations = relations(emailLogs, ({ one }) => ({
  investor: one(investors, {
    fields: [emailLogs.investorId],
    references: [investors.id],
  }),
  template: one(emailTemplates, {
    fields: [emailLogs.templateId],
    references: [emailTemplates.id],
  }),
}));

export const investorPortalUserRelations = relations(investorPortalUsers, ({ one }) => ({
  investor: one(investors, {
    fields: [investorPortalUsers.investorId],
    references: [investors.id],
  }),
}));

// Phase 3 Insert schemas
export const insertCurrencySchema = createInsertSchema(currencies).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTaskRecurrenceSchema = createInsertSchema(taskRecurrences).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomFieldSchema = createInsertSchema(customFields).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCustomFieldValueSchema = createInsertSchema(customFieldValues).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertActivityTimelineSchema = createInsertSchema(activityTimeline).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  userId: true,
  createdAt: true,
});

export const insertInvestorPortalUserSchema = createInsertSchema(investorPortalUsers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Phase 3 Types
export type Currency = typeof currencies.$inferSelect;
export type InsertCurrency = z.infer<typeof insertCurrencySchema>;

export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

export type TaskRecurrence = typeof taskRecurrences.$inferSelect;
export type InsertTaskRecurrence = z.infer<typeof insertTaskRecurrenceSchema>;

export type CustomField = typeof customFields.$inferSelect;
export type InsertCustomField = z.infer<typeof insertCustomFieldSchema>;

export type CustomFieldValue = typeof customFieldValues.$inferSelect;
export type InsertCustomFieldValue = z.infer<typeof insertCustomFieldValueSchema>;

export type ActivityTimelineEntry = typeof activityTimeline.$inferSelect;
export type InsertActivityTimelineEntry = z.infer<typeof insertActivityTimelineSchema>;

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;

export type InvestorPortalUser = typeof investorPortalUsers.$inferSelect;
export type InsertInvestorPortalUser = z.infer<typeof insertInvestorPortalUserSchema>;

// Phase 3 UI Labels
export const recurrenceFrequencies = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
] as const;

export type RecurrenceFrequency = typeof recurrenceFrequencies[number]["value"];

export const calendarEventTypes = [
  { value: "meeting", label: "Meeting", icon: "Users" },
  { value: "call", label: "Call", icon: "Phone" },
  { value: "deadline", label: "Deadline", icon: "AlertCircle" },
  { value: "reminder", label: "Reminder", icon: "Bell" },
  { value: "other", label: "Other", icon: "Calendar" },
] as const;

export type CalendarEventType = typeof calendarEventTypes[number]["value"];

export const customFieldTypes = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "boolean", label: "Yes/No" },
  { value: "select", label: "Dropdown" },
  { value: "multiselect", label: "Multi-select" },
] as const;

export type CustomFieldType = typeof customFieldTypes[number]["value"];

export const activityTypes = [
  { value: "investor_created", label: "Investor Created", icon: "UserPlus" },
  { value: "investor_updated", label: "Investor Updated", icon: "UserCog" },
  { value: "pipeline_changed", label: "Pipeline Changed", icon: "TrendingUp" },
  { value: "task_created", label: "Task Created", icon: "ClipboardList" },
  { value: "task_completed", label: "Task Completed", icon: "CheckCircle" },
  { value: "document_uploaded", label: "Document Uploaded", icon: "FileUp" },
  { value: "communication_logged", label: "Communication Logged", icon: "MessageSquare" },
  { value: "bond_created", label: "Bond Created", icon: "Landmark" },
  { value: "kyc_updated", label: "KYC Updated", icon: "Shield" },
  { value: "email_sent", label: "Email Sent", icon: "Mail" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", icon: "Calendar" },
] as const;

export type ActivityType = typeof activityTypes[number]["value"];

// Default currencies for initialization
export const defaultCurrencies = [
  { code: "USD", name: "US Dollar", symbol: "$", isDefault: true },
  { code: "EUR", name: "Euro", symbol: "€", isDefault: false },
  { code: "GBP", name: "British Pound", symbol: "£", isDefault: false },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", isDefault: false },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", isDefault: false },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", isDefault: false },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", isDefault: false },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", isDefault: false },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", isDefault: false },
] as const;
