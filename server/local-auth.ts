import type { Express, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { users, pendingRegistrations, usedPins } from "@shared/models/auth";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import { sendAdminApprovalNotification, sendPinToUser } from "./email-service";

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
});

const completeRegistrationSchema = z.object({
  email: z.string().email("Invalid email address"),
  pin: z.string().min(1, "PIN is required").max(9, "PIN must be at most 9 characters"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

function generateInvitePin(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const specialChars = '!@#$%&*';
  const alphanumeric = lowercase + numbers;
  
  const pinLength = 8;
  let pin = '';
  
  for (let i = 0; i < pinLength - 1; i++) {
    pin += alphanumeric.charAt(Math.floor(Math.random() * alphanumeric.length));
  }
  
  const specialChar = specialChars.charAt(Math.floor(Math.random() * specialChars.length));
  const insertPos = Math.floor(Math.random() * (pin.length + 1));
  pin = pin.slice(0, insertPos) + specialChar + pin.slice(insertPos);
  
  return pin;
}

async function generateUniquePin(): Promise<string> {
  const maxAttempts = 100;
  
  for (let i = 0; i < maxAttempts; i++) {
    const pin = generateInvitePin();
    
    const existing = await db
      .select()
      .from(usedPins)
      .where(eq(usedPins.pin, pin))
      .limit(1);
    
    if (existing.length === 0) {
      await db.insert(usedPins).values({
        pin,
        usedFor: "registration",
      });
      return pin;
    }
  }
  
  throw new Error("Unable to generate unique PIN after maximum attempts");
}

async function getAdminEmail(): Promise<string | null> {
  const [admin] = await db
    .select()
    .from(users)
    .where(eq(users.isAdmin, "true"))
    .limit(1);
  
  return admin?.email || null;
}

export function setupLocalAuth(app: Express) {
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const result = registerSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: result.error.errors[0].message 
        });
      }

      const { email, password, firstName, lastName } = result.data;

      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (existingUser.length > 0) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const existingPending = await db
        .select()
        .from(pendingRegistrations)
        .where(and(
          eq(pendingRegistrations.email, email),
          ne(pendingRegistrations.status, "rejected")
        ))
        .limit(1);

      if (existingPending.length > 0) {
        const pending = existingPending[0];
        if (pending.status === "approved" && pending.pin) {
          return res.status(400).json({ 
            message: "Your registration has been approved. Please check your email for your PIN.",
            status: "approved"
          });
        }
        return res.status(400).json({ 
          message: "Registration already pending approval",
          status: "pending"
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const [newPending] = await db
        .insert(pendingRegistrations)
        .values({
          email,
          password: hashedPassword,
          firstName,
          lastName,
        })
        .returning();

      const adminEmail = await getAdminEmail();
      if (adminEmail) {
        await sendAdminApprovalNotification(adminEmail, {
          id: newPending.id,
          firstName,
          lastName,
          email,
        });
        
        await db
          .update(pendingRegistrations)
          .set({ adminNotified: "true" })
          .where(eq(pendingRegistrations.id, newPending.id));
      }

      res.json({
        message: "Registration submitted. Please wait for admin approval.",
        status: "pending",
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/complete-registration", async (req: Request, res: Response) => {
    try {
      const result = completeRegistrationSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: result.error.errors[0].message 
        });
      }

      const { email, pin } = result.data;

      const [pending] = await db
        .select()
        .from(pendingRegistrations)
        .where(and(
          eq(pendingRegistrations.email, email),
          eq(pendingRegistrations.status, "approved"),
          eq(pendingRegistrations.pin, pin)
        ))
        .limit(1);

      if (!pending) {
        return res.status(400).json({ message: "Invalid email or PIN" });
      }

      if (!pending.pinConfirmedAt) {
        return res.status(400).json({ message: "This invite has not been confirmed by an admin yet" });
      }

      if (pending.pinExpiresAt && new Date() > new Date(pending.pinExpiresAt)) {
        return res.status(400).json({ message: "This invite PIN has expired. Please request a new invitation." });
      }

      await db
        .update(pendingRegistrations)
        .set({ pinEnteredAt: new Date() })
        .where(eq(pendingRegistrations.id, pending.id));

      const [newUser] = await db
        .insert(users)
        .values({
          email: pending.email,
          password: pending.password,
          firstName: pending.firstName,
          lastName: pending.lastName,
          isAdmin: "false",
        })
        .returning();

      await db
        .delete(pendingRegistrations)
        .where(eq(pendingRegistrations.id, pending.id));

      (req.session as any).userId = newUser.id;
      (req.session as any).user = {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        isAdmin: newUser.isAdmin,
      };

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to complete registration" });
        }
        res.json({
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
        });
      });
    } catch (error) {
      console.error("Complete registration error:", error);
      res.status(500).json({ message: "Failed to complete registration" });
    }
  });

  app.get("/api/auth/pending-registrations", async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!user || user.isAdmin !== "true") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const pending = await db
        .select()
        .from(pendingRegistrations)
        .where(eq(pendingRegistrations.status, "pending"));

      res.json(pending);
    } catch (error) {
      console.error("Get pending registrations error:", error);
      res.status(500).json({ message: "Failed to get pending registrations" });
    }
  });

  app.post("/api/auth/approve-registration/:id", async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!user || user.isAdmin !== "true") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;

      const [pending] = await db
        .select()
        .from(pendingRegistrations)
        .where(eq(pendingRegistrations.id, id))
        .limit(1);

      if (!pending) {
        return res.status(404).json({ message: "Registration not found" });
      }

      if (pending.status !== "pending") {
        return res.status(400).json({ message: "Registration already processed" });
      }

      const pin = await generateUniquePin();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      await db
        .update(pendingRegistrations)
        .set({
          status: "approved",
          pin,
          pinExpiresAt: expiresAt,
          pinConfirmedAt: now,
          approvedAt: now,
          approvedBy: user.id,
          updatedAt: now,
        })
        .where(eq(pendingRegistrations.id, id));

      await sendPinToUser(pending.email, pending.firstName, pin);

      res.json({
        message: "Registration approved. PIN sent to user. Expires in 2 hours.",
        pin,
        expiresAt: expiresAt.toISOString(),
      });
    } catch (error) {
      console.error("Approve registration error:", error);
      res.status(500).json({ message: "Failed to approve registration" });
    }
  });

  app.post("/api/auth/reject-registration/:id", async (req: Request, res: Response) => {
    try {
      const user = (req.session as any)?.user;
      if (!user || user.isAdmin !== "true") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const { id } = req.params;

      const [pending] = await db
        .select()
        .from(pendingRegistrations)
        .where(eq(pendingRegistrations.id, id))
        .limit(1);

      if (!pending) {
        return res.status(404).json({ message: "Registration not found" });
      }

      if (pending.status !== "pending") {
        return res.status(400).json({ message: "Registration already processed" });
      }

      await db
        .update(pendingRegistrations)
        .set({
          status: "rejected",
          updatedAt: new Date(),
        })
        .where(eq(pendingRegistrations.id, id));

      res.json({ message: "Registration rejected" });
    } catch (error) {
      console.error("Reject registration error:", error);
      res.status(500).json({ message: "Failed to reject registration" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const result = loginSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          message: result.error.errors[0].message 
        });
      }

      const { email, password } = result.data;

      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      (req.session as any).userId = user.id;
      (req.session as any).user = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isAdmin: user.isAdmin,
      };

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Login failed" });
        }
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req: Request, res: Response) => {
    const user = (req.session as any)?.user;
    if (!user) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(user);
  });
}

export function isLocalAuthenticated(req: Request, res: Response, next: NextFunction) {
  const user = (req.session as any)?.user;
  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  (req as any).user = { claims: { sub: user.id } };
  next();
}
