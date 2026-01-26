import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  TrendingUp,
  DollarSign,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Investor, Account, Task, JournalEntry } from "@shared/schema";

interface DashboardStats {
  totalInvestors: number;
  activeInvestors: number;
  totalInvestment: number;
  pendingTasks: number;
  completedTasks: number;
  totalAccounts: number;
  recentEntries: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  trend?: { value: number; isPositive: boolean };
  isLoading?: boolean;
}

function StatCard({ title, value, icon: Icon, description, trend, isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-20 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          {trend && (
            <span className={`flex items-center text-xs font-medium ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {trend.isPositive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {trend.value}%
            </span>
          )}
          {description && (
            <span className="text-xs text-muted-foreground">{description}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentInvestorsCard({ investors, isLoading }: { investors?: Investor[], isLoading: boolean }) {
  const pipelineColors: Record<string, string> = {
    lead: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    contacted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    kyc_pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    documents: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    closed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };

  const stageLabels: Record<string, string> = {
    lead: "Lead",
    contacted: "Contacted",
    kyc_pending: "KYC Pending",
    documents: "Documents",
    ready: "Ready",
    closed: "Closed",
  };

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Recent Investors
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : investors && investors.length > 0 ? (
          <div className="space-y-4">
            {investors.slice(0, 5).map((investor) => (
              <div key={investor.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-medium">
                    {investor.firstName[0]}{investor.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{investor.firstName} {investor.lastName}</p>
                    <p className="text-xs text-muted-foreground">{investor.email}</p>
                  </div>
                </div>
                <Badge variant="secondary" className={pipelineColors[investor.pipelineStage]}>
                  {stageLabels[investor.pipelineStage]}
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No investors yet</p>
            <p className="text-xs text-muted-foreground/70">Add your first investor to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentTasksCard({ tasks, isLoading }: { tasks?: Task[], isLoading: boolean }) {
  const priorityColors: Record<string, string> = {
    high: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    low: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-5 w-5" />
          Pending Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-4 w-4 mt-0.5" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-full mb-1" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : tasks && tasks.length > 0 ? (
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-start gap-3">
                <div className="mt-0.5 h-4 w-4 rounded border border-border" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className={`text-xs ${priorityColors[task.priority || 'medium']}`}>
                      {task.priority}
                    </Badge>
                    {task.dueDate && (
                      <span className="text-xs text-muted-foreground">
                        Due {new Date(task.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CheckSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No pending tasks</p>
            <p className="text-xs text-muted-foreground/70">All caught up!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: investors, isLoading: investorsLoading, isError: investorsError } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const { data: accounts, isLoading: accountsLoading, isError: accountsError } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const { data: tasks, isLoading: tasksLoading, isError: tasksError } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: journalEntries, isLoading: entriesLoading, isError: entriesError } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal-entries"],
  });

  const isLoading = investorsLoading || accountsLoading || tasksLoading || entriesLoading;
  const hasError = investorsError || accountsError || tasksError || entriesError;

  const pendingTasks = tasks?.filter(t => t.status === 'pending') || [];
  const closedInvestors = investors?.filter(i => i.pipelineStage === 'closed') || [];
  const totalInvestment = investors?.reduce((sum, i) => sum + (parseFloat(String(i.investmentAmount || 0))), 0) || 0;

  if (hasError) {
    return (
      <div className="p-6 lg:p-8">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load dashboard data. Please try again later.</span>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your investor relations and accounting operations
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Investors"
          value={investors?.length || 0}
          icon={Users}
          description="in pipeline"
          isLoading={isLoading}
        />
        <StatCard
          title="Closed Deals"
          value={closedInvestors.length}
          icon={TrendingUp}
          description="this month"
          trend={{ value: 12, isPositive: true }}
          isLoading={isLoading}
        />
        <StatCard
          title="Total Investment"
          value={`$${totalInvestment.toLocaleString()}`}
          icon={DollarSign}
          description="committed"
          isLoading={isLoading}
        />
        <StatCard
          title="Pending Tasks"
          value={pendingTasks.length}
          icon={CheckSquare}
          description="to complete"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Chart of Accounts"
          value={accounts?.length || 0}
          icon={FileText}
          description="active accounts"
          isLoading={isLoading}
        />
        <StatCard
          title="Journal Entries"
          value={journalEntries?.length || 0}
          icon={FileText}
          description="recorded"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RecentInvestorsCard investors={investors} isLoading={investorsLoading} />
        <RecentTasksCard tasks={pendingTasks} isLoading={tasksLoading} />
      </div>
    </div>
  );
}
