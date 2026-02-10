import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToStream } from "@react-pdf/renderer";
import type { Readable } from "stream";

export type RenderSettlementComplianceArgs = {
  complianceId: string;
  sessionId: string;
  tradeId: number;
  bondName?: string | null;
  amount: number;
  investorEmail?: string | null;

  entityType: string;
  entityLegalName: string;
  taxIdType: string;
  taxIdLast4: string;

  accreditedInvestor: boolean;
  privatePartyAck: boolean;
  holdHarmlessAck: boolean;
  setExchangeAck: boolean;

  authorizationSignedAtISO: string;
  signatureName: string;
  signatureMethod: string;

  creditProvider: string;
  creditReference: string;

  createdAtISO: string;
  ipAddress: string;
  userAgent: string;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 14 },
  h1: { fontSize: 16, marginBottom: 6, fontWeight: "bold" },
  sub: { fontSize: 9, color: "#555" },
  box: { borderWidth: 1, borderColor: "#333", padding: 10, marginTop: 12, backgroundColor: "#f9f9f9" },
  label: { fontSize: 9, color: "#222", fontWeight: "bold" },
  value: { fontSize: 10, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  section: { marginTop: 10 },
  footer: { position: "absolute", bottom: 18, left: 28, right: 28, fontSize: 8, color: "#666", textAlign: "center" },
});

function formatUSD(amount: number): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function yesNo(v: boolean): string {
  return v ? "YES" : "NO";
}

function ComplianceTemplate(a: RenderSettlementComplianceArgs) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>Settlement Compliance Gate</Text>
          <Text style={styles.sub}>JACE CRM • Investor Attestation + Identity + Credit Authorization</Text>
          <Text style={styles.sub}>Compliance ID: {a.complianceId}</Text>
          <Text style={styles.sub}>Generated: {a.createdAtISO}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.label}>Trade & Settlement</Text>
          <View style={{ height: 8 }} />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Trade ID</Text>
              <Text style={styles.value}>{a.tradeId}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Session ID</Text>
              <Text style={styles.value}>{a.sessionId}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Bond</Text>
              <Text style={styles.value}>{a.bondName || "Bond Purchase"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.value}>{formatUSD(a.amount)}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Investor Email</Text>
            <Text style={styles.value}>{a.investorEmail || "n/a"}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Purchasing Entity</Text>
            <Text style={styles.value}>Entity Type: {a.entityType.toUpperCase()}</Text>
            <Text style={styles.value}>Legal Name: {a.entityLegalName}</Text>
            <Text style={styles.value}>Tax ID Type: {a.taxIdType} (Last 4: {a.taxIdLast4})</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Attestations</Text>
            <Text style={styles.value}>Accredited Investor: {yesNo(a.accreditedInvestor)}</Text>
            <Text style={styles.value}>Private Party Acknowledgment: {yesNo(a.privatePartyAck)}</Text>
            <Text style={styles.value}>Hold Harmless Agreement: {yesNo(a.holdHarmlessAck)}</Text>
            <Text style={styles.value}>Set Exchange Consent (EIN/SSN tracking for IRS): {yesNo(a.setExchangeAck)}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Credit Authorization (Tri-Merge)</Text>
            <Text style={styles.value}>Authorized At (ISO): {a.authorizationSignedAtISO}</Text>
            <Text style={styles.value}>Signature Name: {a.signatureName}</Text>
            <Text style={styles.value}>Signature Method: {a.signatureMethod}</Text>
            <Text style={styles.value}>Provider: {a.creditProvider || "(upload/manual)"}</Text>
            <Text style={styles.value}>Reference: {a.creditReference || "(upload/manual)"}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Audit Metadata</Text>
            <Text style={styles.value}>IP Address: {a.ipAddress || "n/a"}</Text>
            <Text style={styles.value}>User Agent: {a.userAgent || "n/a"}</Text>
          </View>
        </View>

        <Text style={styles.footer}>
          This document captures investor-provided compliance data for settlement processing. It is not legal, tax, or investment advice. • Generated by JACE CRM
        </Text>
      </Page>
    </Document>
  );
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

export async function renderSettlementCompliancePdf(args: RenderSettlementComplianceArgs): Promise<Buffer> {
  const pdfStream = await renderToStream(<ComplianceTemplate {...args} />);
  const buffer = await streamToBuffer(pdfStream as unknown as Readable);
  return buffer;
}
