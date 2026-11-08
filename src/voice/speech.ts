export type SpeechStatus = "listening" | "stopped";

export interface SpeechRecognitionProvider {
  start(options: {
    language: string;
    onTranscript: (text: string) => void;
    onStatus: (status: SpeechStatus) => void;
    onError: (message: string) => void;
  }): { stop: () => void };
}

type RecognitionResultEvent = {
  resultIndex: number;
  results: ArrayLike<{ 0: { transcript: string }; isFinal?: boolean }>;
};

type BrowserRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => BrowserRecognition;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

export function createBrowserSpeechProvider(
  host: SpeechWindow | undefined = typeof window === "undefined" ? undefined : (window as SpeechWindow),
): SpeechRecognitionProvider | null {
  const Constructor = host?.SpeechRecognition ?? host?.webkitSpeechRecognition;
  if (!Constructor) return null;

  return {
    start({ language, onTranscript, onStatus, onError }) {
      const recognition = new Constructor();
      recognition.lang = language;
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        const parts: string[] = [];
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const transcript = event.results[index]?.[0]?.transcript?.trim();
          if (transcript) parts.push(transcript);
        }
        if (parts.length) onTranscript(parts.join(" "));
      };
      recognition.onerror = (event) => {
        onError(event.error === "not-allowed"
          ? "Microphone permission was denied. Allow microphone access or type the note."
          : "Speech capture failed. Please retry or type the note.");
      };
      recognition.onend = () => onStatus("stopped");

      try {
        recognition.start();
        onStatus("listening");
      } catch {
        onError("Microphone could not start. Check browser permission and try again.");
        onStatus("stopped");
      }

      return { stop: () => recognition.stop() };
    },
  };
}
