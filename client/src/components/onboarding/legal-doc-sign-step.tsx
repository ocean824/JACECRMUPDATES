import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { FileText, Check, Loader2 } from "lucide-react";

interface LegalDocSignStepProps {
  investorId: string;
  documentType: "AML_CERTIFICATION" | "CIP_KYC_PRIVACY_CONSENT" | "PRIVACY_SHORTFORM";
  documentTitle: string;
  documentBody: string;
  onComplete: () => void;
  signerEmail?: string;
}

export function LegalDocSignStep({
  investorId,
  documentType,
  documentTitle,
  documentBody,
  onComplete,
  signerEmail,
}: LegalDocSignStepProps) {
  const { toast } = useToast();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [signerName, setSignerName] = useState("");
  const [hasAgreed, setHasAgreed] = useState(false);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const maxScroll = scrollHeight - clientHeight;
    
    if (maxScroll <= 0) {
      setScrollProgress(100);
      setHasScrolledToEnd(true);
      return;
    }

    const progress = Math.min(100, Math.round((scrollTop / maxScroll) * 100));
    setScrollProgress(progress);

    if (progress >= 95) {
      setHasScrolledToEnd(true);
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (container.scrollHeight <= container.clientHeight) {
      setScrollProgress(100);
      setHasScrolledToEnd(true);
    }
  }, [documentBody]);

  const signMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/investor-documents/sign", {
        investorId,
        documentType,
        signerName: signerName.trim(),
        signerEmail: signerEmail || null,
        signatureMethod: "TYPED",
        signatureValue: signerName.trim(),
        consentSnapshot: {
          agreedToTerms: true,
          scrolledToEnd: true,
          documentType,
          timestamp: new Date().toISOString(),
        },
        metadata: {
          scrollProgress: 100,
          userAgent: navigator.userAgent,
        },
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document Signed",
        description: `You have successfully signed the ${documentTitle}.`,
      });
      onComplete();
    },
    onError: (error: Error) => {
      toast({
        title: "Signing Failed",
        description: error.message || "Failed to sign the document. Please try again.",
        variant: "destructive",
      });
    },
  });

  const canSubmit = hasScrolledToEnd && hasAgreed && signerName.trim().length >= 2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit && !signMutation.isPending) {
      signMutation.mutate();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <div>
            <CardTitle data-testid="text-document-title">{documentTitle}</CardTitle>
            <CardDescription>Please read the entire document before signing</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Reading Progress</span>
            <span 
              className="font-medium"
              data-testid="text-scroll-progress"
            >
              {scrollProgress}%
            </span>
          </div>
          <Progress 
            value={scrollProgress} 
            className="h-2"
            data-testid="progress-scroll"
          />
          {!hasScrolledToEnd && (
            <p className="text-xs text-muted-foreground">
              Scroll to the bottom of the document to enable signing
            </p>
          )}
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-[400px] overflow-y-auto border rounded-md bg-muted/30 p-4"
          data-testid="container-document"
        >
          <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground">
            {documentBody}
          </pre>
        </div>

        <div 
          className={`space-y-6 transition-opacity duration-300 ${
            hasScrolledToEnd ? "opacity-100" : "opacity-50 pointer-events-none"
          }`}
        >
          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              {hasScrolledToEnd && <Check className="h-4 w-4 text-green-600" />}
              Electronic Signature
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signer-name">Full Legal Name</Label>
                <Input
                  id="signer-name"
                  type="text"
                  placeholder="Enter your full legal name"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  disabled={!hasScrolledToEnd || signMutation.isPending}
                  data-testid="input-signer-name"
                  className="max-w-md"
                />
                {signerName.trim().length > 0 && signerName.trim().length < 2 && (
                  <p className="text-xs text-destructive">Name must be at least 2 characters</p>
                )}
              </div>

              <div className="flex items-start space-x-3">
                <Checkbox
                  id="agree-terms"
                  checked={hasAgreed}
                  onCheckedChange={(checked) => setHasAgreed(checked === true)}
                  disabled={!hasScrolledToEnd || signMutation.isPending}
                  data-testid="checkbox-agree-terms"
                />
                <Label
                  htmlFor="agree-terms"
                  className="text-sm leading-relaxed cursor-pointer"
                >
                  I have read and agree to the terms above. I understand that by typing my name and 
                  clicking submit, I am providing my electronic signature which has the same legal 
                  effect as a handwritten signature.
                </Label>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <Button
                  type="submit"
                  disabled={!canSubmit || signMutation.isPending}
                  data-testid="button-sign-document"
                >
                  {signMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Sign Document
                    </>
                  )}
                </Button>
                {!hasScrolledToEnd && (
                  <span className="text-sm text-muted-foreground">
                    Please scroll to read the entire document first
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
