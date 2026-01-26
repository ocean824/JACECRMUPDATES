import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { NotificationsDropdown } from "@/components/notifications";
import { GlobalSearch } from "@/components/global-search";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";

import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import InvestorsPage from "@/pages/investors";
import InvestorDetailPage from "@/pages/investor-detail";
import PipelinePage from "@/pages/pipeline";
import AccountsPage from "@/pages/accounts";
import JournalPage from "@/pages/journal";
import BondsPage from "@/pages/bonds";
import TasksPage from "@/pages/tasks";
import RecurringTasksPage from "@/pages/recurring-tasks";
import KycPage from "@/pages/kyc";
import DocumentsPage from "@/pages/documents";
import CommunicationsPage from "@/pages/communications";
import AnalyticsPage from "@/pages/analytics";
import AuditLogsPage from "@/pages/audit-logs";
import AdminPage from "@/pages/admin";
import SettingsPage from "@/pages/settings";
import CustomFieldsPage from "@/pages/custom-fields";
import CalendarPage from "@/pages/calendar";
import EmailPage from "@/pages/email";
import ImportPage from "@/pages/import";
import InvestorPortalPage from "@/pages/investor-portal";
import NotFound from "@/pages/not-found";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between gap-2 px-4 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-2">
              <NotificationsDropdown />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedRoutes() {
  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/investors" component={InvestorsPage} />
        <Route path="/investors/:id" component={InvestorDetailPage} />
        <Route path="/pipeline" component={PipelinePage} />
        <Route path="/accounts" component={AccountsPage} />
        <Route path="/journal" component={JournalPage} />
        <Route path="/bonds" component={BondsPage} />
        <Route path="/tasks" component={TasksPage} />
        <Route path="/recurring-tasks" component={RecurringTasksPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/kyc" component={KycPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/communications" component={CommunicationsPage} />
        <Route path="/email" component={EmailPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        <Route path="/audit-logs" component={AuditLogsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/custom-fields" component={CustomFieldsPage} />
        <Route path="/import" component={ImportPage} />
        <Route path="/investor-portal" component={InvestorPortalPage} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground animate-pulse">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <div className="space-y-2 text-center">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <LandingPage />;
  }

  return <AuthenticatedRoutes />;
}

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="jace-crm-theme">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AppRouter />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
