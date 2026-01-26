import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  DollarSign,
  User,
  FileText,
  MessageSquare,
  Settings,
  Clock,
} from "lucide-react";
import { ActivityTimeline } from "@/components/activity-timeline";
import type { Investor, Communication, Document, CustomFieldValue, CustomField } from "@shared/schema";
import { pipelineStages, investorTypes } from "@shared/schema";

const pipelineColors: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  contacted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  kyc_pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  documents: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  closed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
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

function InvestorHeaderSkeleton() {
  return (
    <Card data-testid="investor-header-skeleton">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="flex-1 space-y-4">
            <Skeleton className="h-8 w-64" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvestorHeader({ investor }: { investor: Investor }) {
  const pipelineStage = pipelineStages.find((s) => s.value === investor.pipelineStage);
  const investorType = investorTypes.find((t) => t.value === investor.investorType);

  return (
    <Card data-testid="investor-header">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row md:items-start gap-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shrink-0">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <h1
                className="text-2xl font-bold tracking-tight"
                data-testid="text-investor-name"
              >
                {investor.firstName} {investor.lastName}
              </h1>
              <Badge className={pipelineColors[investor.pipelineStage] || ""}>
                {pipelineStage?.label || investor.pipelineStage}
              </Badge>
              {investorType && (
                <Badge variant="outline">{investorType.label}</Badge>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <span
                  className="text-muted-foreground truncate"
                  data-testid="text-investor-email"
                >
                  {investor.email}
                </span>
              </div>
              {investor.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span
                    className="text-muted-foreground"
                    data-testid="text-investor-phone"
                  >
                    {investor.phone}
                  </span>
                </div>
              )}
              {investor.company && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span
                    className="text-muted-foreground"
                    data-testid="text-investor-company"
                  >
                    {investor.company}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                <span
                  className="font-medium"
                  data-testid="text-investor-amount"
                >
                  {formatCurrency(investor.investmentAmount)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ investor }: { investor: Investor }) {
  return (
    <div className="grid gap-6 md:grid-cols-2" data-testid="tab-overview-content">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Investor Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{formatDateTime(investor.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Updated</span>
            <span>{formatDateTime(investor.updatedAt)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">KYC Status</span>
            <Badge variant="outline">{investor.kycStatus || "pending"}</Badge>
          </div>
        </CardContent>
      </Card>
      {investor.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {investor.notes}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function CommunicationsTab({ investorId }: { investorId: string }) {
  const { data: communications, isLoading } = useQuery<Communication[]>({
    queryKey: ["/api/communications"],
  });

  const investorComms = communications?.filter((c) => c.investorId === investorId);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="communications-skeleton">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!investorComms || investorComms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12" data-testid="communications-empty">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No Communications</h3>
        <p className="text-sm text-muted-foreground">No communications logged for this investor</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="tab-communications-content">
      {investorComms.map((comm) => (
        <Card key={comm.id} data-testid={`communication-item-${comm.id}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-xs capitalize">
                    {comm.type}
                  </Badge>
                  {comm.subject && (
                    <span className="font-medium text-sm">{comm.subject}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {comm.content}
                </p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDateTime(comm.contactedAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function DocumentsTab({ investorId }: { investorId: string }) {
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const investorDocs = documents?.filter((d) => d.investorId === investorId);

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="documents-skeleton">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!investorDocs || investorDocs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12" data-testid="documents-empty">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No Documents</h3>
        <p className="text-sm text-muted-foreground">No documents uploaded for this investor</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="tab-documents-content">
      {investorDocs.map((doc) => (
        <Card key={doc.id} data-testid={`document-item-${doc.id}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{doc.originalName}</p>
                {doc.category && (
                  <Badge variant="outline" className="text-xs mt-1">
                    {doc.category}
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground shrink-0">
                {formatDateTime(doc.createdAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function CustomFieldsTab({ investorId }: { investorId: string }) {
  const { data: customFields, isLoading: fieldsLoading } = useQuery<CustomField[]>({
    queryKey: ["/api/custom-fields"],
  });

  const { data: fieldValues, isLoading: valuesLoading } = useQuery<CustomFieldValue[]>({
    queryKey: ["/api/custom-field-values"],
  });

  const isLoading = fieldsLoading || valuesLoading;

  const investorValues = fieldValues?.filter((v) => v.investorId === investorId);
  const valueMap = new Map(investorValues?.map((v) => [v.customFieldId, v.value]));

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="custom-fields-skeleton">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!customFields || customFields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12" data-testid="custom-fields-empty">
        <Settings className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No Custom Fields</h3>
        <p className="text-sm text-muted-foreground">No custom fields defined</p>
      </div>
    );
  }

  return (
    <Card data-testid="tab-custom-fields-content">
      <CardContent className="p-6">
        <div className="space-y-4">
          {customFields
            .filter((f) => f.isActive)
            .map((field) => (
              <div
                key={field.id}
                className="flex flex-col sm:flex-row sm:items-center gap-2 pb-3 border-b last:border-0 last:pb-0"
                data-testid={`custom-field-${field.id}`}
              >
                <span className="font-medium text-sm sm:w-1/3">{field.label}</span>
                <span className="text-sm text-muted-foreground sm:w-2/3">
                  {valueMap.get(field.id) || "-"}
                </span>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function InvestorDetailPage() {
  const params = useParams<{ id: string }>();
  const investorId = params.id || "";

  const { data: investor, isLoading, error } = useQuery<Investor>({
    queryKey: ["/api/investors", investorId],
    enabled: !!investorId,
  });

  if (isLoading) {
    return (
      <div className="p-6 lg:p-8 space-y-6" data-testid="investor-detail-loading">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24" />
        </div>
        <InvestorHeaderSkeleton />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error || !investor) {
    return (
      <div className="p-6 lg:p-8" data-testid="investor-detail-error">
        <div className="flex flex-col items-center justify-center py-16">
          <User className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Investor Not Found</h2>
          <p className="text-muted-foreground mb-6">The investor you are looking for does not exist.</p>
          <Link href="/investors">
            <Button data-testid="button-back-to-investors">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Investors
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6" data-testid="investor-detail-page">
      <div className="flex items-center gap-3">
        <Link href="/investors">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <InvestorHeader investor={investor} />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full justify-start" data-testid="investor-tabs">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <User className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Clock className="h-4 w-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="communications" data-testid="tab-communications">
            <MessageSquare className="h-4 w-4 mr-2" />
            Communications
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <FileText className="h-4 w-4 mr-2" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="custom-fields" data-testid="tab-custom-fields">
            <Settings className="h-4 w-4 mr-2" />
            Custom Fields
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <TabsContent value="overview">
            <OverviewTab investor={investor} />
          </TabsContent>

          <TabsContent value="timeline">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Activity Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActivityTimeline investorId={investorId} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications">
            <CommunicationsTab investorId={investorId} />
          </TabsContent>

          <TabsContent value="documents">
            <DocumentsTab investorId={investorId} />
          </TabsContent>

          <TabsContent value="custom-fields">
            <CustomFieldsTab investorId={investorId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
