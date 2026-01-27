import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToStream } from "@react-pdf/renderer";
import type { Readable } from "stream";

type RenderLegalPdfArgs = {
  companyName: string;
  companyState: string;
  contactEmail: string;
  contactPhone: string;
  governingState: string;
  investorId: string;
  documentType: string;
  version: string;
  title: string;
  documentBody: string;
  signerName: string;
  signerEmail?: string | null;
  signerTitle?: string | null;
  signatureMethod: "TYPED" | "DRAWN";
  signatureValue?: string | null;
  consentSnapshot: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  signedAtISO: string;
  ip: string | null;
  userAgent: string | null;
  sessionId: string | null;
};

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 16 },
  h1: { fontSize: 14, marginBottom: 6, fontWeight: "bold" },
  h2: { fontSize: 11, marginTop: 12, marginBottom: 4, fontWeight: "bold" },
  p: { marginBottom: 4, lineHeight: 1.4 },
  meta: { fontSize: 9, color: "#444", marginBottom: 2 },
  box: { borderWidth: 1, borderColor: "#333", padding: 10, marginTop: 12, backgroundColor: "#f9f9f9" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 9, color: "#222", fontWeight: "bold" },
  mono: { fontSize: 8, fontFamily: "Courier" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#ccc", marginVertical: 8 },
  documentBody: { marginTop: 8, marginBottom: 12, whiteSpace: "pre-wrap" },
  footer: { position: "absolute", bottom: 20, left: 28, right: 28, fontSize: 8, color: "#666", textAlign: "center" },
});

function LegalPdfTemplate(a: RenderLegalPdfArgs) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>{a.title}</Text>
          <Text style={styles.meta}>
            {a.companyName} ({a.companyState}) | {a.contactEmail} | {a.contactPhone}
          </Text>
          <Text style={styles.meta}>
            Document Type: {a.documentType} | Version: {a.version} | Governing Law: {a.governingState}
          </Text>
        </View>

        <View style={styles.divider} />

        <Text style={styles.h2}>Document Content</Text>
        <View style={styles.documentBody}>
          {a.documentBody.split("\n").map((line, idx) => (
            <Text key={idx} style={styles.p}>{line}</Text>
          ))}
        </View>

        <View style={styles.box}>
          <Text style={styles.h2}>Electronic Signature</Text>
          <View style={styles.divider} />
          
          <Text style={styles.p}>Signer Name: {a.signerName}</Text>
          {a.signerEmail && <Text style={styles.p}>Signer Email: {a.signerEmail}</Text>}
          {a.signerTitle && <Text style={styles.p}>Title: {a.signerTitle}</Text>}
          <Text style={styles.p}>Signature Method: {a.signatureMethod}</Text>
          {a.signatureValue && a.signatureMethod === "TYPED" && (
            <Text style={[styles.p, { fontStyle: "italic", fontSize: 12 }]}>
              Signature: {a.signatureValue}
            </Text>
          )}

          <View style={styles.divider} />
          
          <Text style={styles.label}>Audit Trail</Text>
          <Text style={styles.mono}>Signed At (ISO): {a.signedAtISO}</Text>
          <Text style={styles.mono}>IP Address: {a.ip ?? "n/a"}</Text>
          <Text style={styles.mono}>User Agent: {(a.userAgent ?? "n/a").substring(0, 80)}...</Text>
          <Text style={styles.mono}>Session ID: {a.sessionId ?? "n/a"}</Text>
          <Text style={styles.mono}>Investor ID: {a.investorId}</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.label}>Consent Snapshot</Text>
          <Text style={styles.mono}>{JSON.stringify(a.consentSnapshot)}</Text>
        </View>

        <Text style={styles.footer}>
          This document was electronically signed and is legally binding. | {a.companyName} | This is for persons in the US only.
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

export async function renderLegalPdf(args: RenderLegalPdfArgs): Promise<Buffer> {
  const pdfStream = await renderToStream(<LegalPdfTemplate {...args} />);
  const buffer = await streamToBuffer(pdfStream as unknown as Readable);
  return buffer;
}
