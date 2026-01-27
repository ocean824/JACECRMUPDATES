import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Accessibility, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FooterLegal } from "@/components/footer-legal";

export default function AccessibilityPage() {
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
                <Accessibility className="h-8 w-8 text-muted-foreground" />
                Accessibility Statement
              </CardTitle>
              <p className="text-muted-foreground">
                Our commitment to making our services accessible to everyone.
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-3">Our Commitment</h2>
                <p className="text-muted-foreground leading-relaxed">
                  JACE Management, LLC is committed to ensuring digital accessibility for people with 
                  disabilities. We are continually improving the user experience for everyone and applying 
                  the relevant accessibility standards to ensure we provide equal access to all users.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Accessibility Standards</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We strive to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA 
                  standards. These guidelines explain how to make web content more accessible for people 
                  with disabilities and more user-friendly for everyone.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Our efforts include but are not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Providing text alternatives for non-text content</li>
                  <li>Creating content that can be presented in different ways without losing information</li>
                  <li>Making it easier for users to see and hear content</li>
                  <li>Ensuring all functionality is available from a keyboard</li>
                  <li>Providing users enough time to read and use content</li>
                  <li>Avoiding content that causes seizures or physical reactions</li>
                  <li>Providing ways to help users navigate, find content, and determine where they are</li>
                  <li>Making text content readable and understandable</li>
                  <li>Making web pages appear and operate in predictable ways</li>
                  <li>Helping users avoid and correct mistakes</li>
                  <li>Maximizing compatibility with current and future user tools</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Assistive Technologies</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our website is designed to be compatible with the following assistive technologies:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Screen readers (such as JAWS, NVDA, VoiceOver, and TalkBack)</li>
                  <li>Screen magnification software</li>
                  <li>Speech recognition software</li>
                  <li>Keyboard-only navigation</li>
                  <li>Browser zoom functionality</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Feedback and Contact</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We welcome your feedback on the accessibility of our website. If you encounter any 
                  accessibility barriers or have suggestions for improvement, please contact us:
                </p>
                <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Email</p>
                      <a 
                        href="mailto:jacemgmt@gmail.com" 
                        className="underline hover:no-underline"
                        data-testid="link-accessibility-email"
                      >
                        jacemgmt@gmail.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Phone</p>
                      <a 
                        href="tel:970-710-9193" 
                        className="underline hover:no-underline"
                        data-testid="link-accessibility-phone"
                      >
                        970-710-9193
                      </a>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Please include "Accessibility" in the subject line of your email for priority handling.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Continuous Improvement</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We are continuously working to improve the accessibility of our website. We regularly 
                  review our site and make updates to improve accessibility. Our team receives ongoing 
                  training on accessibility best practices, and we incorporate accessibility testing 
                  into our development process.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Alternative Formats</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you need assistance accessing any content, documents, or information on our website 
                  in an alternative format, please contact us and we will work with you to provide the 
                  information in a format that meets your needs.
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
