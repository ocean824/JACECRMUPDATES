import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";

type Props = {
  /** Public URL of the voice-agent app, e.g. https://your-voice-agent.replit.app */
  agentBaseUrl: string;
  /** Show on these path prefixes only. If omitted, shows everywhere. */
  onlyOnPaths?: string[];
  /** Bottom/right spacing in px */
  offset?: number;
  /** Button label */
  label?: string;

  /** Optional non-sensitive context to pass into the voice agent (via postMessage). */
  context?: {
    firstName?: string;
    email?: string;
    progress?: number;
    page?: string;
    [key: string]: unknown;
  };
};

function normalizeBase(url: string): string {
  return (url || "").trim().replace(/\/$/, "");
}

export default function VoiceAssistantWidget({
  agentBaseUrl,
  onlyOnPaths,
  offset = 18,
  label = "Voice Assistant",
  context,
}: Props) {
  const [location] = useLocation();
  const base = useMemo(() => normalizeBase(agentBaseUrl), [agentBaseUrl]);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const agentOrigin = useMemo(() => {
    try {
      return new URL(base).origin;
    } catch {
      return "";
    }
  }, [base]);

  // If the voice agent URL isn't set, do nothing (avoids broken iframes in prod).
  if (!base) return null;

  if (onlyOnPaths && onlyOnPaths.length > 0) {
    const ok = onlyOnPaths.some((p) => location.startsWith(p));
    if (!ok) return null;
  }

  const src = `${base}/agent?embed=1&parentOrigin=${encodeURIComponent(window.location.origin)}`;

  // Handshake: wait for the iframe to announce readiness, then send context.
  useEffect(() => {
    if (!open) return;
    if (!agentOrigin) return;

    const onMessage = (evt: MessageEvent) => {
      if (evt.origin !== agentOrigin) return;
      const data: any = evt.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "VOICE_AGENT_READY") {
        setReady(true);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, agentOrigin]);

  // Push context once ready (and whenever it changes while open).
  useEffect(() => {
    if (!open || !ready) return;
    if (!agentOrigin) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    if (!context || typeof context !== "object") return;

    iframe.contentWindow.postMessage(
      { type: "VOICE_AGENT_CONTEXT", payload: context },
      agentOrigin
    );
  }, [open, ready, agentOrigin, context]);

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => {
          setReady(false);
          setOpen(true);
        }}
        style={{
          position: "fixed",
          right: offset,
          bottom: offset,
          zIndex: 9999,
          borderRadius: 999,
          padding: "12px 18px",
          border: "1px solid rgba(99, 102, 241, 0.4)",
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.9) 0%, rgba(139, 92, 246, 0.9) 100%)",
          color: "white",
          boxShadow: "0 10px 30px rgba(99, 102, 241, 0.35)",
          cursor: "pointer",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: 600,
          fontSize: "14px",
        }}
        aria-label="Open voice assistant"
        title="Voice assistant"
        data-testid="button-voice-assistant"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" x2="12" y1="19" y2="22"/>
        </svg>
        {label}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setOpen(false);
            setReady(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 10000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(980px, 96vw)",
              height: "min(680px, 86vh)",
              background: "rgba(2, 6, 23, 0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 18,
              overflow: "hidden",
              boxShadow: "0 18px 60px rgba(0,0,0,0.45)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 16px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                color: "white",
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)",
              }}
            >
              <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
                JACE Voice Assistant
              </div>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setReady(false);
                }}
                style={{
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  borderRadius: 10,
                  padding: "6px 14px",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
                data-testid="button-close-voice-assistant"
              >
                Close
              </button>
            </div>

            <iframe
              title="Voice Assistant"
              src={src}
              ref={iframeRef}
              style={{ width: "100%", height: "100%", border: 0, background: "transparent" }}
              // Critical for mic + autoplay in an iframe.
              allow="microphone; autoplay"
            />
          </div>
        </div>
      )}
    </>
  );
}
