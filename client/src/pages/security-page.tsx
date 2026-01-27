import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, Shield, Lock, Smartphone, AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FooterLegal } from "@/components/footer-legal";

export default function SecurityPage() {
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
                <Shield className="h-8 w-8 text-muted-foreground" />
                Security
              </CardTitle>
              <p className="text-muted-foreground">
                Your security is our priority. Learn about our security measures and best practices.
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-4">Our Security Measures</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  At JACE Management, LLC, we employ industry-leading security measures to protect your 
                  personal and financial information:
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-medium mb-2">Data Encryption</h3>
                    <p className="text-sm text-muted-foreground">
                      All data transmitted between your browser and our servers is encrypted using 
                      TLS 1.3 encryption. Data at rest is encrypted using AES-256 encryption.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-medium mb-2">Access Controls</h3>
                    <p className="text-sm text-muted-foreground">
                      We implement strict access controls to ensure only authorized personnel can 
                      access sensitive systems and data.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-medium mb-2">Regular Audits</h3>
                    <p className="text-sm text-muted-foreground">
                      We conduct regular security assessments and penetration testing to identify 
                      and address potential vulnerabilities.
                    </p>
                  </div>
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h3 className="font-medium mb-2">Monitoring</h3>
                    <p className="text-sm text-muted-foreground">
                      Our systems are monitored 24/7 for suspicious activity and potential 
                      security threats.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Recommendations for Users</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Help us keep your account secure by following these best practices:
                </p>
                <div className="space-y-4">
                  <div className="flex gap-4 p-4 border rounded-lg">
                    <Lock className="h-6 w-6 text-muted-foreground shrink-0 mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Use Strong Passwords</h3>
                      <p className="text-sm text-muted-foreground">
                        Create passwords that are at least 12 characters long and include a mix of 
                        uppercase letters, lowercase letters, numbers, and special characters. Avoid 
                        using easily guessable information like birthdays or common words. Consider 
                        using a password manager to generate and store unique passwords.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border rounded-lg">
                    <Smartphone className="h-6 w-6 text-muted-foreground shrink-0 mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Enable Multi-Factor Authentication (MFA)</h3>
                      <p className="text-sm text-muted-foreground">
                        Add an extra layer of security by enabling MFA on your account. This requires 
                        a second form of verification, such as a code sent to your phone or generated 
                        by an authenticator app, in addition to your password.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border rounded-lg">
                    <Shield className="h-6 w-6 text-muted-foreground shrink-0 mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Keep Your Devices Updated</h3>
                      <p className="text-sm text-muted-foreground">
                        Regularly update your operating system, browser, and applications to ensure 
                        you have the latest security patches. Enable automatic updates when possible 
                        and use reputable antivirus software.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4 p-4 border rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-muted-foreground shrink-0 mt-1" />
                    <div>
                      <h3 className="font-medium mb-1">Be Aware of Phishing</h3>
                      <p className="text-sm text-muted-foreground">
                        Be cautious of unsolicited emails, texts, or calls asking for personal 
                        information. JACE Management will never ask for your password via email or 
                        phone. Verify the sender's email address and look for signs of phishing, 
                        such as urgent language or suspicious links.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Reporting Security Issues</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you discover a security vulnerability or suspect your account has been compromised, 
                  please contact us immediately:
                </p>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">Security Contact</span>
                  </div>
                  <p className="text-muted-foreground">Email: jacemgmt@gmail.com</p>
                  <p className="text-muted-foreground">Phone: 970-710-9193</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Include "SECURITY" in the subject line for priority handling.
                  </p>
                </div>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Fraud Prevention Tips</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>Never share your login credentials with anyone</li>
                  <li>Log out of your account when using shared or public computers</li>
                  <li>Regularly review your account activity for unauthorized transactions</li>
                  <li>Use secure, private networks when accessing your account</li>
                  <li>Be skeptical of offers that seem too good to be true</li>
                  <li>Verify requests for money or information, even if they appear to come from trusted sources</li>
                </ul>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>

      <FooterLegal />
    </div>
  );
}
