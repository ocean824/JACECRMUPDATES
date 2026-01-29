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
import { Plus, Banknote, DollarSign, Check } from "lucide-react";
import { format } from "date-fns";

interface PayrollRecord {
  id: string;
  employeeId: string;
  payPeriodStart: string;
  payPeriodEnd: string;
  grossPay: string;
  deductions: string;
  netPay: string;
  status: string;
  paidAt: string | null;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeNumber: string;
  salary: string | null;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500",
  approved: "bg-blue-500",
  paid: "bg-green-500",
  cancelled: "bg-gray-500",
};

export default function PayrollPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: records = [], isLoading } = useQuery<PayrollRecord[]>({
    queryKey: ["/api/payroll"],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
  });

  const createRecord = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create payroll record");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      setIsCreateOpen(false);
      toast({ title: "Payroll record created" });
    },
  });

  const updateRecord = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/payroll/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update payroll record");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({ title: "Payroll record updated" });
    },
  });

  const handleCreateRecord = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const grossPay = parseFloat(formData.get("grossPay") as string);
    const deductions = parseFloat(formData.get("deductions") as string) || 0;
    const data = {
      employeeId: formData.get("employeeId"),
      payPeriodStart: new Date(formData.get("payPeriodStart") as string).toISOString(),
      payPeriodEnd: new Date(formData.get("payPeriodEnd") as string).toISOString(),
      grossPay: grossPay.toFixed(2),
      deductions: deductions.toFixed(2),
      netPay: (grossPay - deductions).toFixed(2),
      status: "pending",
    };
    createRecord.mutate(data);
  };

  const getEmployeeName = (employeeId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Unknown";
  };

  const totalGross = records.reduce((sum, r) => sum + parseFloat(r.grossPay || "0"), 0);
  const totalNet = records.reduce((sum, r) => sum + parseFloat(r.netPay || "0"), 0);
  const pendingCount = records.filter((r) => r.status === "pending").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payroll</h1>
          <p className="text-muted-foreground">Manage employee payroll records</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Payroll
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payroll Record</DialogTitle>
              <DialogDescription>Add a new payroll entry for an employee</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRecord} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="employeeId">Employee</Label>
                <Select name="employeeId" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName} ({emp.employeeNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="payPeriodStart">Period Start</Label>
                  <Input id="payPeriodStart" name="payPeriodStart" type="date" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="payPeriodEnd">Period End</Label>
                  <Input id="payPeriodEnd" name="payPeriodEnd" type="date" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="grossPay">Gross Pay</Label>
                  <Input id="grossPay" name="grossPay" type="number" step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deductions">Deductions</Label>
                  <Input id="deductions" name="deductions" type="number" step="0.01" defaultValue="0" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createRecord.isPending}>
                  Create Record
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{records.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Gross</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${totalGross.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Net</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${totalNet.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payroll Table */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll Records</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Banknote className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payroll records yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{getEmployeeName(record.employeeId)}</TableCell>
                    <TableCell>
                      {format(new Date(record.payPeriodStart), "MMM d")} - {format(new Date(record.payPeriodEnd), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(record.grossPay).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      ${parseFloat(record.deductions).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${parseFloat(record.netPay).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${statusColors[record.status]} text-white`}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateRecord.mutate({ id: record.id, data: { status: "approved" } })}
                        >
                          <Check className="h-4 w-4 text-green-600" />
                        </Button>
                      )}
                      {record.status === "approved" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateRecord.mutate({ id: record.id, data: { status: "paid", paidAt: new Date().toISOString() } })}
                        >
                          <DollarSign className="h-4 w-4 text-green-600" />
                        </Button>
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
