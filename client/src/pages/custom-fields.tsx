import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings, Plus, Pencil, Trash2 } from "lucide-react";
import { CustomField, customFieldTypes } from "@shared/schema";

const customFieldFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  label: z.string().min(1, "Label is required"),
  fieldType: z.enum(["text", "number", "date", "boolean", "select", "multiselect"]),
  options: z.string().optional(),
  isRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

type CustomFieldFormValues = z.infer<typeof customFieldFormSchema>;

export default function CustomFieldsPage() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const form = useForm<CustomFieldFormValues>({
    resolver: zodResolver(customFieldFormSchema),
    defaultValues: {
      name: "",
      label: "",
      fieldType: "text",
      options: "",
      isRequired: false,
      isActive: true,
    },
  });

  const fieldType = form.watch("fieldType");

  const { data: customFields, isLoading } = useQuery<CustomField[]>({
    queryKey: ["/api/custom-fields"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CustomFieldFormValues) => {
      return apiRequest("POST", "/api/custom-fields", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({
        title: "Custom field created",
        description: "The custom field has been created successfully.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create custom field. Please try again.",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomFieldFormValues }) => {
      return apiRequest("PATCH", `/api/custom-fields/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({
        title: "Custom field updated",
        description: "The custom field has been updated successfully.",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update custom field. Please try again.",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/custom-fields/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-fields"] });
      toast({
        title: "Custom field deleted",
        description: "The custom field has been deleted successfully.",
      });
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete custom field. Please try again.",
      });
    },
  });

  const handleOpenCreate = () => {
    setEditingField(null);
    form.reset({
      name: "",
      label: "",
      fieldType: "text",
      options: "",
      isRequired: false,
      isActive: true,
    });
    setShowDialog(true);
  };

  const handleOpenEdit = (field: CustomField) => {
    setEditingField(field);
    form.reset({
      name: field.name,
      label: field.label,
      fieldType: field.fieldType as CustomFieldFormValues["fieldType"],
      options: field.options || "",
      isRequired: field.isRequired ?? false,
      isActive: field.isActive ?? true,
    });
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingField(null);
    form.reset();
  };

  const onSubmit = (data: CustomFieldFormValues) => {
    if (editingField) {
      updateMutation.mutate({ id: editingField.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const getFieldTypeLabel = (type: string) => {
    const found = customFieldTypes.find((t) => t.value === type);
    return found?.label || type;
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Custom Fields
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage dynamic fields for investor profiles
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Field Definitions</CardTitle>
            <CardDescription>
              Configure custom fields to capture additional investor information
            </CardDescription>
          </div>
          <Button onClick={handleOpenCreate} data-testid="button-add-custom-field">
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Field
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : customFields && customFields.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customFields.map((field) => (
                    <TableRow key={field.id} data-testid={`row-custom-field-${field.id}`}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{field.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            ({field.name})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {getFieldTypeLabel(field.fieldType)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={field.isRequired ? "default" : "outline"}>
                          {field.isRequired ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={field.isActive ? "default" : "outline"}>
                          {field.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEdit(field)}
                            data-testid={`button-edit-custom-field-${field.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirmId(field.id)}
                            data-testid={`button-delete-custom-field-${field.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No custom fields defined yet</p>
              <p className="text-sm mt-1">
                Click "Add Custom Field" to create your first custom field
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingField ? "Edit Custom Field" : "Add Custom Field"}
            </DialogTitle>
            <DialogDescription>
              {editingField
                ? "Update the custom field settings below."
                : "Define a new custom field for investor profiles."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name (internal key)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., tax_id"
                        {...field}
                        data-testid="input-custom-field-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="label"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label (display name)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Tax ID"
                        {...field}
                        data-testid="input-custom-field-label"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fieldType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field Type</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-custom-field-type">
                          <SelectValue placeholder="Select field type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customFieldTypes.map((type) => (
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
              {(fieldType === "select" || fieldType === "multiselect") && (
                <FormField
                  control={form.control}
                  name="options"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Options (comma-separated)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Option 1, Option 2, Option 3"
                          {...field}
                          data-testid="textarea-custom-field-options"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              <div className="flex gap-6">
                <FormField
                  control={form.control}
                  name="isRequired"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-custom-field-required"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Required</FormLabel>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-custom-field-active"
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Active</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-custom-field"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? "Saving..."
                    : editingField
                      ? "Update Field"
                      : "Create Field"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Custom Field</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this custom field? This action cannot be
              undone and will remove all associated data from investor profiles.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
