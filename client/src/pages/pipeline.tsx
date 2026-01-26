import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { TrendingUp, User, DollarSign, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { pipelineStages, type Investor, type PipelineStage } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const stageColors: Record<string, { bg: string; border: string; text: string }> = {
  lead: { bg: "bg-slate-50 dark:bg-slate-900/50", border: "border-slate-200 dark:border-slate-800", text: "text-slate-600 dark:text-slate-400" },
  contacted: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-600 dark:text-blue-400" },
  kyc_pending: { bg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-200 dark:border-yellow-800", text: "text-yellow-600 dark:text-yellow-400" },
  documents: { bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800", text: "text-orange-600 dark:text-orange-400" },
  ready: { bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", text: "text-emerald-600 dark:text-emerald-400" },
  closed: { bg: "bg-green-50 dark:bg-green-900/20", border: "border-green-200 dark:border-green-800", text: "text-green-600 dark:text-green-400" },
};

function InvestorCard({ investor, onMoveToStage }: { investor: Investor; onMoveToStage: (investorId: string, stage: PipelineStage) => void }) {
  const currentStageIndex = pipelineStages.findIndex(s => s.value === investor.pipelineStage);
  const nextStage = currentStageIndex < pipelineStages.length - 1 ? pipelineStages[currentStageIndex + 1] : null;

  return (
    <Card className="group hover-elevate transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
              {investor.firstName[0]}{investor.lastName[0]}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{investor.firstName} {investor.lastName}</p>
              <p className="text-xs text-muted-foreground truncate">{investor.company || investor.email}</p>
            </div>
          </div>
          {nextStage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                  data-testid={`button-move-${investor.id}`}
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {pipelineStages
                  .filter(s => s.value !== investor.pipelineStage)
                  .map((stage) => (
                    <DropdownMenuItem
                      key={stage.value}
                      onClick={() => onMoveToStage(investor.id, stage.value as PipelineStage)}
                    >
                      Move to {stage.label}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <DollarSign className="h-3 w-3" />
            <span>
              {investor.investmentAmount
                ? `$${parseFloat(String(investor.investmentAmount)).toLocaleString()}`
                : "No amount"}
            </span>
          </div>
          <Badge
            variant="secondary"
            className={`text-[10px] px-1.5 py-0.5 ${
              investor.kycStatus === "approved"
                ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                : investor.kycStatus === "rejected"
                ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
            }`}
          >
            KYC: {investor.kycStatus}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function PipelineColumn({
  stage,
  investors,
  isLoading,
  onMoveToStage,
}: {
  stage: typeof pipelineStages[number];
  investors: Investor[];
  isLoading: boolean;
  onMoveToStage: (investorId: string, stage: PipelineStage) => void;
}) {
  const colors = stageColors[stage.value];
  const totalValue = investors.reduce((sum, i) => sum + parseFloat(String(i.investmentAmount || 0)), 0);

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className={`rounded-t-lg border ${colors.border} ${colors.bg} p-3`}>
        <div className="flex items-center justify-between mb-1">
          <h3 className={`font-semibold text-sm ${colors.text}`}>{stage.label}</h3>
          <Badge variant="secondary" className="text-xs">
            {investors.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          ${totalValue.toLocaleString()} total
        </p>
      </div>

      <div className={`flex-1 border-x border-b ${colors.border} rounded-b-lg bg-card/50 p-2 min-h-[400px]`}>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-24 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-3 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : investors.length > 0 ? (
          <div className="space-y-2">
            {investors.map((investor) => (
              <InvestorCard
                key={investor.id}
                investor={investor}
                onMoveToStage={onMoveToStage}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <User className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No investors</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { toast } = useToast();

  const { data: investors, isLoading } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: PipelineStage }) => {
      return apiRequest("PATCH", `/api/investors/${id}`, { pipelineStage: stage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investors"] });
      toast({ title: "Success", description: "Investor moved to new stage" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update stage", variant: "destructive" });
    },
  });

  const handleMoveToStage = (investorId: string, stage: PipelineStage) => {
    updateStageMutation.mutate({ id: investorId, stage });
  };

  const getInvestorsByStage = (stage: string) => {
    return investors?.filter((i) => i.pipelineStage === stage) || [];
  };

  const totalInvestors = investors?.length || 0;
  const totalValue = investors?.reduce((sum, i) => sum + parseFloat(String(i.investmentAmount || 0)), 0) || 0;
  const closedDeals = investors?.filter(i => i.pipelineStage === 'closed').length || 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investor Pipeline</h1>
          <p className="text-muted-foreground">
            Track and manage investors through your sales pipeline
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Investors</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvestors}</div>
            <p className="text-xs text-muted-foreground">across all stages</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">total investment</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Closed Deals</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{closedDeals}</div>
            <p className="text-xs text-muted-foreground">successfully closed</p>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-4 pb-4">
          {pipelineStages.map((stage) => (
            <PipelineColumn
              key={stage.value}
              stage={stage}
              investors={getInvestorsByStage(stage.value)}
              isLoading={isLoading}
              onMoveToStage={handleMoveToStage}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
