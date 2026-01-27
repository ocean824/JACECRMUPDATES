import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FooterLegal } from "@/components/footer-legal";

export default function TermsOfUsePage() {
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
              <CardTitle className="text-3xl">Terms of Use</CardTitle>
              <p className="text-muted-foreground">Effective Date: January 27, 2026</p>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none space-y-8">
              <section>
                <h2 className="text-xl font-semibold mb-3">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  By accessing or using the services provided by JACE Management, LLC ("JACE," "we," "us," or "our"), 
                  you agree to be bound by these Terms of Use ("Terms"). If you do not agree to these Terms, 
                  please do not use our services. These Terms constitute a legally binding agreement between you 
                  and JACE Management, LLC regarding your use of our website and related services.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">2. Not a Bank Disclaimer</h2>
                <p className="text-muted-foreground leading-relaxed">
                  JACE Management, LLC is not a bank, credit union, or other depository institution. We do not 
                  accept deposits, make loans, or provide banking services. Any financial services facilitated 
                  through our platform are provided by third-party financial institutions. JACE Management, LLC 
                  is not a registered investment adviser, broker-dealer, or insurance company. Nothing on this 
                  website should be construed as investment, legal, or tax advice.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">3. Eligibility</h2>
                <p className="text-muted-foreground leading-relaxed">
                  To use our services, you must be at least 18 years of age and have the legal capacity to enter 
                  into binding contracts. By using our services, you represent and warrant that you meet these 
                  eligibility requirements. Our services are intended for use by residents of the United States 
                  and may not be available in all jurisdictions.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">4. Permitted Use</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to use our services only for lawful purposes and in accordance with these Terms. 
                  You shall not: (a) use our services in any way that violates applicable laws or regulations; 
                  (b) attempt to gain unauthorized access to our systems or networks; (c) interfere with or 
                  disrupt our services; (d) use automated means to access our services without our express 
                  written consent; or (e) transmit any malicious code or content.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">5. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed">
                  All content, trademarks, logos, and intellectual property displayed on our website are the 
                  property of JACE Management, LLC or our licensors. You may not reproduce, distribute, modify, 
                  or create derivative works from any content without our prior written consent. Nothing in 
                  these Terms grants you any right, title, or interest in our intellectual property.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">6. Third-Party Services</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our services may contain links to third-party websites or services that are not owned or 
                  controlled by JACE Management, LLC. We have no control over, and assume no responsibility 
                  for, the content, privacy policies, or practices of any third-party websites or services. 
                  Your interactions with third-party services are governed by their respective terms and 
                  privacy policies.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">7. Disclaimers</h2>
                <p className="text-muted-foreground leading-relaxed">
                  OUR SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER 
                  EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, 
                  FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT OUR SERVICES 
                  WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">8. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, JACE MANAGEMENT, LLC SHALL NOT BE LIABLE FOR ANY 
                  INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED 
                  TO LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR RELATED TO YOUR USE OF OUR SERVICES. 
                  OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID TO US IN THE TWELVE MONTHS PRECEDING 
                  THE CLAIM.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">9. Indemnification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to indemnify, defend, and hold harmless JACE Management, LLC, its officers, directors, 
                  employees, agents, and affiliates from and against any claims, liabilities, damages, losses, 
                  and expenses, including reasonable attorneys' fees, arising out of or related to: (a) your use 
                  of our services; (b) your violation of these Terms; or (c) your violation of any rights of 
                  another party.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">10. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify you of any material 
                  changes by posting the updated Terms on our website and updating the "Effective Date" above. 
                  Your continued use of our services after any changes indicates your acceptance of the modified 
                  Terms. We encourage you to review these Terms periodically.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">11. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the State of 
                  Colorado, without regard to its conflict of law provisions. Any legal action or proceeding 
                  arising out of or related to these Terms shall be brought exclusively in the state or federal 
                  courts located in the State of Colorado, and you consent to the jurisdiction of such courts.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">12. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If you have any questions about these Terms of Use, please contact us at:
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
