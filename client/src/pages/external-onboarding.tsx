import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck, FileText, PenTool, Landmark, ArrowLeft, Sparkles, HelpCircle, X, FileCheck, Check } from "lucide-react";
import { LegalDocSignStep } from "@/components/onboarding/legal-doc-sign-step";
import { LEGAL_DOCUMENTS } from "@shared/legal-documents";
import { VoiceAssistantWidget } from "@/components/VoiceAssistantWidget";

type SessionResponse = {
  session: {
    id: string;
    status: string;
    expiresAt?: string | null;
    completedAt?: string | null;
    bondaiInvestorId?: string | null;
    returnUrl?: string | null;
  };
  investor: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  };
};

function getTokenFromUrl(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  } catch {
    return "";
  }
}

function getParentOrigin(): string {
  try {
    if (!document.referrer) return "*";
    return new URL(document.referrer).origin;
  } catch {
    return "*";
  }
}

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function SignaturePad(props: {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
  helper?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(140, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (props.value?.startsWith("data:image/png;base64,")) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      };
      img.src = props.value;
    } else {
      ctx.clearRect(0, 0, width, height);
    }
  };

  useEffect(() => {
    resizeCanvas();
    const onResize = () => resizeCanvas();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const getPos = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dataUrl = canvas.toDataURL("image/png");
    try {
      // Check entire canvas for any drawn strokes (check alpha channel for non-transparent pixels)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      let hasInk = false;
      // Check every 100th pixel for performance (still covers the whole canvas)
      for (let i = 3; i < pixels.length; i += 400) {
        if (pixels[i] > 0) {
          hasInk = true;
          break;
        }
      }
      if (!hasInk) return;
    } catch {
      // If getImageData fails (e.g., tainted canvas), still save the signature
      props.onChange(dataUrl);
      return;
    }
    props.onChange(dataUrl);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drawing.current = true;
    last.current = getPos(e);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    const prev = last.current;
    if (!prev) {
      last.current = pos;
      return;
    }
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
  };

  const onPointerUp = () => {
    drawing.current = false;
    last.current = null;
    commit();
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    props.onChange("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label className="text-sm font-medium text-white">{props.label}</Label>
          {props.helper ? <p className="text-xs text-white/70 mt-0.5">{props.helper}</p> : null}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={clear} data-testid="button-clear-signature">
          Clear
        </Button>
      </div>
      <div className="rounded-2xl border bg-background/40 backdrop-blur p-2 shadow-sm">
        <canvas
          ref={canvasRef}
          className="w-full h-40 rounded-xl bg-white/70 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          data-testid="canvas-signature"
        />
      </div>
    </div>
  );
}

export default function ExternalOnboardingPage() {
  const token = useMemo(() => getTokenFromUrl(), []);
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<SessionResponse>({
    queryKey: [`/api/external/onboarding/session?token=${encodeURIComponent(token)}`],
    enabled: Boolean(token),
  });

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpInput, setHelpInput] = useState("");
  const [helpLog, setHelpLog] = useState<Array<{ from: "you" | "assistant"; text: string }>>([
    { from: "assistant", text: "Hi! I'm JACE AI, your personal onboarding guide. I can answer any question about the onboarding process, documents, signatures, banking info, and more. How can I help you today?" },
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const helpLogRef = useRef<HTMLDivElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("United States");

  const [kycDocType, setKycDocType] = useState<"drivers_license" | "passport">("drivers_license");
  const [identityFront, setIdentityFront] = useState<File | null>(null);
  const [identityBack, setIdentityBack] = useState<File | null>(null);
  const [proofOfLife, setProofOfLife] = useState<File | null>(null);

  const [agreeUserAgreement, setAgreeUserAgreement] = useState(false);
  const [acknowledge, setAcknowledge] = useState(false);

  const [bankAccountType, setBankAccountType] = useState<"personal" | "trust">("personal");
  const [routingNumber, setRoutingNumber] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAddress, setBankAddress] = useState("");
  const [bankPhone, setBankPhone] = useState("");

  const [signatureKyc, setSignatureKyc] = useState("");
  const [signatureAgreement, setSignatureAgreement] = useState("");
  const [signatureDisclosure, setSignatureDisclosure] = useState("");

  const [amlSigned, setAmlSigned] = useState(false);
  const [cipKycSigned, setCipKycSigned] = useState(false);
  const [privacySigned, setPrivacySigned] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<{ at: string; submissionId: string } | null>(null);

  useEffect(() => {
    if (!data) return;
    setFirstName(data.investor.firstName || "");
    setLastName(data.investor.lastName || "");
    setEmail(data.investor.email || "");
    setPhone(data.investor.phone || "");

    setAddressLine1(data.investor.addressLine1 || "");
    setAddressLine2(data.investor.addressLine2 || "");
    setCity(data.investor.city || "");
    setState(data.investor.state || "");
    setPostalCode(data.investor.postalCode || "");
    setCountry(data.investor.country || "United States");
  }, [data]);

  const progress = useMemo(() => {
    let total = 13;
    let done = 0;
    const ok = (v: any) => Boolean(v && String(v).trim().length > 0);

    if (ok(firstName) && ok(lastName) && ok(email) && ok(phone)) done++;
    if (ok(addressLine1) && ok(city) && ok(state) && ok(postalCode) && ok(country)) done++;
    if (identityFront && (kycDocType === "passport" || identityBack)) done++;
    if (proofOfLife) done++;
    if (agreeUserAgreement && acknowledge) done++;
    if (ok(bankName) && ok(bankAddress) && ok(bankPhone) && ok(routingNumber) && ok(accountNumber)) done++;
    if (amlSigned) done++;
    if (cipKycSigned) done++;
    if (privacySigned) done++;
    if (signatureKyc) done++;
    if (signatureAgreement) done++;
    if (signatureDisclosure) done++;
    if (token) done++;

    return Math.min(100, Math.round((done / total) * 100));
  }, [
    firstName,
    lastName,
    email,
    phone,
    addressLine1,
    city,
    state,
    postalCode,
    country,
    identityFront,
    identityBack,
    proofOfLife,
    agreeUserAgreement,
    acknowledge,
    bankName,
    bankAddress,
    bankPhone,
    routingNumber,
    accountNumber,
    amlSigned,
    cipKycSigned,
    privacySigned,
    signatureKyc,
    signatureAgreement,
    signatureDisclosure,
    token,
    kycDocType,
  ]);

  // Auto-scroll chat log
  useEffect(() => {
    if (helpLogRef.current) {
      helpLogRef.current.scrollTop = helpLogRef.current.scrollHeight;
    }
  }, [helpLog]);

  // Gather current progress for AI context
  const getCurrentProgress = useCallback(() => {
    const ok = (v: any) => Boolean(v && String(v).trim().length > 0);
    return {
      personalInfo: ok(firstName) && ok(lastName) && ok(email) && ok(phone),
      address: ok(addressLine1) && ok(city) && ok(state) && ok(postalCode),
      identityDocuments: identityFront && (kycDocType === "passport" || identityBack),
      proofOfLife: !!proofOfLife,
      agreements: agreeUserAgreement && acknowledge,
      legalDocsSigned: { aml: amlSigned, cipKyc: cipKycSigned, privacy: privacySigned },
      banking: ok(bankName) && ok(routingNumber) && ok(accountNumber),
      signatures: { kyc: !!signatureKyc, agreement: !!signatureAgreement, disclosure: !!signatureDisclosure },
      overallProgress: progress,
      kycDocType,
    };
  }, [firstName, lastName, email, phone, addressLine1, city, state, postalCode, identityFront, identityBack, proofOfLife, agreeUserAgreement, acknowledge, amlSigned, cipKycSigned, privacySigned, bankName, routingNumber, accountNumber, signatureKyc, signatureAgreement, signatureDisclosure, progress, kycDocType]);

  // Voice assistant context (non-sensitive data only)
  const voiceContext = useMemo(() => ({
    firstName: firstName || undefined,
    email: email || undefined,
    progress,
    page: "external-onboarding",
  }), [firstName, email, progress]);

  const handleHelpSend = async () => {
    const q = helpInput.trim();
    if (!q || aiLoading) return;
    
    const updatedLog = [...helpLog, { from: "you" as const, text: q }];
    setHelpLog(updatedLog);
    setHelpInput("");
    setAiLoading(true);

    // Timeout controller for stalled streams
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch("/api/external/onboarding/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          conversationHistory: updatedLog.slice(-10), // Limit history to last 10 messages
          currentProgress: getCurrentProgress(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let assistantMessage = "";
      let buffer = ""; // Buffer for partial SSE chunks

      // Add placeholder for streaming response
      setHelpLog(prev => [...prev, { from: "assistant", text: "..." }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          
          try {
            const data = JSON.parse(line.slice(6));
            if (data.content) {
              assistantMessage += data.content;
              // Update the last message (streaming)
              setHelpLog(prev => {
                const newLog = [...prev];
                newLog[newLog.length - 1] = { from: "assistant", text: assistantMessage };
                return newLog;
              });
            }
            if (data.error) {
              setHelpLog(prev => {
                const newLog = [...prev];
                newLog[newLog.length - 1] = { from: "assistant", text: data.error };
                return newLog;
              });
            }
          } catch {
            // Ignore parse errors for incomplete JSON
          }
        }
      }

      // If no content received, show fallback message
      if (!assistantMessage) {
        setHelpLog(prev => {
          const newLog = [...prev];
          newLog[newLog.length - 1] = { from: "assistant", text: "I couldn't generate a response. Please try again or contact support." };
          return newLog;
        });
      }
    } catch (error: any) {
      console.error("AI assistant error:", error);
      const errorMessage = error?.name === "AbortError" 
        ? "The response took too long. Please try again with a shorter question."
        : "I'm having trouble connecting right now. For help, contact jacemgmt@gmail.com or call 970-710-9193.";
      
      setHelpLog(prev => {
        // Check if we already added a placeholder
        if (prev[prev.length - 1]?.text === "...") {
          const newLog = [...prev];
          newLog[newLog.length - 1] = { from: "assistant", text: errorMessage };
          return newLog;
        }
        return [...prev, { from: "assistant", text: errorMessage }];
      });
    } finally {
      clearTimeout(timeoutId);
      setAiLoading(false);
    }
  };

  const submit = async () => {
    if (!token) {
      toast({ title: "Missing session token", description: "Please reopen the onboarding link from BondAI.", variant: "destructive" });
      return;
    }
    if (!firstName || !lastName || !email || !phone) {
      toast({ title: "Missing personal info", description: "Please complete your name, email, and phone.", variant: "destructive" });
      return;
    }
    if (!addressLine1 || !city || !state || !postalCode || !country) {
      toast({ title: "Missing address", description: "Please complete your home address.", variant: "destructive" });
      return;
    }
    if (!identityFront || (kycDocType === "drivers_license" && !identityBack)) {
      toast({ title: "Missing identity documents", description: "Upload required identity documents.", variant: "destructive" });
      return;
    }
    if (!proofOfLife) {
      toast({ title: "Missing proof-of-life", description: "Upload your proof-of-life document.", variant: "destructive" });
      return;
    }
    if (!agreeUserAgreement || !acknowledge) {
      toast({ title: "Agreements required", description: "Please check the agreement and acknowledgement boxes.", variant: "destructive" });
      return;
    }
    if (!amlSigned || !cipKycSigned || !privacySigned) {
      toast({ title: "Legal documents required", description: "Please read and sign all three legal compliance documents.", variant: "destructive" });
      return;
    }
    if (!bankName || !bankAddress || !bankPhone || !routingNumber || !accountNumber) {
      toast({ title: "Missing banking info", description: "Please complete all banking fields.", variant: "destructive" });
      return;
    }
    if (!signatureKyc || !signatureAgreement || !signatureDisclosure) {
      toast({ title: "Signatures required", description: "Please sign all required sections.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("token", token);

      fd.append("firstName", firstName);
      fd.append("lastName", lastName);
      fd.append("email", email);
      fd.append("phone", phone);

      fd.append("addressLine1", addressLine1);
      fd.append("addressLine2", addressLine2);
      fd.append("city", city);
      fd.append("state", state);
      fd.append("postalCode", postalCode);
      fd.append("country", country);

      fd.append("kycDocType", kycDocType);

      fd.append("agreeUserAgreement", String(agreeUserAgreement));
      fd.append("acknowledge", String(acknowledge));

      fd.append("bankAccountType", bankAccountType);
      fd.append("routingNumber", routingNumber);
      fd.append("accountNumber", accountNumber);
      fd.append("bankName", bankName);
      fd.append("bankAddress", bankAddress);
      fd.append("bankPhone", bankPhone);

      fd.append("signatureKyc", signatureKyc);
      fd.append("signatureAgreement", signatureAgreement);
      fd.append("signatureDisclosure", signatureDisclosure);

      fd.append("identityFront", identityFront);
      if (identityBack) fd.append("identityBack", identityBack);
      fd.append("proofOfLife", proofOfLife);

      const res = await fetch("/api/external/onboarding/submit", {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.message || "Submission failed");

      setCompleted({ at: json.completedAt, submissionId: json.submissionId });
      toast({ title: "Onboarding submitted", description: "JACE received your onboarding. Returning you to BondAI..." });

      const parentOrigin = getParentOrigin();
      const returnUrl = data?.session?.returnUrl || null;
      const bondaiInvestorId = data?.session?.bondaiInvestorId || null;

      const onboardingCompletionData = {
        completedAt: json.completedAt,
        submissionId: json.submissionId,
        bondaiInvestorId,
        investorEmail: email,
        investorName: `${firstName} ${lastName}`.trim(),
        investorPhone: phone,
        status: "LIVE",
        returnUrl,
        bondaiNotified: json.bondaiNotified || false,
        bondaiWebhookSent: json.bondaiWebhookSent || false,
        bondaiKycApiSuccess: json.bondaiKycApiSuccess || false,
        kyc: {
          kycVerified: true,
          kycVerifiedAt: json.completedAt,
          kycStatus: "submitted",
          identityDocumentType: kycDocType,
          identityDocumentSubmitted: true,
          proofOfLifeSubmitted: true,
          documentsSubmittedCount: identityBack ? 3 : 2,
        },
        signatures: {
          kycAttestationSigned: true,
          kycAttestationSignedAt: json.completedAt,
          investorAgreementSigned: true,
          investorAgreementSignedAt: json.completedAt,
          disclosureDisclaimerSigned: true,
          disclosureDisclaimerSignedAt: json.completedAt,
          totalSignatures: 3,
        },
        agreements: {
          termsAccepted: true,
          termsAcceptedAt: json.completedAt,
          termsOfUseVersion: "1.0",
          privacyPolicyAccepted: true,
          privacyPolicyVersion: "1.0",
          electronicSignatureConsent: true,
          disclosuresAcknowledged: true,
          disclosuresVersion: "1.0",
        },
        jaceOnboarding: {
          isJaceLive: true,
          jaceOnboardedAt: json.completedAt,
          onboardingCompleted: true,
        },
        banking: {
          bankingInfoSubmitted: true,
          accountType: bankAccountType,
          bankName: bankName || null,
        },
      };

      // Send comprehensive message to BondAI parent window
      window.parent?.postMessage(
        {
          type: "ONBOARDING_COMPLETED",
          ...onboardingCompletionData,
        },
        parentOrigin,
      );
      // Also send legacy message type for backward compatibility
      window.parent?.postMessage(
        {
          type: "JACE_ONBOARDING_COMPLETE",
          ...onboardingCompletionData,
        },
        parentOrigin,
      );

      // Auto-redirect back to BondAI after a short delay
      setTimeout(() => {
        if (returnUrl) {
          window.top ? window.top.location.href = returnUrl : window.location.href = returnUrl;
        } else {
          const bondaiOrigin = getParentOrigin();
          if (bondaiOrigin && bondaiOrigin !== "*") {
            window.top ? window.top.location.href = bondaiOrigin : window.location.href = bondaiOrigin;
          }
        }
      }, 2500);
    } catch (e: any) {
      toast({ title: "Submission failed", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6" data-testid="external-onboarding-no-token">
        <Card className="max-w-lg w-full rounded-3xl border-white/10 bg-white/5 backdrop-blur shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Onboarding Link Missing</CardTitle>
            <CardDescription className="text-white/70">
              This page must be opened from BondAI. Please return to BondAI and click "Start Onboarding" again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white" data-testid="external-onboarding-page">
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <div className="absolute -top-20 -left-20 h-96 w-96 rounded-full bg-indigo-500 blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-24 h-[28rem] w-[28rem] rounded-full bg-fuchsia-500 blur-3xl animate-pulse" />
        <div className="absolute bottom-[-6rem] left-1/4 h-[30rem] w-[30rem] rounded-full bg-cyan-500 blur-3xl animate-pulse" />
      </div>

      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        className="fixed right-2 top-1/2 -translate-y-1/2 z-50 rounded-full bg-indigo-600/80 border border-indigo-400/30 backdrop-blur px-3 py-2 shadow-lg hover:bg-indigo-500/80 transition"
        aria-label="Open AI onboarding guide"
        data-testid="button-toggle-ai-guide"
      >
        <div className="flex items-center gap-2 text-xs text-white">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">{sidebarOpen ? "Close" : "AI Guide"}</span>
        </div>
      </button>

      <div
        className={cx(
          "fixed top-0 right-0 h-full w-[360px] max-w-[92vw] z-40 transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="h-full bg-slate-950/70 backdrop-blur border-l border-white/10 shadow-2xl flex flex-col">
          {/* Fixed Header */}
          <div className="flex-shrink-0 p-4 pb-0">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                Onboarding Context
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label="Close" data-testid="button-close-context">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Separator className="my-3 bg-white/10" />
          </div>
          
          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto px-4 space-y-3 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/70">What's happening</div>
              <div className="mt-1">
                You have left <span className="font-semibold">BondAI</span> and are now on{" "}
                <span className="font-semibold">JACE CRM</span> for Investor Onboarding.
              </div>
              <div className="text-xs text-white/60 mt-2">
                All investing features on BondAI are locked until you complete this onboarding.
                Your submission is timestamped with your IP address for compliance records.
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/70">Progress</div>
              <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-white/70 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="text-xs text-white/60 mt-2" data-testid="text-progress">{progress}% complete</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs text-white/70">Quick FAQ</div>
              <ul className="mt-2 text-xs text-white/70 space-y-1 list-disc pl-4">
                <li>Driver's license requires front + back.</li>
                <li>Passport requires only the main page upload.</li>
                <li>All 3 signatures are required to submit.</li>
                <li>After completion, BondAI receives a confirmation webhook.</li>
              </ul>
            </div>

            <Separator className="bg-white/10" />

            {/* AI Chat Section */}
            <div className="flex flex-col gap-3 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3 w-3 text-indigo-400" />
                <div className="text-xs text-white/70">JACE AI - Your Onboarding Guide</div>
              </div>
              <div 
                ref={helpLogRef}
                className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-2 min-h-[120px] max-h-[250px] overflow-y-auto"
              >
                {helpLog.map((m, idx) => (
                  <div
                    key={idx}
                    className={cx(
                      "text-xs leading-relaxed rounded-xl px-3 py-2 border",
                      m.from === "assistant"
                        ? "bg-indigo-500/10 border-indigo-500/20 text-white/90"
                        : "bg-white/5 border-white/10 text-white/80 ml-6",
                    )}
                    data-testid={`chat-message-${idx}`}
                  >
                    {m.text}
                  </div>
                ))}
                {aiLoading && helpLog[helpLog.length - 1]?.text === "..." && (
                  <div className="flex items-center gap-2 text-xs text-white/60 pl-3">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Thinking...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Fixed Input Area at Bottom */}
          <div className="flex-shrink-0 p-4 pt-2 border-t border-white/10">
            <div className="flex gap-2">
              <Input
                value={helpInput}
                onChange={(e) => setHelpInput(e.target.value)}
                placeholder="Ask me anything about onboarding..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !aiLoading) handleHelpSend();
                }}
                disabled={aiLoading}
                data-testid="input-help"
              />
              <Button 
                onClick={handleHelpSend} 
                className="rounded-xl" 
                disabled={aiLoading}
                data-testid="button-help-send"
              >
                {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shadow-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-white/70">BondAI to JACE Secure Redirect</div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight" data-testid="text-page-title">Investor Onboarding</h1>
            </div>
          </div>
          <Button
            variant="secondary"
            className="rounded-xl bg-white/10 border border-white/10 text-white hover:bg-white/15"
            onClick={() => {
              // Send cancel message to parent iframe
              window.parent?.postMessage({ type: "JACE_ONBOARDING_CANCEL" }, getParentOrigin());
              
              // Navigate back to BondAI using returnUrl or parent origin
              const returnUrl = data?.session?.returnUrl;
              if (returnUrl) {
                window.top ? window.top.location.href = returnUrl : window.location.href = returnUrl;
              } else {
                // Fallback: try to go to BondAI origin
                const bondaiOrigin = getParentOrigin();
                if (bondaiOrigin && bondaiOrigin !== "*") {
                  window.top ? window.top.location.href = bondaiOrigin : window.location.href = bondaiOrigin;
                }
              }
            }}
            data-testid="button-back-to-bondai"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to BondAI
          </Button>
        </div>

        <div className="mb-5 rounded-2xl border border-amber-400/30 bg-amber-500/10 backdrop-blur p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="font-semibold text-amber-200 text-sm">You have left BondAI</div>
              <div className="text-amber-100/80 text-sm mt-1">
                You are now on <span className="font-semibold">JACE CRM</span> to complete Investor Onboarding. 
                All investing features on BondAI are locked until you complete this onboarding. 
                Your information is processed securely by JACE Management, LLC.
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2 rounded-3xl border-white/10 bg-white/5 backdrop-blur shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white">Complete JACE Onboarding to Go LIVE</CardTitle>
              <CardDescription className="text-white/70">
                All investing features are locked until you complete JACE onboarding. Once submitted, BondAI is notified and live bidding is unlocked.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {isLoading ? (
                <div className="flex items-center gap-2 text-white/80">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading your onboarding session...
                </div>
              ) : error ? (
                <div className="text-sm text-red-200" data-testid="text-error">Unable to load session. Please reopen onboarding from BondAI.</div>
              ) : completed ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-2" data-testid="card-completed">
                  <div className="text-lg font-semibold">Submitted</div>
                  <div className="text-sm text-white/70">
                    Submission ID: <span className="font-mono text-xs">{completed.submissionId}</span>
                  </div>
                  <div className="text-xs text-white/60">Completed at {completed.at}</div>
                  <div className="text-sm mt-3">BondAI has been notified. Redirecting you back to BondAI...</div>
                  <Button
                    variant="secondary"
                    className="mt-4 rounded-xl bg-white/10 border border-white/10 text-white"
                    onClick={() => {
                      const returnUrl = data?.session?.returnUrl;
                      if (returnUrl) {
                        window.top ? window.top.location.href = returnUrl : window.location.href = returnUrl;
                      } else {
                        const bondaiOrigin = getParentOrigin();
                        if (bondaiOrigin && bondaiOrigin !== "*") {
                          window.top ? window.top.location.href = bondaiOrigin : window.location.href = bondaiOrigin;
                        }
                      }
                    }}
                    data-testid="button-return-to-bondai"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Return to BondAI Now
                  </Button>
                </div>
              ) : (
                <>
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-medium text-white">
                      <FileText className="h-5 w-5" />
                      Personal Information
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="firstName" className="text-white/80">First Name</Label>
                        <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-first-name" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="lastName" className="text-white/80">Last Name</Label>
                        <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-last-name" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="email" className="text-white/80">Email</Label>
                        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-email" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="phone" className="text-white/80">Phone</Label>
                        <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-phone" />
                      </div>
                    </div>
                  </section>

                  <Separator className="bg-white/10" />

                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-medium text-white">
                      <Landmark className="h-5 w-5" />
                      Address
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="space-y-1">
                        <Label htmlFor="addressLine1" className="text-white/80">Address Line 1</Label>
                        <Input id="addressLine1" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-address-line1" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="addressLine2" className="text-white/80">Address Line 2 (optional)</Label>
                        <Input id="addressLine2" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-address-line2" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="space-y-1">
                          <Label htmlFor="city" className="text-white/80">City</Label>
                          <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-city" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="state" className="text-white/80">State</Label>
                          <Input id="state" value={state} onChange={(e) => setState(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-state" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="postalCode" className="text-white/80">ZIP</Label>
                          <Input id="postalCode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-postal-code" />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="country" className="text-white/80">Country</Label>
                          <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-country" />
                        </div>
                      </div>
                    </div>
                  </section>

                  <Separator className="bg-white/10" />

                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-medium text-white">
                      <FileText className="h-5 w-5" />
                      KYC Documents
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-white/80">Document Type</Label>
                        <Select value={kycDocType} onValueChange={(v) => setKycDocType(v as "drivers_license" | "passport")}>
                          <SelectTrigger className="bg-white/10 border-white/10 text-white" data-testid="select-doc-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="drivers_license">Driver's License</SelectItem>
                            <SelectItem value="passport">Passport</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-white/80">{kycDocType === "passport" ? "Passport Image" : "ID Front"}</Label>
                          <Input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => setIdentityFront(e.target.files?.[0] || null)}
                            className="bg-white/10 border-white/10 text-white file:text-white/70"
                            data-testid="input-identity-front"
                          />
                        </div>
                        {kycDocType === "drivers_license" && (
                          <div className="space-y-1">
                            <Label className="text-white/80">ID Back</Label>
                            <Input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => setIdentityBack(e.target.files?.[0] || null)}
                              className="bg-white/10 border-white/10 text-white file:text-white/70"
                              data-testid="input-identity-back"
                            />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-white/80">Proof of Life (selfie holding ID or video)</Label>
                        <Input
                          type="file"
                          accept="image/*,video/*"
                          onChange={(e) => setProofOfLife(e.target.files?.[0] || null)}
                          className="bg-white/10 border-white/10 text-white file:text-white/70"
                          data-testid="input-proof-of-life"
                        />
                      </div>
                    </div>
                  </section>

                  <Separator className="bg-white/10" />

                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-medium text-white">
                      <Landmark className="h-5 w-5" />
                      Banking Information
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-white/80">Account Type</Label>
                        <Select value={bankAccountType} onValueChange={(v) => setBankAccountType(v as "personal" | "trust")}>
                          <SelectTrigger className="bg-white/10 border-white/10 text-white" data-testid="select-bank-account-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="personal">Personal</SelectItem>
                            <SelectItem value="trust">Trust</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="routingNumber" className="text-white/80">Routing Number</Label>
                        <Input id="routingNumber" value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-routing-number" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="accountNumber" className="text-white/80">Account Number</Label>
                        <Input id="accountNumber" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-account-number" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="bankName" className="text-white/80">Bank Name</Label>
                        <Input id="bankName" value={bankName} onChange={(e) => setBankName(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-bank-name" />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label htmlFor="bankAddress" className="text-white/80">Bank Address</Label>
                        <Textarea id="bankAddress" value={bankAddress} onChange={(e) => setBankAddress(e.target.value)} className="bg-white/10 border-white/10 text-white" rows={2} data-testid="input-bank-address" />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="bankPhone" className="text-white/80">Bank Phone</Label>
                        <Input id="bankPhone" value={bankPhone} onChange={(e) => setBankPhone(e.target.value)} className="bg-white/10 border-white/10 text-white" data-testid="input-bank-phone" />
                      </div>
                    </div>
                  </section>

                  <Separator className="bg-white/10" />

                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-lg font-medium text-white">
                      <FileText className="h-5 w-5" />
                      Agreements, Terms & Conditions
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2 text-sm text-white/70">
                      <p>Before proceeding, please review the following legal documents:</p>
                      <div className="flex flex-wrap gap-3">
                        <a href="/terms-of-use" target="_blank" rel="noopener noreferrer" className="underline hover:text-white" data-testid="link-terms">Terms of Use</a>
                        <span className="text-white/30">|</span>
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white" data-testid="link-privacy">Privacy Policy</a>
                        <span className="text-white/30">|</span>
                        <a href="/disclosures" target="_blank" rel="noopener noreferrer" className="underline hover:text-white" data-testid="link-disclosures">Disclosures & Disclaimers</a>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="agree"
                          checked={agreeUserAgreement}
                          onCheckedChange={(v) => setAgreeUserAgreement(Boolean(v))}
                          className="mt-1"
                          data-testid="checkbox-agree"
                        />
                        <Label htmlFor="agree" className="text-sm text-white/80">
                          I have read and agree to the <span className="font-medium text-white">Terms of Use</span>, <span className="font-medium text-white">Privacy Policy</span>, and <span className="font-medium text-white">Investor User Agreement</span>. I authorize JACE Management, LLC and BondAI to process my onboarding data for investor verification and bond settlement purposes.
                        </Label>
                      </div>
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="acknowledge"
                          checked={acknowledge}
                          onCheckedChange={(v) => setAcknowledge(Boolean(v))}
                          className="mt-1"
                          data-testid="checkbox-acknowledge"
                        />
                        <Label htmlFor="acknowledge" className="text-sm text-white/80">
                          I acknowledge and consent that: (1) my submission is timestamped with my IP address, (2) my electronic signatures are legally binding, (3) my data may be shared between JACE and BondAI for compliance and auditing purposes, and (4) I have reviewed the <span className="font-medium text-white">Disclosures & Disclaimers</span> regarding investment risks.
                        </Label>
                      </div>
                    </div>
                  </section>

                  <Separator className="bg-white/10" />

                  <section className="space-y-4" data-testid="section-legal-compliance">
                    <div className="flex items-center gap-2 text-lg font-medium text-white">
                      <FileCheck className="h-5 w-5" />
                      Legal Compliance Documents
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                      <p>All three legal documents below must be read and signed before you can complete your onboarding. Please expand each document, read it carefully, and sign electronically.</p>
                    </div>
                    
                    <Accordion type="single" collapsible className="space-y-3">
                      <AccordionItem value="aml" className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden" data-testid="accordion-aml">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5">
                          <div className="flex items-center gap-3">
                            {amlSigned ? (
                              <div className="h-6 w-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                                <Check className="h-4 w-4 text-green-400" />
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                                <FileText className="h-3 w-3 text-white/50" />
                              </div>
                            )}
                            <span className="text-left text-white">
                              {LEGAL_DOCUMENTS.AML_CERTIFICATION.shortTitle}
                              {amlSigned && <span className="ml-2 text-xs text-green-400">Signed</span>}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          {data?.investor?.id && (
                            <LegalDocSignStep
                              investorId={data.investor.id}
                              documentType="AML_CERTIFICATION"
                              documentTitle={LEGAL_DOCUMENTS.AML_CERTIFICATION.title}
                              documentBody={LEGAL_DOCUMENTS.AML_CERTIFICATION.body}
                              signerEmail={email}
                              onComplete={() => setAmlSigned(true)}
                              token={token}
                            />
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="cipkyc" className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden" data-testid="accordion-cipkyc">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5">
                          <div className="flex items-center gap-3">
                            {cipKycSigned ? (
                              <div className="h-6 w-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                                <Check className="h-4 w-4 text-green-400" />
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                                <FileText className="h-3 w-3 text-white/50" />
                              </div>
                            )}
                            <span className="text-left text-white">
                              {LEGAL_DOCUMENTS.CIP_KYC_PRIVACY_CONSENT.shortTitle}
                              {cipKycSigned && <span className="ml-2 text-xs text-green-400">Signed</span>}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          {data?.investor?.id && (
                            <LegalDocSignStep
                              investorId={data.investor.id}
                              documentType="CIP_KYC_PRIVACY_CONSENT"
                              documentTitle={LEGAL_DOCUMENTS.CIP_KYC_PRIVACY_CONSENT.title}
                              documentBody={LEGAL_DOCUMENTS.CIP_KYC_PRIVACY_CONSENT.body}
                              signerEmail={email}
                              onComplete={() => setCipKycSigned(true)}
                              token={token}
                            />
                          )}
                        </AccordionContent>
                      </AccordionItem>

                      <AccordionItem value="privacy" className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden" data-testid="accordion-privacy">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/5">
                          <div className="flex items-center gap-3">
                            {privacySigned ? (
                              <div className="h-6 w-6 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                                <Check className="h-4 w-4 text-green-400" />
                              </div>
                            ) : (
                              <div className="h-6 w-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center">
                                <FileText className="h-3 w-3 text-white/50" />
                              </div>
                            )}
                            <span className="text-left text-white">
                              {LEGAL_DOCUMENTS.PRIVACY_SHORTFORM.shortTitle}
                              {privacySigned && <span className="ml-2 text-xs text-green-400">Signed</span>}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4">
                          {data?.investor?.id && (
                            <LegalDocSignStep
                              investorId={data.investor.id}
                              documentType="PRIVACY_SHORTFORM"
                              documentTitle={LEGAL_DOCUMENTS.PRIVACY_SHORTFORM.title}
                              documentBody={LEGAL_DOCUMENTS.PRIVACY_SHORTFORM.body}
                              signerEmail={email}
                              onComplete={() => setPrivacySigned(true)}
                              token={token}
                            />
                          )}
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </section>

                  <Separator className="bg-white/10" />

                  <section className="space-y-6">
                    <div className="flex items-center gap-2 text-lg font-medium text-white">
                      <PenTool className="h-5 w-5" />
                      Electronic Signatures (Legally Binding)
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                      <p>By signing below, you acknowledge that your electronic signatures are legally binding and have the same legal effect as a handwritten signature. Each signature will be timestamped and stored for compliance records.</p>
                    </div>
                    <SignaturePad
                      label="1. KYC Attestation Signature"
                      helper="I attest that I am the person named in this application, all information provided is true and accurate, and all documents submitted are authentic."
                      value={signatureKyc}
                      onChange={setSignatureKyc}
                    />
                    <SignaturePad
                      label="2. Investor User Agreement & Terms Signature"
                      helper="I have read, understand, and agree to the Terms of Use, Privacy Policy, and Investor User Agreement between myself, JACE Management, LLC, and BondAI."
                      value={signatureAgreement}
                      onChange={setSignatureAgreement}
                    />
                    <SignaturePad
                      label="3. Disclosures & Disclaimers Acknowledgement Signature"
                      helper="I acknowledge that I have reviewed and understand the Disclosures & Disclaimers regarding investment risks, regulatory requirements, and my obligations as an investor."
                      value={signatureDisclosure}
                      onChange={setSignatureDisclosure}
                    />
                  </section>

                  <div className="pt-4">
                    <Button
                      className="w-full rounded-xl py-6 text-lg font-medium"
                      onClick={submit}
                      disabled={submitting}
                      data-testid="button-submit"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        "Submit Onboarding"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-3xl border-white/10 bg-white/5 backdrop-blur shadow-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg">Required Documents</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-white/70 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cx("h-2 w-2 rounded-full", identityFront ? "bg-green-400" : "bg-white/30")} />
                  Identity Front
                </div>
                {kycDocType === "drivers_license" && (
                  <div className="flex items-center gap-2">
                    <div className={cx("h-2 w-2 rounded-full", identityBack ? "bg-green-400" : "bg-white/30")} />
                    Identity Back
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <div className={cx("h-2 w-2 rounded-full", proofOfLife ? "bg-green-400" : "bg-white/30")} />
                  Proof of Life
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/10 bg-white/5 backdrop-blur shadow-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg">Signatures</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-white/70 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={cx("h-2 w-2 rounded-full", signatureKyc ? "bg-green-400" : "bg-white/30")} />
                  KYC Attestation
                </div>
                <div className="flex items-center gap-2">
                  <div className={cx("h-2 w-2 rounded-full", signatureAgreement ? "bg-green-400" : "bg-white/30")} />
                  Investor Agreement
                </div>
                <div className="flex items-center gap-2">
                  <div className={cx("h-2 w-2 rounded-full", signatureDisclosure ? "bg-green-400" : "bg-white/30")} />
                  Disclosure Signature
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-white/10 bg-white/5 backdrop-blur shadow-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-lg">Security</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-white/70">
                <ul className="space-y-1">
                  <li>256-bit AES encryption for sensitive data</li>
                  <li>IP and timestamp captured for audit</li>
                  <li>BondAI notified via signed webhook</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Voice Assistant Widget */}
      <VoiceAssistantWidget
        context={voiceContext}
        label="Voice Help"
        offset={24}
        apiEndpoint="/api/external/onboarding/voice-assistant"
      />
    </div>
  );
}
