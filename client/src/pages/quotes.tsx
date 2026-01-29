import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, FileSpreadsheet, ArrowRight, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface Quote {
  id: string;
  quoteNumber: string;
  investorId: string | null;
  status: string;
  validUntil: string;
  subtotal: string;
  totalAmount: string;
  notes: string | null;
}

const statusColors: Record<string, string> = {
  draft: "bg-gray-500",
  sent: "bg-blue-500",
  accepted: "bg-green-500",
  rejected: "bg-red-500",
  expired: "bg-yellow-500",
  converted: "bg-purple-500",
};

export default function QuotesPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  const { data: investors = [] } = useQuery<any[]>({
    queryKey: ["/api/investors"],
  });

  const createQuote = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create quote");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setIsCreateOpen(false);
      toast({ title: "Quote created successfully" });
    },
  });

  const convertToInvoice = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quotes/${id}/convert`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to convert quote");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Quote converted to invoice" });
    },
  });

  const handleCreateQuote = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      investorId: formData.get("investorId") || null,
      validUntil: new Date(formData.get("validUntil") as string).toISOString(),
      subtotal: formData.get("subtotal"),
      totalAmount: formData.get("totalAmount"),
      notes: formData.get("notes") || null,
      status: "draft",
    };
    createQuote.mutate(data);
  };

  const getInvestorName = (investorId: string | null) => {
    if (!investorId) return "—";
    const investor = investors.find((i) => i.id === investorId);
    return investor ? `${investor.firstName} ${investor.lastName}` : "Unknown";
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quotes</h1>
          <p className="text-muted-foreground">Create and manage customer quotes</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Quote</DialogTitle>
              <DialogDescription>Create a quote for a customer</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateQuote} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="investorId">Customer</Label>
                <Select name="investorId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
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
              <div className="space-y-2">
                <Label htmlFor="validUntil">Valid Until</Label>
                <Input
                  id="validUntil"
                  name="validUntil"
                  type="date"
                  required
                  defaultValue={format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd")}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="subtotal">Subtotal</Label>
                  <Input id="subtotal" name="subtotal" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalAmount">Total Amount</Label>
                  <Input id="totalAmount" name="totalAmount" type="number" step="0.01" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createQuote.isPending}>
                  {createQuote.isPending ? "Creating..." : "Create Quote"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Quotes</CardTitle>
          <CardDescription>View and manage quotes</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading quotes...</div>
          ) : quotes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No quotes yet. Create your first quote to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">{quote.quoteNumber}</TableCell>
                    <TableCell>{getInvestorName(quote.investorId)}</TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[quote.status]} text-white`}>
                        {quote.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{format(new Date(quote.validUntil), "MMM d, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(quote.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {quote.status === "accepted" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => convertToInvoice.mutate(quote.id)}
                          >
                            <ArrowRight className="h-4 w-4" />
                            Convert
                          </Button>
                        )}
                      </div>
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
