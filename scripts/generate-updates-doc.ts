import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, BorderStyle, Table, TableRow, TableCell, WidthType } from "docx";
import { writeFileSync, readFileSync } from "fs";
import { execSync } from "child_process";

const gitLog = execSync(
  'git log --pretty=format:"%ai|%s|%b" --reverse',
  { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }
);

interface Entry {
  date: string;
  time: string;
  description: string;
  details: string;
}

const skipPatterns = [
  /^Saved progress/i,
  /^Published your App/i,
  /^Extracted stack files/i,
  /^Initial commit/i,
];

const entries: Entry[] = [];

for (const line of gitLog.split("\n")) {
  if (!line.trim()) continue;
  const parts = line.split("|");
  if (parts.length < 2) continue;

  const rawDate = parts[0].trim().replace(/^"/, "");
  const subject = parts[1].trim();
  const body = (parts.slice(2).join("|") || "").trim().replace(/"$/, "");

  if (skipPatterns.some((p) => p.test(subject))) continue;

  const dateObj = new Date(rawDate);
  const dateStr = dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Denver",
  });
  const timeStr = dateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Denver",
    hour12: true,
  });

  entries.push({
    date: dateStr,
    time: timeStr,
    description: subject,
    details: body,
  });
}

const categoryMap: Record<string, string[]> = {};
for (const e of entries) {
  if (!categoryMap[e.date]) categoryMap[e.date] = [];
}

const tableRows: TableRow[] = [
  new TableRow({
    tableHeader: true,
    children: [
      new TableCell({
        width: { size: 1800, type: WidthType.DXA },
        shading: { fill: "1a365d" },
        children: [new Paragraph({ children: [new TextRun({ text: "Date", bold: true, color: "ffffff", size: 22, font: "Calibri" })] })],
      }),
      new TableCell({
        width: { size: 1200, type: WidthType.DXA },
        shading: { fill: "1a365d" },
        children: [new Paragraph({ children: [new TextRun({ text: "Time (MT)", bold: true, color: "ffffff", size: 22, font: "Calibri" })] })],
      }),
      new TableCell({
        width: { size: 6600, type: WidthType.DXA },
        shading: { fill: "1a365d" },
        children: [new Paragraph({ children: [new TextRun({ text: "Update / Improvement", bold: true, color: "ffffff", size: 22, font: "Calibri" })] })],
      }),
    ],
  }),
];

let rowIndex = 0;
for (const entry of entries) {
  const fill = rowIndex % 2 === 0 ? "f7fafc" : "ffffff";
  tableRows.push(
    new TableRow({
      children: [
        new TableCell({
          shading: { fill },
          children: [new Paragraph({ children: [new TextRun({ text: entry.date, size: 20, font: "Calibri" })] })],
        }),
        new TableCell({
          shading: { fill },
          children: [new Paragraph({ children: [new TextRun({ text: entry.time, size: 20, font: "Calibri" })] })],
        }),
        new TableCell({
          shading: { fill },
          children: [new Paragraph({ children: [new TextRun({ text: entry.description, size: 20, font: "Calibri" })] })],
        }),
      ],
    })
  );
  rowIndex++;
}

const table = new Table({
  rows: tableRows,
  width: { size: 9600, type: WidthType.DXA },
});

const categorized: Record<string, Entry[]> = {};
for (const e of entries) {
  let cat = "General";
  const d = e.description.toLowerCase();
  if (d.includes("security") || d.includes("audit") || d.includes("hardening") || d.includes("validation")) cat = "Security & Compliance";
  else if (d.includes("settlement") || d.includes("escrow")) cat = "Settlement & Escrow";
  else if (d.includes("webhook") || d.includes("bondai") || d.includes("jace integration") || d.includes("jace webhook")) cat = "BondAI Integration & Webhooks";
  else if (d.includes("onboarding") || d.includes("signature") || d.includes("legal") || d.includes("compliance") || d.includes("kyc") || d.includes("privacy")) cat = "Onboarding & Legal Documents";
  else if (d.includes("stripe") || d.includes("payment") || d.includes("invoice") || d.includes("expense")) cat = "Payments & Invoicing";
  else if (d.includes("vendor")) cat = "Vendor Management";
  else if (d.includes("assignment") || d.includes("payout")) cat = "Assignments & Payouts";
  else if (d.includes("agent") || d.includes("ai") || d.includes("voice") || d.includes("chat") || d.includes("assistant")) cat = "AI & Voice Assistant";
  else if (d.includes("auth") || d.includes("login") || d.includes("registration") || d.includes("invite") || d.includes("pin") || d.includes("admin")) cat = "Authentication & User Management";
  else if (d.includes("database") || d.includes("migration") || d.includes("schema") || d.includes("table")) cat = "Database & Schema";
  else if (d.includes("publish") || d.includes("deploy")) cat = "Deployment";
  else if (d.includes("ui") || d.includes("page") || d.includes("route") || d.includes("button") || d.includes("color") || d.includes("scroll") || d.includes("sidebar") || d.includes("navigation") || d.includes("dashboard")) cat = "UI/UX Improvements";

  if (!categorized[cat]) categorized[cat] = [];
  categorized[cat].push(e);
}

const summaryParagraphs: Paragraph[] = [];
for (const [cat, items] of Object.entries(categorized).sort()) {
  summaryParagraphs.push(
    new Paragraph({
      spacing: { before: 240, after: 80 },
      children: [new TextRun({ text: `${cat} (${items.length} updates)`, bold: true, size: 24, font: "Calibri", color: "1a365d" })],
    })
  );
  for (const item of items) {
    summaryParagraphs.push(
      new Paragraph({
        bullet: { level: 0 },
        children: [
          new TextRun({ text: `${item.date}, ${item.time}: `, bold: true, size: 20, font: "Calibri" }),
          new TextRun({ text: item.description, size: 20, font: "Calibri" }),
        ],
      })
    );
  }
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: "Calibri", size: 22 },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new TextRun({
              text: "JACE CRM",
              bold: true,
              size: 40,
              font: "Calibri",
              color: "1a365d",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: "Updates & Improvements Log",
              bold: true,
              size: 32,
              font: "Calibri",
              color: "2d3748",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: "JACE Management, LLC",
              size: 24,
              font: "Calibri",
              color: "718096",
            }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          children: [
            new TextRun({
              text: `Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "America/Denver" })} | Total Updates: ${entries.length}`,
              size: 22,
              font: "Calibri",
              color: "a0aec0",
            }),
          ],
        }),

        new Paragraph({
          spacing: { before: 400, after: 200 },
          children: [
            new TextRun({
              text: "Summary by Category",
              bold: true,
              size: 28,
              font: "Calibri",
              color: "1a365d",
            }),
          ],
        }),
        ...summaryParagraphs,

        new Paragraph({
          spacing: { before: 600, after: 200 },
          children: [
            new TextRun({
              text: "Detailed Chronological Log",
              bold: true,
              size: 28,
              font: "Calibri",
              color: "1a365d",
            }),
          ],
        }),
        table,

        new Paragraph({
          spacing: { before: 600 },
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: "--- End of Report ---",
              size: 20,
              font: "Calibri",
              color: "a0aec0",
              italics: true,
            }),
          ],
        }),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const outPath = "JACE_CRM_Updates_Log.docx";
  writeFileSync(outPath, buffer);
  console.log(`Word document generated: ${outPath}`);
  console.log(`Total updates included: ${entries.length}`);
  console.log(`Categories: ${Object.keys(categorized).length}`);
});
