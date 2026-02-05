import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { settlementSessions } from "@shared/schema";
import { logAudit } from "./storage";

export interface SettlementJwtPayload {
  sid: string;
  tradeId: number;
  bondId?: number;
  investorId?: number;
  amount: number;
  bondName?: string;
  investorEmail?: string;
  exp: number;
  iat?: number;
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(",")[0].trim();
  }
  return req.ip || "unknown";
}

function hmacSha256Hex(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message, "utf8").digest("hex");
}

function setFrameAncestorsHeaders(res: Response) {
  const fa = process.env.BONDAI_ALLOWED_FRAME_ANCESTORS;
  if (fa) {
    res.setHeader("Content-Security-Policy", `frame-ancestors ${fa};`);
  }
}

function verifySettlementJwt(token: string, secret: string): SettlementJwtPayload {
  try {
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as SettlementJwtPayload;
    if (!decoded.sid || typeof decoded.tradeId !== "number" || typeof decoded.amount !== "number") {
      throw new Error("Invalid token claims");
    }
    return decoded;
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      throw new Error("Token expired");
    }
    if (err.name === "JsonWebTokenError") {
      throw new Error("Invalid token signature");
    }
    throw new Error(err.message || "Token verification failed");
  }
}

async function sendWebhookToBondAI(
  webhookUrl: string,
  webhookSecret: string,
  event: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; statusCode?: number; error?: string }> {
  try {
    const body = JSON.stringify({
      event,
      timestamp: new Date().toISOString(),
      payload,
    });

    const timestamp = Date.now().toString();
    const signaturePayload = `${timestamp}.${body}`;
    const signature = hmacSha256Hex(webhookSecret, signaturePayload);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Timestamp": timestamp,
      },
      body,
    });

    return {
      success: response.ok,
      statusCode: response.status,
    };
  } catch (err: any) {
    console.error("Failed to send webhook to BondAI:", err);
    return {
      success: false,
      error: err.message,
    };
  }
}

