import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Assignment, InsertAssignment } from "@shared/schema";
import { assignmentStatuses } from "@shared/schema";

const formatCurrency = (val: string | number | null | undefined) => {
  if (!val) return "$0.00";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(val));
};

const formatDate = (val: string | Date | null | undefined) => {
  if (!val) return "\u2014";
  return new Date(val).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
};

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "active": return "default";
    case "matured": return "secondary";
    case "closed": return "outline";
    case "defaulted": return "destructive";
    default: return "secondary";
  }
};

const createAssignmentSchema = z.object({
  bondName: z.string().min(1, "Bond name is required"),
  investorName: z.string().min(1, "Investor name is required"),
  investorEmail: z.string().email("Valid email required").or(z.literal("")),
  issuerName: z.string().optional(),
  assignmentType: z.string().optional(),
  cusip: z.string().optional(),
  maturityDate: z.string().optional(),
  couponRate: z.string().optional(),
  unitCount: z.string().optional(),
  unitPrice: z.string().optional(),
  totalAmount: z.string().min(1, "Total amount is required"),
  status: z.string().default("active"),
  notes: z.string().optional(),
});

type CreateAssignmentFormValues = z.infer<typeof createAssignmentSchema>;

function CreateAssignmentDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<CreateAssignmentFormValues>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      bondName: "",
      investorName: "",
      investorEmail: "",
      issuerName: "",
      assignmentType: "",
      cusip: "",
      maturityDate: "",
      couponRate: "",
      unitCount: "",
      unitPrice: "",
      totalAmount: "",
      status: "active",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateAssignmentFormValues) => {
      const payload: Partial<InsertAssignment> = {
        bondName: data.bondName,
        investorName: data.investorName,
        investorEmail: data.investorEmail || undefined,
        issuerName: data.issuerName || undefined,
        assignmentType: data.assignmentType || undefined,
        cusip: data.cusip || undefined,
        maturityDate: data.maturityDate ? new Date(data.maturityDate).toISOString() : undefined,
        couponRate: data.couponRate || undefined,
        unitCount: data.unitCount || undefined,
        unitPrice: data.unitPrice || undefined,
        totalAmount: data.totalAmount,
        status: data.status,
        notes: data.notes || undefined,
      };
      const res = await apiRequest("POST", "/api/assignments", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments"] });
      toast({ title: "Assignment created" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create assignment", variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateAssignmentFormValues) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Assignment</DialogTitle>
          <DialogDescription>Create a new bond assignment record</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="bondName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bond Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Bond name" {...field} data-testid="input-bondName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="investorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Investor name" {...field} data-testid="input-investorName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="investorEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investor Email</FormLabel>
                    <FormControl>
                      <Input placeholder="investor@example.com" {...field} data-testid="input-investorEmail" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="issuerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issuer Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Issuer name" {...field} value={field.value || ""} data-testid="input-issuerName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignmentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignment Type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Corporate Bond" {...field} value={field.value || ""} data-testid="input-assignmentType" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="cusip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CUSIP</FormLabel>
                    <FormControl>
                      <Input placeholder="CUSIP identifier" {...field} value={field.value || ""} data-testid="input-cusip" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maturityDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Maturity Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value || ""} data-testid="input-maturityDate" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="couponRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coupon Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.001" placeholder="5.250" {...field} value={field.value || ""} data-testid="input-couponRate" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Units</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" placeholder="100" {...field} value={field.value || ""} data-testid="input-unitCount" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.0001" placeholder="1000.00" {...field} value={field.value || ""} data-testid="input-unitPrice" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="totalAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="100000.00" {...field} data-testid="input-totalAmount" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {assignmentStatuses.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} value={field.value || ""} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                {createMutation.isPending ? "Creating..." : "Create Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AssignmentsPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ["/api/assignments"],
  });

  const filteredAssignments = assignments.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (a.bondName || "").toLowerCase().includes(q) ||
      (a.investorName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Assignments & Payouts</h1>
          <p className="text-muted-foreground">Manage bond assignments and track investor payouts</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-new-assignment">
          <Plus className="h-4 w-4 mr-2" />
          New Assignment
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Assignments</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by bond or investor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bond Name</TableHead>
                    <TableHead>Investor</TableHead>
                    <TableHead>CUSIP</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Coupon Rate</TableHead>
                    <TableHead>Maturity Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        {searchQuery ? "No assignments match your search." : "No assignments yet. Create your first assignment."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAssignments.map((assignment) => (
                      <TableRow
                        key={assignment.id}
                        className="cursor-pointer"
                        onClick={() => setLocation(`/assignments/${assignment.id}`)}
                        data-testid={`row-assignment-${assignment.id}`}
                      >
                        <TableCell className="font-medium" data-testid={`text-bondName-${assignment.id}`}>
                          {assignment.bondName || "\u2014"}
                        </TableCell>
                        <TableCell data-testid={`text-investor-${assignment.id}`}>
                          {assignment.investorName || "\u2014"}
                        </TableCell>
                        <TableCell data-testid={`text-cusip-${assignment.id}`}>
                          {assignment.cusip || "\u2014"}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-units-${assignment.id}`}>
                          {assignment.unitCount ? Number(assignment.unitCount).toLocaleString() : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-unitPrice-${assignment.id}`}>
                          {assignment.unitPrice ? formatCurrency(assignment.unitPrice) : "\u2014"}
                        </TableCell>
                        <TableCell className="text-right font-medium" data-testid={`text-totalAmount-${assignment.id}`}>
                          {formatCurrency(assignment.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right" data-testid={`text-couponRate-${assignment.id}`}>
                          {assignment.couponRate ? `${Number(assignment.couponRate).toFixed(3)}%` : "\u2014"}
                        </TableCell>
                        <TableCell data-testid={`text-maturityDate-${assignment.id}`}>
                          {formatDate(assignment.maturityDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(assignment.status)} data-testid={`badge-status-${assignment.id}`}>
                            {assignmentStatuses.find((s) => s.value === assignment.status)?.label || assignment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(`/assignments/${assignment.id}`);
                            }}
                            data-testid={`button-view-${assignment.id}`}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateAssignmentDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </div>
  );
}
