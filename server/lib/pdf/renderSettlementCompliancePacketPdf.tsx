import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToStream } from "@react-pdf/renderer";
import type { Readable } from "stream";

export type RenderSettlementCompliancePacketArgs = {
  sessionId: string;
  tradeId: number;
  bondName?: string | null;
  amount: number;
  investorEmail?: string | null;
  entityType?: string | null;
  legalName?: string | null;
  taxIdType?: string | null;
  taxIdLast4?: string | null;
  idPrimaryOriginalName?: string | null;
  idSecondaryOriginalName?: string | null;
  creditReportStatus?: string | null;
  creditReportOriginalName?: string | null;
  creditReportRequestedAt?: string | null;
  creditReportCompletedAt?: string | null;
  creditAuthorizationSigned?: boolean;
  creditAuthorizationSignedAt?: string | null;
  accreditedInvestorAttested?: boolean;
  accreditedInvestorSignedAt?: string | null;
  holdHarmlessSigned?: boolean;
  holdHarmlessSignedAt?: string | null;
  privatePartySelfDirected?: boolean;
  privatePartySelfDirectedSignedAt?: string | null;
  signatureName?: string | null;
  signatureIp?: string | null;
  completedAt?: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 16 },
  h1: { fontSize: 16, marginBottom: 6, fontWeight: "bold" },
  sub: { fontSize: 9, color: "#555" },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 12, fontWeight: "bold", marginBottom: 6, borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 4 },
  label: { fontSize: 9, color: "#222", fontWeight: "bold" },
  value: { fontSize: 10, marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  box: { borderWidth: 1, borderColor: "#333", padding: 10, marginTop: 12, backgroundColor: "#f9f9f9" },
  attestationRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4, gap: 8 },
  footer: { position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 8, color: "#666", textAlign: "center" },
});

function formatUSD(amount: number): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function formatTaxId(taxIdType?: string | null, taxIdLast4?: string | null): string {
  if (!taxIdLast4) return "n/a";
  const t = (taxIdType || "").toUpperCase();
  if (t === "SSN") return `***-**-${taxIdLast4}`;
  if (t === "EIN") return `**-***${taxIdLast4}`;
  return `****${taxIdLast4}`;
}

function formatSignedStatus(signed?: boolean): string {
  return signed ? "Signed" : "Not Signed";
}

function SettlementCompliancePacketTemplate(a: RenderSettlementCompliancePacketArgs) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>JACE Management, LLC - Settlement Compliance Packet</Text>
          <Text style={styles.sub}>Session ID: {a.sessionId}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>Settlement Details</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Session ID</Text>
              <Text style={styles.value}>{a.sessionId}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Trade ID</Text>
              <Text style={styles.value}>{a.tradeId}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Bond Name</Text>
              <Text style={styles.value}>{a.bondName || "n/a"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Amount</Text>
              <Text style={styles.value}>{formatUSD(a.amount)}</Text>
            </View>
          </View>

          <Text style={styles.label}>Investor Email</Text>
          <Text style={styles.value}>{a.investorEmail || "n/a"}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>Purchaser Entity</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Entity Type</Text>
              <Text style={styles.value}>{a.entityType || "n/a"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Legal Name</Text>
              <Text style={styles.value}>{a.legalName || "n/a"}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tax ID Type</Text>
              <Text style={styles.value}>{a.taxIdType || "n/a"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Tax ID (Last 4)</Text>
              <Text style={styles.value}>{formatTaxId(a.taxIdType, a.taxIdLast4)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>Identification Documents</Text>

          <Text style={styles.label}>Primary ID</Text>
          <Text style={styles.value}>{a.idPrimaryOriginalName || "Not provided"}</Text>

          <Text style={styles.label}>Secondary ID</Text>
          <Text style={styles.value}>{a.idSecondaryOriginalName || "Not provided"}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>Credit Report</Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.value}>{a.creditReportStatus || "n/a"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Original File Name</Text>
              <Text style={styles.value}>{a.creditReportOriginalName || "n/a"}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Requested At</Text>
              <Text style={styles.value}>{a.creditReportRequestedAt || "n/a"}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Completed At</Text>
              <Text style={styles.value}>{a.creditReportCompletedAt || "n/a"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>Attestations</Text>

          <View style={styles.attestationRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Accredited Investor Attestation</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>{formatSignedStatus(a.accreditedInvestorAttested)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>{a.accreditedInvestorSignedAt || "n/a"}</Text>
            </View>
          </View>

          <View style={styles.attestationRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Hold Harmless Agreement</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>{formatSignedStatus(a.holdHarmlessSigned)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>{a.holdHarmlessSignedAt || "n/a"}</Text>
            </View>
          </View>

          <View style={styles.attestationRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Private Party / Self-Directed Acknowledgment</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>{formatSignedStatus(a.privatePartySelfDirected)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>{a.privatePartySelfDirectedSignedAt || "n/a"}</Text>
            </View>
          </View>

          <View style={styles.attestationRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Credit Report Authorization</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>{formatSignedStatus(a.creditAuthorizationSigned)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.value}>{a.creditAuthorizationSignedAt || "n/a"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>Signature</Text>

          <Text style={styles.label}>Signature Name</Text>
          <Text style={styles.value}>{a.signatureName || "n/a"}</Text>

          <Text style={styles.label}>Signature IP</Text>
          <Text style={styles.value}>{a.signatureIp || "n/a"}</Text>
        </View>

        <View style={styles.box}>
          <Text style={styles.sectionTitle}>Compliance Status</Text>

          <Text style={styles.label}>Completed At</Text>
          <Text style={styles.value}>{a.completedAt || "Pending"}</Text>
        </View>

        <Text style={styles.footer}>
          Generated: {new Date().toISOString()} {"\n"}This document is for internal use only.
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

export async function renderSettlementCompliancePacketPdf(data: RenderSettlementCompliancePacketArgs): Promise<Buffer> {
  const pdfStream = await renderToStream(<SettlementCompliancePacketTemplate {...data} />);
  const buffer = await streamToBuffer(pdfStream as unknown as Readable);
  return buffer;
}
