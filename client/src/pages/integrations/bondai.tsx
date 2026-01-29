import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Link2, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Activity,
  Webhook,
  Clock
} from "lucide-react";
import { format } from "date-fns";

interface WebhookEvent {
  id: string;
  eventId: string;
  eventType: string;
  correlationId: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  processedAt: string | null;
}

interface IntegrationHealth {
  status: string;
  recentEventsCount: number;
  failedEventsCount: number;
  lastEventAt: string | null;
  webhookConfigured: boolean;
}

const statusColors: Record<string, string> = {
  received: "bg-blue-500",
  processing: "bg-yellow-500",
  processed: "bg-green-500",
  failed: "bg-red-500",
  duplicate: "bg-gray-500",
};

const eventTypeLabels: Record<string, string> = {
  "investor_onboarding_submitted": "Investor Onboarding Submitted",
  "investor_onboarding_completed": "Investor Onboarding Completed",
  "payment.pending": "Payment Pending",
  "payment.confirmed": "Payment Confirmed",
  "payment.failed": "Payment Failed",
  "kyc.submitted": "KYC Submitted",
  "kyc.completed": "KYC Completed",
  "kyc.rejected": "KYC Rejected",
  "trade.created": "Trade Created",
  "trade.completed": "Trade Completed",
};

export default function BondAIIntegrationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: health, isLoading: healthLoading } = useQuery<IntegrationHealth>({
    queryKey: ["/api/bondai/health"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<WebhookEvent[]>({
    queryKey: ["/api/bondai/webhook-events"],
  });

  const refreshHealth = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bondai/health", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check health");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bondai/health"] });
      toast({ title: "Health check completed" });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <XCircle className="h-5 w-5 text-red-500" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">BondAI Integration</h1>
          <p className="text-muted-foreground">Monitor and manage BondAI payment integration</p>
        </div>
        <Button onClick={() => refreshHealth.mutate()} disabled={refreshHealth.isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshHealth.isPending ? "animate-spin" : ""}`} />
          Refresh Status
        </Button>
      </div>

      {/* Integration Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Integration Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {healthLoading ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  {getStatusIcon(health?.status || "unknown")}
                  <span className="text-lg font-semibold capitalize">
                    {health?.status || "Unknown"}
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhook Config
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {health?.webhookConfigured ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-lg font-semibold">Configured</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-lg font-semibold">Not Configured</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recent Events (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{health?.recentEventsCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed Events (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(health?.failedEventsCount || 0) > 0 ? "text-red-600" : "text-green-600"}`}>
              {health?.failedEventsCount || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Integration Setup
          </CardTitle>
          <CardDescription>Configure the BondAI integration for your JACE CRM</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Webhook Endpoint</h4>
            <code className="bg-background px-2 py-1 rounded text-sm">
              POST /api/bondai/webhook
            </code>
            <p className="text-sm text-muted-foreground mt-2">
              Configure this endpoint in your BondAI dashboard to receive real-time events.
            </p>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Environment Variables</h4>
            <ul className="text-sm space-y-1">
              <li><code className="bg-background px-1 rounded">BONDAI_API_URL</code> - BondAI API base URL</li>
              <li><code className="bg-background px-1 rounded">BONDAI_API_KEY</code> - Your BondAI API key</li>
              <li><code className="bg-background px-1 rounded">BONDAI_WEBHOOK_SECRET</code> - Webhook signature secret</li>
            </ul>
          </div>

          <div className="bg-muted p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Supported Events</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {Object.entries(eventTypeLabels).map(([key, label]) => (
                <div key={key} className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Events Log */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Events</CardTitle>
          <CardDescription>Recent webhook events from BondAI</CardDescription>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading events...</div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No webhook events received yet.</p>
              <p className="text-sm">Events will appear here once BondAI sends data to your webhook endpoint.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Correlation ID</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Processed</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-mono text-xs">{event.eventId.slice(0, 12)}...</TableCell>
                    <TableCell>
                      <span className="text-sm">
                        {eventTypeLabels[event.eventType] || event.eventType}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[event.status]} text-white`}>
                        {event.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {event.correlationId ? `${event.correlationId.slice(0, 12)}...` : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Clock className="h-3 w-3" />
                        {format(new Date(event.createdAt), "MMM d, HH:mm:ss")}
                      </div>
                    </TableCell>
                    <TableCell>
                      {event.processedAt ? (
                        <span className="text-sm">
                          {format(new Date(event.processedAt), "HH:mm:ss")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {event.errorMessage ? (
                        <span className="text-xs text-red-600 truncate max-w-32 block" title={event.errorMessage}>
                          {event.errorMessage}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
