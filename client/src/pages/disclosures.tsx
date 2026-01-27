import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { ArrowLeft, AlertCircle, FileWarning, ExternalLink as ExternalLinkIcon, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FooterLegal } from "@/components/footer-legal";

export default function DisclosuresPage() {
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
                <FileWarning className="h-8 w-8 text-muted-foreground" />
                Disclosures
              </CardTitle>
              <p className="text-muted-foreground">
                Important information about JACE Management, LLC and our services.
              </p>
            </CardHeader>
            <CardContent className="space-y-8">
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">General Disclaimer</h2>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg space-y-4">
                  <p className="text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">JACE Management, LLC is not a bank.</strong> We are not 
                    a bank, savings and loan, credit union, trust company, or other type of depository 
                    institution. We do not accept deposits, make loans, or offer banking services. Any 
                    banking services referenced on this website are provided by third-party financial 
                    institutions with which JACE Management, LLC may partner.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">No Investment Advice.</strong> The information provided 
                    on this website is for general informational purposes only and does not constitute 
                    investment advice, financial advice, trading advice, or any other sort of advice. 
                    JACE Management, LLC is not a registered investment adviser, broker-dealer, or 
                    financial planner. You should not rely on the information presented on this website 
                    as a basis for making any investment decisions.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    <strong className="text-foreground">No Legal or Tax Advice.</strong> Nothing on this website 
                    should be construed as legal, tax, or accounting advice. We recommend that you consult 
                    with qualified professionals for specific legal, tax, or accounting matters.
                  </p>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <ExternalLinkIcon className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Third-Party Services</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Our website may contain links to third-party websites, products, or services that are 
                  not owned or controlled by JACE Management, LLC. Please be aware of the following:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    We have no control over, and assume no responsibility for, the content, privacy 
                    policies, or practices of any third-party websites or services.
                  </li>
                  <li>
                    The inclusion of any link does not imply endorsement, approval, or sponsorship by 
                    JACE Management, LLC.
                  </li>
                  <li>
                    Third-party services have their own terms of service and privacy policies that 
                    govern your use of those services.
                  </li>
                  <li>
                    Any transactions or interactions you have with third parties are solely between 
                    you and the third party.
                  </li>
                  <li>
                    We are not responsible for any loss or damage arising from your reliance on 
                    third-party content or services.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">Risk and Compliance Disclosures</h2>
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Investment Risks</h3>
                    <p className="text-sm text-muted-foreground">
                      All investments involve risk, including the potential loss of principal. Past 
                      performance does not guarantee future results. The value of investments may 
                      fluctuate, and you may receive more or less than your original investment. 
                      Consider your investment objectives and risk tolerance before investing.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">Regulatory Compliance</h3>
                    <p className="text-sm text-muted-foreground">
                      JACE Management, LLC is organized as a Colorado Limited Liability Company. We 
                      are committed to compliance with all applicable federal and state laws and 
                      regulations. This includes, but is not limited to, anti-money laundering (AML) 
                      requirements, Know Your Customer (KYC) procedures, and data privacy regulations.
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <h3 className="font-medium mb-2">No Guarantees</h3>
                    <p className="text-sm text-muted-foreground">
                      We make no representations or warranties of any kind, express or implied, about 
                      the completeness, accuracy, reliability, suitability, or availability of the 
                      information, products, services, or related graphics contained on this website 
                      for any purpose.
                    </p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-xl font-semibold">Electronic Communications Consent</h2>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  By using our services, you consent to receive electronic communications from 
                  JACE Management, LLC. This consent includes:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mb-4">
                  <li>
                    <strong className="text-foreground">Account Notifications:</strong> Alerts about your 
                    account activity, security updates, and service changes.
                  </li>
                  <li>
                    <strong className="text-foreground">Legal Disclosures:</strong> Terms of use, privacy 
                    policy updates, and other required legal notices.
                  </li>
                  <li>
                    <strong className="text-foreground">Transaction Confirmations:</strong> Records and 
                    confirmations of transactions or actions taken through our platform.
                  </li>
                  <li>
                    <strong className="text-foreground">Marketing Communications:</strong> Promotional 
                    materials and updates about our services (you may opt out at any time).
                  </li>
                </ul>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h3 className="font-medium mb-2">Hardware and Software Requirements</h3>
                  <p className="text-sm text-muted-foreground">
                    To receive and retain electronic communications, you need: (1) a computer or mobile 
                    device with internet access; (2) a current web browser with cookies enabled; (3) a 
                    valid email address; (4) sufficient storage space to save communications or a 
                    printer to print them.
                  </p>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  You may withdraw your consent to receive electronic communications at any time by 
                  contacting us. Withdrawal of consent may result in termination of your access to 
                  certain services.
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Additional Disclosures</h2>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                  <li>
                    <strong className="text-foreground">Securities:</strong> Securities products, if any, 
                    are not FDIC insured, have no bank guarantee, and may lose value.
                  </li>
                  <li>
                    <strong className="text-foreground">Insurance:</strong> Insurance products are not 
                    deposits and are not insured by the FDIC or any federal government agency.
                  </li>
                  <li>
                    <strong className="text-foreground">Forward-Looking Statements:</strong> Any 
                    forward-looking statements on this website are based on current expectations and 
                    are subject to risks and uncertainties.
                  </li>
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-3">Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed">
                  For questions about these disclosures, please contact us:
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
