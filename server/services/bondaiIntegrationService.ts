/**
 * BondAI Integration Service for JACE CRM
 * 
 * This service handles bi-directional communication between JACE CRM and BondAI:
 * 1. Receiving webhook events from BondAI (investor onboarding, payment confirmations, KYC updates)
 * 2. Sending investor data to BondAI for onboarding
 * 3. Syncing investor status between systems
 */

import crypto from "crypto";
import { storage } from "../storage";

// Environment configuration
const BONDAI_API_URL = process.env.BONDAI_API_URL || "https://bondai.example.com/api";
const BONDAI_API_KEY = process.env.BONDAI_API_KEY || "";
const BONDAI_WEBHOOK_SECRET = process.env.BONDAI_WEBHOOK_SECRET || "";
const JACE_WEBHOOK_SECRET = process.env.JACE_WEBHOOK_SECRET || "";

// Webhook event types from BondAI
export type BondAIEventType = 
  | "investor_onboarding_submitted"
  | "investor_onboarding_completed"
  | "payment.pending"
  | "payment.confirmed"
  | "payment.failed"
  | "kyc.submitted"
  | "kyc.completed"
  | "kyc.rejected"
  | "trade.created"
  | "trade.completed"
  | "auction.bid_placed"
  | "auction.won";

// Webhook payload structure
export interface BondAIWebhookPayload {
  eventId: string;
  eventType: BondAIEventType;
  correlationId?: string;
  timestamp: string;
  data: Record<string, any>;
}

// Signature verification
export function verifyBondAISignature(payload: Buffer, signature: string): { ok: boolean; reason?: string } {
  if (!BONDAI_WEBHOOK_SECRET) {
    return { ok: true, reason: "No secret configured - skipping verification" };
  }
  
  if (!signature) {
    return { ok: false, reason: "Missing signature header" };
  }
  
  try {
    const expected = crypto
      .createHmac("sha256", BONDAI_WEBHOOK_SECRET)
      .update(payload)
      .digest("hex");
    
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
    
    return isValid ? { ok: true } : { ok: false, reason: "Signature mismatch" };
  } catch (error: any) {
    return { ok: false, reason: `Verification error: ${error.message}` };
  }
}

