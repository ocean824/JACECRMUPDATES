import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
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
import { Plus, Search, FileText, MoreHorizontal, Eye, Trash2, X, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { JournalEntry, JournalEntryLine, Account } from "@shared/schema";

const lineSchema = z.object({
  accountId: z.string().min(1, "Account is required"),
  debit: z.string().optional(),
  credit: z.string().optional(),
  description: z.string().optional(),
});

const formSchema = z.object({
  entryNumber: z.string().min(1, "Entry number is required"),
  description: z.string().min(1, "Description is required"),
  date: z.string().min(1, "Date is required"),
  lines: z.array(lineSchema).min(2, "At least 2 lines are required"),
});

type FormValues = z.infer<typeof formSchema>;

function JournalEntryFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const { data: accounts } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entryNumber: `JE-${Date.now().toString(36).toUpperCase()}`,
      description: "",
      date: new Date().toISOString().split('T')[0],
      lines: [
        { accountId: "", debit: "", credit: "", description: "" },
        { accountId: "", debit: "", credit: "", description: "" },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const entryData = {
        entryNumber: data.entryNumber,
        description: data.description,
        date: data.date,
      };
      const entry = await apiRequest("POST", "/api/journal-entries", entryData);
      const entryResult = await entry.json();
      
      for (const line of data.lines) {
        if (line.accountId && (line.debit || line.credit)) {
          await apiRequest("POST", "/api/journal-entry-lines", {
            journalEntryId: entryResult.id,
            accountId: line.accountId,
            debit: line.debit || "0",
            credit: line.credit || "0",
            description: line.description,
          });
        }
      }
      return entryResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      toast({ title: "Success", description: "Journal entry created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create journal entry", variant: "destructive" });
    },
  });

  const onSubmit = (data: FormValues) => {
    const totalDebits = data.lines.reduce((sum, l) => sum + parseFloat(l.debit || "0"), 0);
    const totalCredits = data.lines.reduce((sum, l) => sum + parseFloat(l.credit || "0"), 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      toast({ 
        title: "Unbalanced Entry", 
        description: "Total debits must equal total credits", 
        variant: "destructive" 
      });
      return;
    }
    
    createMutation.mutate(data);
  };

  const watchLines = form.watch("lines");
  const totalDebits = watchLines.reduce((sum, l) => sum + parseFloat(l.debit || "0"), 0);
  const totalCredits = watchLines.reduce((sum, l) => sum + parseFloat(l.credit || "0"), 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Journal Entry</DialogTitle>
          <DialogDescription>
            Record a new double-entry journal transaction
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="entryNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Number</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-entry-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-entry-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Entry description..." {...field} data-testid="input-entry-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FormLabel>Entry Lines</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ accountId: "", debit: "", credit: "", description: "" })}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="w-28">Debit</TableHead>
                      <TableHead className="w-28">Credit</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => (
                      <TableRow key={field.id}>
                        <TableCell className="p-2">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.accountId`}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger className="h-9" data-testid={`select-account-${index}`}>
                                  <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                                <SelectContent>
                                  {accounts?.map((account) => (
                                    <SelectItem key={account.id} value={account.id}>
                                      {account.code} - {account.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.debit`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                placeholder="0.00"
                                className="h-9"
                                {...field}
                                data-testid={`input-debit-${index}`}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          <FormField
                            control={form.control}
                            name={`lines.${index}.credit`}
                            render={({ field }) => (
                              <Input
                                type="number"
                                placeholder="0.00"
                                className="h-9"
                                {...field}
                                data-testid={`input-credit-${index}`}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell className="p-2">
                          {fields.length > 2 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => remove(index)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
                <span className="text-sm font-medium">Totals:</span>
                <div className="flex items-center gap-6">
                  <span className={`text-sm font-mono ${!isBalanced ? 'text-destructive' : ''}`}>
                    Debits: ${totalDebits.toFixed(2)}
                  </span>
                  <span className={`text-sm font-mono ${!isBalanced ? 'text-destructive' : ''}`}>
                    Credits: ${totalCredits.toFixed(2)}
                  </span>
                  {isBalanced ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                      Balanced
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                      Unbalanced
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !isBalanced}
                data-testid="button-save-entry"
              >
                {createMutation.isPending ? "Saving..." : "Create Entry"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

interface JournalEntryDetail extends JournalEntry {
  lines?: (JournalEntryLine & { accountName?: string })[];
}

export default function JournalPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const { toast } = useToast();

  const { data: entries, isLoading } = useQuery<JournalEntry[]>({
    queryKey: ["/api/journal-entries"],
  });

  const { data: entryDetail, isLoading: isDetailLoading } = useQuery<JournalEntryDetail>({
    queryKey: ["/api/journal-entries", selectedEntryId],
    enabled: !!selectedEntryId && detailOpen,
  });

  const { data: accountsList } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });

  const accountMap = new Map(accountsList?.map((a) => [a.id, a.name]) ?? []);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/journal-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      toast({ title: "Success", description: "Entry deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete entry", variant: "destructive" });
    },
  });

  const filteredEntries = entries?.filter((entry) => {
    const search = searchQuery.toLowerCase();
    return (
      entry.entryNumber.toLowerCase().includes(search) ||
      entry.description.toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Journal Entries</h1>
          <p className="text-muted-foreground">
            Record and manage double-entry accounting transactions
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-add-entry">
          <Plus className="h-4 w-4 mr-2" />
          New Entry
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              All Entries
              {entries && (
                <Badge variant="secondary" className="ml-2">
                  {entries.length}
                </Badge>
              )}
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entries..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-entries"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-48 flex-1" />
                  <Skeleton className="h-4 w-24" />
                </div>
              ))}
            </div>
          ) : filteredEntries && filteredEntries.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Entry #</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.map((entry) => (
                    <TableRow key={entry.id} data-testid={`row-entry-${entry.id}`}>
                      <TableCell className="font-mono text-sm font-medium">
                        {entry.entryNumber}
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-1">{entry.description}</p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(entry.date).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-menu-entry-${entry.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedEntryId(entry.id);
                                setDetailOpen(true);
                              }}
                              data-testid={`button-view-entry-${entry.id}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteMutation.mutate(entry.id)}
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
              <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-1">No journal entries found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery ? "Try adjusting your search" : "Get started by creating your first entry"}
              </p>
              {!searchQuery && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Entry
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <JournalEntryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />

      <Dialog open={detailOpen} onOpenChange={(open) => { setDetailOpen(open); if (!open) setSelectedEntryId(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Journal Entry Details</DialogTitle>
            <DialogDescription>
              {entryDetail?.entryNumber} — {entryDetail?.description}
            </DialogDescription>
          </DialogHeader>
          {isDetailLoading ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : entryDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Entry #</span>
                  <p className="font-mono font-medium">{entryDetail.entryNumber}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <p>{new Date(entryDetail.date).toLocaleDateString()}</p>
                </div>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Description</span>
                <p>{entryDetail.description}</p>
              </div>
              {entryDetail.lines && entryDetail.lines.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Line Items</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Account</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {entryDetail.lines.map((line, idx) => (
                        <TableRow key={line.id || idx}>
                          <TableCell className="text-sm">
                            {accountMap.get(line.accountId) || line.accountId}
                            {line.description && (
                              <p className="text-xs text-muted-foreground">{line.description}</p>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {Number(line.debit) > 0 ? `$${Number(line.debit).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            {Number(line.credit) > 0 ? `$${Number(line.credit).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end gap-6 mt-2 text-sm font-medium border-t pt-2">
                    <span>Total Debit: ${entryDetail.lines.reduce((sum, l) => sum + Number(l.debit || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    <span>Total Credit: ${entryDetail.lines.reduce((sum, l) => sum + Number(l.credit || 0), 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground py-4">Entry not found.</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
