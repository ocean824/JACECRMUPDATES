import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
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
  DialogTrigger,
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
import { Plus, Search, Users, MoreHorizontal, Pencil, Trash2, CheckSquare, Square } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { insertInvestorSchema, pipelineStages, investorTypes, type Investor } from "@shared/schema";

const formSchema = insertInvestorSchema.extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  company: z.string().optional(),
  investorType: z.string().optional(),
  investmentAmount: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const pipelineColors: Record<string, string> = {
  lead: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  contacted: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  kyc_pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  documents: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  ready: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  closed: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
};

function InvestorFormDialog({
  investor,
  open,
  onOpenChange,
}: {
  investor?: Investor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEditing = !!investor;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      firstName: investor?.firstName || "",
      lastName: investor?.lastName || "",
      email: investor?.email || "",
      phone: investor?.phone || "",
      company: investor?.company || "",
      investorType: investor?.investorType || "individual",
      pipelineStage: investor?.pipelineStage || "lead",
      investmentAmount: investor?.investmentAmount?.toString() || "",
      notes: investor?.notes || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("POST", "/api/investors", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investors"] });
      toast({ title: "Success", description: "Investor created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create investor", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      return apiRequest("PATCH", `/api/investors/${investor?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investors"] });
      toast({ title: "Success", description: "Investor updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update investor", variant: "destructive" });
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Investor" : "Add New Investor"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update investor information" : "Enter the investor's details below"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} data-testid="input-first-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} data-testid="input-last-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="john@example.com" {...field} data-testid="input-email" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 000-0000" {...field} data-testid="input-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} data-testid="input-company" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="investorType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investor Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-investor-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {investorTypes.map((type) => (
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
                name="pipelineStage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pipeline Stage</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-pipeline-stage">
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pipelineStages.map((stage) => (
                          <SelectItem key={stage.value} value={stage.value}>
                            {stage.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="investmentAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Investment Amount</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="100000" {...field} data-testid="input-investment" />
                  </FormControl>
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
                    <Textarea placeholder="Additional notes..." {...field} data-testid="input-notes" />
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
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-investor"
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

const investorTypeColors: Record<string, string> = {
  individual: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  institutional: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300",
  fund: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
};

export default function InvestorsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<Investor | undefined>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: investors, isLoading } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/investors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investors"] });
      toast({ title: "Success", description: "Investor deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete investor", variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updates }: { ids: string[]; updates: Record<string, any> }) => {
      return apiRequest("PATCH", "/api/investors/bulk", { ids, updates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investors"] });
      setSelectedIds([]);
      toast({ title: "Success", description: "Investors updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update investors", variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      return apiRequest("DELETE", "/api/investors/bulk", { ids });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/investors"] });
      setSelectedIds([]);
      setBulkDeleteDialogOpen(false);
      toast({ title: "Success", description: "Investors deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete investors", variant: "destructive" });
    },
  });

  const filteredInvestors = investors?.filter((investor) => {
    const search = searchQuery.toLowerCase();
    const matchesSearch = 
      investor.firstName.toLowerCase().includes(search) ||
      investor.lastName.toLowerCase().includes(search) ||
      investor.email.toLowerCase().includes(search) ||
      investor.company?.toLowerCase().includes(search);
    
    const matchesType = typeFilter === "all" || investor.investorType === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const handleEdit = (investor: Investor) => {
    setSelectedInvestor(investor);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedInvestor(undefined);
    setDialogOpen(true);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (filteredInvestors) {
      if (selectedIds.length === filteredInvestors.length) {
        setSelectedIds([]);
      } else {
        setSelectedIds(filteredInvestors.map((i) => i.id));
      }
    }
  };

  const handleBulkPipelineUpdate = (stage: string) => {
    bulkUpdateMutation.mutate({ ids: selectedIds, updates: { pipelineStage: stage } });
  };

  const handleBulkTypeUpdate = (type: string) => {
    bulkUpdateMutation.mutate({ ids: selectedIds, updates: { investorType: type } });
  };

  const isAllSelected = filteredInvestors && filteredInvestors.length > 0 && selectedIds.length === filteredInvestors.length;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Investors</h1>
          <p className="text-muted-foreground">
            Manage your investor profiles and track their journey
          </p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-investor">
          <Plus className="h-4 w-4 mr-2" />
          Add Investor
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              All Investors
              {investors && (
                <Badge variant="secondary" className="ml-2">
                  {investors.length}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-3">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-36" data-testid="select-filter-type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {investorTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search investors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="input-search-investors"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 p-3 mb-4 bg-muted rounded-lg" data-testid="bulk-actions-toolbar">
              <span className="text-sm font-medium" data-testid="text-selected-count">
                {selectedIds.length} selected
              </span>
              <Select onValueChange={handleBulkPipelineUpdate}>
                <SelectTrigger className="w-44" data-testid="select-bulk-pipeline-stage">
                  <SelectValue placeholder="Update Pipeline Stage" />
                </SelectTrigger>
                <SelectContent>
                  {pipelineStages.map((stage) => (
                    <SelectItem key={stage.value} value={stage.value}>
                      {stage.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={handleBulkTypeUpdate}>
                <SelectTrigger className="w-36" data-testid="select-bulk-investor-type">
                  <SelectValue placeholder="Update Type" />
                </SelectTrigger>
                <SelectContent>
                  {investorTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteDialogOpen(true)}
                data-testid="button-bulk-delete"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          ) : filteredInvestors && filteredInvestors.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Investment</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvestors.map((investor) => (
                    <TableRow key={investor.id} data-testid={`row-investor-${investor.id}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(investor.id)}
                          onCheckedChange={() => toggleSelection(investor.id)}
                          data-testid={`checkbox-investor-${investor.id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <Link href={`/investors/${investor.id}`}>
                          <div className="flex items-center gap-3 hover-elevate rounded-md cursor-pointer">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-medium">
                              {investor.firstName[0]}{investor.lastName[0]}
                            </div>
                            <div>
                              <p className="font-medium" data-testid={`link-investor-${investor.id}`}>{investor.firstName} {investor.lastName}</p>
                              <p className="text-xs text-muted-foreground">{investor.phone}</p>
                            </div>
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{investor.email}</TableCell>
                      <TableCell>{investor.company || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={investorTypeColors[investor.investorType]}>
                          {investorTypes.find(t => t.value === investor.investorType)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={pipelineColors[investor.pipelineStage]}>
                          {pipelineStages.find(s => s.value === investor.pipelineStage)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {investor.investmentAmount ? `$${parseFloat(String(investor.investmentAmount)).toLocaleString()}` : "-"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-menu-${investor.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(investor)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(investor.id)}
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
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-1">No investors found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search" : "Get started by adding your first investor"}
              </p>
              {!searchQuery && (
                <Button onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Investor
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <InvestorFormDialog
        investor={selectedInvestor}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} investors?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected investors and all their associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-bulk-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedIds)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
