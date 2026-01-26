import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  DollarSign,
  Users,
  CheckSquare,
  TrendingUp,
  Download,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import type { AuditLog } from "@shared/schema";

interface AnalyticsData {
  investorsByStage: { stage: string; count: number }[];
  investorsByType: { type: string; count: number }[];
  totalPipelineValue: number;
  tasksByStatus: { status: string; count: number }[];
  tasksByPriority: { priority: string; count: number }[];
  bondsByStatus: { status: string; count: number; totalValue: number }[];
  recentActivity: AuditLog[];
}

const STAGE_COLORS: Record<string, string> = {
  lead: "#64748b",
  contacted: "#3b82f6",
  kyc_pending: "#eab308",
  documents: "#f97316",
  ready: "#10b981",
  closed: "#22c55e",
};

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  contacted: "Contacted",
  kyc_pending: "KYC Pending",
  documents: "Documents",
  ready: "Ready",
  closed: "Closed",
};

const TYPE_COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4"];

const PRIORITY_COLORS: Record<string, string> = {
  low: "#22c55e",
  medium: "#eab308",
  high: "#ef4444",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#eab308",
  in_progress: "#3b82f6",
  completed: "#22c55e",
};

const BOND_STATUS_COLORS: Record<string, string> = {
  pending: "#eab308",
  settled: "#22c55e",
  matured: "#3b82f6",
  cancelled: "#ef4444",
};

interface KPICardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  isLoading?: boolean;
}

function KPICard({ title, value, icon: Icon, description, isLoading }: KPICardProps) {
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
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ChartSkeleton() {
  return (
    <div className="h-64 flex items-center justify-center">
      <div className="space-y-3 w-full px-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-5/6" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-8 w-4/5" />
      </div>
    </div>
  );
}

function PieChartSkeleton() {
  return (
    <div className="h-64 flex items-center justify-center">
      <Skeleton className="h-40 w-40 rounded-full" />
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
  });

  const totalInvestors = analytics?.investorsByStage.reduce((sum, s) => sum + s.count, 0) || 0;
  const pendingTasks = analytics?.tasksByStatus.find(t => t.status === "pending")?.count || 0;
  const activeBonds = analytics?.bondsByStatus.reduce((sum, b) => {
    if (b.status === "pending" || b.status === "settled") {
      return sum + b.count;
    }
    return sum;
  }, 0) || 0;

  const pipelineChartData = analytics?.investorsByStage.map(item => ({
    name: STAGE_LABELS[item.stage] || item.stage,
    value: item.count,
    fill: STAGE_COLORS[item.stage] || "#64748b",
  })) || [];

  const typeChartData = analytics?.investorsByType.map((item, index) => ({
    name: item.type.charAt(0).toUpperCase() + item.type.slice(1),
    value: item.count,
    fill: TYPE_COLORS[index % TYPE_COLORS.length],
  })) || [];

  const taskStatusData = analytics?.tasksByStatus.map(item => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1).replace("_", " "),
    value: item.count,
    fill: STATUS_COLORS[item.status] || "#64748b",
  })) || [];

  const taskPriorityData = analytics?.tasksByPriority.map(item => ({
    name: item.priority.charAt(0).toUpperCase() + item.priority.slice(1),
    value: item.count,
    fill: PRIORITY_COLORS[item.priority] || "#64748b",
  })) || [];

  const bondStatusData = analytics?.bondsByStatus.map(item => ({
    name: item.status.charAt(0).toUpperCase() + item.status.slice(1),
    count: item.count,
    totalValue: item.totalValue,
    fill: BOND_STATUS_COLORS[item.status] || "#64748b",
  })) || [];

  const handleExport = (type: string) => {
    window.open(`/api/export/${type}`, "_blank");
  };

  const formatActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
      update: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
      delete: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    };
    return colors[action] || "";
  };

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
            <p className="text-muted-foreground">
              Comprehensive insights into your business operations
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("investors")}
            data-testid="button-export-investors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Investors
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("accounts")}
            data-testid="button-export-accounts"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Accounts
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("bonds")}
            data-testid="button-export-bonds"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Bonds
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Total Pipeline Value"
          value={`$${(analytics?.totalPipelineValue || 0).toLocaleString()}`}
          icon={DollarSign}
          description="Total committed investment"
          isLoading={isLoading}
        />
        <KPICard
          title="Total Investors"
          value={totalInvestors}
          icon={Users}
          description="Across all pipeline stages"
          isLoading={isLoading}
        />
        <KPICard
          title="Pending Tasks"
          value={pendingTasks}
          icon={CheckSquare}
          description="Tasks awaiting completion"
          isLoading={isLoading}
        />
        <KPICard
          title="Active Bonds"
          value={activeBonds}
          icon={TrendingUp}
          description="Pending and settled bonds"
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Investor Pipeline Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : pipelineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pipelineChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" width={90} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {pipelineChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No investor data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Investor Types Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <PieChartSkeleton />
            ) : typeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={typeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {typeChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No investor type data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Task Status Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <ChartSkeleton />
            ) : taskStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={taskStatusData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <CheckSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No task data available</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Task Priority Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <PieChartSkeleton />
            ) : taskPriorityData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={taskPriorityData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {taskPriorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "6px",
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center">
                <CheckSquare className="h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No task priority data available</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Bond Portfolio by Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartSkeleton />
          ) : bondStatusData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bondStatusData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis yAxisId="left" orientation="left" className="text-xs" />
                <YAxis yAxisId="right" orientation="right" className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "totalValue") {
                      return [`$${value.toLocaleString()}`, "Total Value"];
                    }
                    return [value, "Count"];
                  }}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="count" name="Count" radius={[4, 4, 0, 0]}>
                  {bondStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
                <Bar yAxisId="right" dataKey="totalValue" name="Total Value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No bond data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ActivitySkeleton />
          ) : analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
            <div className="space-y-4">
              {analytics.recentActivity.slice(0, 10).map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-border last:border-0 last:pb-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                    {activity.action[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className={formatActionBadge(activity.action)}>
                        {activity.action}
                      </Badge>
                      <span className="text-sm font-medium">{activity.entityType}</span>
                    </div>
                    {activity.description && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">{activity.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No recent activity</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
