import { Switch, Route, useLocation, Link } from "wouter";
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
import { HelpChat } from "@/components/help-chat";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

// Existing Pages
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
import ComplianceOnboardingPage from "@/pages/compliance-onboarding";
import PrivacyNoticePage from "@/pages/privacy-notice";
import ExternalOnboardingPage from "@/pages/external-onboarding";
import RegisterPage from "@/pages/register";
import LoginPage from "@/pages/login";
import AdminLoginPage from "@/pages/admin-login";
import NotFound from "@/pages/not-found";
import TermsOfUsePage from "@/pages/terms-of-use";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import SecurityPage from "@/pages/security-page";
import SiteMapPage from "@/pages/site-map";
import AccessibilityPage from "@/pages/accessibility";
import ContactUsPage from "@/pages/contact-us";
import ShareYourScreenPage from "@/pages/share-your-screen";
import DisclosuresPage from "@/pages/disclosures";
import CookiePreferencesPage from "@/pages/cookie-preferences";

// Phase 4: New Pages - Financial
import InvoicesPage from "@/pages/invoices";
import ExpensesPage from "@/pages/expenses";
import QuotesPage from "@/pages/quotes";
import EscrowPage from "@/pages/escrow";

// Phase 4: New Pages - HR
import EmployeesPage from "@/pages/employees";
import DepartmentsPage from "@/pages/departments";
import TimeTrackingPage from "@/pages/time-tracking";
import LeaveRequestsPage from "@/pages/leave-requests";
import PayrollPage from "@/pages/payroll";

// Phase 4: New Pages - Reports
import { TrialBalancePage, IncomeStatementPage, BalanceSheetPage } from "@/pages/reports/financial-reports";

// Phase 4: New Pages - Integrations
import BondAIIntegrationPage from "@/pages/integrations/bondai";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isNotDashboard = location !== "/";
  
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
              {isNotDashboard && (
                <Button variant="ghost" size="sm" asChild data-testid="button-back-to-dashboard">
                  <Link href="/">
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Dashboard
                  </Link>
                </Button>
              )}
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
          <HelpChat />
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthenticatedRoutes() {
  return (
    <AuthenticatedLayout>
      <Switch>
        {/* Dashboard */}
        <Route path="/" component={DashboardPage} />
        
        {/* Investors */}
        <Route path="/investors" component={InvestorsPage} />
        <Route path="/investors/:id" component={InvestorDetailPage} />
        <Route path="/pipeline" component={PipelinePage} />
        
        {/* Accounting */}
        <Route path="/accounts" component={AccountsPage} />
        <Route path="/journal" component={JournalPage} />
        <Route path="/bonds" component={BondsPage} />
        
        {/* Financial (Phase 4) */}
        <Route path="/invoices" component={InvoicesPage} />
        <Route path="/quotes" component={QuotesPage} />
        <Route path="/expenses" component={ExpensesPage} />
        <Route path="/escrow" component={EscrowPage} />
        
        {/* Reports (Phase 4) */}
        <Route path="/reports/trial-balance" component={TrialBalancePage} />
        <Route path="/reports/income-statement" component={IncomeStatementPage} />
        <Route path="/reports/balance-sheet" component={BalanceSheetPage} />
        
        {/* HR (Phase 4) */}
        <Route path="/employees" component={EmployeesPage} />
        <Route path="/departments" component={DepartmentsPage} />
        <Route path="/time-tracking" component={TimeTrackingPage} />
        <Route path="/leave-requests" component={LeaveRequestsPage} />
        <Route path="/payroll" component={PayrollPage} />
        
        {/* Management */}
        <Route path="/tasks" component={TasksPage} />
        <Route path="/recurring-tasks" component={RecurringTasksPage} />
        <Route path="/calendar" component={CalendarPage} />
        <Route path="/kyc" component={KycPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/communications" component={CommunicationsPage} />
        <Route path="/email" component={EmailPage} />
        <Route path="/analytics" component={AnalyticsPage} />
        
        {/* Compliance */}
        <Route path="/compliance/:investorId" component={ComplianceOnboardingPage} />
        <Route path="/privacy-notice" component={PrivacyNoticePage} />
        
        {/* Integrations (Phase 4) */}
        <Route path="/integrations/bondai" component={BondAIIntegrationPage} />
        
        {/* System */}
        <Route path="/audit-logs" component={AuditLogsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/custom-fields" component={CustomFieldsPage} />
        <Route path="/import" component={ImportPage} />
        <Route path="/investor-portal" component={InvestorPortalPage} />
        
        {/* 404 */}
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

  return (
    <Switch>
      <Route path="/register" component={RegisterPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/admin-login" component={AdminLoginPage} />
      <Route path="/external/onboarding" component={ExternalOnboardingPage} />
      <Route path="/terms-of-use" component={TermsOfUsePage} />
      <Route path="/privacy" component={PrivacyPolicyPage} />
      <Route path="/security" component={SecurityPage} />
      <Route path="/site-map" component={SiteMapPage} />
      <Route path="/accessibility" component={AccessibilityPage} />
      <Route path="/contact-us" component={ContactUsPage} />
      <Route path="/share-your-screen" component={ShareYourScreenPage} />
      <Route path="/disclosures" component={DisclosuresPage} />
      <Route path="/cookie-preferences" component={CookiePreferencesPage} />
      <Route>
        {user ? <AuthenticatedRoutes /> : <LandingPage />}
      </Route>
    </Switch>
  );
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
