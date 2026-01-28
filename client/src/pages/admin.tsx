import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Shield, Plus, Users, AlertCircle, UserPlus, Check, X, Clock,
  LayoutDashboard, Wallet, ClipboardList, FileText, ShieldCheck, 
  History, LogOut, Loader2, TrendingUp, DollarSign, UserCheck
} from "lucide-react";

type PendingRegistration = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: string;
};

type UserRole = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
};

type DashboardStats = {
  totalInvestors: number;
  pendingKyc: number;
  totalInvestment: number;
  pendingTasks: number;
  recentDocuments: number;
  auditEventsToday: number;
};

const roleOptions = [
  { value: "admin", label: "Admin", description: "Full system access" },
  { value: "accounting", label: "Accounting", description: "Financial operations" },
  { value: "investor_relations", label: "Investor Relations", description: "Investor management" },
  { value: "ops", label: "Operations", description: "Day-to-day operations" },
];

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case "admin":
      return "default";
    case "accounting":
      return "secondary";
    case "investor_relations":
      return "outline";
    case "ops":
      return "outline";
    default:
      return "outline";
  }
}

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("investor_relations");
  const [registrationToReject, setRegistrationToReject] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: authData, isLoading: authLoading, isError: authError } = useQuery<{ id: string; email: string; isAdmin?: string }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: currentRole, isLoading: roleLoading } = useQuery<{ role: string }>({
    queryKey: ["/api/user/role"],
    enabled: !!authData,
  });

  const { data: roles, isLoading: rolesLoading } = useQuery<UserRole[]>({
    queryKey: ["/api/admin/roles"],
    enabled: authData?.isAdmin === "true" || currentRole?.role === "admin",
  });

  const { data: pendingRegistrations, isLoading: isPendingLoading } = useQuery<PendingRegistration[]>({
    queryKey: ["/api/auth/pending-registrations"],
    enabled: authData?.isAdmin === "true" || currentRole?.role === "admin",
  });

  const { data: investors } = useQuery<any[]>({
    queryKey: ["/api/investors"],
    enabled: authData?.isAdmin === "true" || currentRole?.role === "admin",
  });

  const { data: tasks } = useQuery<any[]>({
    queryKey: ["/api/tasks"],
    enabled: authData?.isAdmin === "true" || currentRole?.role === "admin",
  });

  const { data: journalEntries } = useQuery<any[]>({
    queryKey: ["/api/journal-entries"],
    enabled: authData?.isAdmin === "true" || currentRole?.role === "admin",
  });

  const { data: auditLogs } = useQuery<any[]>({
    queryKey: ["/api/audit-logs"],
    enabled: authData?.isAdmin === "true" || currentRole?.role === "admin",
  });

  useEffect(() => {
    if (!authLoading && (authError || !authData)) {
      setLocation("/admin-login");
    }
  }, [authLoading, authError, authData, setLocation]);

  const addRoleMutation = useMutation({
    mutationFn: async (data: { userId: string; role: string }) => {
      return apiRequest("POST", "/api/admin/roles", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/roles"] });
      toast({
        title: "Role assigned",
        description: "User role has been updated successfully.",
      });
      setShowAddDialog(false);
      setNewUserId("");
      setNewRole("investor_relations");
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to assign role. Please try again.",
      });
    },
  });

  const approveRegistrationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/auth/approve-registration/${id}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/pending-registrations"] });
      toast({
        title: "Invite Sent",
        description: `Invite PIN has been sent to the user. Expires in 2 hours.`,
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve registration. Please try again.",
      });
    },
  });

  const rejectRegistrationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/auth/reject-registration/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/pending-registrations"] });
      toast({
        title: "Registration Rejected",
        description: "The registration request has been rejected.",
      });
      setRegistrationToReject(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to reject registration. Please try again.",
      });
    },
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      queryClient.clear();
      setLocation("/admin-login");
    } catch {
      toast({ variant: "destructive", title: "Logout failed" });
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!authData || (authData.isAdmin !== "true" && currentRole?.role !== "admin")) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="text-center py-12">
          <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground mb-4">
            You need administrator privileges to access this page.
          </p>
          <Button onClick={() => setLocation("/admin-login")} data-testid="button-go-login">
            Go to Admin Login
          </Button>
        </div>
      </div>
    );
  }

  const stats: DashboardStats = {
    totalInvestors: investors?.length || 0,
    pendingKyc: investors?.filter((i: any) => i.kycStatus === "pending").length || 0,
    totalInvestment: investors?.reduce((sum: number, i: any) => sum + (Number(i.investmentAmount) || 0), 0) || 0,
    pendingTasks: tasks?.filter((t: any) => t.status !== "completed").length || 0,
    recentDocuments: 0,
    auditEventsToday: auditLogs?.length || 0,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold" data-testid="text-page-title">
                JACE Admin Dashboard
              </h1>
              <p className="text-xs text-muted-foreground">
                Logged in as {authData.email}
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} data-testid="button-logout">
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2" data-testid="tab-users">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Users</span>
            </TabsTrigger>
            <TabsTrigger value="investors" className="flex items-center gap-2" data-testid="tab-investors">
              <UserCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Investors</span>
            </TabsTrigger>
            <TabsTrigger value="accounting" className="flex items-center gap-2" data-testid="tab-accounting">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Accounting</span>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex items-center gap-2" data-testid="tab-tasks">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Tasks</span>
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2" data-testid="tab-compliance">
              <ShieldCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Compliance</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2" data-testid="tab-audit">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Audit</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Investors</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalInvestors}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.pendingKyc} pending KYC
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Investment</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${stats.totalInvestment.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Across all investors
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.pendingTasks}</div>
                  <p className="text-xs text-muted-foreground">
                    Tasks requiring attention
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending Registrations</CardTitle>
                  <UserPlus className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pendingRegistrations?.length || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting approval
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("users")} data-testid="button-manage-users">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Users & Roles
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("investors")} data-testid="button-view-investors">
                    <UserCheck className="h-4 w-4 mr-2" />
                    View All Investors
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("accounting")} data-testid="button-view-accounting">
                    <Wallet className="h-4 w-4 mr-2" />
                    View Journal Entries
                  </Button>
                  <Button className="w-full justify-start" variant="outline" onClick={() => setActiveTab("audit")} data-testid="button-view-audit">
                    <History className="h-4 w-4 mr-2" />
                    View Audit Logs
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Pending Registrations
                  </CardTitle>
                  <CardDescription>Users awaiting admin approval</CardDescription>
                </CardHeader>
                <CardContent>
                  {isPendingLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : pendingRegistrations && pendingRegistrations.length > 0 ? (
                    <div className="space-y-2">
                      {pendingRegistrations.slice(0, 3).map((reg) => (
                        <div key={reg.id} className="flex items-center justify-between p-2 border rounded-md">
                          <div>
                            <p className="font-medium text-sm">{reg.firstName} {reg.lastName}</p>
                            <p className="text-xs text-muted-foreground">{reg.email}</p>
                          </div>
                          <Button size="sm" onClick={() => approveRegistrationMutation.mutate(reg.id)} data-testid={`button-quick-approve-${reg.id}`}>
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                        </div>
                      ))}
                      {pendingRegistrations.length > 3 && (
                        <Button variant="ghost" className="w-full" onClick={() => setActiveTab("users")}>
                          View all {pendingRegistrations.length} pending
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm text-center py-4">No pending registrations</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-5 w-5" />
                    Pending Registrations
                  </CardTitle>
                  <CardDescription>
                    Approve or reject user registration requests
                  </CardDescription>
                </div>
                {pendingRegistrations && pendingRegistrations.length > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {pendingRegistrations.length} pending
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                {isPendingLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : pendingRegistrations && pendingRegistrations.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Requested</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingRegistrations.map((reg) => (
                          <TableRow key={reg.id} data-testid={`row-pending-${reg.id}`}>
                            <TableCell className="font-medium">
                              {reg.firstName} {reg.lastName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {reg.email}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(reg.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approveRegistrationMutation.mutate(reg.id)}
                                  disabled={approveRegistrationMutation.isPending}
                                  data-testid={`button-approve-${reg.id}`}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Confirm & Send Invite
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setRegistrationToReject(reg.id)}
                                  disabled={rejectRegistrationMutation.isPending}
                                  data-testid={`button-reject-${reg.id}`}
                                >
                                  <X className="h-4 w-4 mr-1" />
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <UserPlus className="h-10 w-10 mx-auto mb-3 opacity-50" />
                    <p>No pending registration requests</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Roles
                  </CardTitle>
                  <CardDescription>
                    Assign roles to control user access and permissions
                  </CardDescription>
                </div>
                <Button onClick={() => setShowAddDialog(true)} data-testid="button-add-role">
                  <Plus className="h-4 w-4 mr-2" />
                  Assign Role
                </Button>
              </CardHeader>
              <CardContent>
                {rolesLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : roles && roles.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User ID</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead className="text-right">Assigned On</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roles.map((role) => (
                          <TableRow key={role.id} data-testid={`row-role-${role.id}`}>
                            <TableCell className="font-mono text-sm">
                              {role.userId}
                            </TableCell>
                            <TableCell>
                              <Badge variant={getRoleBadgeVariant(role.role)}>
                                {role.role.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right text-sm text-muted-foreground">
                              {new Date(role.createdAt).toLocaleDateString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No user roles assigned yet</p>
                  </div>
                )}

                <div className="mt-6 pt-6 border-t">
                  <h3 className="font-semibold mb-4">Role Descriptions</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roleOptions.map((role) => (
                      <div key={role.value} className="p-4 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getRoleBadgeVariant(role.value)}>
                            {role.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {role.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="investors" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  All Investors
                </CardTitle>
                <CardDescription>Complete list of investors in the system</CardDescription>
              </CardHeader>
              <CardContent>
                {investors && investors.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Pipeline Stage</TableHead>
                          <TableHead>KYC Status</TableHead>
                          <TableHead className="text-right">Investment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {investors.map((investor: any) => (
                          <TableRow key={investor.id} data-testid={`row-investor-${investor.id}`}>
                            <TableCell className="font-medium">
                              {investor.firstName} {investor.lastName}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{investor.email}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{investor.pipelineStage}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={investor.kycStatus === "approved" ? "default" : "secondary"}>
                                {investor.kycStatus}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              ${Number(investor.investmentAmount || 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <UserCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No investors found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounting" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Journal Entries
                </CardTitle>
                <CardDescription>All accounting journal entries</CardDescription>
              </CardHeader>
              <CardContent>
                {journalEntries && journalEntries.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Total Debit</TableHead>
                          <TableHead className="text-right">Total Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {journalEntries.map((entry: any) => (
                          <TableRow key={entry.id} data-testid={`row-journal-${entry.id}`}>
                            <TableCell>{new Date(entry.entryDate).toLocaleDateString()}</TableCell>
                            <TableCell>{entry.description}</TableCell>
                            <TableCell className="text-right">${Number(entry.totalDebit || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right">${Number(entry.totalCredit || 0).toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No journal entries found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  All Tasks
                </CardTitle>
                <CardDescription>Tasks across all users</CardDescription>
              </CardHeader>
              <CardContent>
                {tasks && tasks.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Title</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Due Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tasks.map((task: any) => (
                          <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                            <TableCell className="font-medium">{task.title}</TableCell>
                            <TableCell>
                              <Badge variant={task.priority === "high" ? "destructive" : "outline"}>
                                {task.priority}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                                {task.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tasks found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  Compliance Overview
                </CardTitle>
                <CardDescription>KYC status and compliance tracking</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Pending KYC</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-amber-500">{stats.pendingKyc}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Approved</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-500">
                        {investors?.filter((i: any) => i.kycStatus === "approved").length || 0}
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Submitted</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-blue-500">
                        {investors?.filter((i: any) => i.kycStatus === "submitted").length || 0}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Audit Log
                </CardTitle>
                <CardDescription>System activity and changes</CardDescription>
              </CardHeader>
              <CardContent>
                {auditLogs && auditLogs.length > 0 ? (
                  <div className="border rounded-md">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Timestamp</TableHead>
                          <TableHead>Action</TableHead>
                          <TableHead>Entity</TableHead>
                          <TableHead>Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditLogs.slice(0, 50).map((log: any) => (
                          <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                            <TableCell className="text-sm">
                              {new Date(log.createdAt).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.action}</Badge>
                            </TableCell>
                            <TableCell>{log.entityType}</TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                              {log.details}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No audit logs found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign User Role</DialogTitle>
            <DialogDescription>
              Enter the user ID and select a role to assign.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="Enter user ID"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                data-testid="input-user-id"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddDialog(false)}
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={() => addRoleMutation.mutate({ userId: newUserId, role: newRole })}
              disabled={!newUserId || addRoleMutation.isPending}
              data-testid="button-confirm-add"
            >
              {addRoleMutation.isPending ? "Assigning..." : "Assign Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!registrationToReject} onOpenChange={() => setRegistrationToReject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Registration?</AlertDialogTitle>
            <AlertDialogDescription>
              This will reject the user's registration request. They will need to submit a new request if they want to register again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-reject">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => registrationToReject && rejectRegistrationMutation.mutate(registrationToReject)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-reject"
            >
              Reject Registration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
