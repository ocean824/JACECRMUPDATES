import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, ShieldCheck, FileCheck2 } from "lucide-react";

type ComplianceSnapshot = {
  sessionId: string;
  status: string;
  entityType: string;
  entityLegalName: string | null;
  taxIdType: string | null;
  taxIdLast4: string | null;
  accreditedInvestor: boolean;
  privatePartyAck: boolean;
  holdHarmlessAck: boolean;
  setExchangeAck: boolean;
  authorizationSigned: boolean;
  authorizationSignedAt: string | null;
  signatureName: string | null;
  idPrimaryDocumentId: string | null;
  idSecondaryDocumentId: string | null;
  creditReportDocumentId: string | null;
  creditProvider: string | null;
  creditReference: string | null;
  creditStatus: string;
  completedAt: string | null;
};

async function getSnapshot(token: string): Promise<ComplianceSnapshot> {
  const res = await fetch(`/api/settlement/compliance?token=${encodeURIComponent(token)}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load compliance");
  return res.json();
}

async function postJson<T>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data as T;
}

async function uploadFile(token: string, kind: "id_primary" | "id_secondary" | "credit_report", file: File) {
  const fd = new FormData();
  fd.append("token", token);
  fd.append("kind", kind);
  fd.append("file", file);
  const res = await fetch("/api/settlement/compliance/upload", {
    method: "POST",
    credentials: "include",
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Upload failed");
  return data;
}

export function SettlementComplianceWizard({ token, onComplete }: { token: string; onComplete: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const snap = useQuery({
    queryKey: ["settlementCompliance", token],
    queryFn: () => getSnapshot(token),
    enabled: !!token,
    retry: 1,
  });

  const initial = snap.data;

  const [step, setStep] = useState(0);

  const [entityType, setEntityType] = useState("individual");
  const [entityLegalName, setEntityLegalName] = useState("");
  const [taxIdType, setTaxIdType] = useState<"SSN" | "EIN">("SSN");
  const [taxId, setTaxId] = useState("");

  const [signatureName, setSignatureName] = useState("");
  const [signatureValue, setSignatureValue] = useState("");

  const [accreditedInvestor, setAccreditedInvestor] = useState(false);
  const [privatePartyAck, setPrivatePartyAck] = useState(false);
  const [holdHarmlessAck, setHoldHarmlessAck] = useState(false);
  const [setExchangeAck, setSetExchangeAck] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setEntityType(initial.entityType || "individual");
    setEntityLegalName(initial.entityLegalName || "");
    setTaxIdType((initial.taxIdType as any) || "SSN");
    setAccreditedInvestor(!!initial.accreditedInvestor);
    setPrivatePartyAck(!!initial.privatePartyAck);
    setHoldHarmlessAck(!!initial.holdHarmlessAck);
    setSetExchangeAck(!!initial.setExchangeAck);
    setSignatureName(initial.signatureName || "");
  }, [initial?.sessionId]);

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => postJson<ComplianceSnapshot>("/api/settlement/compliance/save", { token, ...payload }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["settlementCompliance", token] });
    },
    onError: (err: any) => toast({ title: "Save failed", description: err?.message || "Unable to save", variant: "destructive" }),
  });

  const signMutation = useMutation({
    mutationFn: async () =>
      postJson<ComplianceSnapshot>("/api/settlement/compliance/sign", {
        token,
        signatureName: signatureName.trim(),
        signatureMethod: "TYPED",
        signatureValue: signatureValue.trim(),
      }),
    onSuccess: async () => {
      toast({ title: "Authorization signed", description: "Credit authorization captured." });
      await qc.invalidateQueries({ queryKey: ["settlementCompliance", token] });
    },
    onError: (err: any) => toast({ title: "Signature failed", description: err?.message || "Unable to sign", variant: "destructive" }),
  });

  const pullCreditMutation = useMutation({
    mutationFn: async () => postJson<any>("/api/settlement/compliance/pull-credit", { token, provider: "demo" }),
    onSuccess: async (data) => {
      toast({ title: "Tri-merge received", description: `Reference: ${data?.reference || "(n/a)"}` });
      await qc.invalidateQueries({ queryKey: ["settlementCompliance", token] });
    },
    onError: (err: any) => toast({ title: "Credit pull failed", description: err?.message || "Unable to pull credit", variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: async () => postJson<any>("/api/settlement/compliance/complete", { token }),
    onSuccess: async () => {
      toast({ title: "Compliance complete", description: "You may now submit your settlement." });
      await qc.invalidateQueries({ queryKey: ["settlementCompliance", token] });
      try {
        window.parent?.postMessage({ type: "JACE_SETTLEMENT_COMPLIANCE_COMPLETED", sessionToken: token }, "*");
      } catch {
        // no-op
      }
      onComplete();
    },
    onError: (err: any) => {
      const msg = err?.message || "Unable to complete compliance";
      toast({ title: "Compliance incomplete", description: msg, variant: "destructive" });
    },
  });

  const idPrimaryInputRef = useRef<HTMLInputElement | null>(null);
  const idSecondaryInputRef = useRef<HTMLInputElement | null>(null);
  const creditInputRef = useRef<HTMLInputElement | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async ({ kind, file }: { kind: "id_primary" | "id_secondary" | "credit_report"; file: File }) => uploadFile(token, kind, file),
    onSuccess: async () => {
      toast({ title: "Upload complete" });
      await qc.invalidateQueries({ queryKey: ["settlementCompliance", token] });
    },
    onError: (err: any) => toast({ title: "Upload failed", description: err?.message || "Unable to upload", variant: "destructive" }),
  });

  const canNextEntity = entityLegalName.trim().length >= 2;
  const canNextTax = taxId.trim().length >= 4;
  const hasIds = !!initial?.idPrimaryDocumentId && !!initial?.idSecondaryDocumentId;
  const hasCredit = !!initial?.creditReportDocumentId || initial?.creditStatus === "received";
  const hasSignature = !!initial?.authorizationSigned;

  const canComplete = useMemo(() => {
    return (
      canNextEntity &&
      !!initial?.taxIdLast4 &&
      hasIds &&
      hasSignature &&
      hasCredit &&
      accreditedInvestor &&
      privatePartyAck &&
      holdHarmlessAck &&
      setExchangeAck
    );
  }, [canNextEntity, initial?.taxIdLast4, hasIds, hasSignature, hasCredit, accreditedInvestor, privatePartyAck, holdHarmlessAck, setExchangeAck]);

  if (snap.isLoading) {
    return (
      <Card className="border-slate-700 bg-slate-800/80 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading compliance gate…
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (snap.isError) {
    return (
      <Card className="border-slate-700 bg-slate-800/80 text-white">
        <CardHeader>
          <CardTitle>Compliance Gate</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="bg-red-900/30 border-red-500/50">
            <AlertDescription>Unable to load compliance information. Please refresh the page.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (initial?.status === "complete") {
    return (
      <Card className="border-slate-700 bg-slate-800/80 text-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-emerald-400" /> Compliance Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="text-slate-300">
          You've completed the compliance gate. You may now submit your settlement.
        </CardContent>
      </Card>
    );
  }

  async function goNext() {
    if (step === 0) {
      await saveMutation.mutateAsync({ entityType, entityLegalName });
      setStep(1);
      return;
    }
    if (step === 1) {
      await saveMutation.mutateAsync({ taxIdType, taxId });
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      setStep(4);
      return;
    }
  }

  function goBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <Card className="border-slate-700 bg-slate-800/80 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-indigo-400" /> Compliance Gate
        </CardTitle>
        <div className="text-xs text-slate-400">Step {step + 1} of 5</div>
      </CardHeader>

      <CardContent className="space-y-6">
        <Alert className="bg-indigo-900/30 border-indigo-500/50">
          <AlertDescription className="text-slate-300">
            Before you can submit settlement, we must collect entity type, tax ID (encrypted), two forms of ID, and tri-merge credit authorization.
          </AlertDescription>
        </Alert>

        {step === 0 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Purchasing As</Label>
              <RadioGroup value={entityType} onValueChange={setEntityType} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="individual" id="entity-individual" data-testid="radio-entity-individual" />
                  <Label htmlFor="entity-individual" className="text-slate-200">Individual</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="trust" id="entity-trust" data-testid="radio-entity-trust" />
                  <Label htmlFor="entity-trust" className="text-slate-200">Trust</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="llc" id="entity-llc" data-testid="radio-entity-llc" />
                  <Label htmlFor="entity-llc" className="text-slate-200">LLC / Entity</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="legalName" className="text-slate-300">Legal Name (exact)</Label>
              <Input
                id="legalName"
                value={entityLegalName}
                onChange={(e) => setEntityLegalName(e.target.value)}
                placeholder="Full legal name of individual, trust, or LLC"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                data-testid="input-legal-name"
              />
            </div>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Tax ID Type</Label>
              <RadioGroup value={taxIdType} onValueChange={(v) => setTaxIdType(v as any)} className="grid gap-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="SSN" id="tax-ssn" data-testid="radio-tax-ssn" />
                  <Label htmlFor="tax-ssn" className="text-slate-200">SSN (Individual)</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="EIN" id="tax-ein" data-testid="radio-tax-ein" />
                  <Label htmlFor="tax-ein" className="text-slate-200">EIN (Trust/LLC)</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="taxId" className="text-slate-300">{taxIdType} (encrypted)</Label>
              <Input
                id="taxId"
                value={taxId}
                onChange={(e) => setTaxId(e.target.value)}
                placeholder={taxIdType === "SSN" ? "XXX-XX-XXXX" : "XX-XXXXXXX"}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                data-testid="input-tax-id"
              />
              <p className="text-xs text-slate-400">We encrypt and store only the last 4 digits for display.</p>
              {initial?.taxIdLast4 ? <p className="text-xs text-emerald-400">On file: ****{initial.taxIdLast4}</p> : null}
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Upload two forms of ID</Label>
              <p className="text-xs text-slate-400">Accepts PDF/JPG/PNG. You can use a driver's license + passport, etc.</p>
            </div>

            <div className="grid gap-3">
              <input ref={idPrimaryInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMutation.mutate({ kind: "id_primary", file: f });
              }} />
              <Button
                type="button"
                variant="outline"
                className="border-slate-600 text-slate-200 hover:bg-slate-700 justify-start"
                onClick={() => idPrimaryInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                data-testid="button-upload-primary-id"
              >
                <Upload className="h-4 w-4 mr-2" /> Primary ID {initial?.idPrimaryDocumentId ? "\u2713" : ""}
              </Button>

              <input ref={idSecondaryInputRef} type="file" className="hidden" accept="image/*,application/pdf" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMutation.mutate({ kind: "id_secondary", file: f });
              }} />
              <Button
                type="button"
                variant="outline"
                className="border-slate-600 text-slate-200 hover:bg-slate-700 justify-start"
                onClick={() => idSecondaryInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                data-testid="button-upload-secondary-id"
              >
                <Upload className="h-4 w-4 mr-2" /> Secondary ID {initial?.idSecondaryDocumentId ? "\u2713" : ""}
              </Button>
            </div>

            {!hasIds ? (
              <Alert className="bg-slate-900/50 border-slate-600">
                <AlertDescription className="text-slate-300">Both ID uploads are required.</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Credit Authorization (Tri-Merge)</Label>
              <p className="text-xs text-slate-400">Sign authorization to pull your tri-merge credit report, or upload a tri-merge PDF.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sigName" className="text-slate-300">Signature Name</Label>
              <Input
                id="sigName"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Type your full legal name"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                data-testid="input-signature-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sigValue" className="text-slate-300">Signature (type again)</Label>
              <Input
                id="sigValue"
                value={signatureValue}
                onChange={(e) => setSignatureValue(e.target.value)}
                placeholder="Type your signature"
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                data-testid="input-signature-value"
              />
            </div>

            <div className="flex flex-col md:flex-row gap-2">
              <Button
                type="button"
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => signMutation.mutate()}
                disabled={signMutation.isPending || !signatureName.trim() || !signatureValue.trim()}
                data-testid="button-sign-authorization"
              >
                {signMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Sign Authorization
              </Button>

              <Button
                type="button"
                variant="outline"
                className="border-slate-600 text-slate-200 hover:bg-slate-700"
                onClick={() => pullCreditMutation.mutate()}
                disabled={pullCreditMutation.isPending || !initial?.authorizationSigned}
                data-testid="button-pull-credit"
              >
                {pullCreditMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Pull Tri-Merge (Demo)
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Or Upload Tri-Merge PDF</Label>
              <input ref={creditInputRef} type="file" className="hidden" accept="application/pdf,image/*" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadMutation.mutate({ kind: "credit_report", file: f });
              }} />
              <Button
                type="button"
                variant="outline"
                className="border-slate-600 text-slate-200 hover:bg-slate-700 justify-start"
                onClick={() => creditInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                data-testid="button-upload-credit-report"
              >
                <Upload className="h-4 w-4 mr-2" /> Upload Tri-Merge {hasCredit ? "\u2713" : ""}
              </Button>
            </div>

            {!hasSignature ? (
              <Alert className="bg-slate-900/50 border-slate-600">
                <AlertDescription className="text-slate-300">Authorization signature is required.</AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Required Attestations</Label>
              <p className="text-xs text-slate-400">These are required for purchase processing and recordkeeping.</p>
            </div>

            <div className="grid gap-3">
              <div className="flex items-start gap-2">
                <Checkbox checked={accreditedInvestor} onCheckedChange={(v) => {
                  const b = !!v;
                  setAccreditedInvestor(b);
                  saveMutation.mutate({ accreditedInvestor: b });
                }} data-testid="checkbox-accredited-investor" />
                <div className="space-y-1">
                  <p className="text-slate-200 text-sm">I am an accredited investor and understand the risks.</p>
                  <p className="text-xs text-slate-400">I acknowledge I am making an informed private investment decision.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox checked={privatePartyAck} onCheckedChange={(v) => {
                  const b = !!v;
                  setPrivatePartyAck(b);
                  saveMutation.mutate({ privatePartyAck: b });
                }} data-testid="checkbox-private-party" />
                <div className="space-y-1">
                  <p className="text-slate-200 text-sm">I am a private party purchaser and acknowledge this is not a public offering.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox checked={holdHarmlessAck} onCheckedChange={(v) => {
                  const b = !!v;
                  setHoldHarmlessAck(b);
                  saveMutation.mutate({ holdHarmlessAck: b });
                }} data-testid="checkbox-hold-harmless" />
                <div className="space-y-1">
                  <p className="text-slate-200 text-sm">I agree to hold JACE harmless for my investment decision.</p>
                  <p className="text-xs text-slate-400">Subject to the terms of the contracts and applicable law.</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox checked={setExchangeAck} onCheckedChange={(v) => {
                  const b = !!v;
                  setSetExchangeAck(b);
                  saveMutation.mutate({ setExchangeAck: b });
                }} data-testid="checkbox-set-exchange" />
                <div className="space-y-1">
                  <p className="text-slate-200 text-sm">I consent to EIN/SSN tracking for IRS reporting and set exchange recordkeeping.</p>
                  <p className="text-xs text-slate-400">Tax ID is encrypted; only last 4 is displayed.</p>
                </div>
              </div>
            </div>

            {!canComplete ? (
              <Alert className="bg-slate-900/50 border-slate-600">
                <AlertDescription className="text-slate-300">
                  Please ensure all prior steps are complete (entity, tax ID, two IDs, tri-merge, authorization) and all attestations are checked.
                </AlertDescription>
              </Alert>
            ) : null}
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex gap-2 justify-between">
        <Button
          type="button"
          variant="outline"
          className="border-slate-600 text-slate-200 hover:bg-slate-700"
          onClick={goBack}
          disabled={step === 0 || saveMutation.isPending || signMutation.isPending || uploadMutation.isPending || pullCreditMutation.isPending || completeMutation.isPending}
          data-testid="button-compliance-back"
        >
          Back
        </Button>

        {step < 4 ? (
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={goNext}
            disabled={
              (step === 0 && !canNextEntity) ||
              (step === 1 && !canNextTax) ||
              (step === 2 && !hasIds) ||
              (step === 3 && (!hasSignature || !hasCredit)) ||
              saveMutation.isPending ||
              uploadMutation.isPending ||
              signMutation.isPending ||
              pullCreditMutation.isPending
            }
            data-testid="button-compliance-next"
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Next
          </Button>
        ) : (
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={() => completeMutation.mutate()}
            disabled={!canComplete || completeMutation.isPending}
            data-testid="button-compliance-complete"
          >
            {completeMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Complete Compliance
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
