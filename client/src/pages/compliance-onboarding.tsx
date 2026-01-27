import { useState, useEffect, useCallback } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  FileCheck, 
  AlertCircle,
  Shield,
  Lock,
  FileText,
  User,
  Building2,
  Loader2,
  CheckCircle2,
  Circle
} from "lucide-react";
import { ElectronicSignature, type SignatureData } from "@/components/electronic-signature";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

type InvestorType = "individual" | "entity";
type DocumentType = "AML_CERTIFICATION" | "PRIVACY_CIP_KYC_NOTICE_CONSENT" | "PRIVACY_NOTICE_SHORTFORM";
type PrivacySharingTier = "REQUIRED_ONLY" | "PRODUCT_COMMS" | "MARKETING_PLUS";

interface ComplianceStatus {
  investorId: string;
  amlCertificationSigned: boolean;
  privacyNoticeSigned: boolean;
  shortFormPrivacySigned: boolean;
  isActivated: boolean;
  activatedAt?: string;
  privacySharingTier?: PrivacySharingTier;
  electronicDeliveryConsent?: boolean;
}

interface AMLFormData {
  investorType: InvestorType;
  fullName: string;
  dateOfBirth: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  governmentIdType: string;
  governmentIdNumber: string;
  phone: string;
  email: string;
  legalEntityName: string;
  entityType: string;
  stateOfFormation: string;
  ein: string;
  authorizedSignatoryName: string;
  authorizedSignatoryTitle: string;
  sourceOfFunds: string[];
  certifications: boolean[];
}

interface PrivacyFormData {
  privacySharingTier: PrivacySharingTier;
  electronicDeliveryConsent: boolean;
  cipNoticeAcknowledged: boolean;
  privacyNoticeAcknowledged: boolean;
}

interface ShortFormPrivacyFormData {
  longFormGoverns: boolean;
}

const ENTITY_TYPES = [
  { value: "llc", label: "Limited Liability Company (LLC)" },
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust", label: "Trust" },
  { value: "fund", label: "Fund" },
  { value: "other", label: "Other" },
];

const GOVERNMENT_ID_TYPES = [
  { value: "passport", label: "Passport" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "state_id", label: "State ID" },
  { value: "national_id", label: "National ID" },
];

const SOURCE_OF_FUNDS_OPTIONS = [
  { value: "employment", label: "Employment Income" },
  { value: "business", label: "Business Income" },
  { value: "investments", label: "Investment Returns" },
  { value: "real_estate", label: "Real Estate" },
  { value: "inheritance", label: "Inheritance" },
  { value: "savings", label: "Savings" },
  { value: "other", label: "Other" },
];

const AML_CERTIFICATIONS = [
  "I certify that all information provided is true, accurate, and complete to the best of my knowledge.",
  "I am not a Politically Exposed Person (PEP) or, if I am, I have disclosed this status.",
  "The funds used for investment are not derived from illegal activities.",
  "I am not acting as a nominee or agent for an undisclosed third party.",
  "I will promptly notify JACE of any material changes to the information provided.",
  "I understand that providing false information may result in legal consequences.",
  "I consent to JACE conducting background checks and verifying the information provided.",
];

const CIP_NOTICE_TEXT = `CUSTOMER IDENTIFICATION PROGRAM (CIP) NOTICE

To help the government fight the funding of terrorism and money laundering activities, federal law requires all financial institutions to obtain, verify, and record information that identifies each person who opens an account.

What this means for you: When you open an account, we will ask for your name, address, date of birth, and other information that will allow us to identify you. We may also ask to see your driver's license or other identifying documents.`;

const PRIVACY_NOTICE_TEXT = `PRIVACY NOTICE

This notice describes how we collect, use, and share your personal information. We are committed to protecting your privacy and handling your data responsibly.

We collect information you provide directly, such as your name, contact information, and financial data. We may share this information with affiliates and service providers as necessary to provide our services.

You have the right to access, correct, and delete your personal information. Please contact us for any privacy-related inquiries.`;

