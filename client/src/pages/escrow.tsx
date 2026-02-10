import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useToast } from "@/hooks/use-toast";
import { Building2, Plus, Pencil, Trash2, Shield, Lock, Landmark } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface EscrowAccount {
  id: string;
  accountName: string;
  bankName: string | null;
  accountType: string | null;
  accountNumberLast4: string | null;
  routingNumberLast4: string | null;
  balance: string;
  currency: string;
  isActive: boolean;
  isDefault: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const accountTypeOptions = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "escrow", label: "Escrow" },
  { value: "trust", label: "Trust" },
];

const createFormSchema = z.object({
  accountName: z.string().min(1, "Account name is required"),
  bankName: z.string().optional(),
  accountType: z.string().optional(),
  accountNumber: z.string().min(1, "Account number is required"),
  routingNumber: z.string().min(1, "Routing number is required"),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

const editFormSchema = z.object({
  accountName: z.string().min(1, "Account name is required"),
  bankName: z.string().optional(),
  accountType: z.string().optional(),
  accountNumber: z.string().optional(),
  routingNumber: z.string().optional(),
  currency: z.string().default("USD"),
  notes: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type CreateFormValues = z.infer<typeof createFormSchema>;
type EditFormValues = z.infer<typeof editFormSchema>;

function CreateEscrowDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createFormSchema),
    defaultValues: {
      accountName: "",
      bankName: "",
      accountType: "",
      accountNumber: "",
      routingNumber: "",
      currency: "USD",
      notes: "",
      isDefault: false,
      isActive: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateFormValues) => {
      const res = await apiRequest("POST", "/api/escrow-accounts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/escrow-accounts"] });
      toast({ title: "Escrow account created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Failed to create escrow account", variant: "destructive" });
    },
  });

  const onSubmit = (data: CreateFormValues) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Escrow Account</DialogTitle>
          <DialogDescription>Add a new escrow account with encrypted banking information</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="accountName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Main Escrow Account" {...field} data-testid="input-accountName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="First National Bank" {...field} value={field.value || ""} data-testid="input-bankName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-accountType">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accountTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Account number" {...field} data-testid="input-accountNumber" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="routingNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Routing Number</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Routing number" {...field} data-testid="input-routingNumber" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input placeholder="USD" {...field} value={field.value || "USD"} data-testid="input-currency" />
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
                    <Textarea placeholder="Additional notes..." {...field} value={field.value || ""} data-testid="input-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between gap-4">
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormLabel className="mt-0">Default Account</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-isDefault"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormLabel className="mt-0">Active</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-isActive"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-create">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-create">
                {createMutation.isPending ? "Creating..." : "Create Account"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EditEscrowDialog({
  account,
  open,
  onOpenChange,
}: {
  account: EscrowAccount;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      accountName: account.accountName,
      bankName: account.bankName || "",
      accountType: account.accountType || "",
      accountNumber: "",
      routingNumber: "",
      currency: account.currency || "USD",
      notes: account.notes || "",
      isDefault: account.isDefault ?? false,
      isActive: account.isActive ?? true,
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditFormValues) => {
      const payload: Record<string, unknown> = {
        accountName: data.accountName,
        bankName: data.bankName,
        accountType: data.accountType,
        currency: data.currency,
        notes: data.notes,
        isDefault: data.isDefault,
        isActive: data.isActive,
      };
      if (data.accountNumber && data.accountNumber.length > 0) {
        payload.accountNumber = data.accountNumber;
      }
      if (data.routingNumber && data.routingNumber.length > 0) {
        payload.routingNumber = data.routingNumber;
      }
      const res = await apiRequest("PATCH", `/api/escrow-accounts/${account.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/escrow-accounts"] });
      toast({ title: "Escrow account updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Failed to update escrow account", variant: "destructive" });
    },
  });

  const onSubmit = (data: EditFormValues) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Escrow Account</DialogTitle>
          <DialogDescription>Update escrow account information</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="accountName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-edit-accountName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} data-testid="input-edit-bankName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="accountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-edit-accountType">
                        <SelectValue placeholder="Select account type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accountTypeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Number</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={account.accountNumberLast4 ? `****${account.accountNumberLast4}` : "Enter new number"}
                        {...field}
                        data-testid="input-edit-accountNumber"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="routingNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Routing Number</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder={account.routingNumberLast4 ? `****${account.routingNumberLast4}` : "Enter new number"}
                        {...field}
                        data-testid="input-edit-routingNumber"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="currency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || "USD"} data-testid="input-edit-currency" />
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
                    <Textarea {...field} value={field.value || ""} data-testid="input-edit-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between gap-4">
              <FormField
                control={form.control}
                name="isDefault"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormLabel className="mt-0">Default Account</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-isDefault"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormLabel className="mt-0">Active</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-edit-isActive"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-submit-edit">
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function formatMaskedNumber(last4: string | null): string {
  if (!last4) return "Not set";
  return `****${last4}`;
}

function formatAccountType(type: string | null): string {
  if (!type) return "—";
  const option = accountTypeOptions.find((o) => o.value === type);
  return option ? option.label : type;
}

export default function EscrowPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EscrowAccount | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<EscrowAccount | null>(null);
  const { toast } = useToast();

  const { data: accounts = [], isLoading } = useQuery<EscrowAccount[]>({
    queryKey: ["/api/escrow-accounts"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/escrow-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/escrow-accounts"] });
      toast({ title: "Escrow account deleted successfully" });
      setDeletingAccount(null);
    },
    onError: () => {
      toast({ title: "Failed to delete escrow account", variant: "destructive" });
    },
  });

  const activeAccounts = accounts.filter((a) => a.isActive);
  const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || "0"), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Escrow Accounts</h1>
          <p className="text-muted-foreground">Manage escrow accounts with encrypted banking information</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-new-account">
          <Plus className="h-4 w-4 mr-2" />
          New Account
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-accounts">{accounts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-accounts">{activeAccounts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-balance">
              ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground" data-testid="text-empty-state">No escrow accounts yet. Create your first account to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <Card key={account.id} data-testid={`card-escrow-${account.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-lg truncate" data-testid={`text-account-name-${account.id}`}>
                    {account.accountName}
                  </CardTitle>
                  {account.bankName && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1" data-testid={`text-bank-name-${account.id}`}>
                      <Building2 className="h-3 w-3 shrink-0" />
                      {account.bankName}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0 flex-wrap">
                  {account.isDefault && (
                    <Badge variant="secondary" data-testid={`badge-default-${account.id}`}>
                      <Shield className="h-3 w-3 mr-1" />
                      Default
                    </Badge>
                  )}
                  <Badge variant={account.isActive ? "default" : "secondary"} data-testid={`badge-status-${account.id}`}>
                    {account.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Type</span>
                    <p className="font-medium" data-testid={`text-account-type-${account.id}`}>{formatAccountType(account.accountType)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Currency</span>
                    <p className="font-medium" data-testid={`text-currency-${account.id}`}>{account.currency}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Account #
                    </span>
                    <p className="font-mono font-medium" data-testid={`text-account-number-${account.id}`}>
                      {formatMaskedNumber(account.accountNumberLast4)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      Routing #
                    </span>
                    <p className="font-mono font-medium" data-testid={`text-routing-number-${account.id}`}>
                      {formatMaskedNumber(account.routingNumberLast4)}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Balance</span>
                  <p className="text-xl font-bold" data-testid={`text-balance-${account.id}`}>
                    ${parseFloat(account.balance || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="flex items-center justify-end gap-1 pt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingAccount(account)}
                    data-testid={`button-edit-${account.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeletingAccount(account)}
                    data-testid={`button-delete-${account.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateEscrowDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />

      {editingAccount && (
        <EditEscrowDialog
          account={editingAccount}
          open={!!editingAccount}
          onOpenChange={(open) => !open && setEditingAccount(null)}
        />
      )}

      <AlertDialog open={!!deletingAccount} onOpenChange={(open) => !open && setDeletingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Escrow Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingAccount?.accountName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAccount && deleteMutation.mutate(deletingAccount.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
