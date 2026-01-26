import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Building2,
  Users,
  TrendingUp,
  Shield,
  BarChart3,
  FileText,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const features = [
  {
    icon: Users,
    title: "Investor Management",
    description: "Track investor profiles, pipeline stages, and KYC status with real-time updates and comprehensive activity logging.",
  },
  {
    icon: TrendingUp,
    title: "Pipeline Tracking",
    description: "Visual pipeline management from lead to closed deal with automated stage tracking and customizable workflows.",
  },
  {
    icon: BarChart3,
    title: "Double-Entry Ledger",
    description: "Enterprise-grade accounting with chart of accounts, journal entries, and real-time financial statements.",
  },
  {
    icon: Shield,
    title: "Secure & Compliant",
    description: "Bank-level security with role-based access control, audit logging, and comprehensive compliance features.",
  },
  {
    icon: FileText,
    title: "Document Generation",
    description: "Automated settlement documents, investor communications, and professional PDF reports.",
  },
  {
    icon: Building2,
    title: "Multi-Tenant Platform",
    description: "Enterprise workspace management with team collaboration, task assignment, and activity tracking.",
  },
];

const trustIndicators = [
  "Enterprise-grade security",
  "SOC 2 compliant architecture",
  "Real-time data sync",
  "99.9% uptime SLA",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">JACE CRM</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="ghost" asChild data-testid="button-login-nav">
              <a href="/login">Sign In</a>
            </Button>
            <Button asChild data-testid="button-get-started-nav">
              <a href="/register">Get Started</a>
            </Button>
          </div>
        </nav>
      </header>

      <main>
        <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-32 overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/3 rounded-full blur-3xl" />
          </div>

          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                Enterprise-ready platform
              </div>
              
              <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                The CRM Built for
                <span className="block text-primary">Financial Excellence</span>
              </h1>
              
              <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
                JACE CRM combines investor relations, bond settlement, and enterprise accounting 
                in one powerful platform. Manage your entire financial operation with confidence.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild className="w-full sm:w-auto text-base h-12 px-8" data-testid="button-get-started-hero">
                  <a href="/register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </a>
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-base h-12 px-8" data-testid="button-learn-more">
                  <a href="#features">Learn More</a>
                </Button>
              </div>

              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {trustIndicators.map((indicator) => (
                  <div key={indicator} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span>{indicator}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 lg:py-32 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                Everything You Need to Succeed
              </h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                From investor onboarding to settlement closeout, JACE CRM provides 
                the complete toolkit for modern financial operations.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, index) => (
                <Card 
                  key={feature.title} 
                  className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover-elevate transition-all duration-300"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardContent className="p-6">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section id="about" className="py-20 lg:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <h2 className="font-serif text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-6">
                  Built for Modern Financial Teams
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  JACE CRM integrates with Judgement Bond AI (BondAI) as your transaction 
                  and escrow agent to sync investor onboarding, track KYC status, manage 
                  settlements, and generate professional documents.
                </p>
                <ul className="space-y-4">
                  {[
                    "Real-time double-entry ledger postings",
                    "Automated settlement document generation",
                    "Comprehensive audit trails and compliance",
                    "Multi-tenant workspace management",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-10">
                  <Button size="lg" asChild data-testid="button-start-now">
                    <a href="/register">
                      Start Now
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-8 lg:p-12">
                  <div className="h-full w-full rounded-xl bg-card border border-border shadow-xl flex items-center justify-center">
                    <div className="text-center p-6">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <Building2 className="h-8 w-8" />
                      </div>
                      <h3 className="text-xl font-semibold mb-2">JACE CRM</h3>
                      <p className="text-sm text-muted-foreground">
                        Enterprise Accounting & Investor Relations
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-sm font-medium">JACE CRM</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} JACE CRM. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
