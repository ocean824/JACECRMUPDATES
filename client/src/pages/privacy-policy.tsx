import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FooterLegal } from "@/components/footer-legal";

export default function PrivacyPolicyPage() {
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
              <CardTitle className="text-3xl">Privacy Policy</CardTitle>
              <p className="text-muted-foreground">Effective Date: January 27, 2026</p>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none space-y-8">
              <section>
                <p className="text-muted-foreground leading-relaxed">
                  JACE Management, LLC ("JACE," "we," "us," or "our") respects your privacy and is committed 
                  to protecting your personal information. This Privacy Policy explains how we collect, use, 
                  disclose, and safeguard your information when you use our services. This policy is designed 
                  to comply with the Colorado Privacy Act (CPA) and other applicable privacy laws.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We may collect the following categories of personal information:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Identifiers:</strong> Name, email address, phone number, postal address, account credentials</li>
                  <li><strong>Financial Information:</strong> Bank account details, investment information, transaction history</li>
                  <li><strong>Commercial Information:</strong> Records of products or services purchased or considered</li>
                  <li><strong>Internet Activity:</strong> Browsing history, search history, interactions with our website</li>
                  <li><strong>Geolocation Data:</strong> Approximate location based on IP address</li>
                  <li><strong>Professional Information:</strong> Employment history, business affiliations</li>
                  <li><strong>Inferences:</strong> Preferences and characteristics derived from collected information</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We use your personal information for the following purposes:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>To provide, maintain, and improve our services</li>
                  <li>To process transactions and send related information</li>
                  <li>To send administrative information, updates, and security alerts</li>
                  <li>To respond to your inquiries and provide customer support</li>
                  <li>To comply with legal obligations and regulatory requirements</li>
                  <li>To detect, prevent, and address fraud and security issues</li>
                  <li>To analyze usage patterns and improve user experience</li>
                  <li>To send marketing communications (with your consent where required)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. How We Share Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We may share your personal information with:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Service Providers:</strong> Third parties who perform services on our behalf</li>
                  <li><strong>Business Partners:</strong> Financial institutions and other partners who help deliver our services</li>
                  <li><strong>Legal and Regulatory Authorities:</strong> When required by law or to protect our rights</li>
                  <li><strong>Corporate Transactions:</strong> In connection with mergers, acquisitions, or asset sales</li>
                  <li><strong>With Your Consent:</strong> When you direct us to share your information</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We do not sell your personal information to third parties for monetary consideration.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Cookies and Tracking Technologies</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We use cookies and similar tracking technologies to collect information about your browsing 
                  activities. These technologies help us:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Strictly Necessary Cookies:</strong> Required for the website to function properly</li>
                  <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
                  <li><strong>Analytics Cookies:</strong> Understand how visitors interact with our website</li>
                  <li><strong>Targeting Cookies:</strong> Deliver relevant advertisements and measure campaign effectiveness</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  You can manage your cookie preferences through our <Link href="/cookie-preferences" className="underline hover:no-underline">Cookie Preferences</Link> page.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We implement appropriate technical and organizational measures to protect your personal 
                  information against unauthorized access, alteration, disclosure, or destruction. These 
                  measures include encryption, access controls, secure data storage, and regular security 
                  assessments. However, no method of transmission over the Internet or electronic storage 
                  is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your personal information for as long as necessary to fulfill the purposes for 
                  which it was collected, comply with legal obligations, resolve disputes, and enforce our 
                  agreements. Retention periods vary based on the type of information and applicable legal 
                  requirements. When we no longer need your information, we will securely delete or anonymize it.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Your Privacy Rights (Colorado Privacy Act)</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Under the Colorado Privacy Act, Colorado residents have the following rights:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li><strong>Right to Know:</strong> Request confirmation of whether we process your personal data and access to that data</li>
                  <li><strong>Right to Correction:</strong> Request correction of inaccurate personal data</li>
                  <li><strong>Right to Deletion:</strong> Request deletion of your personal data</li>
                  <li><strong>Right to Data Portability:</strong> Obtain a copy of your personal data in a portable format</li>
                  <li><strong>Right to Opt-Out:</strong> Opt out of targeted advertising, sale of personal data, or profiling</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  To exercise these rights, please contact us using the information below. We will respond to 
                  your request within 45 days. You have the right to appeal our decision regarding your request.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our services are not directed to individuals under the age of 18. We do not knowingly collect 
                  personal information from children. If we become aware that we have collected personal 
                  information from a child, we will take steps to delete that information promptly.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Changes to This Privacy Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material 
                  changes by posting the updated policy on our website and updating the "Effective Date" above. 
                  We encourage you to review this Privacy Policy periodically to stay informed about how we 
                  protect your information.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions about this Privacy Policy or wish to exercise your privacy rights, 
                  please contact us at:
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
