import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { AuditLog } from "@shared/schema";

type Step = "upload" | "preview" | "import";

interface ColumnMapping {
  csvColumn: string;
  mappedTo: string;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

const INVESTOR_FIELDS = [
  { value: "firstName", label: "First Name", required: true },
  { value: "lastName", label: "Last Name", required: true },
  { value: "email", label: "Email", required: true },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "investorType", label: "Investor Type" },
  { value: "pipelineStage", label: "Pipeline Stage" },
  { value: "investmentAmount", label: "Investment Amount" },
  { value: "notes", label: "Notes" },
  { value: "skip", label: "-- Skip Column --" },
];

const COLUMN_NAME_MAPPINGS: Record<string, string> = {
  "first name": "firstName",
  "firstname": "firstName",
  "first_name": "firstName",
  "last name": "lastName",
  "lastname": "lastName",
  "last_name": "lastName",
  "email": "email",
  "email address": "email",
  "phone": "phone",
  "phone number": "phone",
  "telephone": "phone",
  "company": "company",
  "company name": "company",
  "organization": "company",
  "investor type": "investorType",
  "investortype": "investorType",
  "investor_type": "investorType",
  "type": "investorType",
  "pipeline stage": "pipelineStage",
  "pipelinestage": "pipelineStage",
  "pipeline_stage": "pipelineStage",
  "stage": "pipelineStage",
  "status": "pipelineStage",
  "investment amount": "investmentAmount",
  "investmentamount": "investmentAmount",
  "investment_amount": "investmentAmount",
  "amount": "investmentAmount",
  "investment": "investmentAmount",
  "notes": "notes",
  "note": "notes",
  "comments": "notes",
};

function autoDetectMapping(csvColumn: string): string {
  const normalized = csvColumn.toLowerCase().trim();
  return COLUMN_NAME_MAPPINGS[normalized] || "skip";
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseRow = (row: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);

  return { headers, rows };
}

function generateSampleCSV(): string {
  const headers = ["First Name", "Last Name", "Email", "Phone", "Company", "Investor Type", "Pipeline Stage", "Investment Amount", "Notes"];
  const sampleData = [
    ["John", "Doe", "john.doe@example.com", "+1-555-123-4567", "Acme Corp", "individual", "lead", "50000", "Interested in Series A"],
    ["Jane", "Smith", "jane.smith@example.com", "+1-555-987-6543", "Tech Ventures", "institutional", "contacted", "100000", "Follow up next week"],
    ["Bob", "Johnson", "bob.johnson@example.com", "", "Capital Partners", "fund", "kyc_pending", "250000", "KYC documents pending"],
  ];

  const csvContent = [headers.join(","), ...sampleData.map((row) => row.map((cell) => `"${cell}"`).join(","))].join("\n");
  return csvContent;
}

