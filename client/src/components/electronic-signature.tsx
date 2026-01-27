import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, FileSignature } from "lucide-react";

export interface SignatureData {
  name: string;
  title?: string;
  value: string;
  timezone: string;
  timestamp: string;
  userAgent: string;
}

interface ElectronicSignatureProps {
  showTitle?: boolean;
  value: SignatureData | null;
  onChange: (data: SignatureData | null) => void;
}

export function ElectronicSignature({ showTitle = false, value, onChange }: ElectronicSignatureProps) {
  const [name, setName] = useState(value?.name || "");
  const [title, setTitle] = useState(value?.title || "");
  const [currentDateTime, setCurrentDateTime] = useState(new Date());

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "";

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (name.trim()) {
      onChange({
        name: name.trim(),
        title: showTitle ? title.trim() : undefined,
        value: name.trim(),
        timezone,
        timestamp: new Date().toISOString(),
        userAgent,
      });
    } else {
      onChange(null);
    }
  }, [name, title, showTitle, timezone, userAgent, onChange]);

  const formattedDateTime = currentDateTime.toLocaleString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  });

  return (
    <Card className="border-2 border-dashed" data-testid="electronic-signature">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <FileSignature className="h-5 w-5" />
          <span className="font-medium text-foreground">Electronic Signature</span>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signature-name">Full Legal Name</Label>
            <Input
              id="signature-name"
              placeholder="Type your full legal name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-signature-name"
            />
          </div>

          {showTitle && (
            <div className="space-y-2">
              <Label htmlFor="signature-title">Title / Position</Label>
              <Input
                id="signature-title"
                placeholder="e.g., Managing Partner, Authorized Signatory"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-signature-title"
              />
            </div>
          )}
        </div>

        {name.trim() && (
          <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-3">
            <div className="text-sm text-muted-foreground">Signature Preview:</div>
            <div 
              className="text-2xl text-foreground py-2 border-b border-foreground/30"
              style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}
              data-testid="text-signature-preview"
            >
              {name}
            </div>
            {showTitle && title.trim() && (
              <div className="text-sm text-muted-foreground" data-testid="text-signature-title-preview">
                {title}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Clock className="h-3 w-3" />
              <span data-testid="text-signature-datetime">{formattedDateTime}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Timezone: {timezone}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          By typing your name above, you are signing this document electronically. 
          This electronic signature has the same legal effect as a handwritten signature.
        </p>
      </CardContent>
    </Card>
  );
}
