import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, CheckCircle2, XCircle, AlertTriangle, CreditCard, Building2,
  DollarSign, Calendar, User, Shield, Upload, FileText, ClipboardCheck,
  CreditCard as CreditCardIcon, Eye
} from "lucide-react";

interface SettlementSession {
  sessionId: string;
  tradeId: number;
  bondId?: number | null;
  amount: number;
  bondName?: string | null;
  investorEmail?: string | null;
  status: string;
  paymentReference?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  complianceStatus?: string | null;
  complianceRequired?: boolean;
}

interface ComplianceData {
  entityType?: string;
  legalName?: string;
  taxIdType?: string;
  taxIdLast4?: string;
  idPrimaryUploaded?: boolean;
  idPrimaryFileName?: string;
  idSecondaryUploaded?: boolean;
  idSecondaryFileName?: string;
  accreditedInvestorAttested?: boolean;
  holdHarmlessSigned?: boolean;
  privatePartySelfDirected?: boolean;
  creditAuthorizationSigned?: boolean;
  signatureName?: string;
  creditReportStatus?: string;
  status?: string;
}

function notifyParent(type: string, data?: Record<string, unknown>) {
  if (window.parent !== window) {
    window.parent.postMessage({ type, ...data }, "*");
  }
}

function SettlementComplianceWizard({ token, session }: { token: string; session: SettlementSession }) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [entityType, setEntityType] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxIdType, setTaxIdType] = useState("");
  const [taxIdFull, setTaxIdFull] = useState("");

  const [primaryFileName, setPrimaryFileName] = useState("");
  const [secondaryFileName, setSecondaryFileName] = useState("");
  const [primaryUploaded, setPrimaryUploaded] = useState(false);
  const [secondaryUploaded, setSecondaryUploaded] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const primaryInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);

  const [accreditedInvestor, setAccreditedInvestor] = useState(false);
  const [privateParty, setPrivateParty] = useState(false);
  const [holdHarmless, setHoldHarmless] = useState(false);
  const [creditAuthorization, setCreditAuthorization] = useState(false);
  const [signatureName, setSignatureName] = useState("");

  const [creditReportStatus, setCreditReportStatus] = useState("not_requested");
  const [pullingCredit, setPullingCredit] = useState(false);

  const { data: complianceData, isLoading: complianceLoading } = useQuery<ComplianceData>({
    queryKey: ["/api/settlement/compliance", token],
    queryFn: async () => {
      const res = await fetch(`/api/settlement/compliance?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load compliance data");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  useEffect(() => {
    if (complianceData) {
      if (complianceData.entityType) setEntityType(complianceData.entityType);
      if (complianceData.legalName) setLegalName(complianceData.legalName);
      if (complianceData.taxIdType) setTaxIdType(complianceData.taxIdType);
      if (complianceData.idPrimaryUploaded) {
        setPrimaryUploaded(true);
        setPrimaryFileName(complianceData.idPrimaryFileName || "Primary ID");
      }
      if (complianceData.idSecondaryUploaded) {
        setSecondaryUploaded(true);
        setSecondaryFileName(complianceData.idSecondaryFileName || "Secondary ID");
      }
      if (complianceData.accreditedInvestorAttested) setAccreditedInvestor(true);
      if (complianceData.holdHarmlessSigned) setHoldHarmless(true);
      if (complianceData.privatePartySelfDirected) setPrivateParty(true);
      if (complianceData.creditAuthorizationSigned) setCreditAuthorization(true);
      if (complianceData.signatureName) setSignatureName(complianceData.signatureName);
      if (complianceData.creditReportStatus) setCreditReportStatus(complianceData.creditReportStatus);
    }
  }, [complianceData]);

  useEffect(() => {
    if (entityType === "individual" && taxIdType === "ein") {
      setTaxIdType("ssn");
    } else if ((entityType === "llc" || entityType === "trust") && taxIdType === "ssn") {
      setTaxIdType("ein");
    }
  }, [entityType]);

  const handleSaveEntity = async () => {
    if (!entityType || !legalName || !taxIdType || !taxIdFull) {
      toast({ title: "Missing Fields", description: "Please complete all fields before continuing.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("POST", "/api/settlement/compliance/save", {
        token,
        entityType,
        legalName,
        taxIdType,
        taxIdLast4: taxIdFull.slice(-4),
        taxIdFull,
      });
      await res.json();
      toast({ title: "Saved", description: "Entity information saved." });
      setStep(2);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (docType: string, file: File) => {
    setUploading(docType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("token", token);
      formData.append("docType", docType);
      const res = await fetch("/api/settlement/compliance/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }
      if (docType === "id_primary") {
        setPrimaryUploaded(true);
        setPrimaryFileName(file.name);
      } else {
        setSecondaryUploaded(true);
        setSecondaryFileName(file.name);
      }
      toast({ title: "Uploaded", description: `${file.name} uploaded successfully.` });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleSign = async () => {
    if (!accreditedInvestor || !privateParty || !holdHarmless || !creditAuthorization || !signatureName) {
      toast({ title: "Incomplete", description: "Please complete all attestations and provide your signature.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiRequest("POST", "/api/settlement/compliance/sign", {
        token,
        accreditedInvestorAttested: accreditedInvestor,
        holdHarmlessSigned: holdHarmless,
        privatePartySelfDirected: privateParty,
        creditAuthorizationSigned: creditAuthorization,
        signatureName,
      });
      toast({ title: "Signed", description: "Attestations signed successfully." });
      setStep(4);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handlePullCredit = async () => {
    setPullingCredit(true);
    setCreditReportStatus("requested");
    try {
      const res = await apiRequest("POST", "/api/settlement/compliance/pull-credit", { token });
      const data = await res.json();
      const newStatus = data.status || "completed";
      setCreditReportStatus(newStatus);
      if (newStatus === "completed") {
        toast({ title: "Credit Report", description: "Credit report completed." });
        setTimeout(() => setStep(5), 1000);
      }
    } catch (err: any) {
      setCreditReportStatus("not_requested");
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setPullingCredit(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await apiRequest("POST", "/api/settlement/compliance/complete", { token });
      notifyParent("JACE_SETTLEMENT_COMPLIANCE_COMPLETED", { sessionId: session.sessionId });
      toast({ title: "Compliance Complete", description: "You may now proceed to settlement." });
      queryClient.invalidateQueries({ queryKey: ["/api/settlement/session", token] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (complianceLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="compliance-loading">
        <Card className="w-full max-w-md bg-slate-800/80 border-slate-700 text-white">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
            <p className="text-slate-300">Loading compliance information...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stepLabels = ["Entity & Tax ID", "Upload IDs", "Attestations", "Credit Report", "Review"];
  const stepIcons = [User, Upload, ClipboardCheck, CreditCardIcon, Eye];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="compliance-wizard">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
            <Shield className="h-6 w-6 text-indigo-400" />
            Settlement Compliance
          </h1>
          <p className="text-slate-400 mt-1">Complete compliance verification before settlement</p>
        </div>

        <div className="flex items-center justify-center gap-1" data-testid="compliance-step-indicator">
          {stepLabels.map((label, i) => {
            const StepIcon = stepIcons[i];
            const stepNum = i + 1;
            const isActive = step === stepNum;
            const isComplete = step > stepNum;
            return (
              <div key={label} className="flex items-center gap-1">
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : isComplete
                      ? "bg-emerald-600/30 text-emerald-400"
                      : "bg-slate-700/50 text-slate-500"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{stepNum}</span>
                </div>
                {i < stepLabels.length - 1 && (
                  <div className={`w-4 h-0.5 ${isComplete ? "bg-emerald-500" : "bg-slate-700"}`} />
                )}
              </div>
            );
          })}
        </div>

        <Badge variant="outline" className="mx-auto block w-fit border-indigo-500/50 text-indigo-300">
          Step {step} of 5
        </Badge>

        {step === 1 && (
          <Card className="border-slate-700 bg-slate-800/80 text-white" data-testid="compliance-step-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-400" />
                Entity & Tax Identification
              </CardTitle>
              <CardDescription className="text-slate-400">
                Provide your entity type and tax identification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-300">Entity Type</Label>
                <RadioGroup value={entityType} onValueChange={setEntityType} className="flex flex-wrap gap-4">
                  {[
                    { value: "individual", label: "Individual" },
                    { value: "llc", label: "LLC" },
                    { value: "trust", label: "Trust" },
                  ].map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={`entity-${opt.value}`} data-testid={`radio-entity-${opt.value}`} />
                      <Label htmlFor={`entity-${opt.value}`} className="text-slate-300 cursor-pointer">{opt.label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legalName" className="text-slate-300">Legal Name</Label>
                <Input
                  id="legalName"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="Full legal name"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  data-testid="input-legal-name"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Tax ID Type</Label>
                <RadioGroup value={taxIdType} onValueChange={setTaxIdType} className="flex flex-wrap gap-4">
                  {entityType === "individual" ? (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="ssn" id="taxid-ssn" data-testid="radio-taxid-ssn" />
                      <Label htmlFor="taxid-ssn" className="text-slate-300 cursor-pointer">SSN</Label>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="ein" id="taxid-ein" data-testid="radio-taxid-ein" />
                      <Label htmlFor="taxid-ein" className="text-slate-300 cursor-pointer">EIN</Label>
                    </div>
                  )}
                  {!entityType && (
                    <>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="ssn" id="taxid-ssn" data-testid="radio-taxid-ssn" />
                        <Label htmlFor="taxid-ssn" className="text-slate-300 cursor-pointer">SSN</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="ein" id="taxid-ein" data-testid="radio-taxid-ein" />
                        <Label htmlFor="taxid-ein" className="text-slate-300 cursor-pointer">EIN</Label>
                      </div>
                    </>
                  )}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="taxIdFull" className="text-slate-300">
                  {taxIdType === "ssn" ? "Social Security Number" : taxIdType === "ein" ? "Employer Identification Number" : "Tax ID"}
                </Label>
                <Input
                  id="taxIdFull"
                  value={taxIdFull}
                  onChange={(e) => setTaxIdFull(e.target.value)}
                  placeholder={taxIdType === "ssn" ? "XXX-XX-XXXX" : "XX-XXXXXXX"}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  data-testid="input-tax-id"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleSaveEntity}
                disabled={saving || !entityType || !legalName || !taxIdType || !taxIdFull}
                data-testid="button-save-entity"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save & Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 2 && (
          <Card className="border-slate-700 bg-slate-800/80 text-white" data-testid="compliance-step-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-indigo-400" />
                Identity Documents
              </CardTitle>
              <CardDescription className="text-slate-400">
                Upload government-issued identification documents
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <Label className="text-slate-300">Primary ID (Government-issued photo ID)</Label>
                {primaryUploaded ? (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-900/30 border border-emerald-500/30 p-3" data-testid="status-primary-id-uploaded">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 text-sm truncate">{primaryFileName}</span>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={primaryInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      data-testid="input-primary-id-file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload("id_primary", file);
                      }}
                    />
                    <Button
                      variant="outline"
                      className="w-full border-slate-600 text-slate-300"
                      onClick={() => primaryInputRef.current?.click()}
                      disabled={uploading === "id_primary"}
                      data-testid="button-upload-primary-id"
                    >
                      {uploading === "id_primary" ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Primary ID
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-slate-300">Secondary ID (Second form of identification)</Label>
                {secondaryUploaded ? (
                  <div className="flex items-center gap-2 rounded-md bg-emerald-900/30 border border-emerald-500/30 p-3" data-testid="status-secondary-id-uploaded">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                    <span className="text-emerald-300 text-sm truncate">{secondaryFileName}</span>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={secondaryInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      data-testid="input-secondary-id-file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUpload("id_secondary", file);
                      }}
                    />
                    <Button
                      variant="outline"
                      className="w-full border-slate-600 text-slate-300"
                      onClick={() => secondaryInputRef.current?.click()}
                      disabled={uploading === "id_secondary"}
                      data-testid="button-upload-secondary-id"
                    >
                      {uploading === "id_secondary" ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Upload Secondary ID
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300"
                onClick={() => setStep(1)}
                data-testid="button-back-step-1"
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={() => setStep(3)}
                disabled={!primaryUploaded}
                data-testid="button-continue-step-3"
              >
                Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 3 && (
          <Card className="border-slate-700 bg-slate-800/80 text-white" data-testid="compliance-step-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-indigo-400" />
                Attestations & Signature
              </CardTitle>
              <CardDescription className="text-slate-400">
                Review and acknowledge required attestations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="accredited"
                    checked={accreditedInvestor}
                    onCheckedChange={(v) => setAccreditedInvestor(!!v)}
                    data-testid="checkbox-accredited-investor"
                  />
                  <Label htmlFor="accredited" className="text-slate-300 text-sm cursor-pointer leading-relaxed">
                    I am an accredited investor as defined by SEC Rule 501(a)
                  </Label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="privateParty"
                    checked={privateParty}
                    onCheckedChange={(v) => setPrivateParty(!!v)}
                    data-testid="checkbox-private-party"
                  />
                  <Label htmlFor="privateParty" className="text-slate-300 text-sm cursor-pointer leading-relaxed">
                    I acknowledge I am a private party acting in a self-directed capacity
                  </Label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="holdHarmless"
                    checked={holdHarmless}
                    onCheckedChange={(v) => setHoldHarmless(!!v)}
                    data-testid="checkbox-hold-harmless"
                  />
                  <Label htmlFor="holdHarmless" className="text-slate-300 text-sm cursor-pointer leading-relaxed">
                    I agree to the Hold Harmless agreement and acknowledge investment risks
                  </Label>
                </div>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="creditAuth"
                    checked={creditAuthorization}
                    onCheckedChange={(v) => setCreditAuthorization(!!v)}
                    data-testid="checkbox-credit-authorization"
                  />
                  <Label htmlFor="creditAuth" className="text-slate-300 text-sm cursor-pointer leading-relaxed">
                    I authorize JACE Management to obtain my consumer credit report
                  </Label>
                </div>
              </div>

              <Separator className="bg-slate-700" />

              <div className="space-y-2">
                <Label htmlFor="signatureName" className="text-slate-300">Typed Signature (Legal Name)</Label>
                <Input
                  id="signatureName"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Type your full legal name"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 italic"
                  data-testid="input-signature-name"
                />
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300"
                onClick={() => setStep(2)}
                data-testid="button-back-step-2"
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                onClick={handleSign}
                disabled={saving || !accreditedInvestor || !privateParty || !holdHarmless || !creditAuthorization || !signatureName}
                data-testid="button-sign-continue"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
                Sign & Continue
              </Button>
            </CardFooter>
          </Card>
        )}

        {step === 4 && (
          <Card className="border-slate-700 bg-slate-800/80 text-white" data-testid="compliance-step-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCardIcon className="h-5 w-5 text-indigo-400" />
                Credit Report Authorization
              </CardTitle>
              <CardDescription className="text-slate-400">
                Authorize and pull credit report
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg bg-slate-700/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  <span className="text-slate-300 text-sm">Credit authorization signed</span>
                </div>
                <Separator className="bg-slate-600" />
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">Credit Report Status</span>
                  <Badge
                    variant="outline"
                    className={
                      creditReportStatus === "completed"
                        ? "border-emerald-500 text-emerald-400"
                        : creditReportStatus === "requested"
                        ? "border-amber-500 text-amber-400"
                        : "border-slate-500 text-slate-400"
                    }
                    data-testid="status-credit-report"
                  >
                    {creditReportStatus === "completed"
                      ? "Completed"
                      : creditReportStatus === "requested"
                      ? "Processing..."
                      : "Not Requested"}
                  </Badge>
                </div>
              </div>

              {creditReportStatus === "completed" && (
                <Alert className="bg-emerald-900/30 border-emerald-500/50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <AlertDescription className="text-emerald-300">
                    Credit report completed successfully. You may proceed to review.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300"
                onClick={() => setStep(3)}
                data-testid="button-back-step-3"
              >
                Back
              </Button>
              {creditReportStatus === "completed" ? (
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => setStep(5)}
                  data-testid="button-continue-step-5"
                >
                  Continue to Review
                </Button>
              ) : (
                <Button
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={handlePullCredit}
                  disabled={pullingCredit || creditReportStatus === "requested"}
                  data-testid="button-pull-credit"
                >
                  {pullingCredit ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCardIcon className="h-4 w-4 mr-2" />}
                  Pull Credit Report
                </Button>
              )}
            </CardFooter>
          </Card>
        )}

        {step === 5 && (
          <Card className="border-slate-700 bg-slate-800/80 text-white" data-testid="compliance-step-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5 text-indigo-400" />
                Review & Complete
              </CardTitle>
              <CardDescription className="text-slate-400">
                Review your compliance information before completing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-slate-700/50 p-4 space-y-3">
                <h3 className="text-sm font-medium text-slate-300">Entity Information</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-slate-400">Entity Type</span>
                  <span className="text-white capitalize" data-testid="review-entity-type">{entityType}</span>
                  <span className="text-slate-400">Legal Name</span>
                  <span className="text-white" data-testid="review-legal-name">{legalName}</span>
                  <span className="text-slate-400">Tax ID Type</span>
                  <span className="text-white uppercase" data-testid="review-tax-id-type">{taxIdType}</span>
                  <span className="text-slate-400">Tax ID</span>
                  <span className="text-white" data-testid="review-tax-id">***-**-{taxIdFull.slice(-4)}</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-700/50 p-4 space-y-3">
                <h3 className="text-sm font-medium text-slate-300">Documents</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-slate-300">Primary ID: {primaryFileName}</span>
                  </div>
                  {secondaryUploaded && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-slate-300">Secondary ID: {secondaryFileName}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-slate-700/50 p-4 space-y-3">
                <h3 className="text-sm font-medium text-slate-300">Attestations</h3>
                <div className="space-y-2 text-sm">
                  {[
                    { check: accreditedInvestor, label: "Accredited Investor" },
                    { check: privateParty, label: "Private Party Self-Directed" },
                    { check: holdHarmless, label: "Hold Harmless Agreement" },
                    { check: creditAuthorization, label: "Credit Authorization" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2">
                      <CheckCircle2 className={`h-4 w-4 ${item.check ? "text-emerald-400" : "text-slate-500"}`} />
                      <span className={item.check ? "text-slate-300" : "text-slate-500"}>{item.label}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm pt-1">
                  <span className="text-slate-400">Signature:</span>
                  <span className="text-white italic" data-testid="review-signature">{signatureName}</span>
                </div>
              </div>

              <div className="rounded-lg bg-slate-700/50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Credit Report</span>
                  <Badge variant="outline" className="border-emerald-500 text-emerald-400">
                    {creditReportStatus === "completed" ? "Completed" : creditReportStatus}
                  </Badge>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-3">
              <Button
                variant="outline"
                className="border-slate-600 text-slate-300"
                onClick={() => setStep(4)}
                data-testid="button-back-step-4"
              >
                Back
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleComplete}
                disabled={saving}
                data-testid="button-complete-compliance"
              >
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Shield className="h-4 w-4 mr-2" />}
                Complete Compliance
              </Button>
            </CardFooter>
          </Card>
        )}

        <p className="text-center text-slate-500 text-xs">
          Session ID: {session.sessionId} | Trade #{session.tradeId}
        </p>
      </div>
    </div>
  );
}

export default function SettlementPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [paymentReference, setPaymentReference] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [settlementComplete, setSettlementComplete] = useState(false);
  const [settlementCancelled, setSettlementCancelled] = useState(false);

  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get("session") || "";

  const { data: session, isLoading, error } = useQuery<SettlementSession>({
    queryKey: ["/api/settlement/session", token],
    queryFn: async () => {
      if (!token) throw new Error("No session token provided");
      const res = await fetch(`/api/settlement/session?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load settlement session");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const completeMutation = useMutation({
    mutationFn: async ({ sessionId, paymentRef, token: sessionToken }: { sessionId: string; paymentRef: string; token: string }) => {
      const res = await apiRequest("POST", "/api/settlement/complete", {
        sessionId,
        paymentReference: paymentRef,
        token: sessionToken,
      });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      setSettlementComplete(true);
      const ref = variables.paymentRef;
      notifyParent("JACE_SETTLEMENT_SUBMITTED", {
        sessionId: session?.sessionId,
        paymentReference: ref,
      });
      toast({
        title: "Settlement Submitted",
        description: "Your settlement request has been submitted and is pending internal escrow confirmation.",
      });
    },
    onError: (err: Error) => {
      notifyParent("JACE_SETTLEMENT_FAILED", {
        sessionId: session?.sessionId,
        reason: err.message,
      });
      toast({
        title: "Settlement Failed",
        description: err.message,
        variant: "destructive",
      });
    },
    onSettled: () => { setIsProcessing(false); },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ sessionId, reason, token: sessionToken }: { sessionId: string; reason?: string; token: string }) => {
      const res = await apiRequest("POST", "/api/settlement/cancel", {
        sessionId,
        reason,
        token: sessionToken,
      });
      return res.json();
    },
    onSuccess: () => {
      setSettlementCancelled(true);
      notifyParent("JACE_SETTLEMENT_CANCELLED", {
        sessionId: session?.sessionId,
      });
      toast({
        title: "Settlement Cancelled",
        description: "The settlement has been cancelled.",
      });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const handleConfirm = async () => {
    if (!session?.sessionId) return;
    
    setIsProcessing(true);
    
    const ref = paymentReference || `JACE-PAY-${Date.now()}`;
    setPaymentReference(ref);
    
    completeMutation.mutate({ sessionId: session.sessionId, paymentRef: ref, token });
  };

  const handleCancel = () => {
    if (!session?.sessionId || !token) return;
    cancelMutation.mutate({ sessionId: session.sessionId, reason: "User cancelled", token });
  };

  useEffect(() => {
    if (session) {
      notifyParent("JACE_SETTLEMENT_LOADED", { sessionId: session.sessionId });
    }
  }, [session]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="settlement-no-token">
        <Card className="w-full max-w-md border-red-500/50 bg-slate-800/80 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Invalid Session
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">No settlement session token was provided. Please return to BondAI and try again.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="settlement-loading">
        <Card className="w-full max-w-md bg-slate-800/80 border-slate-700 text-white">
          <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-400" />
            <p className="text-slate-300">Loading settlement session...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="settlement-error">
        <Card className="w-full max-w-md border-red-500/50 bg-slate-800/80 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-400">
              <XCircle className="h-5 w-5" />
              Session Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-300">{(error as Error).message}</p>
            <p className="text-slate-400 text-sm mt-2">Please return to BondAI and start a new settlement session.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (session && session.complianceRequired === true && session.complianceStatus !== "complete") {
    return <SettlementComplianceWizard token={token} session={session} />;
  }

  if (settlementComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 p-6" data-testid="settlement-complete">
        <Card className="w-full max-w-md border-emerald-500/50 bg-slate-800/80 text-white">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            </div>
            <CardTitle className="text-emerald-400">Settlement Submitted</CardTitle>
            <CardDescription className="text-slate-300">
              Your settlement request has been submitted and is pending internal escrow confirmation
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-slate-700/50 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Trade ID</span>
                <span className="text-white font-medium">{session?.tradeId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Amount</span>
                <span className="text-emerald-400 font-medium">${Number(session?.amount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Reference</span>
                <span className="text-white font-mono text-xs">{paymentReference}</span>
              </div>
            </div>
            <p className="text-center text-slate-400 text-sm">
              You may close this window. Your request is in queue for confirmation.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (settlementCancelled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 p-6" data-testid="settlement-cancelled">
        <Card className="w-full max-w-md border-amber-500/50 bg-slate-800/80 text-white">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <XCircle className="h-10 w-10 text-amber-400" />
            </div>
            <CardTitle className="text-amber-400">Settlement Cancelled</CardTitle>
            <CardDescription className="text-slate-300">
              Your settlement has been cancelled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-slate-400 text-sm">
              You may close this window and return to BondAI.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-6" data-testid="settlement-page">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">JACE CRM Settlement</h1>
          <p className="text-slate-400 mt-1">Complete your bond purchase settlement</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/80 text-white">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-indigo-400" />
                Settlement Details
              </CardTitle>
              <Badge variant="outline" className="border-indigo-500 text-indigo-400">
                Trade #{session?.tradeId}
              </Badge>
            </div>
            <CardDescription className="text-slate-400">
              Review and confirm your settlement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4">
              <div className="rounded-lg bg-slate-700/50 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-indigo-400" />
                  <div>
                    <p className="text-xs text-slate-400">Bond Name</p>
                    <p className="text-white font-medium">{session?.bondName || "Bond Purchase"}</p>
                  </div>
                </div>
                <Separator className="bg-slate-600" />
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-emerald-400" />
                  <div>
                    <p className="text-xs text-slate-400">Settlement Amount</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      ${Number(session?.amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Separator className="bg-slate-600" />
                <div className="flex items-center gap-3">
                  <User className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Investor Email</p>
                    <p className="text-white">{session?.investorEmail || "N/A"}</p>
                  </div>
                </div>
                <Separator className="bg-slate-600" />
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-xs text-slate-400">Session Expires</p>
                    <p className="text-white">
                      {session?.expiresAt ? new Date(session.expiresAt).toLocaleString() : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="paymentRef" className="text-slate-300">Payment Reference (Optional)</Label>
              <Input
                id="paymentRef"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Enter a reference for your records"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                data-testid="input-payment-reference"
              />
            </div>

            <Alert className="bg-indigo-900/30 border-indigo-500/50">
              <Shield className="h-4 w-4 text-indigo-400" />
              <AlertDescription className="text-slate-300">
                Your payment is secured by JACE CRM. All transactions are encrypted and logged for compliance.
              </AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300"
              onClick={handleCancel}
              disabled={isProcessing || cancelMutation.isPending}
              data-testid="button-cancel-settlement"
            >
              {cancelMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Cancel
            </Button>
            <Button
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleConfirm}
              disabled={isProcessing || completeMutation.isPending}
              data-testid="button-confirm-payment"
            >
              {isProcessing || completeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Submit Settlement
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <p className="text-center text-slate-500 text-xs">
          Session ID: {session?.sessionId} | Created: {session?.createdAt ? new Date(session.createdAt).toLocaleString() : "N/A"}
        </p>
      </div>
    </div>
  );
}
