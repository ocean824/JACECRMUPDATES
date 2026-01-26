import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Plus,
  Trash2,
  FileText,
  Mail,
  Phone,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  insertCommunicationSchema,
  communicationTypes,
  type Communication,
  type Investor,
} from "@shared/schema";

const formSchema = insertCommunicationSchema.extend({
  investorId: z.string().min(1, "Investor is required"),
  type: z.enum(["note", "email", "call", "meeting"], {
    required_error: "Type is required",
  }),
  content: z.string().min(1, "Content is required"),
  subject: z.string().optional(),
  contactedAt: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function getTypeIcon(type: string) {
  switch (type) {
    case "note":
      return <FileText className="h-4 w-4" />;
    case "email":
      return <Mail className="h-4 w-4" />;
    case "call":
      return <Phone className="h-4 w-4" />;
    case "meeting":
      return <Users className="h-4 w-4" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
}

function getTypeColor(type: string) {
  switch (type) {
    case "note":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";
    case "email":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300";
    case "call":
      return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    case "meeting":
      return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function formatDateTime(timestamp: string | Date | null | undefined) {
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

function CommunicationFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const { data: investors } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      investorId: "",
      type: "note",
      subject: "",
      content: "",
      contactedAt: new Date().toISOString().slice(0, 16),
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", "/api/communications", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      toast({ title: "Success", description: "Communication logged successfully" });
      onOpenChange(false);
      form.reset({
        investorId: "",
        type: "note",
        subject: "",
        content: "",
        contactedAt: new Date().toISOString().slice(0, 16),
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to log communication", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Communication</DialogTitle>
          <DialogDescription>
            Record a communication with an investor
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="investorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investor</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-investor">
                        <SelectValue placeholder="Select investor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {investors?.map((investor) => (
                        <SelectItem key={investor.id} value={investor.id}>
                          {investor.firstName} {investor.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {communicationTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Subject (optional)" {...field} data-testid="input-subject" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter communication details..."
                      className="min-h-[100px]"
                      {...field}
                      data-testid="input-content"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactedAt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date/Time</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      data-testid="input-contacted-at"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending}
                data-testid="button-save-communication"
              >
                {createMutation.isPending ? "Saving..." : "Log Communication"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

type CommunicationWithInvestor = Communication & {
  investor?: {
    firstName: string;
    lastName: string;
  };
};

export default function CommunicationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [investorFilter, setInvestorFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { toast } = useToast();

  const { data: communications, isLoading } = useQuery<CommunicationWithInvestor[]>({
    queryKey: ["/api/communications"],
  });

  const { data: investors } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/communications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/communications"] });
      toast({ title: "Success", description: "Communication deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete communication", variant: "destructive" });
    },
  });

  const investorMap = investors?.reduce((acc, inv) => {
    acc[inv.id] = `${inv.firstName} ${inv.lastName}`;
    return acc;
  }, {} as Record<string, string>) || {};

  const filteredCommunications = communications?.filter((comm) => {
    const matchesInvestor = investorFilter === "all" || comm.investorId === investorFilter;
    const matchesType = typeFilter === "all" || comm.type === typeFilter;
    return matchesInvestor && matchesType;
  });

  const totalCount = communications?.length || 0;
  const notesCount = communications?.filter((c) => c.type === "note").length || 0;
  const emailsCount = communications?.filter((c) => c.type === "email").length || 0;
  const callsCount = communications?.filter((c) => c.type === "call").length || 0;
  const meetingsCount = communications?.filter((c) => c.type === "meeting").length || 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              Communication Log
            </h1>
            <p className="text-muted-foreground">
              Track all investor communications
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-log-communication">
          <Plus className="h-4 w-4 mr-2" />
          Log Communication
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card data-testid="card-total-communications">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Communications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-notes">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Notes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notesCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-emails">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Emails
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emailsCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-calls">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{callsCount}</div>
          </CardContent>
        </Card>
        <Card data-testid="card-meetings">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Meetings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{meetingsCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Communication Timeline
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <Select value={investorFilter} onValueChange={setInvestorFilter}>
                <SelectTrigger className="w-[180px]" data-testid="filter-investor">
                  <SelectValue placeholder="Filter by investor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Investors</SelectItem>
                  {investors?.map((investor) => (
                    <SelectItem key={investor.id} value={investor.id}>
                      {investor.firstName} {investor.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]" data-testid="filter-type">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {communicationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredCommunications && filteredCommunications.length > 0 ? (
            <div className="space-y-4">
              {filteredCommunications.map((comm) => (
                <div
                  key={comm.id}
                  className="flex gap-4 p-4 border rounded-lg group"
                  data-testid={`communication-${comm.id}`}
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${getTypeColor(comm.type)}`}
                  >
                    {getTypeIcon(comm.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        {comm.subject && (
                          <p className="font-medium">{comm.subject}</p>
                        )}
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {comm.content}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={() => deleteMutation.mutate(comm.id)}
                        data-testid={`button-delete-${comm.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {comm.investor
                          ? `${comm.investor.firstName} ${comm.investor.lastName}`
                          : investorMap[comm.investorId] || "Unknown Investor"}
                      </span>
                      <span>{formatDateTime(comm.contactedAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-1">No communications found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {investorFilter !== "all" || typeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by logging your first communication"}
              </p>
              {investorFilter === "all" && typeFilter === "all" && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Log Communication
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CommunicationFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
