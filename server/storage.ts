import {
  investors,
  accounts,
  journalEntries,
  journalEntryLines,
  tasks,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
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
}

export class DatabaseStorage implements IStorage {
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
    // First delete entry lines, then entry
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
}

export const storage = new DatabaseStorage();
