import { useState, useMemo } from "react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Plus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Phone,
  Flag,
  Bell,
  Circle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  insertCalendarEventSchema,
  calendarEventTypes,
  type CalendarEvent,
  type Investor,
} from "@shared/schema";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from "date-fns";

const eventTypeColors: Record<string, string> = {
  meeting: "bg-blue-500",
  call: "bg-green-500",
  deadline: "bg-red-500",
  reminder: "bg-yellow-500",
  other: "bg-purple-500",
};

const eventTypeIcons: Record<string, typeof CalendarDays> = {
  meeting: Users,
  call: Phone,
  deadline: Flag,
  reminder: Bell,
  other: Circle,
};

const formSchema = insertCalendarEventSchema.extend({
  title: z.string().min(1, "Title is required"),
  eventType: z.enum(["meeting", "call", "deadline", "reminder", "other"]),
  startTime: z.string().min(1, "Start time is required"),
  endTime: z.string().min(1, "End time is required"),
  location: z.string().optional(),
  investorId: z.string().optional().nullable(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

function EventFormDialog({
  event,
  open,
  onOpenChange,
}: {
  event?: CalendarEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEditing = !!event;

  const { data: investors } = useQuery<Investor[]>({
    queryKey: ["/api/investors"],
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: event?.title || "",
      eventType: event?.eventType || "meeting",
      startTime: event?.startTime
        ? format(new Date(event.startTime), "yyyy-MM-dd'T'HH:mm")
        : "",
      endTime: event?.endTime
        ? format(new Date(event.endTime), "yyyy-MM-dd'T'HH:mm")
        : "",
      location: event?.location || "",
      investorId: event?.investorId || null,
      description: event?.description || "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        investorId: data.investorId === "_none" ? null : data.investorId,
      };
      return apiRequest("POST", "/api/calendar-events", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({ title: "Success", description: "Event created successfully" });
      onOpenChange(false);
      form.reset();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create event", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: FormValues) => {
      const payload = {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        investorId: data.investorId === "_none" ? null : data.investorId,
      };
      return apiRequest("PATCH", `/api/calendar-events/${event?.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({ title: "Success", description: "Event updated successfully" });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update event", variant: "destructive" });
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
          <DialogTitle>{isEditing ? "Edit Event" : "Add New Event"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update event details" : "Schedule a new event or appointment"}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Event title..." {...field} data-testid="input-event-title" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="eventType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Event Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-event-type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {calendarEventTypes.map((type) => (
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-event-start-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} data-testid="input-event-end-time" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Meeting room, address, or link..." {...field} data-testid="input-event-location" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="investorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Related Investor (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-event-investor">
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Event details..." {...field} data-testid="input-event-description" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-event">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-event"
              >
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEditing ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function EventCard({
  event,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const IconComponent = eventTypeIcons[event.eventType] || Circle;
  const colorClass = eventTypeColors[event.eventType] || "bg-gray-500";

  return (
    <Card className="group hover-elevate" data-testid={`card-event-${event.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-md ${colorClass} text-white shrink-0`}>
              <IconComponent className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{event.title}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {format(new Date(event.startTime), "MMM d, h:mm a")} -{" "}
                  {format(new Date(event.endTime), "h:mm a")}
                </span>
              </div>
              {event.location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{event.location}</span>
                </div>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                data-testid={`button-event-menu-${event.id}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit} data-testid={`button-edit-event-${event.id}`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={onDelete} data-testid={`button-delete-event-${event.id}`}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {event.description && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
        )}
        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary" className={`${colorClass} text-white`}>
            {calendarEventTypes.find((t) => t.value === event.eventType)?.label || event.eventType}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarGrid({
  currentDate,
  events,
  onDayClick,
}: {
  currentDate: Date;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const startPadding = monthStart.getDay();
  const paddingDays = Array(startPadding).fill(null);

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    events.forEach((event) => {
      const dayKey = format(new Date(event.startTime), "yyyy-MM-dd");
      if (!map[dayKey]) map[dayKey] = [];
      map[dayKey].push(event);
    });
    return map;
  }, [events]);

  return (
    <div className="grid grid-cols-7 gap-1">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
        <div
          key={day}
          className="text-center text-sm font-medium text-muted-foreground py-2"
        >
          {day}
        </div>
      ))}
      {paddingDays.map((_, i) => (
        <div key={`pad-${i}`} className="aspect-square" />
      ))}
      {days.map((day) => {
        const dayKey = format(day, "yyyy-MM-dd");
        const dayEvents = eventsByDay[dayKey] || [];
        const isCurrentMonth = isSameMonth(day, currentDate);
        const isCurrentDay = isToday(day);

        return (
          <button
            key={dayKey}
            onClick={() => onDayClick(day)}
            className={`
              aspect-square p-1 rounded-md text-sm flex flex-col items-center justify-start hover-elevate
              ${isCurrentMonth ? "" : "text-muted-foreground opacity-50"}
              ${isCurrentDay ? "bg-primary text-primary-foreground" : ""}
            `}
            data-testid={`calendar-day-${dayKey}`}
          >
            <span className="font-medium">{format(day, "d")}</span>
            {dayEvents.length > 0 && (
              <div className="flex gap-0.5 mt-1 flex-wrap justify-center">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className={`w-1.5 h-1.5 rounded-full ${eventTypeColors[event.eventType] || "bg-gray-500"}`}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEvent | null>(null);
  const { toast } = useToast();

  const { data: events, isLoading } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/calendar-events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({ title: "Success", description: "Event deleted successfully" });
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete event", variant: "destructive" });
    },
  });

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => setCurrentDate(new Date());

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const handleAddEvent = () => {
    setEditingEvent(undefined);
    setFormOpen(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleDeleteEvent = (event: CalendarEvent) => {
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (eventToDelete) {
      deleteMutation.mutate(eventToDelete.id);
    }
  };

  const upcomingEvents = useMemo(() => {
    if (!events) return [];
    const now = new Date();
    return events
      .filter((e) => new Date(e.startTime) >= now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 10);
  }, [events]);

  const selectedDayEvents = useMemo(() => {
    if (!events || !selectedDate) return [];
    return events.filter((e) => isSameDay(new Date(e.startTime), selectedDate));
  }, [events, selectedDate]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-80 w-full" />
              </CardContent>
            </Card>
          </div>
          <div>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-primary text-primary-foreground">
            <CalendarDays className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" data-testid="text-calendar-title">Calendar</h1>
            <p className="text-muted-foreground text-sm">Schedule and manage your events</p>
          </div>
        </div>
        <Button onClick={handleAddEvent} data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
              <CardTitle className="text-lg" data-testid="text-current-month">
                {format(currentDate, "MMMM yyyy")}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleToday} data-testid="button-today">
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={handlePrevMonth} data-testid="button-prev-month">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth} data-testid="button-next-month">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <CalendarGrid
                currentDate={currentDate}
                events={events || []}
                onDayClick={handleDayClick}
              />
            </CardContent>
          </Card>

          {selectedDate && selectedDayEvents.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg" data-testid="text-selected-date">
                  Events on {format(selectedDate, "MMMM d, yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {selectedDayEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={() => handleEditEvent(event)}
                      onDelete={() => handleDeleteEvent(event)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8" data-testid="text-no-events">
                  No upcoming events
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onEdit={() => handleEditEvent(event)}
                      onDelete={() => handleDeleteEvent(event)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EventFormDialog
        event={editingEvent}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{eventToDelete?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
