import { useQuery } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus,
  UserCog,
  TrendingUp,
  ClipboardList,
  CheckCircle,
  FileUp,
  MessageSquare,
  Landmark,
  Shield,
  Mail,
  Calendar,
  Clock,
} from "lucide-react";
import type { ActivityTimelineEntry } from "@shared/schema";

const activityIcons: Record<string, ComponentType<{ className?: string }>> = {
  investor_created: UserPlus,
  investor_updated: UserCog,
  pipeline_changed: TrendingUp,
  task_created: ClipboardList,
  task_completed: CheckCircle,
  document_uploaded: FileUp,
  communication_logged: MessageSquare,
  bond_created: Landmark,
  kyc_updated: Shield,
  email_sent: Mail,
  meeting_scheduled: Calendar,
};

const activityColors: Record<string, string> = {
  investor_created: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  investor_updated: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  pipeline_changed: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  task_created: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  task_completed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  document_uploaded: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  communication_logged: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  bond_created: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  kyc_updated: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  email_sent: "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
  meeting_scheduled: "bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300",
};

function formatRelativeTime(timestamp: string | Date | null | undefined): string {
  if (!timestamp) return "";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
}

function TimelineSkeleton() {
  return (
    <div className="space-y-6" data-testid="timeline-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex gap-4">
          <Skeleton className="h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center" data-testid="timeline-empty">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
        <Clock className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">No Activity Yet</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Activities will appear here as they happen
      </p>
    </div>
  );
}

interface ActivityTimelineProps {
  investorId: string;
}

export function ActivityTimeline({ investorId }: ActivityTimelineProps) {
  const { data: activities, isLoading } = useQuery<ActivityTimelineEntry[]>({
    queryKey: ["/api/investors", investorId, "timeline"],
  });

  if (isLoading) {
    return <TimelineSkeleton />;
  }

  if (!activities || activities.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="relative" data-testid="activity-timeline">
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
      <div className="space-y-6">
        {activities.map((activity) => {
          const Icon = activityIcons[activity.activityType] || Clock;
          const colorClass = activityColors[activity.activityType] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";

          return (
            <div
              key={activity.id}
              className="relative flex gap-4 pl-0"
              data-testid={`timeline-item-${activity.id}`}
            >
              <div
                className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${colorClass}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h4
                    className="font-medium text-sm"
                    data-testid={`timeline-title-${activity.id}`}
                  >
                    {activity.title}
                  </h4>
                  {activity.entityType && (
                    <Badge
                      variant="outline"
                      className="text-xs"
                      data-testid={`timeline-badge-${activity.id}`}
                    >
                      {activity.entityType}
                    </Badge>
                  )}
                </div>
                {activity.description && (
                  <p
                    className="text-sm text-muted-foreground mt-1"
                    data-testid={`timeline-description-${activity.id}`}
                  >
                    {activity.description}
                  </p>
                )}
                <p
                  className="text-xs text-muted-foreground mt-1"
                  data-testid={`timeline-time-${activity.id}`}
                >
                  {formatRelativeTime(activity.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
