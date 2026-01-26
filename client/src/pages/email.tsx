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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Mail, Send, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  insertEmailTemplateSchema,
  type EmailTemplate,
  type EmailLog,
  type Investor,
} from "@shared/schema";

const templateFormSchema = insertEmailTemplateSchema.extend({
  name: z.string().min(1, "Name is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  isActive: z.boolean().optional(),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

const sendEmailFormSchema = z.object({
  investorId: z.string().optional(),
  toEmail: z.string().email("Valid email is required"),
  templateId: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
});

type SendEmailFormValues = z.infer<typeof sendEmailFormSchema>;

function formatDateTime(timestamp: string | Date | null | undefined) {
  if (!timestamp) return "-";
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function TemplateFormDialog({
  template,
  open,
  onOpenChange,
}: {
  template?: EmailTemplate;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEditing = !!template;

  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: template?.name || "",
      subject: template?.subject || "",
      body: template?.body || "",
      isActive: template?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      return apiRequest("POST", "/api/email-templates", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Success", description: "Template created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      return apiRequest("PATCH", `/api/email-templates/${template?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Success", description: "Template updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update template", variant: "destructive" });
    },
  });

  const onSubmit = (data: TemplateFormValues) => {
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
          <DialogTitle>{isEditing ? "Edit Template" : "Add New Template"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update email template details" : "Create a new email template. Use {{firstName}}, {{lastName}}, {{email}} as placeholder variables."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Template name..." {...field} data-testid="input-template-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input placeholder="Email subject..." {...field} data-testid="input-template-subject" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Hello {{firstName}},&#10;&#10;Your email content here...&#10;&#10;Best regards"
                      className="min-h-[150px]"
                      {...field}
                      data-testid="input-template-body"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="checkbox-template-active"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Is Active</FormLabel>
                  </div>
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-template-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-template-submit"
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

function SendEmailTab() {
  const { toast } = useToast();

  const { data: investors } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const { data: templates } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const form = useForm<SendEmailFormValues>({
    resolver: zodResolver(sendEmailFormSchema),
    defaultValues: {
      investorId: "",
      toEmail: "",
      templateId: "",
      subject: "",
      body: "",
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (data: SendEmailFormValues) => {
      return apiRequest("POST", "/api/send-email", {
        investorId: data.investorId === "_none" ? null : data.investorId || null,
        templateId: data.templateId === "_none" ? null : data.templateId || null,
        toEmail: data.toEmail,
        subject: data.subject,
        body: data.body,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-logs"] });
      toast({ title: "Success", description: "Email sent successfully" });
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send email", variant: "destructive" });
    },
  });

  const onSubmit = (data: SendEmailFormValues) => {
    sendMutation.mutate(data);
  };

  const handleInvestorChange = (investorId: string) => {
    form.setValue("investorId", investorId);
    if (investorId && investorId !== "_none") {
      const investor = investors?.find((i) => i.id === investorId);
      if (investor?.email) {
        form.setValue("toEmail", investor.email);
      }
    }
  };

  const handleTemplateChange = (templateId: string) => {
    form.setValue("templateId", templateId);
    if (templateId && templateId !== "_none") {
      const template = templates?.find((t) => t.id === templateId);
      if (template) {
        form.setValue("subject", template.subject);
        form.setValue("body", template.body);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Compose Email
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="investorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investor (Optional)</FormLabel>
                    <Select
                      onValueChange={handleInvestorChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-investor">
                          <SelectValue placeholder="Select investor" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_none">-- None --</SelectItem>
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
                name="toEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To (Email)</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="recipient@example.com"
                        {...field}
                        data-testid="input-to-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="templateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template (Optional)</FormLabel>
                  <Select
                    onValueChange={handleTemplateChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-template">
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="_none">-- None --</SelectItem>
                      {templates
                        ?.filter((t) => t.isActive)
                        .map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
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
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Email subject..."
                      {...field}
                      data-testid="input-subject"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Body</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Email content..."
                      className="min-h-[200px]"
                      {...field}
                      data-testid="input-body"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={sendMutation.isPending}
                data-testid="button-send-email"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendMutation.isPending ? "Sending..." : "Send Email"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function TemplatesTab() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | undefined>();
  const { toast } = useToast();

  const { data: templates, isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/email-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Success", description: "Template deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete template", variant: "destructive" });
    },
  });

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingTemplate(undefined);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this template?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Email Templates</CardTitle>
          <Button onClick={handleAdd} data-testid="button-add-template">
            <Plus className="h-4 w-4 mr-2" />
            Add Template
          </Button>
        </CardHeader>
        <CardContent>
          {templates && templates.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id} data-testid={`row-template-${template.id}`}>
                    <TableCell className="font-medium">{template.name}</TableCell>
                    <TableCell>{template.subject}</TableCell>
                    <TableCell>
                      <Badge variant={template.isActive ? "default" : "secondary"}>
                        {template.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(template)}
                          data-testid={`button-edit-template-${template.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(template.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-template-${template.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No templates yet. Create your first email template.
            </div>
          )}
        </CardContent>
      </Card>

      <TemplateFormDialog
        template={editingTemplate}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

function SentEmailsSection() {
  const { data: logs, isLoading } = useQuery<EmailLog[]>({
    queryKey: ["/api/email-logs"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Sent Emails
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs && logs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} data-testid={`row-email-log-${log.id}`}>
                  <TableCell>{log.toEmail}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{log.subject}</TableCell>
                  <TableCell>
                    <Badge variant={log.status === "sent" ? "default" : "secondary"}>
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDateTime(log.sentAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No emails sent yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EmailPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Mail className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Email</h1>
          <p className="text-muted-foreground">Send emails and manage templates</p>
        </div>
      </div>

      <Tabs defaultValue="send" className="space-y-4">
        <TabsList>
          <TabsTrigger value="send" data-testid="tab-send-email">
            <Send className="h-4 w-4 mr-2" />
            Send Email
          </TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">
            <Mail className="h-4 w-4 mr-2" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-6">
          <SendEmailTab />
          <SentEmailsSection />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
