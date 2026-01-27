import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Monitor, Shield, Eye, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FooterLegal } from "@/components/footer-legal";

export default function ShareYourScreenPage() {
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
              <CardTitle className="text-3xl flex items-center gap-3">
                <Monitor className="h-8 w-8 text-muted-foreground" />
                Share Your Screen
              </CardTitle>
              <p className="text-muted-foreground">
                Learn about our co-browsing feature and how it helps us assist you better.
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-3">What is Co-Browsing?</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Co-browsing is a collaborative technology that allows our customer support representatives 
                  to view your screen in real-time while you navigate our website. This feature enables us 
                  to provide more effective and personalized assistance by seeing exactly what you see on 
                  your screen.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">How It Works</h2>
                <div className="space-y-4">
                  <div className="flex gap-4 p-4 border rounded-lg">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      1
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Initiate a Support Session</h3>
                      <p className="text-sm text-muted-foreground">
                        Contact our support team through phone or chat and let them know you'd like 
                        to share your screen for assistance.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border rounded-lg">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      2
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Receive a Session Code</h3>
                      <p className="text-sm text-muted-foreground">
                        Our representative will provide you with a unique session code to enter on 
                        our website.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border rounded-lg">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      3
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Grant Permission</h3>
                      <p className="text-sm text-muted-foreground">
                        You will be asked to confirm that you want to share your screen. The session 
                        will only begin after you provide explicit consent.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border rounded-lg">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                      4
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Receive Guided Assistance</h3>
                      <p className="text-sm text-muted-foreground">
                        Our representative can now see your screen and guide you through any steps 
                        or help troubleshoot issues in real-time.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Privacy and Security</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Your privacy and security are our top priorities during co-browsing sessions:
                </p>
                <ul className="space-y-3">
                  <li className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">View-Only Access:</strong> Our representatives can only view 
                      your screen; they cannot control your computer or access other applications.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Masked Sensitive Data:</strong> Password fields and other 
                      sensitive information are automatically masked and hidden from view.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Session Recording:</strong> Sessions may be recorded for 
                      quality assurance and training purposes. You will be informed if recording is active.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Secure Connection:</strong> All co-browsing sessions are 
                      encrypted end-to-end to protect your information.
                    </span>
                  </li>
                  <li className="flex gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-500 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <strong className="text-foreground">Website Only:</strong> The co-browsing feature only shares 
                      content from our website, not your entire screen or other applications.
                    </span>
                  </li>
                </ul>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Your Consent</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Co-browsing is entirely voluntary and requires your explicit consent:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>You must actively initiate and confirm the screen sharing session</li>
                  <li>You can end the session at any time by clicking the "End Session" button</li>
                  <li>You maintain full control of your browser and can navigate away at any time</li>
                  <li>Your consent is required for each new co-browsing session</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">When to Use Co-Browsing</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Co-browsing is particularly helpful when you need assistance with:
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    Navigating complex forms or applications
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    Understanding error messages
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    Completing transactions or account setup
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg text-sm">
                    Troubleshooting technical issues
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions about our co-browsing feature or need assistance:
                </p>
                <div className="mt-4 p-4 bg-muted/50 rounded-lg">
                  <p className="font-medium">JACE Management, LLC</p>
                  <p className="text-muted-foreground">Email: jacemgmt@gmail.com</p>
                  <p className="text-muted-foreground">Phone: 970-710-9193</p>
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
