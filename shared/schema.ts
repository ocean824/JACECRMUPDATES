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