const SHORT_FORM_PRIVACY_TEXT = `SHORT-FORM PRIVACY NOTICE

FACTS: WHAT DOES JACE DO WITH YOUR PERSONAL INFORMATION?

WHY? Financial companies choose how they share your personal information. Federal law gives consumers the right to limit some but not all sharing. Federal law also requires us to tell you how we collect, share, and protect your personal information.

WHAT? The types of personal information we collect and share depend on the product or service you have with us. This information can include:
• Social Security number and income
• Account balances and payment history
• Credit history and credit scores

HOW? All financial companies need to share customers' personal information to run their everyday business. In the section below, we list the reasons financial companies can share their customers' personal information; the reasons JACE chooses to share; and whether you can limit this sharing.

For more information, please refer to our full Privacy Policy.`;

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export default function ComplianceOnboardingPage() {
  const { investorId } = useParams<{ investorId: string }>();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [sessionId] = useState(() => generateSessionId());

  const [amlFormData, setAmlFormData] = useState<AMLFormData>({
    investorType: "individual",
    fullName: "",
    dateOfBirth: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "United States",
    governmentIdType: "",
    governmentIdNumber: "",
    phone: "",
    email: "",
    legalEntityName: "",
    entityType: "",
    stateOfFormation: "",
    ein: "",
    authorizedSignatoryName: "",
    authorizedSignatoryTitle: "",
    sourceOfFunds: [],
    certifications: new Array(AML_CERTIFICATIONS.length).fill(false),
  });

  const [privacyFormData, setPrivacyFormData] = useState<PrivacyFormData>({
    privacySharingTier: "REQUIRED_ONLY",
    electronicDeliveryConsent: false,
    cipNoticeAcknowledged: false,
    privacyNoticeAcknowledged: false,
  });

  const [shortFormPrivacyFormData, setShortFormPrivacyFormData] = useState<ShortFormPrivacyFormData>({
    longFormGoverns: false,
  });

  const [amlSignature, setAmlSignature] = useState<SignatureData | null>(null);
  const [privacySignature, setPrivacySignature] = useState<SignatureData | null>(null);
  const [shortFormSignature, setShortFormSignature] = useState<SignatureData | null>(null);

  const { data: complianceStatus, isLoading: isLoadingStatus } = useQuery<ComplianceStatus>({
    queryKey: ["/api/compliance/status", investorId],
    enabled: !!investorId,
  });

  const submitDocumentMutation = useMutation({
    mutationFn: async ({ documentType, formData, signature }: { 
      documentType: DocumentType; 
      formData: Record<string, unknown>; 
      signature: SignatureData;
    }) => {
      return apiRequest("POST", "/api/compliance/documents", {
        investorId,
        documentType,
        formData,
        signature,
        onboardingSessionId: sessionId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/status", investorId] });
      toast({
        title: "Document Signed",
        description: `${variables.documentType.replace(/_/g, " ")} has been successfully signed.`,
      });
      if (currentStep < 3) {
        setCurrentStep(currentStep + 1);
      }
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit document",
        variant: "destructive",
      });
    },
  });

  const activateInvestorMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/compliance/activate/${investorId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/compliance/status", investorId] });
      toast({
        title: "Investor Activated",
        description: "The investor has been successfully activated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to activate investor",
        variant: "destructive",
      });
    },
  });

  const isDocumentSigned = (docType: DocumentType): boolean => {
    if (!complianceStatus) return false;
    switch (docType) {
      case "AML_CERTIFICATION":
        return complianceStatus.amlCertificationSigned ?? false;
      case "PRIVACY_CIP_KYC_NOTICE_CONSENT":
        return complianceStatus.privacyNoticeSigned ?? false;
      case "PRIVACY_NOTICE_SHORTFORM":
        return complianceStatus.shortFormPrivacySigned ?? false;
      default:
        return false;
    }
  };

  // All required documents: AML + Privacy/CIP/KYC must be signed for activation
  // Short-form privacy is optional but recommended
  const allRequiredDocumentsSigned = complianceStatus
    ? (complianceStatus.amlCertificationSigned && complianceStatus.privacyNoticeSigned)
    : false;
  
  // Track if all three documents are signed (including optional short-form)
  const allDocumentsSigned = complianceStatus
    ? (complianceStatus.amlCertificationSigned && 
       complianceStatus.privacyNoticeSigned && 
       complianceStatus.shortFormPrivacySigned)
    : false;

  const handleAmlSubmit = () => {
    if (!amlSignature) {
      toast({ title: "Error", description: "Please provide your signature", variant: "destructive" });
      return;
    }
    if (!amlFormData.certifications.every(c => c)) {
      toast({ title: "Error", description: "Please acknowledge all certifications", variant: "destructive" });
      return;
    }
    submitDocumentMutation.mutate({
      documentType: "AML_CERTIFICATION",
      formData: amlFormData as unknown as Record<string, unknown>,
      signature: amlSignature,
    });
  };

  const handlePrivacySubmit = () => {
    if (!privacySignature) {
      toast({ title: "Error", description: "Please provide your signature", variant: "destructive" });
      return;
    }
    if (!privacyFormData.cipNoticeAcknowledged || !privacyFormData.privacyNoticeAcknowledged) {
      toast({ title: "Error", description: "Please acknowledge all notices", variant: "destructive" });
      return;
    }
    submitDocumentMutation.mutate({
      documentType: "PRIVACY_CIP_KYC_NOTICE_CONSENT",
      formData: privacyFormData as unknown as Record<string, unknown>,
      signature: privacySignature,
    });
  };

  const handleShortFormSubmit = () => {
    if (!shortFormSignature) {
      toast({ title: "Error", description: "Please provide your signature", variant: "destructive" });
      return;
    }
    if (!shortFormPrivacyFormData.longFormGoverns) {
      toast({ title: "Error", description: "Please acknowledge the disclosure", variant: "destructive" });
      return;
    }
    submitDocumentMutation.mutate({
      documentType: "PRIVACY_NOTICE_SHORTFORM",
      formData: shortFormPrivacyFormData as unknown as Record<string, unknown>,
      signature: shortFormSignature,
    });
  };

  const handleAmlSignatureChange = useCallback((data: SignatureData | null) => {
    setAmlSignature(data);
  }, []);

  const handlePrivacySignatureChange = useCallback((data: SignatureData | null) => {
    setPrivacySignature(data);
  }, []);

  const handleShortFormSignatureChange = useCallback((data: SignatureData | null) => {
    setShortFormSignature(data);
  }, []);

  if (!investorId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <span>Invalid investor ID</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoadingStatus) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  const steps = [
    { id: 1, title: "AML/CTF & Sanctions", icon: Shield, docType: "AML_CERTIFICATION" as DocumentType },
    { id: 2, title: "Privacy & CIP/KYC", icon: Lock, docType: "PRIVACY_CIP_KYC_NOTICE_CONSENT" as DocumentType },
    { id: 3, title: "Short-Form Privacy", icon: FileText, docType: "PRIVACY_NOTICE_SHORTFORM" as DocumentType },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="compliance-onboarding-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
            Compliance Onboarding
          </h1>
          <p className="text-muted-foreground">
            Complete all required compliance documents to proceed with your investment.
          </p>
        </div>
        {allRequiredDocumentsSigned && !complianceStatus?.isActivated && (
          <Button 
            onClick={() => activateInvestorMutation.mutate()}
            disabled={activateInvestorMutation.isPending}
            data-testid="button-activate-investor"
          >
            {activateInvestorMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Activate Investor
          </Button>
        )}
        {complianceStatus?.isActivated && (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Activated
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => setCurrentStep(step.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                currentStep === step.id 
                  ? "bg-primary text-primary-foreground" 
                  : isDocumentSigned(step.docType)
                    ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                    : "bg-muted text-muted-foreground hover-elevate"
              }`}
              data-testid={`button-step-${step.id}`}
            >
              {isDocumentSigned(step.docType) ? (
                <Check className="h-4 w-4" />
              ) : (
                <step.icon className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">Step {step.id}</span>
            </button>
            {index < steps.length - 1 && (
              <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {(() => {
                  const StepIcon = steps[currentStep - 1].icon;
                  return StepIcon ? <StepIcon className="h-5 w-5" /> : null;
                })()}
                {steps[currentStep - 1].title}
              </CardTitle>
              <CardDescription>
                Step {currentStep} of 3
                {isDocumentSigned(steps[currentStep - 1].docType) && (
                  <Badge className="ml-2 bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    Completed
                  </Badge>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {currentStep === 1 && (
            <AMLCertificationForm
              formData={amlFormData}
              setFormData={setAmlFormData}
              signature={amlSignature}
              onSignatureChange={handleAmlSignatureChange}
              onSubmit={handleAmlSubmit}
              isSubmitting={submitDocumentMutation.isPending}
              isSigned={isDocumentSigned("AML_CERTIFICATION")}
            />
          )}
          {currentStep === 2 && (
            <PrivacyCIPKYCForm
              formData={privacyFormData}
              setFormData={setPrivacyFormData}
              signature={privacySignature}
              onSignatureChange={handlePrivacySignatureChange}
              onSubmit={handlePrivacySubmit}
              isSubmitting={submitDocumentMutation.isPending}
              isSigned={isDocumentSigned("PRIVACY_CIP_KYC_NOTICE_CONSENT")}
            />
          )}
          {currentStep === 3 && (
            <ShortFormPrivacyForm
              formData={shortFormPrivacyFormData}
              setFormData={setShortFormPrivacyFormData}
              signature={shortFormSignature}
              onSignatureChange={handleShortFormSignatureChange}
              onSubmit={handleShortFormSubmit}
              isSubmitting={submitDocumentMutation.isPending}
              isSigned={isDocumentSigned("PRIVACY_NOTICE_SHORTFORM")}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1}
          data-testid="button-back"
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button
          onClick={() => setCurrentStep(Math.min(3, currentStep + 1))}
          disabled={currentStep === 3}
          data-testid="button-continue"
        >
          Continue
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

interface AMLFormProps {
  formData: AMLFormData;
  setFormData: (data: AMLFormData) => void;
  signature: SignatureData | null;
  onSignatureChange: (data: SignatureData | null) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isSigned: boolean;
}

function AMLCertificationForm({ formData, setFormData, signature, onSignatureChange, onSubmit, isSubmitting, isSigned }: AMLFormProps) {
  const updateFormData = (updates: Partial<AMLFormData>) => {
    setFormData({ ...formData, ...updates });
  };

  const toggleSourceOfFunds = (value: string) => {
    const newSources = formData.sourceOfFunds.includes(value)
      ? formData.sourceOfFunds.filter(s => s !== value)
      : [...formData.sourceOfFunds, value];
    updateFormData({ sourceOfFunds: newSources });
  };

  const toggleCertification = (index: number) => {
    const newCertifications = [...formData.certifications];
    newCertifications[index] = !newCertifications[index];
    updateFormData({ certifications: newCertifications });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Label>Investor Type</Label>
        <Tabs 
          value={formData.investorType} 
          onValueChange={(value) => updateFormData({ investorType: value as InvestorType })}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual" data-testid="tab-individual">
              <User className="h-4 w-4 mr-2" />
              Individual
            </TabsTrigger>
            <TabsTrigger value="entity" data-testid="tab-entity">
              <Building2 className="h-4 w-4 mr-2" />
              Entity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Legal Name</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => updateFormData({ fullName: e.target.value })}
                  placeholder="John Doe"
                  data-testid="input-full-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateFormData({ dateOfBirth: e.target.value })}
                  data-testid="input-dob"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="governmentIdType">Government ID Type</Label>
                <Select
                  value={formData.governmentIdType}
                  onValueChange={(value) => updateFormData({ governmentIdType: value })}
                >
                  <SelectTrigger data-testid="select-id-type">
                    <SelectValue placeholder="Select ID type" />
                  </SelectTrigger>
                  <SelectContent>
                    {GOVERNMENT_ID_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="governmentIdNumber">ID Number</Label>
                <Input
                  id="governmentIdNumber"
                  value={formData.governmentIdNumber}
                  onChange={(e) => updateFormData({ governmentIdNumber: e.target.value })}
                  placeholder="ID Number"
                  data-testid="input-id-number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateFormData({ address: e.target.value })}
                placeholder="123 Main Street"
                data-testid="input-address"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateFormData({ city: e.target.value })}
                  placeholder="City"
                  data-testid="input-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => updateFormData({ state: e.target.value })}
                  placeholder="State"
                  data-testid="input-state"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => updateFormData({ zipCode: e.target.value })}
                  placeholder="12345"
                  data-testid="input-zip"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => updateFormData({ country: e.target.value })}
                  placeholder="Country"
                  data-testid="input-country"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateFormData({ phone: e.target.value })}
                  placeholder="+1 (555) 123-4567"
                  data-testid="input-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData({ email: e.target.value })}
                  placeholder="john@example.com"
                  data-testid="input-email"
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="entity" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="legalEntityName">Legal Entity Name</Label>
                <Input
                  id="legalEntityName"
                  value={formData.legalEntityName}
                  onChange={(e) => updateFormData({ legalEntityName: e.target.value })}
                  placeholder="Acme Corp LLC"
                  data-testid="input-entity-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entityType">Entity Type</Label>
                <Select
                  value={formData.entityType}
                  onValueChange={(value) => updateFormData({ entityType: value })}
                >
                  <SelectTrigger data-testid="select-entity-type">
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stateOfFormation">State of Formation</Label>
                <Input
                  id="stateOfFormation"
                  value={formData.stateOfFormation}
                  onChange={(e) => updateFormData({ stateOfFormation: e.target.value })}
                  placeholder="Delaware"
                  data-testid="input-state-formation"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ein">EIN / Tax ID</Label>
                <Input
                  id="ein"
                  value={formData.ein}
                  onChange={(e) => updateFormData({ ein: e.target.value })}
                  placeholder="XX-XXXXXXX"
                  data-testid="input-ein"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="entityAddress">Business Address</Label>
              <Input
                id="entityAddress"
                value={formData.address}
                onChange={(e) => updateFormData({ address: e.target.value })}
                placeholder="123 Business Ave"
                data-testid="input-entity-address"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entityCity">City</Label>
                <Input
                  id="entityCity"
                  value={formData.city}
                  onChange={(e) => updateFormData({ city: e.target.value })}
                  placeholder="City"
                  data-testid="input-entity-city"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entityState">State</Label>
                <Input
                  id="entityState"
                  value={formData.state}
                  onChange={(e) => updateFormData({ state: e.target.value })}
                  placeholder="State"
                  data-testid="input-entity-state"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entityZip">ZIP Code</Label>
                <Input
                  id="entityZip"
                  value={formData.zipCode}
                  onChange={(e) => updateFormData({ zipCode: e.target.value })}
                  placeholder="12345"
                  data-testid="input-entity-zip"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entityCountry">Country</Label>
                <Input
                  id="entityCountry"
                  value={formData.country}
                  onChange={(e) => updateFormData({ country: e.target.value })}
                  placeholder="Country"
                  data-testid="input-entity-country"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Authorized Signatory</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="authorizedSignatoryName">Signatory Name</Label>
                  <Input
                    id="authorizedSignatoryName"
                    value={formData.authorizedSignatoryName}
                    onChange={(e) => updateFormData({ authorizedSignatoryName: e.target.value })}
                    placeholder="Jane Smith"
                    data-testid="input-signatory-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="authorizedSignatoryTitle">Signatory Title</Label>
                  <Input
                    id="authorizedSignatoryTitle"
                    value={formData.authorizedSignatoryTitle}
                    onChange={(e) => updateFormData({ authorizedSignatoryTitle: e.target.value })}
                    placeholder="Managing Partner"
                    data-testid="input-signatory-title"
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Separator />

      <div className="space-y-4">
        <Label>Source of Funds (select all that apply)</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SOURCE_OF_FUNDS_OPTIONS.map((source) => (
            <div key={source.value} className="flex items-center space-x-2">
              <Checkbox
                id={`source-${source.value}`}
                checked={formData.sourceOfFunds.includes(source.value)}
                onCheckedChange={() => toggleSourceOfFunds(source.value)}
                data-testid={`checkbox-source-${source.value}`}
              />
              <Label htmlFor={`source-${source.value}`} className="text-sm font-normal cursor-pointer">
                {source.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <Label>Certifications</Label>
        <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
          {AML_CERTIFICATIONS.map((certification, index) => (
            <div key={index} className="flex items-start space-x-3">
              <Checkbox
                id={`cert-${index}`}
                checked={formData.certifications[index]}
                onCheckedChange={() => toggleCertification(index)}
                className="mt-0.5"
                data-testid={`checkbox-certification-${index}`}
              />
              <Label htmlFor={`cert-${index}`} className="text-sm font-normal cursor-pointer leading-relaxed">
                {certification}
              </Label>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      <ElectronicSignature
        showTitle={formData.investorType === "entity"}
        value={signature}
        onChange={onSignatureChange}
      />

      <div className="flex justify-end">
        <Button 
          onClick={onSubmit} 
          disabled={isSubmitting || isSigned}
          data-testid="button-submit-aml"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isSigned ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Signed
            </>
          ) : (
            <>
              <FileCheck className="h-4 w-4 mr-2" />
              Sign & Submit
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface PrivacyFormProps {
  formData: PrivacyFormData;
  setFormData: (data: PrivacyFormData) => void;
  signature: SignatureData | null;
  onSignatureChange: (data: SignatureData | null) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isSigned: boolean;
}

function PrivacyCIPKYCForm({ formData, setFormData, signature, onSignatureChange, onSubmit, isSubmitting, isSigned }: PrivacyFormProps) {
  const updateFormData = (updates: Partial<PrivacyFormData>) => {
    setFormData({ ...formData, ...updates });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Customer Identification Program (CIP) Notice
          </h4>
          <ScrollArea className="h-40 w-full rounded-md border p-4">
            <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="text-cip-notice">
              {CIP_NOTICE_TEXT}
            </p>
          </ScrollArea>
          <div className="flex items-center space-x-2 mt-3">
            <Checkbox
              id="cipAcknowledge"
              checked={formData.cipNoticeAcknowledged}
              onCheckedChange={(checked) => updateFormData({ cipNoticeAcknowledged: checked === true })}
              data-testid="checkbox-cip-acknowledge"
            />
            <Label htmlFor="cipAcknowledge" className="text-sm font-normal cursor-pointer">
              I have read and understand the CIP Notice
            </Label>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Privacy Notice
          </h4>
          <ScrollArea className="h-40 w-full rounded-md border p-4">
            <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="text-privacy-notice">
              {PRIVACY_NOTICE_TEXT}
            </p>
          </ScrollArea>
          <div className="flex items-center space-x-2 mt-3">
            <Checkbox
              id="privacyAcknowledge"
              checked={formData.privacyNoticeAcknowledged}
              onCheckedChange={(checked) => updateFormData({ privacyNoticeAcknowledged: checked === true })}
              data-testid="checkbox-privacy-acknowledge"
            />
            <Label htmlFor="privacyAcknowledge" className="text-sm font-normal cursor-pointer">
              I have read and understand the Privacy Notice
            </Label>
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-medium">Information Sharing Preferences</h4>
        <RadioGroup
          value={formData.privacySharingTier}
          onValueChange={(value) => updateFormData({ privacySharingTier: value as PrivacySharingTier })}
          className="space-y-3"
        >
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate">
            <RadioGroupItem value="REQUIRED_ONLY" id="tier-required" data-testid="radio-required-only" />
            <div>
              <Label htmlFor="tier-required" className="font-medium cursor-pointer">
                Required Sharing Only
              </Label>
              <p className="text-sm text-muted-foreground">
                Share information only as required by law and for essential business operations.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate">
            <RadioGroupItem value="PRODUCT_COMMS" id="tier-product" data-testid="radio-product-comms" />
            <div>
              <Label htmlFor="tier-product" className="font-medium cursor-pointer">
                Plus Product Communications
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow sharing for product updates, investment opportunities, and service improvements.
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 rounded-lg border hover-elevate">
            <RadioGroupItem value="MARKETING_PLUS" id="tier-marketing" data-testid="radio-marketing-plus" />
            <div>
              <Label htmlFor="tier-marketing" className="font-medium cursor-pointer">
                Plus Marketing
              </Label>
              <p className="text-sm text-muted-foreground">
                Allow sharing for marketing, promotional offers, and partner communications.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      <Separator />

      <div className="flex items-center space-x-2">
        <Checkbox
          id="electronicDelivery"
          checked={formData.electronicDeliveryConsent}
          onCheckedChange={(checked) => updateFormData({ electronicDeliveryConsent: checked === true })}
          data-testid="checkbox-electronic-delivery"
        />
        <Label htmlFor="electronicDelivery" className="text-sm font-normal cursor-pointer">
          I consent to receive documents and communications electronically
        </Label>
      </div>

      <Separator />

      <ElectronicSignature
        showTitle={false}
        value={signature}
        onChange={onSignatureChange}
      />

      <div className="flex justify-end">
        <Button 
          onClick={onSubmit} 
          disabled={isSubmitting || isSigned}
          data-testid="button-submit-privacy"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isSigned ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Signed
            </>
          ) : (
            <>
              <FileCheck className="h-4 w-4 mr-2" />
              Sign & Submit
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

interface ShortFormPrivacyFormProps {
  formData: ShortFormPrivacyFormData;
  setFormData: (data: ShortFormPrivacyFormData) => void;
  signature: SignatureData | null;
  onSignatureChange: (data: SignatureData | null) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isSigned: boolean;
}

function ShortFormPrivacyForm({ formData, setFormData, signature, onSignatureChange, onSubmit, isSubmitting, isSigned }: ShortFormPrivacyFormProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h4 className="font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Short-Form Privacy Notice
        </h4>
        <ScrollArea className="h-64 w-full rounded-md border p-4">
          <p className="text-sm text-muted-foreground whitespace-pre-line" data-testid="text-short-form-notice">
            {SHORT_FORM_PRIVACY_TEXT}
          </p>
        </ScrollArea>
      </div>

      <Separator />

      <div className="p-4 bg-muted/50 rounded-lg">
        <div className="flex items-start space-x-3">
          <Checkbox
            id="longFormGoverns"
            checked={formData.longFormGoverns}
            onCheckedChange={(checked) => setFormData({ longFormGoverns: checked === true })}
            className="mt-0.5"
            data-testid="checkbox-long-form-governs"
          />
          <Label htmlFor="longFormGoverns" className="text-sm font-normal cursor-pointer leading-relaxed">
            I acknowledge that this Short-Form Privacy Notice is provided for convenience only and that the 
            Long-Form Privacy Notice governs the relationship between JACE and myself with respect to privacy 
            matters. I have been provided with access to the Long-Form Privacy Notice.
          </Label>
        </div>
      </div>

      <Separator />

      <ElectronicSignature
        showTitle={false}
        value={signature}
        onChange={onSignatureChange}
      />

      <div className="flex justify-end">
        <Button 
          onClick={onSubmit} 
          disabled={isSubmitting || isSigned}
          data-testid="button-submit-short-form"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isSigned ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Signed
            </>
          ) : (
            <>
              <FileCheck className="h-4 w-4 mr-2" />
              Sign & Submit
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
