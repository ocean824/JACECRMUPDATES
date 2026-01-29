import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Scale, PieChart, DollarSign, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";

interface TrialBalanceItem {
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
}

interface IncomeStatementData {
  revenue: { name: string; amount: number }[];
  expenses: { name: string; amount: number }[];
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  period: { start: string; end: string };
}

interface BalanceSheetData {
  assets: { name: string; amount: number; type: string }[];
  liabilities: { name: string; amount: number; type: string }[];
  equity: { name: string; amount: number }[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  asOfDate: string;
}

export function TrialBalancePage() {
  const { data: trialBalance = [], isLoading, refetch } = useQuery<TrialBalanceItem[]>({
    queryKey: ["/api/reports/trial-balance"],
  });

  const totalDebits = trialBalance.reduce((sum, item) => sum + item.debit, 0);
  const totalCredits = trialBalance.reduce((sum, item) => sum + item.credit, 0);
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trial Balance</h1>
          <p className="text-muted-foreground">Summary of all account balances</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Trial Balance as of {format(new Date(), "MMMM d, yyyy")}
          </CardTitle>
          <CardDescription>
            {isBalanced ? (
              <span className="text-green-600">✓ Debits and Credits are balanced</span>
            ) : (
              <span className="text-red-600">⚠ Debits and Credits are not balanced</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading trial balance...</div>
          ) : trialBalance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Scale className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No account data available. Create journal entries to generate the trial balance.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account Code</TableHead>
                  <TableHead>Account Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialBalance.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono">{item.accountCode}</TableCell>
                    <TableCell>{item.accountName}</TableCell>
                    <TableCell className="capitalize">{item.accountType}</TableCell>
                    <TableCell className="text-right">
                      {item.debit > 0 ? `$${item.debit.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.credit > 0 ? `$${item.credit.toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted">
                  <TableCell colSpan={3}>Totals</TableCell>
                  <TableCell className="text-right">
                    ${totalDebits.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    ${totalCredits.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function IncomeStatementPage() {
  const [startDate, setStartDate] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: incomeStatement, isLoading, refetch } = useQuery<IncomeStatementData>({
    queryKey: ["/api/reports/income-statement", startDate, endDate],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Income Statement</h1>
          <p className="text-muted-foreground">Revenue and expenses summary</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Period Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : !incomeStatement?.revenue?.length ? (
              <p className="text-muted-foreground">No revenue data</p>
            ) : (
              <Table>
                <TableBody>
                  {incomeStatement.revenue.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">
                        ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total Revenue</TableCell>
                    <TableCell className="text-right text-green-600">
                      ${(incomeStatement?.totalRevenue || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : !incomeStatement?.expenses?.length ? (
              <p className="text-muted-foreground">No expense data</p>
            ) : (
              <Table>
                <TableBody>
                  {incomeStatement.expenses.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">
                        ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total Expenses</TableCell>
                    <TableCell className="text-right text-red-600">
                      ${(incomeStatement?.totalExpenses || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Net Income</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-4xl font-bold ${(incomeStatement?.netIncome || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
            ${(incomeStatement?.netIncome || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function BalanceSheetPage() {
  const { data: balanceSheet, isLoading, refetch } = useQuery<BalanceSheetData>({
    queryKey: ["/api/reports/balance-sheet"],
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Balance Sheet</h1>
          <p className="text-muted-foreground">Assets, liabilities, and equity snapshot</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-blue-600" />
              Assets
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : !balanceSheet?.assets?.length ? (
              <p className="text-muted-foreground">No asset data</p>
            ) : (
              <Table>
                <TableBody>
                  {balanceSheet.assets.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-right">
                        ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-bold border-t-2">
                    <TableCell>Total Assets</TableCell>
                    <TableCell className="text-right text-blue-600">
                      ${(balanceSheet?.totalAssets || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-red-600">Liabilities</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : !balanceSheet?.liabilities?.length ? (
                <p className="text-muted-foreground">No liability data</p>
              ) : (
                <Table>
                  <TableBody>
                    {balanceSheet.liabilities.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">
                          ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total Liabilities</TableCell>
                      <TableCell className="text-right text-red-600">
                        ${(balanceSheet?.totalLiabilities || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Equity</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground">Loading...</div>
              ) : !balanceSheet?.equity?.length ? (
                <p className="text-muted-foreground">No equity data</p>
              ) : (
                <Table>
                  <TableBody>
                    {balanceSheet.equity.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell className="text-right">
                          ${item.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total Equity</TableCell>
                      <TableCell className="text-right text-green-600">
                        ${(balanceSheet?.totalEquity || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-muted-foreground mb-2">Accounting Equation Check</p>
            <p className="text-lg">
              Assets = Liabilities + Equity
            </p>
            <p className="text-xl font-mono mt-2">
              ${(balanceSheet?.totalAssets || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} = 
              ${(balanceSheet?.totalLiabilities || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })} + 
              ${(balanceSheet?.totalEquity || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
