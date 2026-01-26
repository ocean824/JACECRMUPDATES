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
import { Checkbox } from "@/components/ui/checkbox";
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
import { RefreshCw, Plus, Pencil, Trash2, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  insertTaskRecurrenceSchema,
  type TaskRecurrence,
  type Investor,
  recurrenceFrequencies,
} from "@shared/schema";

const priorityOptions = [
  { value: "low", label: "Low", color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  { value: "medium", label: "Medium", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" },
  { value: "high", label: "High", color: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
];

const formSchema = insertTaskRecurrenceSchema.extend({
  taskTemplateTitle: z.string().min(1, "Title is required"),
  taskTemplateDescription: z.string().optional().nullable(),
  frequency: z.enum(["daily", "weekly", "biweekly", "monthly", "quarterly", "yearly"]),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  investorId: z.string().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  isActive: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function RecurrenceFormDialog({
  recurrence,
  open,
  onOpenChange,
}: {
  recurrence?: TaskRecurrence;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEditing = !!recurrence;

  const { data: investors } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      taskTemplateTitle: recurrence?.taskTemplateTitle || "",
      taskTemplateDescription: recurrence?.taskTemplateDescription || "",
      frequency: (recurrence?.frequency as FormValues["frequency"]) || "weekly",
      startDate: recurrence?.startDate
        ? new Date(recurrence.startDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      endDate: recurrence?.endDate
        ? new Date(recurrence.endDate).toISOString().split("T")[0]
        : "",
      investorId: recurrence?.investorId || "",
      priority: (recurrence?.priority as "low" | "medium" | "high") || "medium",
      isActive: recurrence?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        investorId: data.investorId === "_none" || !data.investorId ? null : data.investorId,
      };
      return apiRequest("POST", "/api/task-recurrences", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-recurrences"] });
      toast({ title: "Success", description: "Recurring task created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create recurring task", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        investorId: data.investorId === "_none" || !data.investorId ? null : data.investorId,
      };
      return apiRequest("PATCH", `/api/task-recurrences/${recurrence?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-recurrences"] });
      toast({ title: "Success", description: "Recurring task updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update recurring task", variant: "destructive" });
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
          <DialogTitle>{isEditing ? "Edit Recurring Task" : "Add Recurring Task"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update the recurring task settings" : "Create a new recurring task rule"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="taskTemplateTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Task Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title..." {...field} data-testid="input-recurrence-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="taskTemplateDescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Task description..."
                      {...field}
                      value={field.value || ""}
                      data-testid="input-recurrence-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-recurrence-frequency">
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {recurrenceFrequencies.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-recurrence-priority">
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {priorityOptions.map((option) => (
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-recurrence-start-date" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                        data-testid="input-recurrence-end-date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="investorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Associated Investor (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || "_none"}>
                    <FormControl>
                      <SelectTrigger data-testid="select-recurrence-investor">
                        <SelectValue placeholder="Select investor" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {investors?.map((investor) => (
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

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-recurrence-active"
                    />
                  </FormControl>
                  <FormLabel className="font-normal">Active</FormLabel>
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
                data-testid="button-save-recurrence"
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : isEditing
                  ? "Update"
                  : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function RecurringTasksPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecurrence, setEditingRecurrence] = useState<TaskRecurrence | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: recurrences, isLoading } = useQuery<TaskRecurrence[]>({
    queryKey: ["/api/task-recurrences"],
  });

  const { data: investors } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/task-recurrences/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/task-recurrences"] });
      toast({ title: "Success", description: "Recurring task deleted" });
      setDeleteId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete recurring task", variant: "destructive" });
    },
  });

  const handleEdit = (recurrence: TaskRecurrence) => {
    setEditingRecurrence(recurrence);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingRecurrence(undefined);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingRecurrence(undefined);
    }
  };

  const getInvestorName = (investorId: string | null) => {
    if (!investorId || !investors) return "-";
    const investor = investors.find((i) => i.id === investorId);
    return investor ? `${investor.firstName} ${investor.lastName}` : "-";
  };

  const getFrequencyLabel = (value: string) => {
    return recurrenceFrequencies.find((f) => f.value === value)?.label || value;
  };

  const getPriorityBadge = (priority: string | null) => {
    const option = priorityOptions.find((p) => p.value === priority);
    return option ? (
      <Badge variant="secondary" className={option.color}>
        {option.label}
      </Badge>
    ) : (
      <Badge variant="secondary">Medium</Badge>
    );
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="recurring-tasks-page">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Recurring Tasks</h1>
            <p className="text-sm text-muted-foreground">
              Manage task recurrence rules and schedules
            </p>
          </div>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-recurring-task">
          <Plus className="h-4 w-4 mr-2" />
          Add Recurring Task
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Recurring Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recurrences && recurrences.length > 0 ? (
            <Table data-testid="recurring-tasks-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Task Title</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Investor</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recurrences.map((recurrence) => (
                  <TableRow key={recurrence.id} data-testid={`row-recurrence-${recurrence.id}`}>
                    <TableCell className="font-medium">{recurrence.taskTemplateTitle}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getFrequencyLabel(recurrence.frequency)}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(recurrence.startDate)}</TableCell>
                    <TableCell>{formatDate(recurrence.endDate)}</TableCell>
                    <TableCell>{getInvestorName(recurrence.investorId)}</TableCell>
                    <TableCell>{getPriorityBadge(recurrence.priority)}</TableCell>
                    <TableCell>
                      <Badge variant={recurrence.isActive ? "default" : "secondary"}>
                        {recurrence.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(recurrence)}
                          data-testid={`button-edit-recurrence-${recurrence.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(recurrence.id)}
                          data-testid={`button-delete-recurrence-${recurrence.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No recurring tasks yet</p>
              <p className="text-sm">Create your first recurring task to automate task scheduling</p>
            </div>
          )}
        </CardContent>
      </Card>

      <RecurrenceFormDialog
        recurrence={editingRecurrence}
        open={dialogOpen}
        onOpenChange={handleDialogClose}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this recurring task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