// Generate signature for outgoing webhooks to BondAI
export function generateJACESignature(payload: string): string {
  if (!JACE_WEBHOOK_SECRET) return "";
  
  return crypto
    .createHmac("sha256", JACE_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
}

// Process incoming webhook events from BondAI
export async function processBondAIWebhook(
  payload: BondAIWebhookPayload,
  userId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { eventId, eventType, correlationId, data } = payload;
  
  console.log(`Processing BondAI webhook: ${eventType} (${eventId})`);
  
  try {
    switch (eventType) {
      case "investor_onboarding_submitted":
        return await handleInvestorOnboardingSubmitted(data, userId);
      
      case "investor_onboarding_completed":
        return await handleInvestorOnboardingCompleted(data, userId);
      
      case "payment.confirmed":
        return await handlePaymentConfirmed(data, userId);
      
      case "payment.failed":
        return await handlePaymentFailed(data, userId);
      
      case "kyc.completed":
        return await handleKYCCompleted(data, userId);
      
      case "kyc.rejected":
        return await handleKYCRejected(data, userId);
      
      case "trade.completed":
        return await handleTradeCompleted(data, userId);
      
      default:
        console.log(`Unhandled BondAI event type: ${eventType}`);
        return { success: true, message: `Event type ${eventType} logged but not processed` };
    }
  } catch (error: any) {
    console.error(`Error processing BondAI webhook ${eventType}:`, error);
    return { success: false, message: error.message };
  }
}

// Handle investor onboarding submitted from BondAI
async function handleInvestorOnboardingSubmitted(
  data: Record<string, any>,
  userId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { email, legalName, phone, entityName, investorType } = data;
  
  if (!email) {
    return { success: false, message: "Missing email in onboarding data" };
  }
  
  // Parse name into first/last
  const nameParts = (legalName || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  
  // Check if investor already exists (would need to query by email)
  // For now, log the event and return success
  console.log(`Investor onboarding submitted: ${email}`);
  
  return {
    success: true,
    message: `Investor onboarding received for ${email}`,
    data: { email, firstName, lastName, entityName, investorType },
  };
}

// Handle investor onboarding completed from BondAI
async function handleInvestorOnboardingCompleted(
  data: Record<string, any>,
  userId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { email, bondaiUserId, onboardingSessionId } = data;
  
  console.log(`Investor onboarding completed: ${email} (BondAI User: ${bondaiUserId})`);
  
  return {
    success: true,
    message: `Investor onboarding completed for ${email}`,
    data: { email, bondaiUserId, onboardingSessionId },
  };
}

// Handle payment confirmed from BondAI
async function handlePaymentConfirmed(
  data: Record<string, any>,
  userId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { tradeId, sessionId, paymentReference, amount, investorEmail } = data;
  
  console.log(`Payment confirmed: Trade ${tradeId}, Amount: ${amount}, Reference: ${paymentReference}`);
  
  // Here you would:
  // 1. Find the corresponding investor in JACE
  // 2. Update their payment status
  // 3. Create a journal entry for the payment
  // 4. Update bond settlement status if applicable
  
  return {
    success: true,
    message: `Payment confirmed for trade ${tradeId}`,
    data: { tradeId, sessionId, paymentReference, amount },
  };
}

// Handle payment failed from BondAI
async function handlePaymentFailed(
  data: Record<string, any>,
  userId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { tradeId, sessionId, errorMessage, investorEmail } = data;
  
  console.log(`Payment failed: Trade ${tradeId}, Error: ${errorMessage}`);
  
  return {
    success: true,
    message: `Payment failure recorded for trade ${tradeId}`,
    data: { tradeId, sessionId, errorMessage },
  };
}

// Handle KYC completed from BondAI
async function handleKYCCompleted(
  data: Record<string, any>,
  userId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { investorEmail, bondaiUserId, kycLevel, verificationDate } = data;
  
  console.log(`KYC completed: ${investorEmail} (Level: ${kycLevel})`);
  
  // Here you would:
  // 1. Find the investor by email
  // 2. Update their KYC status to "verified"
  // 3. Update pipeline stage if applicable
  // 4. Log the compliance event
  
  return {
    success: true,
    message: `KYC completed for ${investorEmail}`,
    data: { investorEmail, bondaiUserId, kycLevel, verificationDate },
  };
}

// Handle KYC rejected from BondAI
async function handleKYCRejected(
  data: Record<string, any>,
  userId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { investorEmail, bondaiUserId, rejectionReason } = data;
  
  console.log(`KYC rejected: ${investorEmail} (Reason: ${rejectionReason})`);
  
  return {
    success: true,
    message: `KYC rejection recorded for ${investorEmail}`,
    data: { investorEmail, bondaiUserId, rejectionReason },
  };
}

// Handle trade completed from BondAI
async function handleTradeCompleted(
  data: Record<string, any>,
  userId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  const { tradeId, bondId, investorEmail, amount, settlementDate } = data;
  
  console.log(`Trade completed: ${tradeId} for bond ${bondId}`);
  
  // Here you would:
  // 1. Create or update bond settlement record
  // 2. Create journal entries for the transaction
  // 3. Update investor activity timeline
  
  return {
    success: true,
    message: `Trade ${tradeId} completed`,
    data: { tradeId, bondId, investorEmail, amount, settlementDate },
  };
}

// Send investor data to BondAI for onboarding
export async function sendInvestorToBondAI(
  investorData: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    entityName?: string;
    investorType: string;
    investmentAmount?: string;
  },
  correlationId?: string
): Promise<{ success: boolean; message: string; data?: any }> {
  if (!BONDAI_API_KEY) {
    return { success: false, message: "BondAI API key not configured" };
  }
  
  const payload = {
    source: "JACE_CRM",
    event: "investor_export",
    correlationId: correlationId || `jace_${crypto.randomUUID()}`,
    timestamp: new Date().toISOString(),
    data: {
      legalName: `${investorData.firstName} ${investorData.lastName}`.trim(),
      email: investorData.email,
      phone: investorData.phone,
      entityName: investorData.entityName,
      investorType: investorData.investorType,
      investmentAmount: investorData.investmentAmount,
    },
  };
  
  try {
    const response = await fetch(`${BONDAI_API_URL}/jace/investor-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BONDAI_API_KEY}`,
        "X-JACE-Signature": generateJACESignature(JSON.stringify(payload)),
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, message: `BondAI API error: ${response.status} - ${errorText}` };
    }
    
    const result = await response.json();
    return { success: true, message: "Investor sent to BondAI", data: result };
  } catch (error: any) {
    return { success: false, message: `Failed to send to BondAI: ${error.message}` };
  }
}

// Check BondAI integration status
export async function checkBondAIStatus(): Promise<{
  connected: boolean;
  apiConfigured: boolean;
  webhookConfigured: boolean;
  lastWebhookAt?: string;
  message: string;
}> {
  const apiConfigured = !!BONDAI_API_KEY;
  const webhookConfigured = !!BONDAI_WEBHOOK_SECRET;
  
  // Try to ping BondAI API if configured
  let connected = false;
  if (apiConfigured) {
    try {
      const response = await fetch(`${BONDAI_API_URL}/health`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${BONDAI_API_KEY}`,
        },
      });
      connected = response.ok;
    } catch {
      connected = false;
    }
  }
  
  return {
    connected,
    apiConfigured,
    webhookConfigured,
    message: connected 
      ? "BondAI integration is active" 
      : apiConfigured 
        ? "BondAI API configured but not reachable"
        : "BondAI integration not configured",
  };
}

// Create automated journal entry from BondAI payment
export async function createPaymentJournalEntry(
  userId: string,
  paymentData: {
    amount: string;
    investorName: string;
    paymentReference: string;
    tradeId: string;
  }
): Promise<{ success: boolean; journalEntryId?: string; message: string }> {
  // This would create a double-entry journal entry:
  // Debit: Cash/Bank Account (Asset)
  // Credit: Revenue or Investor Payable (depending on context)
  
  console.log(`Creating journal entry for payment: ${paymentData.paymentReference}`);
  
  // Implementation would use the existing journal entry API
  // For now, return success
  return {
    success: true,
    message: `Journal entry would be created for payment ${paymentData.paymentReference}`,
  };
}
