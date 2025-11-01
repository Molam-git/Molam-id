import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TTSContextType {
  enabled: boolean;
  speaking: boolean;
  toggleTTS: () => void;
  speak: (text: string) => void;
  stop: () => void;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export function TTSProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => {
    const saved = localStorage.getItem('molam.tts.enabled');
    return saved === 'true';
  });
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback((text: string) => {
    if (!enabled || !window.speechSynthesis) return;

    // Stop any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, [enabled]);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, []);

  const toggleTTS = useCallback(() => {
    setEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('molam.tts.enabled', String(newValue));
      if (!newValue) {
        stop();
      } else {
        speak('Synthèse vocale activée');
      }
      return newValue;
    });
  }, [speak, stop]);

  return (
    <TTSContext.Provider value={{ enabled, speaking, toggleTTS, speak, stop }}>
      {children}
    </TTSContext.Provider>
  );
}

export function useTTS() {
  const context = useContext(TTSContext);
  if (!context) {
    throw new Error('useTTS must be used within TTSProvider');
  }
  return context;
}
