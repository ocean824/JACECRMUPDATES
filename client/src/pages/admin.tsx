import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Shield, Plus, Users, AlertCircle } from "lucide-react";

type UserRole = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
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
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState("investor_relations");

  const { data: currentRole } = useQuery<{ role: string }>({
    queryKey: ["/api/user/role"],
  });

  const { data: roles, isLoading, isError, error } = useQuery<UserRole[]>({
    queryKey: ["/api/admin/roles"],
    enabled: currentRole?.role === "admin",
  });

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

  if (currentRole?.role !== "admin") {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="text-center py-12">
          <Shield className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold mb-2">Admin Access Required</h2>
          <p className="text-muted-foreground">
            You need administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Admin Settings
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage user roles and permissions
          </p>
        </div>
      </div>

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
          {isError ? (
            <div className="flex items-center gap-2 text-destructive p-4">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to load user roles. Please try again later.</span>
            </div>
          ) : isLoading ? (
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
              <p className="text-sm mt-1">
                Click "Assign Role" to add users to roles
              </p>
            </div>
          )}

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold mb-4">Role Descriptions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roleOptions.map((role) => (
                <div
                  key={role.value}
                  className="p-4 border rounded-lg"
                >
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
    </div>
  );
}
