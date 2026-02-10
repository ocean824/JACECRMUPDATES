import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Building,
  Mail,
  FileText,
  Shield,
  Phone,
  DollarSign,
  TrendingUp,
  Download,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Eye,
  Users,
  CreditCard,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  Investor,
  BondSettlement,
  Document,
  Communication,
  KycChecklistItem,
} from "@shared/schema";
import {
  pipelineStages,
  investorTypes,
  bondStatuses,
  kycItemStatuses,
  communicationTypes,
} from "@shared/schema";

const pipelineColors: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  contacted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  kyc_pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  documents: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  closed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

const kycStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  approved: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const bondStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  settled: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  matured: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function formatCurrency(amount: string | number | null | undefined): string {
  if (!amount) return "-";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatDate(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return "-";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatDateTime(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return "-";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function KycStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "submitted":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "rejected":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
  }
}

function InvestorProfileCard({ investor }: { investor: Investor }) {
  const pipelineStage = pipelineStages.find((s) => s.value === investor.pipelineStage);
  const investorType = investorTypes.find((t) => t.value === investor.investorType);

  return (
    <Card data-testid="card-investor-profile">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <User className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl" data-testid="text-investor-name">
              {investor.firstName} {investor.lastName}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Badge className={pipelineColors[investor.pipelineStage] || ""} variant="secondary">
                {pipelineStage?.label || investor.pipelineStage}
              </Badge>
              {investorType && (
                <Badge variant="outline">{investorType.label}</Badge>
              )}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-3 text-sm">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span data-testid="text-investor-email">{investor.email}</span>
        </div>
        {investor.phone && (
          <div className="flex items-center gap-3 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span data-testid="text-investor-phone">{investor.phone}</span>
          </div>
        )}
        {investor.company && (
          <div className="flex items-center gap-3 text-sm">
            <Building className="h-4 w-4 text-muted-foreground" />
            <span data-testid="text-investor-company">{investor.company}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InvestmentSummaryCard({ investor }: { investor: Investor }) {
  const investorType = investorTypes.find((t) => t.value === investor.investorType);

  return (
    <Card data-testid="card-investment-summary">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Investment Summary</CardTitle>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Investment Amount</p>
            <p className="text-2xl font-bold" data-testid="text-investment-amount">
              {formatCurrency(investor.investmentAmount)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Investor Type</p>
            <p className="text-lg font-medium" data-testid="text-investor-type">
              {investorType?.label || investor.investorType}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BondsTable({ investorId }: { investorId: string }) {
  const { data: bonds, isLoading } = useQuery<BondSettlement[]>({
    queryKey: ["/api/bond-settlements"],
  });

  const investorBonds = bonds?.filter((b) => b.investorId === investorId);

  if (isLoading) {
    return (
      <Card data-testid="card-bonds-loading">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-bonds">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Bond Holdings</CardTitle>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {!investorBonds || investorBonds.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No bonds associated with this investor
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bond Name</TableHead>
                <TableHead>ISIN</TableHead>
                <TableHead>Face Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Maturity Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investorBonds.map((bond) => {
                const status = bondStatuses.find((s) => s.value === bond.status);
                return (
                  <TableRow key={bond.id} data-testid={`row-bond-${bond.id}`}>
                    <TableCell className="font-medium">{bond.bondName}</TableCell>
                    <TableCell>{bond.isin || "-"}</TableCell>
                    <TableCell>{formatCurrency(bond.faceValue)}</TableCell>
                    <TableCell>
                      <Badge className={bondStatusColors[bond.status] || ""} variant="secondary">
                        {status?.label || bond.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(bond.maturityDate)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function DocumentsTable({ investorId }: { investorId: string }) {
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents", { investorId }],
  });

  const investorDocs = documents?.filter((d) => d.investorId === investorId);

  if (isLoading) {
    return (
      <Card data-testid="card-documents-loading">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-documents">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Documents</CardTitle>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {!investorDocs || investorDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No documents available
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investorDocs.map((doc) => (
                <TableRow key={doc.id} data-testid={`row-document-${doc.id}`}>
                  <TableCell className="font-medium">{doc.originalName}</TableCell>
                  <TableCell>
                    {doc.category ? (
                      <Badge variant="outline">{doc.category}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell>{formatDate(doc.createdAt)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      data-testid={`button-download-${doc.id}`}
                    >
                      <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

interface SettlementReceipt {
  sessionId: string;
  tradeId: number;
  bondName: string | null;
  amount: string;
  status: string;
  settledAt: string | null;
  createdAt: string;
  receiptDocumentId: string | null;
  journalEntryId: string | null;
  unitCount: string | null;
  assignmentType: string | null;
}

const settlementStatusColors: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  settled: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function SettlementReceiptsTable({ investorId }: { investorId: string }) {
  const { data: settlements, isLoading } = useQuery<SettlementReceipt[]>({
    queryKey: ["/api/investor-settlements", { investorId }],
  });

  const investorSettlements = settlements?.filter((s) => {
    // Filter by investorId through the API query parameter
    return true;
  }) || [];

  if (isLoading) {
    return (
      <Card data-testid="card-settlement-receipts-loading">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-settlement-receipts">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Settlement Receipts</CardTitle>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {!investorSettlements || investorSettlements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No settlement receipts
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trade ID</TableHead>
                <TableHead>Bond/Assignment</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Units</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Settled Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investorSettlements.map((settlement) => (
                <TableRow key={settlement.sessionId} data-testid={`row-settlement-${settlement.sessionId}`}>
                  <TableCell className="font-medium" data-testid={`text-trade-id-${settlement.tradeId}`}>
                    {settlement.tradeId}
                  </TableCell>
                  <TableCell data-testid={`text-bond-name-${settlement.sessionId}`}>
                    {settlement.bondName || settlement.assignmentType || "-"}
                  </TableCell>
                  <TableCell data-testid={`text-amount-${settlement.sessionId}`}>
                    {formatCurrency(settlement.amount)}
                  </TableCell>
                  <TableCell data-testid={`text-units-${settlement.sessionId}`}>
                    {settlement.unitCount || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      className={settlementStatusColors[settlement.status] || ""} 
                      variant="secondary"
                      data-testid={`badge-status-${settlement.sessionId}`}
                    >
                      {settlement.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-settled-date-${settlement.sessionId}`}>
                    {formatDate(settlement.settledAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {settlement.receiptDocumentId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          data-testid={`button-download-receipt-${settlement.sessionId}`}
                        >
                          <a 
                            href={`/api/admin/documents/${settlement.receiptDocumentId}/download`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {settlement.journalEntryId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          data-testid={`button-view-ledger-${settlement.sessionId}`}
                        >
                          <a href={`/journal`}>
                            <Eye className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CommunicationsLog({ investorId }: { investorId: string }) {
  const { data: communications, isLoading } = useQuery<Communication[]>({
    queryKey: ["/api/communications"],
  });

  const investorComms = communications
    ?.filter((c) => c.investorId === investorId)
    .slice(0, 10);

  if (isLoading) {
    return (
      <Card data-testid="card-communications-loading">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-communications">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Recent Communications</CardTitle>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {!investorComms || investorComms.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No communications logged
          </p>
        ) : (
          <div className="space-y-4">
            {investorComms.map((comm) => {
              const commType = communicationTypes.find((t) => t.value === comm.type);
              return (
                <div
                  key={comm.id}
                  className="border-l-2 border-muted pl-4 py-2"
                  data-testid={`item-communication-${comm.id}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs">
                      {commType?.label || comm.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(comm.contactedAt)}
                    </span>
                  </div>
                  {comm.subject && (
                    <p className="text-sm font-medium">{comm.subject}</p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {comm.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function KycChecklistCard({ investorId }: { investorId: string }) {
  const { data: kycItems, isLoading } = useQuery<KycChecklistItem[]>({
    queryKey: ["/api/kyc-checklist", { investorId }],
  });

  const investorKyc = kycItems?.filter((k) => k.investorId === investorId);

  if (isLoading) {
    return (
      <Card data-testid="card-kyc-loading">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const approved = investorKyc?.filter((k) => k.status === "approved").length || 0;
  const total = investorKyc?.length || 0;

  return (
    <Card data-testid="card-kyc-checklist">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">KYC Status</CardTitle>
          </div>
          {total > 0 && (
            <Badge variant="secondary" data-testid="badge-kyc-progress">
              {approved}/{total} Complete
            </Badge>
          )}
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {!investorKyc || investorKyc.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No KYC items configured
          </p>
        ) : (
          <div className="space-y-3">
            {investorKyc.map((item) => {
              const status = kycItemStatuses.find((s) => s.value === item.status);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                  data-testid={`item-kyc-${item.id}`}
                >
                  <div className="flex items-center gap-2">
                    <KycStatusIcon status={item.status} />
                    <span className="text-sm">{item.itemName}</span>
                  </div>
                  <Badge className={kycStatusColors[item.status] || ""} variant="secondary">
                    {status?.label || item.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PortalAccessManagement() {
  const { toast } = useToast();

  const { data: investors, isLoading: investorsLoading } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const { data: portalUsers, isLoading: portalLoading } = useQuery<{ investorId: string }[]>({
    queryKey: ["/api/investor-portal-users"],
  });

  const enableMutation = useMutation({
    mutationFn: async (investorId: string) => {
      return apiRequest("POST", "/api/investor-portal-users", { investorId, enabled: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investor-portal-users"] });
      toast({ title: "Success", description: "Portal access enabled" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to enable portal access", variant: "destructive" });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async (investorId: string) => {
      return apiRequest("DELETE", `/api/investor-portal-users/${investorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investor-portal-users"] });
      toast({ title: "Success", description: "Portal access disabled" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to disable portal access", variant: "destructive" });
    },
  });

  const portalUserIds = new Set(portalUsers?.map((p) => p.investorId) || []);

  if (investorsLoading || portalLoading) {
    return (
      <Card data-testid="card-portal-access-loading">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-portal-access-management">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Portal Access Management</CardTitle>
        </div>
        <CardDescription>
          Manage which investors have access to the investor portal
        </CardDescription>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        {!investors || investors.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No investors available
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Investor</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {investors.map((investor) => {
                const hasAccess = portalUserIds.has(investor.id);
                return (
                  <TableRow key={investor.id} data-testid={`row-portal-access-${investor.id}`}>
                    <TableCell className="font-medium">
                      {investor.firstName} {investor.lastName}
                    </TableCell>
                    <TableCell>{investor.email}</TableCell>
                    <TableCell>
                      {hasAccess ? (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Enabled
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="h-3 w-3 mr-1" />
                          Disabled
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasAccess ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => disableMutation.mutate(investor.id)}
                          disabled={disableMutation.isPending}
                          data-testid={`button-disable-portal-${investor.id}`}
                        >
                          Disable Access
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => enableMutation.mutate(investor.id)}
                          disabled={enableMutation.isPending}
                          data-testid={`button-enable-portal-${investor.id}`}
                        >
                          Enable Access
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function InvestorPortalPreview({ investorId }: { investorId: string }) {
  const { data: investor, isLoading } = useQuery<Investor>({
    queryKey: ["/api/investors", investorId],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!investor) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Investor not found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="investor-portal-preview">
      <div className="grid gap-6 lg:grid-cols-2">
        <InvestorProfileCard investor={investor} />
        <InvestmentSummaryCard investor={investor} />
      </div>
      <BondsTable investorId={investorId} />
      <SettlementReceiptsTable investorId={investorId} />
      <div className="grid gap-6 lg:grid-cols-2">
        <DocumentsTable investorId={investorId} />
        <KycChecklistCard investorId={investorId} />
      </div>
      <CommunicationsLog investorId={investorId} />
    </div>
  );
}

export default function InvestorPortalPage() {
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"preview" | "access">("preview");

  const { data: investors, isLoading } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  return (
    <div className="p-6 space-y-6" data-testid="page-investor-portal">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Investor Portal
          </h1>
          <p className="text-muted-foreground">
            Preview investor portal view and manage portal access
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === "preview" ? "default" : "outline"}
            onClick={() => setActiveTab("preview")}
            data-testid="button-tab-preview"
          >
            <Eye className="h-4 w-4 mr-2" />
            Portal Preview
          </Button>
          <Button
            variant={activeTab === "access" ? "default" : "outline"}
            onClick={() => setActiveTab("access")}
            data-testid="button-tab-access"
          >
            <Shield className="h-4 w-4 mr-2" />
            Access Management
          </Button>
        </div>
      </div>

      {activeTab === "preview" && (
        <div className="space-y-6">
          <Card data-testid="card-investor-selector">
            <CardContent className="py-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-sm font-medium">Select Investor:</label>
                {isLoading ? (
                  <Skeleton className="h-10 w-64" />
                ) : (
                  <Select
                    value={selectedInvestorId}
                    onValueChange={setSelectedInvestorId}
                  >
                    <SelectTrigger className="w-full sm:w-80" data-testid="select-investor">
                      <SelectValue placeholder="Choose an investor to preview" />
                    </SelectTrigger>
                    <SelectContent>
                      {investors?.map((investor) => (
                        <SelectItem
                          key={investor.id}
                          value={investor.id}
                          data-testid={`option-investor-${investor.id}`}
                        >
                          {investor.firstName} {investor.lastName} - {investor.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {selectedInvestorId ? (
            <InvestorPortalPreview investorId={selectedInvestorId} />
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Investor Selected</h3>
                <p className="text-muted-foreground">
                  Select an investor from the dropdown above to preview their portal view
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "access" && <PortalAccessManagement />}
    </div>
  );
}
