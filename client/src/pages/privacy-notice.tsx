import { useRef } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Printer, Download, FileText } from "lucide-react";
import { PrivacyModelForm } from "@/templates/privacy-model-form";

export default function PrivacyNoticePage() {
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 lg:p-8" data-testid="privacy-notice-page">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              GLBA Model Privacy Notice
            </h1>
            <p className="text-muted-foreground text-sm">
              Federal privacy disclosure form (Gramm-Leach-Bliley Act compliant)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} data-testid="button-print">
            <Printer className="h-4 w-4 mr-2" />
            Print / Save PDF
          </Button>
        </div>
      </div>

      <Card className="print:shadow-none print:border-none">
        <CardHeader className="print:hidden">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Privacy Notice Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="print:p-0">
          <div className="border rounded-lg overflow-auto print:border-none print:overflow-visible">
            <PrivacyModelForm ref={printRef} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 print:hidden">
        <CardHeader>
          <CardTitle>About This Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            This is the GLBA Model Privacy Form, a standardized privacy notice format developed by federal financial regulators.
            Using this model form provides a "safe harbor" for covered financial institutions.
          </p>
          <div>
            <h4 className="font-medium text-foreground mb-2">Key Components:</h4>
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>FACTS box:</strong> Explains why, what, and how personal information is collected and shared</li>
              <li><strong>Disclosure table:</strong> Lists all sharing categories with Yes/No indicators</li>
              <li><strong>To limit our sharing:</strong> Instructions for opting out of certain sharing</li>
              <li><strong>Mail-in form:</strong> Physical opt-out form for investors who prefer mail</li>
              <li><strong>Page 2:</strong> Definitions and additional FAQ about data practices</li>
            </ul>
          </div>
          <p>
            This form is automatically customized with JACE's sharing policies. Investors receive this notice during compliance onboarding
            and can access it at any time through the investor portal.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
