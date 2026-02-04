import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, X, Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoiceRecorder } from "../../replit_integrations/audio/useVoiceRecorder";
import { useAudioPlayback } from "../../replit_integrations/audio/useAudioPlayback";

interface VoiceMessage {
  from: "you" | "assistant";
  text: string;
}

interface VoiceAssistantWidgetProps {
  context?: Record<string, any>;
  label?: string;
  offset?: number;
}

export function VoiceAssistantWidget({
  context = {},
  label = "Voice Help",
  offset = 24,
}: VoiceAssistantWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState<string>("");

  const recorder = useVoiceRecorder();
  const playback = useAudioPlayback();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentTranscript]);

  const handleMicClick = useCallback(async () => {
    setError(null);

    if (recorder.state === "recording") {
      setIsProcessing(true);
      const blob = await recorder.stopRecording();

      try {
        await playback.init();
        playback.clear();

        const base64Audio = await new Promise<string>((resolve) => {
          const fileReader = new FileReader();
          fileReader.onload = () => {
            const result = fileReader.result as string;
            resolve(result.split(",")[1]);
          };
          fileReader.readAsDataURL(blob);
        });

        const response = await fetch("/api/external/onboarding/voice-assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio: base64Audio,
            conversationHistory: messages,
            currentProgress: context,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Voice request failed");
        }

        const streamReader = response.body?.getReader();
        if (!streamReader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";
        let userText = "";
        let assistantText = "";

        while (true) {
          const { done, value } = await streamReader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;

            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case "user_transcript":
                  userText = event.data;
                  setMessages((prev) => [...prev, { from: "you", text: userText }]);
                  break;
                case "transcript":
                  assistantText = event.data;
                  setCurrentTranscript(assistantText);
                  break;
                case "audio":
                  playback.pushAudio(event.data);
                  break;
                case "done":
                  playback.signalComplete();
                  if (assistantText) {
                    setMessages((prev) => [...prev, { from: "assistant", text: assistantText }]);
                    setCurrentTranscript("");
                  }
                  break;
                case "error":
                  throw new Error(event.error);
              }
            } catch (e) {
              if (!(e instanceof SyntaxError)) {
                setError((e as Error).message);
                // Ensure playback is terminated on event errors
                playback.signalComplete();
              }
            }
          }
        }
      } catch (e) {
        console.error("Voice assistant error:", e);
        setError((e as Error).message || "Failed to process voice");
        // Ensure playback is properly terminated on error
        playback.signalComplete();
      } finally {
        setIsProcessing(false);
      }
    } else {
      try {
        await recorder.startRecording();
      } catch (e) {
        setError("Microphone access denied. Please allow microphone access.");
      }
    }
  }, [recorder, playback, messages, context]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    playback.clear();
    if (recorder.state === "recording") {
      recorder.stopRecording();
    }
  }, [playback, recorder]);

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed z-50 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
        style={{ bottom: offset, right: offset }}
        size="lg"
        data-testid="button-voice-assistant-open"
      >
        <Mic className="w-5 h-5 mr-2" />
        {label}
      </Button>
    );
  }

  return (
    <div
      className="fixed z-50 bg-background border border-border rounded-xl shadow-2xl flex flex-col"
      style={{
        bottom: offset,
        right: offset,
        width: 360,
        height: 480,
      }}
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-primary" />
          <span className="font-semibold">Voice Assistant</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          data-testid="button-voice-assistant-close"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !currentTranscript && (
          <div className="text-center text-muted-foreground py-8">
            <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm">Tap the microphone and ask a question about the onboarding process.</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg text-sm ${
              msg.from === "you"
                ? "bg-primary/10 text-foreground ml-8"
                : "bg-muted text-foreground mr-8"
            }`}
          >
            <span className="text-xs font-medium text-muted-foreground block mb-1">
              {msg.from === "you" ? "You" : "JACE AI"}
            </span>
            {msg.text}
          </div>
        ))}

        {currentTranscript && (
          <div className="p-3 rounded-lg text-sm bg-muted text-foreground mr-8">
            <span className="text-xs font-medium text-muted-foreground block mb-1">
              JACE AI
            </span>
            {currentTranscript}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="p-4 border-t border-border">
        <Button
          onClick={handleMicClick}
          disabled={isProcessing}
          className={`w-full h-14 rounded-full text-lg font-medium ${
            recorder.state === "recording"
              ? "bg-destructive hover:bg-destructive/90 animate-pulse"
              : ""
          }`}
          variant={recorder.state === "recording" ? "destructive" : "default"}
          data-testid="button-voice-assistant-record"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-6 h-6 mr-2 animate-spin" />
              Processing...
            </>
          ) : recorder.state === "recording" ? (
            <>
              <MicOff className="w-6 h-6 mr-2" />
              Tap to Stop
            </>
          ) : (
            <>
              <Mic className="w-6 h-6 mr-2" />
              Tap to Speak
            </>
          )}
        </Button>

        {playback.state === "playing" && (
          <p className="text-center text-xs text-muted-foreground mt-2">
            Speaking...
          </p>
        )}
      </div>
    </div>
  );
}

export default VoiceAssistantWidget;
