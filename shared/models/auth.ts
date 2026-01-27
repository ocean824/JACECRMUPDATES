import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: varchar("is_admin").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Registration status enum
export const registrationStatusEnum = pgEnum("registration_status", [
  "pending",
  "approved",
  "rejected"
]);

// Pending registrations table (for PIN approval workflow)
export const pendingRegistrations = pgTable("pending_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").notNull(),
  password: varchar("password").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  status: registrationStatusEnum("status").default("pending").notNull(),
  pin: varchar("pin", { length: 9 }),
  pinExpiresAt: timestamp("pin_expires_at"),
  pinConfirmedAt: timestamp("pin_confirmed_at"),
  pinEnteredAt: timestamp("pin_entered_at"),
  adminNotified: varchar("admin_notified").default("false"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  approvedAt: timestamp("approved_at"),
  approvedBy: varchar("approved_by"),
});

export const insertPendingRegistrationSchema = createInsertSchema(pendingRegistrations).omit({
  id: true,
  status: true,
  pin: true,
  pinExpiresAt: true,
  pinConfirmedAt: true,
  pinEnteredAt: true,
  adminNotified: true,
  createdAt: true,
  updatedAt: true,
  approvedAt: true,
  approvedBy: true,
});

export type InsertPendingRegistration = z.infer<typeof insertPendingRegistrationSchema>;
export type PendingRegistration = typeof pendingRegistrations.$inferSelect;

// Used PINs table (to ensure no two PINs are ever alike)
export const usedPins = pgTable("used_pins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pin: varchar("pin", { length: 9 }).notNull().unique(),
  usedAt: timestamp("used_at").defaultNow().notNull(),
  usedFor: varchar("used_for"),
});
