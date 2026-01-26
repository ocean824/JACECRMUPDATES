import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, Landmark, MoreHorizontal, Pencil, Trash2, CalendarIcon, Clock, DollarSign, TrendingUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertBondSettlementSchema, bondStatuses, type BondSettlement, type Investor } from "@shared/schema";

const formSchema = insertBondSettlementSchema.extend({
  bondName: z.string().min(1, "Bond name is required"),
  isin: z.string().optional(),
  investorId: z.string().optional().nullable(),
  faceValue: z.string().min(1, "Face value is required"),
  purchasePrice: z.string().optional(),
  couponRate: z.string().optional(),
  purchaseDate: z.date().optional().nullable(),
  settlementDate: z.date().optional().nullable(),
  maturityDate: z.date().optional().nullable(),
  status: z.enum(["pending", "settled", "matured", "cancelled"]).optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  settled: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  matured: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

function BondFormDialog({
  bond,
  investors,
  open,
  onOpenChange,
}: {
  bond?: BondSettlement;
  investors: Investor[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEditing = !!bond;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      bondName: bond?.bondName || "",
      isin: bond?.isin || "",
      investorId: bond?.investorId || null,
      faceValue: bond?.faceValue?.toString() || "",
      purchasePrice: bond?.purchasePrice?.toString() || "",
      couponRate: bond?.couponRate?.toString() || "",
      purchaseDate: bond?.purchaseDate ? new Date(bond.purchaseDate) : null,
      settlementDate: bond?.settlementDate ? new Date(bond.settlementDate) : null,
      maturityDate: bond?.maturityDate ? new Date(bond.maturityDate) : null,
      status: bond?.status || "pending",
      notes: bond?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        investorId: data.investorId === "none" ? null : data.investorId,
      };
      return apiRequest("POST", "/api/bond-settlements", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bond-settlements"] });
      toast({ title: "Success", description: "Bond created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create bond", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        investorId: data.investorId === "none" ? null : data.investorId,
      };
      return apiRequest("PATCH", `/api/bond-settlements/${bond?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bond-settlements"] });
      toast({ title: "Success", description: "Bond updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update bond", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Bond" : "Add New Bond"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update bond settlement information" : "Enter the bond details below"}
          </DialogDescription>
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
                    <Input placeholder="US Treasury 10Y" {...field} data-testid="input-bond-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="isin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ISIN</FormLabel>
                    <FormControl>
                      <Input placeholder="US912810TM25" {...field} data-testid="input-isin" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="investorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investor</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-investor">
                          <SelectValue placeholder="Select investor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No investor</SelectItem>
                        {investors.map((investor) => (
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="faceValue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Face Value</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="100000" {...field} data-testid="input-face-value" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="purchasePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Purchase Price</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="99500" {...field} data-testid="input-purchase-price" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="couponRate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coupon Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="4.50" {...field} data-testid="input-coupon-rate" />
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bondStatuses.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="purchaseDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Purchase Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-purchase-date"
                          >
                            {field.value ? format(field.value, "MMM d, yyyy") : "Pick date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="settlementDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Settlement Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-settlement-date"
                          >
                            {field.value ? format(field.value, "MMM d, yyyy") : "Pick date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="maturityDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Maturity Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                            data-testid="input-maturity-date"
                          >
                            {field.value ? format(field.value, "MMM d, yyyy") : "Pick date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value || undefined}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Additional notes..." {...field} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-bond"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function BondsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBond, setSelectedBond] = useState<BondSettlement | undefined>();
  const { toast } = useToast();

  const { data: bonds, isLoading } = useQuery<BondSettlement[]>({
    queryKey: ["/api/bond-settlements"],
  });

  const { data: investors } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/bond-settlements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bond-settlements"] });
      toast({ title: "Success", description: "Bond deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete bond", variant: "destructive" });
    },
  });

  const filteredBonds = bonds?.filter((bond) => {
    if (statusFilter === "all") return true;
    return bond.status === statusFilter;
  });

  const handleEdit = (bond: BondSettlement) => {
    setSelectedBond(bond);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedBond(undefined);
    setDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    return statusColors[status] || "";
  };

  const getStatusLabel = (status: string) => {
    return bondStatuses.find((s) => s.value === status)?.label || status;
  };

  const getInvestorName = (investorId: string | null) => {
    if (!investorId || !investors) return "-";
    const investor = investors.find((i) => i.id === investorId);
    return investor ? `${investor.firstName} ${investor.lastName}` : "-";
  };

  const formatCurrency = (value: string | null | undefined) => {
    if (!value) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(parseFloat(value));
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    return format(new Date(date), "MMM d, yyyy");
  };

  const totalBonds = bonds?.length || 0;
  const totalFaceValue = bonds?.reduce((sum, b) => sum + parseFloat(b.faceValue || "0"), 0) || 0;
  const pendingCount = bonds?.filter((b) => b.status === "pending").length || 0;
  
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const maturingSoonCount = bonds?.filter((b) => {
    if (!b.maturityDate || b.status === "matured" || b.status === "cancelled") return false;
    const maturityDate = new Date(b.maturityDate);
    return maturityDate <= thirtyDaysFromNow && maturityDate >= new Date();
  }).length || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Landmark className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Bond Settlements</h1>
            <p className="text-sm text-muted-foreground">Manage bond investments and settlements</p>
          </div>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-bond">
          <Plus className="h-4 w-4 mr-2" />
          Add Bond
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bonds</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-bonds">{totalBonds}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Face Value</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-face-value">
              {formatCurrency(totalFaceValue.toString())}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Settlement</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-count">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maturing Soon</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-maturing-soon">{maturingSoonCount}</div>
            <p className="text-xs text-muted-foreground">Within 30 days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <CardTitle>Bond List</CardTitle>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {bondStatuses.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredBonds?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-empty-state">
              No bonds found. Click "Add Bond" to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bond Name</TableHead>
                    <TableHead>ISIN</TableHead>
                    <TableHead>Investor</TableHead>
                    <TableHead className="text-right">Face Value</TableHead>
                    <TableHead className="text-right">Coupon Rate</TableHead>
                    <TableHead>Settlement Date</TableHead>
                    <TableHead>Maturity Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBonds?.map((bond) => (
                    <TableRow key={bond.id} data-testid={`row-bond-${bond.id}`}>
                      <TableCell className="font-medium" data-testid={`text-bond-name-${bond.id}`}>
                        {bond.bondName}
                      </TableCell>
                      <TableCell data-testid={`text-isin-${bond.id}`}>{bond.isin || "-"}</TableCell>
                      <TableCell data-testid={`text-investor-${bond.id}`}>
                        {getInvestorName(bond.investorId)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-face-value-${bond.id}`}>
                        {formatCurrency(bond.faceValue)}
                      </TableCell>
                      <TableCell className="text-right" data-testid={`text-coupon-rate-${bond.id}`}>
                        {bond.couponRate ? `${bond.couponRate}%` : "-"}
                      </TableCell>
                      <TableCell data-testid={`text-settlement-date-${bond.id}`}>
                        {formatDate(bond.settlementDate)}
                      </TableCell>
                      <TableCell data-testid={`text-maturity-date-${bond.id}`}>
                        {formatDate(bond.maturityDate)}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(bond.status)} data-testid={`badge-status-${bond.id}`}>
                          {getStatusLabel(bond.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${bond.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(bond)} data-testid={`button-edit-${bond.id}`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => deleteMutation.mutate(bond.id)}
                              className="text-destructive"
                              data-testid={`button-delete-${bond.id}`}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <BondFormDialog
        bond={selectedBond}
        investors={investors || []}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
