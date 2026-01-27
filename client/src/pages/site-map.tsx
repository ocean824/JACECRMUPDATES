import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FooterLegal } from "@/components/footer-legal";

export default function SiteMapPage() {
  const publicPages = [
    { name: "Home", href: "/" },
    { name: "Terms of Use", href: "/terms-of-use" },
    { name: "Privacy Policy", href: "/privacy-policy" },
    { name: "Security", href: "/security" },
    { name: "Site Map", href: "/site-map" },
    { name: "Accessibility", href: "/accessibility" },
    { name: "Contact Us", href: "/contact-us" },
    { name: "Share Your Screen", href: "/share-your-screen" },
    { name: "Disclosures", href: "/disclosures" },
    { name: "Cookie Preferences", href: "/cookie-preferences" },
    { name: "Login", href: "/login" },
    { name: "Register", href: "/register" },
  ];

  const authenticatedPages = [
    { name: "Dashboard", href: "/" },
    { name: "Investors", href: "/investors" },
    { name: "Pipeline", href: "/pipeline" },
    { name: "Chart of Accounts", href: "/accounts" },
    { name: "Journal Entries", href: "/journal" },
    { name: "Bond Settlements", href: "/bonds" },
    { name: "Tasks", href: "/tasks" },
    { name: "Recurring Tasks", href: "/recurring-tasks" },
    { name: "Calendar", href: "/calendar" },
    { name: "KYC Workflow", href: "/kyc" },
    { name: "Documents", href: "/documents" },
    { name: "Communications", href: "/communications" },
    { name: "Email", href: "/email" },
    { name: "Analytics", href: "/analytics" },
    { name: "Investor Portal", href: "/investor-portal" },
    { name: "Compliance Onboarding", href: "/compliance/demo" },
    { name: "Privacy Notice (GLBA)", href: "/privacy-notice" },
    { name: "Audit Logs", href: "/audit-logs" },
    { name: "Custom Fields", href: "/custom-fields" },
    { name: "Data Import", href: "/import" },
    { name: "Admin", href: "/admin" },
    { name: "Settings", href: "/settings" },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Button variant="ghost" size="sm" asChild data-testid="button-back-home">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Home
            </Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="max-w-4xl mx-auto px-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">Site Map</CardTitle>
              <p className="text-muted-foreground">
                Navigate to any page on our website using the links below.
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Public Pages</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  These pages are accessible to all visitors without signing in.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {publicPages.map((page) => (
                    <Link
                      key={page.href}
                      href={page.href}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                      data-testid={`sitemap-link-${page.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {page.name}
                    </Link>
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Authenticated Pages</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  These pages require you to sign in to access.
                </p>
                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                  {authenticatedPages.map((page) => (
                    <Link
                      key={page.href + page.name}
                      href={page.href}
                      className="p-3 rounded-lg border hover:bg-muted/50 transition-colors text-sm"
                      data-testid={`sitemap-link-${page.name.toLowerCase().replace(/\s+/g, "-")}`}
                    >
                      {page.name}
                    </Link>
                  ))}
                </div>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>

      <FooterLegal />
    </div>
  );
}
