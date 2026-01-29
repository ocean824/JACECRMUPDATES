import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Plus, Banknote, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";

interface EscrowAccount {
  id: string;
  accountName: string;
  accountNumber: string | null;
  balance: string;
  currency: string;
  status: string;
  investorId: string | null;
}

const statusColors: Record<string, string> = {
  active: "bg-green-500",
  frozen: "bg-blue-500",
  closed: "bg-gray-500",
};

export default function EscrowPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EscrowAccount | null>(null);
  const [isTransactionOpen, setIsTransactionOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<EscrowAccount[]>({
    queryKey: ["/api/escrow-accounts"],
  });

  const { data: investors = [] } = useQuery<any[]>({
    queryKey: ["/api/investors"],
  });

  const createAccount = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/escrow-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create escrow account");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/escrow-accounts"] });
      setIsCreateOpen(false);
      toast({ title: "Escrow account created" });
    },
  });

  const createTransaction = useMutation({
    mutationFn: async ({ accountId, data }: { accountId: string; data: any }) => {
      const res = await fetch(`/api/escrow-accounts/${accountId}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create transaction");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/escrow-accounts"] });
      setIsTransactionOpen(false);
      setSelectedAccount(null);
      toast({ title: "Transaction recorded" });
    },
  });

  const handleCreateAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      accountName: formData.get("accountName"),
      investorId: formData.get("investorId") || null,
      balance: "0",
      status: "active",
    };
    createAccount.mutate(data);
  };

  const handleCreateTransaction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAccount) return;
    const formData = new FormData(e.currentTarget);
    const data = {
      transactionType: formData.get("transactionType"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      reference: formData.get("reference") || null,
    };
    createTransaction.mutate({ accountId: selectedAccount.id, data });
  };

  const totalBalance = accounts.reduce((sum, acc) => sum + parseFloat(acc.balance || "0"), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Escrow Accounts</h1>
          <p className="text-muted-foreground">Manage escrow accounts and transactions</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Escrow Account</DialogTitle>
              <DialogDescription>Set up a new escrow account</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">Account Name</Label>
                <Input id="accountName" name="accountName" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="investorId">Associated Investor (Optional)</Label>
                <Select name="investorId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select investor" />
                  </SelectTrigger>
                  <SelectContent>
                    {investors.map((investor) => (
                      <SelectItem key={investor.id} value={investor.id}>
                        {investor.firstName} {investor.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createAccount.isPending}>
                  Create Account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {accounts.filter((a) => a.status === "active").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Escrow Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : accounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No escrow accounts yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Account #</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.accountName}</TableCell>
                    <TableCell className="font-mono">{account.accountNumber || "—"}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[account.status]} text-white`}>
                        {account.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(account.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAccount(account);
                            setIsTransactionOpen(true);
                          }}
                        >
                          <ArrowUpRight className="h-4 w-4 text-green-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transaction Dialog */}
      <Dialog open={isTransactionOpen} onOpenChange={setIsTransactionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Transaction</DialogTitle>
            <DialogDescription>
              {selectedAccount?.accountName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTransaction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="transactionType">Type</Label>
              <Select name="transactionType" required>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" name="description" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reference">Reference</Label>
              <Input id="reference" name="reference" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTransactionOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTransaction.isPending}>
                Record
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
