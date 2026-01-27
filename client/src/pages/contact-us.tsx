import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Mail, Phone, Building2, Shield, Accessibility } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FooterLegal } from "@/components/footer-legal";

export default function ContactUsPage() {
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
              <CardTitle className="text-3xl">Contact Us</CardTitle>
              <p className="text-muted-foreground">
                We're here to help. Reach out to us through any of the methods below.
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              <section>
                <div className="flex items-center gap-3 mb-4">
                  <Building2 className="h-6 w-6 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Company Information</h2>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium text-lg">JACE Management, LLC</p>
                  <p className="text-muted-foreground">A Colorado Limited Liability Company</p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">General Inquiries</h2>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Mail className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Email</span>
                    </div>
                    <a 
                      href="mailto:jacemgmt@gmail.com" 
                      className="underline hover:no-underline"
                      data-testid="link-email"
                    >
                      jacemgmt@gmail.com
                    </a>
                    <p className="text-sm text-muted-foreground mt-2">
                      We typically respond within 1-2 business days.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-3">
                      <Phone className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Phone</span>
                    </div>
                    <a 
                      href="tel:970-710-9193" 
                      className="underline hover:no-underline"
                      data-testid="link-phone"
                    >
                      970-710-9193
                    </a>
                    <p className="text-sm text-muted-foreground mt-2">
                      Available Monday - Friday, 9:00 AM - 5:00 PM MT
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Specialized Contacts</h2>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Security Concerns</span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-2">
                      To report security vulnerabilities, suspicious activity, or account compromise:
                    </p>
                    <a 
                      href="mailto:jacemgmt@gmail.com?subject=SECURITY" 
                      className="underline hover:no-underline"
                      data-testid="link-security-email"
                    >
                      jacemgmt@gmail.com
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please include "SECURITY" in the subject line for priority handling.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <Accessibility className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Accessibility Support</span>
                    </div>
                    <p className="text-muted-foreground text-sm mb-2">
                      For accessibility-related questions or to request alternative formats:
                    </p>
                    <a 
                      href="mailto:jacemgmt@gmail.com?subject=Accessibility" 
                      className="underline hover:no-underline"
                      data-testid="link-accessibility-email"
                    >
                      jacemgmt@gmail.com
                    </a>
                    <p className="text-xs text-muted-foreground mt-1">
                      Please include "Accessibility" in the subject line.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Privacy Inquiries</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  For questions about your privacy rights, data requests, or to exercise your rights 
                  under the Colorado Privacy Act, please contact us at:
                </p>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Email: jacemgmt@gmail.com</p>
                  <p className="text-muted-foreground">Phone: 970-710-9193</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Include "Privacy Request" in the subject line. We will respond within 45 days.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Mailing Address</h2>
                <p className="text-muted-foreground leading-relaxed">
                  For formal correspondence, please contact us via email at jacemgmt@gmail.com 
                  to request our mailing address.
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>

      <FooterLegal />
    </div>
  );
}
