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

const nav = typeof navigator !== 'undefined' ? navigator : undefined;
const isIOS = !!nav && (/iPhone|iPad|iPod/.test(nav.userAgent) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1));
const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (nav as { standalone?: boolean } | undefined)?.standalone === true);
const BROKEN_KEY = 'plano:dictation-broken';
const brokenBefore = () => {
  try {
    return sessionStorage.getItem(BROKEN_KEY) === '1';
  } catch {
    return false;
  }
};
// Errors that mean recognition won't work here at all (the home-screen app on iPhone often hits these).
const FATAL = new Set(['not-allowed', 'service-not-allowed', 'network', 'audio-capture']);

/**
 * How dictation works here: `live` — our own recognition; `keyboard` — iPhone, where the
 * installed app can't use it, but the keyboard's microphone always works; `none` — hide the button.
 */
export type DictationMode = 'live' | 'keyboard' | 'none';
const initialMode = (): DictationMode => (Ctor && !(isIOS && standalone) && !brokenBefore() ? 'live' : isIOS ? 'keyboard' : 'none');

/** Ukrainian dictation: `onText` gets the text so far (interim, then final) while listening. */
export function useDictation(onText: (text: string, final: boolean) => void, onError?: (error: string) => void) {
  const [listening, setListening] = useState(false);
  const [mode, setMode] = useState(initialMode);
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
    r.onerror = (e) => {
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      // Not a one-off: switch to the keyboard's microphone (or hide) for the rest of the visit.
      const fatal = FATAL.has(e.error);
      if (fatal) {
        try {
          sessionStorage.setItem(BROKEN_KEY, '1');
        } catch {
          /* private mode */
        }
        setMode(isIOS ? 'keyboard' : 'none');
      }
      cb.current.onError?.(fatal ? (isIOS ? 'keyboard' : 'unavailable') : e.error);
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
    };
    rec.current = r;
    setListening(true);
    try {
      r.start();
    } catch {
      rec.current = null;
      setListening(false);
    }
  };
  const stop = () => rec.current?.stop();
  return { mode, supported: mode !== 'none', listening, start, stop };
}