export function registerSettlementRoutes(app: Express) {
  // Set frame-ancestors for the settlement page HTML and API routes to allow iframe embedding from BondAI
  app.use((req, res, next) => {
    if (req.path === "/settlement" || req.path.startsWith("/settlement/") || req.path.startsWith("/api/settlement")) {
      setFrameAncestorsHeaders(res);
      res.setHeader("Cache-Control", "no-store");
    }
    next();
  });

  app.get("/api/settlement/session", async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      const secret = envOrThrow("BONDAI_SETTLEMENT_SECRET");
      
      let payload: SettlementJwtPayload;
      try {
        payload = verifySettlementJwt(token, secret);
      } catch (err: any) {
        console.error("Settlement JWT verification failed:", err.message);
        return res.status(401).json({ message: err.message });
      }

      const ipAddress = getClientIp(req);
      const userAgent = req.headers["user-agent"] || null;
      const expiresAt = new Date(payload.exp * 1000);

      const existing = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, payload.sid))
        .limit(1);

      let session;
      if (existing.length > 0) {
        [session] = await db
          .update(settlementSessions)
          .set({
            ipAddress,
            userAgent,
            bondName: payload.bondName || existing[0].bondName,
            investorEmail: payload.investorEmail || existing[0].investorEmail,
          })
          .where(eq(settlementSessions.sessionId, payload.sid))
          .returning();
      } else {
        [session] = await db
          .insert(settlementSessions)
          .values({
            sessionId: payload.sid,
            tradeId: payload.tradeId,
            bondId: payload.bondId || null,
            bondaiInvestorId: payload.investorId || null,
            amount: payload.amount.toString(),
            bondName: payload.bondName || null,
            investorEmail: payload.investorEmail || null,
            ipAddress,
            userAgent,
            status: "pending",
            expiresAt,
          })
          .returning();

        await logAudit(
          "system",
          "create",
          "settlement_session",
          session.id,
          `Settlement session created for trade ${payload.tradeId}`,
          { tradeId: payload.tradeId, bondId: payload.bondId, amount: payload.amount },
          ipAddress
        );
      }

      return res.json({
        sessionId: session.sessionId,
        tradeId: session.tradeId,
        bondId: session.bondId,
        amount: session.amount,
        bondName: session.bondName,
        investorEmail: session.investorEmail,
        status: session.status,
        expiresAt: session.expiresAt?.toISOString(),
        createdAt: session.createdAt.toISOString(),
      });
    } catch (err: any) {
      console.error("Error in settlement session endpoint:", err);
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  app.post("/api/settlement/complete", async (req: Request, res: Response) => {
    try {
      const { sessionId, paymentReference, token } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "sessionId is required" });
      }
      if (!token) {
        return res.status(400).json({ message: "token is required for verification" });
      }

      // Verify the JWT token to ensure the request is authenticated
      const secret = envOrThrow("BONDAI_SETTLEMENT_SECRET");
      let payload: SettlementJwtPayload;
      try {
        payload = verifySettlementJwt(token, secret);
      } catch (err: any) {
        console.error("Settlement complete JWT verification failed:", err.message);
        return res.status(401).json({ message: err.message });
      }

      // Verify sessionId matches the token
      if (payload.sid !== sessionId) {
        return res.status(403).json({ message: "Session ID does not match token" });
      }

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, sessionId))
        .limit(1);

      if (!session) {
        return res.status(404).json({ message: "Settlement session not found" });
      }

      if (session.status === "settled") {
        return res.status(400).json({ message: "Session already settled" });
      }

      if (session.status === "cancelled") {
        return res.status(400).json({ message: "Session was cancelled" });
      }

      if (session.expiresAt && new Date() > session.expiresAt) {
        return res.status(400).json({ message: "Session has expired" });
      }

      const settledAt = new Date();
      const [updatedSession] = await db
        .update(settlementSessions)
        .set({
          status: "settled",
          settledAt,
          paymentReference: paymentReference || null,
        })
        .where(eq(settlementSessions.sessionId, sessionId))
        .returning();

      const ipAddress = getClientIp(req);
      await logAudit(
        "system",
        "update",
        "settlement_session",
        updatedSession.id,
        `Settlement completed for trade ${updatedSession.tradeId}`,
        {
          tradeId: updatedSession.tradeId,
          amount: updatedSession.amount,
          paymentReference,
        },
        ipAddress
      );

      const webhookUrl = process.env.BONDAI_WEBHOOK_URL;
      const webhookSecret = process.env.BONDAI_WEBHOOK_SECRET;
      
      if (webhookUrl && webhookSecret) {
        const webhookResult = await sendWebhookToBondAI(
          webhookUrl,
          webhookSecret,
          "settlement.completed",
          {
            sessionId: updatedSession.sessionId,
            tradeId: updatedSession.tradeId,
            bondId: updatedSession.bondId,
            amount: updatedSession.amount,
            paymentReference: updatedSession.paymentReference,
            settledAt: settledAt.toISOString(),
          }
        );

        await logAudit(
          "system",
          "create",
          "webhook_sent",
          updatedSession.id,
          `Webhook sent to BondAI: settlement.completed (success: ${webhookResult.success})`,
          webhookResult,
          ipAddress
        );
      }

      return res.json({
        sessionId: updatedSession.sessionId,
        tradeId: updatedSession.tradeId,
        status: updatedSession.status,
        settledAt: updatedSession.settledAt?.toISOString(),
        message: "Settlement completed successfully",
      });
    } catch (err: any) {
      console.error("Error completing settlement:", err);
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });

  app.post("/api/settlement/cancel", async (req: Request, res: Response) => {
    try {
      const { sessionId, reason, token } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "sessionId is required" });
      }
      if (!token) {
        return res.status(400).json({ message: "token is required for verification" });
      }

      // Verify the JWT token to ensure the request is authenticated
      const secret = envOrThrow("BONDAI_SETTLEMENT_SECRET");
      let payload: SettlementJwtPayload;
      try {
        payload = verifySettlementJwt(token, secret);
      } catch (err: any) {
        console.error("Settlement cancel JWT verification failed:", err.message);
        return res.status(401).json({ message: err.message });
      }

      // Verify sessionId matches the token
      if (payload.sid !== sessionId) {
        return res.status(403).json({ message: "Session ID does not match token" });
      }

      const [session] = await db
        .select()
        .from(settlementSessions)
        .where(eq(settlementSessions.sessionId, sessionId))
        .limit(1);

      if (!session) {
        return res.status(404).json({ message: "Settlement session not found" });
      }

      if (session.status === "settled") {
        return res.status(400).json({ message: "Cannot cancel a settled session" });
      }

      if (session.status === "cancelled") {
        return res.status(400).json({ message: "Session already cancelled" });
      }

      const cancelledAt = new Date();
      const [updatedSession] = await db
        .update(settlementSessions)
        .set({
          status: "cancelled",
          cancelledAt,
          failureReason: reason || null,
        })
        .where(eq(settlementSessions.sessionId, sessionId))
        .returning();

      const ipAddress = getClientIp(req);
      await logAudit(
        "system",
        "update",
        "settlement_session",
        updatedSession.id,
        `Settlement cancelled for trade ${updatedSession.tradeId}`,
        {
          tradeId: updatedSession.tradeId,
          reason,
        },
        ipAddress
      );

      const webhookUrl = process.env.BONDAI_WEBHOOK_URL;
      const webhookSecret = process.env.BONDAI_WEBHOOK_SECRET;
      
      if (webhookUrl && webhookSecret) {
        const webhookResult = await sendWebhookToBondAI(
          webhookUrl,
          webhookSecret,
          "settlement.cancelled",
          {
            sessionId: updatedSession.sessionId,
            tradeId: updatedSession.tradeId,
            bondId: updatedSession.bondId,
            amount: updatedSession.amount,
            reason: updatedSession.failureReason,
            cancelledAt: cancelledAt.toISOString(),
          }
        );

        await logAudit(
          "system",
          "create",
          "webhook_sent",
          updatedSession.id,
          `Webhook sent to BondAI: settlement.cancelled (success: ${webhookResult.success})`,
          webhookResult,
          ipAddress
        );
      }

      return res.json({
        sessionId: updatedSession.sessionId,
        tradeId: updatedSession.tradeId,
        status: updatedSession.status,
        cancelledAt: updatedSession.cancelledAt?.toISOString(),
        message: "Settlement cancelled",
      });
    } catch (err: any) {
      console.error("Error cancelling settlement:", err);
      return res.status(500).json({ message: err.message || "Internal server error" });
    }
  });
}
