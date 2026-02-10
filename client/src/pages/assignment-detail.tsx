import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRoute, useLocation, Link } from "wouter";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Assignment, AssignmentPayout } from "@shared/schema";
import { assignmentStatuses, payoutTypes, payoutStatuses } from "@shared/schema";

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

const getPayoutStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "paid": return "default";
    case "scheduled": return "secondary";
    case "cancelled": return "outline";
    case "failed": return "destructive";
    default: return "secondary";
  }
};

const addPayoutSchema = z.object({
  payoutDate: z.string().min(1, "Payout date is required"),
  amount: z.string().min(1, "Amount is required"),
  payoutType: z.string().min(1, "Payout type is required"),
  status: z.string().default("scheduled"),
  notes: z.string().optional(),
});

type AddPayoutFormValues = z.infer<typeof addPayoutSchema>;

const editPayoutStatusSchema = z.object({
  status: z.string().min(1, "Status is required"),
  notes: z.string().optional(),
});

type EditPayoutStatusFormValues = z.infer<typeof editPayoutStatusSchema>;

function AddPayoutDialog({
  assignmentId,
  open,
  onOpenChange,
}: {
  assignmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<AddPayoutFormValues>({
    resolver: zodResolver(addPayoutSchema),
    defaultValues: {
      payoutDate: "",
      amount: "",
      payoutType: "",
      status: "scheduled",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: AddPayoutFormValues) => {
      const payload = {
        assignmentId,
        payoutDate: new Date(data.payoutDate).toISOString(),
        amount: data.amount,
        payoutType: data.payoutType,
        status: data.status,
        notes: data.notes || undefined,
      };
      const res = await apiRequest("POST", `/api/assignments/${assignmentId}/payouts`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments", assignmentId, "payouts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/assignments", assignmentId] });
      toast({ title: "Payout added" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to add payout", variant: "destructive" });
    },
  });

  const onSubmit = (data: AddPayoutFormValues) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Payout</DialogTitle>
          <DialogDescription>Schedule a new payout for this assignment</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="payoutDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payout Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} data-testid="input-payoutDate" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="1000.00" {...field} data-testid="input-payout-amount" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payoutType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payout Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payoutType">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {payoutTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
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
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-payout-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {payoutStatuses.map((s) => (
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
                    <Textarea placeholder="Optional notes..." {...field} value={field.value || ""} data-testid="input-payout-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-payout">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-payout">
                {createMutation.isPending ? "Adding..." : "Add Payout"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditPayoutDialog({
  payout,
  assignmentId,
  open,
  onOpenChange,
}: {
  payout: AssignmentPayout;
  assignmentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<EditPayoutStatusFormValues>({
    resolver: zodResolver(editPayoutStatusSchema),
    defaultValues: {
      status: payout.status,
      notes: payout.notes || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditPayoutStatusFormValues) => {
      const res = await apiRequest("PATCH", `/api/assignments/${assignmentId}/payouts/${payout.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments", assignmentId, "payouts"] });
      toast({ title: "Payout updated" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update payout", variant: "destructive" });
    },
  });

  const onSubmit = (data: EditPayoutStatusFormValues) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Payout</DialogTitle>
          <DialogDescription>Update payout status</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-payout-status">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {payoutStatuses.map((s) => (
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
                    <Textarea placeholder="Optional notes..." {...field} value={field.value || ""} data-testid="input-edit-payout-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit-payout">
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit-payout">
                {updateMutation.isPending ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function AssignmentDetailPage() {
  const [, params] = useRoute("/assignments/:id");
  const id = params?.id;
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [isAddPayoutOpen, setIsAddPayoutOpen] = useState(false);
  const [editingPayout, setEditingPayout] = useState<AssignmentPayout | null>(null);
  const [deletingPayout, setDeletingPayout] = useState<AssignmentPayout | null>(null);

  const { data: assignment, isLoading: assignmentLoading } = useQuery<Assignment>({
    queryKey: ["/api/assignments", id],
    enabled: !!id,
  });

  const { data: payouts = [], isLoading: payoutsLoading } = useQuery<AssignmentPayout[]>({
    queryKey: ["/api/assignments", id, "payouts"],
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: async (payoutId: string) => {
      await apiRequest("DELETE", `/api/assignments/${id}/payouts/${payoutId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/assignments", id, "payouts"] });
      toast({ title: "Payout deleted" });
      setDeletingPayout(null);
    },
    onError: () => {
      toast({ title: "Failed to delete payout", variant: "destructive" });
    },
  });

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Assignment not found.</p>
      </div>
    );
  }

  if (assignmentLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => setLocation("/assignments")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Assignments
        </Button>
        <p className="text-muted-foreground">Assignment not found.</p>
      </div>
    );
  }

  const statusInfo = assignmentStatuses.find((s) => s.value === assignment.status);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-4 flex-wrap">
          <Button variant="outline" onClick={() => setLocation("/assignments")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Assignments
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold" data-testid="text-assignment-title">
                {assignment.bondName || "Untitled Assignment"}
              </h1>
              <Badge variant={getStatusBadgeVariant(assignment.status)} data-testid="badge-assignment-status">
                {statusInfo?.label || assignment.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {assignment.investorName || "No investor"} {assignment.cusip ? `\u00b7 CUSIP: ${assignment.cusip}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total Amount</div>
            <div className="text-xl font-bold" data-testid="text-total-amount">{formatCurrency(assignment.totalAmount)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Units</div>
            <div className="text-xl font-bold" data-testid="text-units">{assignment.unitCount ? Number(assignment.unitCount).toLocaleString() : "\u2014"}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Coupon Rate</div>
            <div className="text-xl font-bold" data-testid="text-coupon-rate">{assignment.couponRate ? `${Number(assignment.couponRate).toFixed(3)}%` : "\u2014"}</div>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assignment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Bond Name</div>
              <div className="font-medium" data-testid="detail-bondName">{assignment.bondName || "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Issuer</div>
              <div className="font-medium" data-testid="detail-issuer">{assignment.issuerName || "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Investor Name</div>
              <div className="font-medium" data-testid="detail-investorName">{assignment.investorName || "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Investor Email</div>
              <div className="font-medium" data-testid="detail-investorEmail">{assignment.investorEmail || "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Assignment Type</div>
              <div className="font-medium" data-testid="detail-assignmentType">{assignment.assignmentType || "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">CUSIP</div>
              <div className="font-medium" data-testid="detail-cusip">{assignment.cusip || "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Maturity Date</div>
              <div className="font-medium" data-testid="detail-maturityDate">{formatDate(assignment.maturityDate)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Coupon Rate</div>
              <div className="font-medium" data-testid="detail-couponRate">{assignment.couponRate ? `${Number(assignment.couponRate).toFixed(3)}%` : "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unit Count</div>
              <div className="font-medium" data-testid="detail-unitCount">{assignment.unitCount ? Number(assignment.unitCount).toLocaleString() : "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Unit Price</div>
              <div className="font-medium" data-testid="detail-unitPrice">{assignment.unitPrice ? formatCurrency(assignment.unitPrice) : "\u2014"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Amount</div>
              <div className="font-medium" data-testid="detail-totalAmount">{formatCurrency(assignment.totalAmount)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge variant={getStatusBadgeVariant(assignment.status)} data-testid="detail-status">
                {statusInfo?.label || assignment.status}
              </Badge>
            </div>
            {assignment.settlementSessionId && (
              <div>
                <div className="text-sm text-muted-foreground">Settlement Session</div>
                <Link href={`/settlements`} className="text-primary underline" data-testid="link-settlement">
                  View Settlement
                </Link>
              </div>
            )}
            {assignment.notes && (
              <div className="md:col-span-2">
                <div className="text-sm text-muted-foreground">Notes</div>
                <div className="font-medium" data-testid="detail-notes">{assignment.notes}</div>
              </div>
            )}
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="font-medium" data-testid="detail-createdAt">{formatDate(assignment.createdAt)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div className="font-medium" data-testid="detail-updatedAt">{formatDate(assignment.updatedAt)}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>Payouts</CardTitle>
          <Button onClick={() => setIsAddPayoutOpen(true)} data-testid="button-add-payout">
            <Plus className="h-4 w-4 mr-2" />
            Add Payout
          </Button>
        </CardHeader>
        <CardContent>
          {payoutsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No payouts scheduled yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    payouts.map((payout) => (
                      <TableRow key={payout.id} data-testid={`row-payout-${payout.id}`}>
                        <TableCell data-testid={`text-payout-date-${payout.id}`}>
                          {formatDate(payout.payoutDate)}
                        </TableCell>
                        <TableCell className="text-right font-medium" data-testid={`text-payout-amount-${payout.id}`}>
                          {formatCurrency(payout.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" data-testid={`badge-payout-type-${payout.id}`}>
                            {payoutTypes.find((t) => t.value === payout.payoutType)?.label || payout.payoutType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getPayoutStatusVariant(payout.status)} data-testid={`badge-payout-status-${payout.id}`}>
                            {payoutStatuses.find((s) => s.value === payout.status)?.label || payout.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" data-testid={`text-payout-notes-${payout.id}`}>
                          {payout.notes || "\u2014"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setEditingPayout(payout)}
                              data-testid={`button-edit-payout-${payout.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {payout.status === "scheduled" && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setDeletingPayout(payout)}
                                data-testid={`button-delete-payout-${payout.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
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

      {id && <AddPayoutDialog assignmentId={id} open={isAddPayoutOpen} onOpenChange={setIsAddPayoutOpen} />}

      {editingPayout && id && (
        <EditPayoutDialog
          payout={editingPayout}
          assignmentId={id}
          open={!!editingPayout}
          onOpenChange={(open) => { if (!open) setEditingPayout(null); }}
        />
      )}

      <AlertDialog open={!!deletingPayout} onOpenChange={(open) => { if (!open) setDeletingPayout(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payout</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payout of {deletingPayout ? formatCurrency(deletingPayout.amount) : ""}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-payout">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingPayout) {
                  deleteMutation.mutate(deletingPayout.id);
                }
              }}
              data-testid="button-confirm-delete-payout"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
