import { useEffect, useRef, useState } from 'react';

// Web Speech API (Chrome, Edge, Safari, Android). Not in TypeScript's DOM types yet.
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

const Ctor = (typeof window !== 'undefined' && ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition)) as RecognitionCtor | undefined;

/** Ukrainian dictation: `onText` gets the text so far (interim, then final) while listening. */
export function useDictation(onText: (text: string, final: boolean) => void, onError?: (error: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef({ onText, onError });
  cb.current = { onText, onError };

  useEffect(() => () => rec.current?.stop(), []);

  const start = () => {
    if (!Ctor || rec.current) return;
    const r = new Ctor();
    r.lang = 'uk-UA';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      const parts = Array.from(e.results);
      cb.current.onText(parts.map((p) => p[0].transcript).join(' ').trim(), parts.every((p) => p.isFinal));
    };
    r.onerror = (e) => e.error !== 'aborted' && e.error !== 'no-speech' && cb.current.onError?.(e.error);
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setListening(true);
    r.start();
  };
  const stop = () => rec.current?.stop();
  return { supported: !!Ctor, listening, start, stop };
}