export default function ImportPage() {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importProgress, setImportProgress] = useState(0);

  const { data: auditLogs } = useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs"],
  });

  const importHistory = auditLogs?.filter(
    (log) => log.entityType === "import" || log.description?.toLowerCase().includes("import")
  ).slice(0, 10);

  const importMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/import/investors", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Import failed");
      }
      return response.json();
    },
    onSuccess: (data: ImportResult) => {
      setImportResult(data);
      setImportProgress(100);
      queryClient.invalidateQueries({ queryKey: ["/api/investors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
      toast({
        title: "Import Complete",
        description: `Successfully imported ${data.success} investor(s)`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive",
      });
      setImportProgress(0);
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast({
        title: "Invalid File",
        description: "Please select a CSV file",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0) {
        toast({
          title: "Invalid CSV",
          description: "The CSV file appears to be empty",
          variant: "destructive",
        });
        return;
      }

      setCsvHeaders(headers);
      setCsvRows(rows);

      const initialMappings = headers.map((header) => ({
        csvColumn: header,
        mappedTo: autoDetectMapping(header),
      }));
      setColumnMappings(initialMappings);
    };
    reader.readAsText(selectedFile);
  }, [toast]);

  const handleDownloadTemplate = () => {
    const csv = generateSampleCSV();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "investor_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleMappingChange = (csvColumn: string, mappedTo: string) => {
    setColumnMappings((prev) =>
      prev.map((m) => (m.csvColumn === csvColumn ? { ...m, mappedTo } : m))
    );
  };

  const handleStartImport = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mappings", JSON.stringify(columnMappings));

    setImportProgress(10);
    importMutation.mutate(formData);
  };

  const handleReset = () => {
    setStep("upload");
    setFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setColumnMappings([]);
    setImportResult(null);
    setImportProgress(0);
  };

  const canProceedToPreview = file && csvHeaders.length > 0;
  const hasRequiredMappings = columnMappings.some((m) => m.mappedTo === "firstName") &&
    columnMappings.some((m) => m.mappedTo === "lastName") &&
    columnMappings.some((m) => m.mappedTo === "email");

  const previewRows = csvRows.slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Data Import</h1>
          <p className="text-muted-foreground">Import investors from CSV files</p>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            1
          </div>
          <span className={step === "upload" ? "font-medium" : "text-muted-foreground"}>Upload</span>
        </div>
        <div className="h-px w-8 bg-border" />
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === "preview" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            2
          </div>
          <span className={step === "preview" ? "font-medium" : "text-muted-foreground"}>Preview</span>
        </div>
        <div className="h-px w-8 bg-border" />
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${step === "import" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            3
          </div>
          <span className={step === "import" ? "font-medium" : "text-muted-foreground"}>Import</span>
        </div>
      </div>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload CSV File
            </CardTitle>
            <CardDescription>
              Select a CSV file containing investor data to import
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Drag and drop your CSV file here, or click to browse
                </p>
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="max-w-xs mx-auto"
                  data-testid="input-file-upload"
                />
              </div>
              {file && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span data-testid="text-selected-file">{file.name}</span>
                  <Badge variant="secondary">{csvRows.length} rows</Badge>
                </div>
              )}
            </div>

            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h4 className="font-medium">Expected Format</h4>
              <p className="text-sm text-muted-foreground">
                Your CSV should include columns for investor information. Required fields are:
                <strong> First Name, Last Name, and Email</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                Optional fields include: Phone, Company, Investor Type, Pipeline Stage, Investment Amount, and Notes.
              </p>
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} data-testid="button-download-template">
                <Download className="h-4 w-4 mr-2" />
                Download Sample Template
              </Button>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => setStep("preview")}
                disabled={!canProceedToPreview}
                data-testid="button-next-preview"
              >
                Next: Preview Data
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Preview & Map Columns
            </CardTitle>
            <CardDescription>
              Review your data and configure column mappings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium mb-3">Column Mapping</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Map each CSV column to the corresponding investor field. Required fields are marked with an asterisk (*).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {columnMappings.map((mapping) => (
                  <div key={mapping.csvColumn} className="flex items-center gap-2">
                    <span className="text-sm font-medium min-w-[100px] truncate" title={mapping.csvColumn}>
                      {mapping.csvColumn}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={mapping.mappedTo}
                      onValueChange={(value) => handleMappingChange(mapping.csvColumn, value)}
                    >
                      <SelectTrigger className="flex-1" data-testid={`select-mapping-${mapping.csvColumn.toLowerCase().replace(/\s+/g, "-")}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INVESTOR_FIELDS.map((field) => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label}{field.required && " *"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {!hasRequiredMappings && (
                <div className="mt-4 flex items-center gap-2 text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">Please map First Name, Last Name, and Email columns</span>
                </div>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-3">Data Preview (First 5 Rows)</h4>
              <div className="border rounded-lg overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {csvHeaders.map((header, idx) => (
                        <TableHead key={idx} className="whitespace-nowrap">
                          {header}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewRows.map((row, rowIdx) => (
                      <TableRow key={rowIdx} data-testid={`row-preview-${rowIdx}`}>
                        {row.map((cell, cellIdx) => (
                          <TableCell key={cellIdx} className="whitespace-nowrap">
                            {cell || <span className="text-muted-foreground italic">empty</span>}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Showing {previewRows.length} of {csvRows.length} rows
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back-upload">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={() => setStep("import")}
                disabled={!hasRequiredMappings}
                data-testid="button-next-import"
              >
                Next: Import
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "import" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {importResult ? (
                importResult.failed === 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                )
              ) : (
                <Upload className="h-5 w-5" />
              )}
              {importResult ? "Import Complete" : "Start Import"}
            </CardTitle>
            <CardDescription>
              {importResult
                ? `Processed ${csvRows.length} records`
                : `Ready to import ${csvRows.length} investor records`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!importResult && (
              <>
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Import Summary</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>File: {file?.name}</li>
                    <li>Total rows: {csvRows.length}</li>
                    <li>Mapped columns: {columnMappings.filter((m) => m.mappedTo !== "skip").length}</li>
                  </ul>
                </div>

                {importMutation.isPending && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Importing...</span>
                    </div>
                    <Progress value={importProgress} className="h-2" data-testid="progress-import" />
                  </div>
                )}

                <div className="flex justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setStep("preview")}
                    disabled={importMutation.isPending}
                    data-testid="button-back-preview"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button
                    onClick={handleStartImport}
                    disabled={importMutation.isPending}
                    data-testid="button-start-import"
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Start Import
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}

            {importResult && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-4 text-center">
                    <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                    <div className="text-2xl font-bold text-green-600" data-testid="text-success-count">
                      {importResult.success}
                    </div>
                    <div className="text-sm text-muted-foreground">Successfully Imported</div>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4 text-center">
                    <AlertCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
                    <div className="text-2xl font-bold text-red-600" data-testid="text-failed-count">
                      {importResult.failed}
                    </div>
                    <div className="text-sm text-muted-foreground">Failed</div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">Errors</h4>
                    <ul className="text-sm text-red-700 dark:text-red-300 space-y-1 max-h-40 overflow-auto">
                      {importResult.errors.map((error, idx) => (
                        <li key={idx} data-testid={`text-error-${idx}`}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex justify-end">
                  <Button onClick={handleReset} data-testid="button-import-another">
                    Import Another File
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {importHistory && importHistory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Import History</CardTitle>
            <CardDescription>Recent import activity</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importHistory.map((log) => (
                  <TableRow key={log.id} data-testid={`row-history-${log.id}`}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.action}</Badge>
                    </TableCell>
                    <TableCell>{log.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
