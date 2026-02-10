import { storage } from "../storage";
import type { ToolContext } from "./types";

// IMPORTANT: This tool is deliberately constrained to a safe allowlist of storage methods.
// If you want to expose more DB reads/writes, add explicit method names below.
const READ_METHODS = new Set<string>([
  "getInvestor",
  "getInvestors",
  "getInvestorCompliance",
  "getInvestorPortalUser",
  "getInvestorPortalUserByEmail",
  "getInvestorPortalUserByInvestor",
  "getBondSettlement",
  "getBondSettlements",
  "getCommunications",
  "getCommunicationsByInvestor",
  "getDocumentsByInvestor",
  "getEmailLogsByInvestor",
  "getUserRole",
  "getAllUserRoles"
]);

const WRITE_METHODS = new Set<string>([
  "createAuditLog",
  "createInvestor",
  "updateInvestor",
  "createCommunication",
  "updateBondSettlement",
  "createBondSettlement",
  "updateInvestorCompliance",
  "setUserRole",
  "updateUserRole",
  "createDocument"
]);

type DbToolArgs = {
  method: string;
  params?: any[];
};

export async function dbRead(args: DbToolArgs, _ctx: ToolContext) {
  const method = args?.method;
  const params = Array.isArray(args?.params) ? args.params : [];

  if (!method || typeof method !== "string") {
    throw new Error("dbRead: method is required");
  }
  if (!READ_METHODS.has(method)) {
    throw new Error(`dbRead: method not allowed: ${method}`);
  }

  // @ts-expect-error dynamic method call on storage
  const fn = storage[method];
  if (typeof fn !== "function") {
    throw new Error(`dbRead: unknown storage method: ${method}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return await fn.apply(storage, params);
}

export async function dbWrite(args: DbToolArgs, _ctx: ToolContext) {
  const method = args?.method;
  const params = Array.isArray(args?.params) ? args.params : [];

  if (!method || typeof method !== "string") {
    throw new Error("dbWrite: method is required");
  }
  if (!WRITE_METHODS.has(method)) {
    throw new Error(`dbWrite: method not allowed: ${method}`);
  }

  // @ts-expect-error dynamic method call on storage
  const fn = storage[method];
  if (typeof fn !== "function") {
    throw new Error(`dbWrite: unknown storage method: ${method}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return await fn.apply(storage, params);
}
