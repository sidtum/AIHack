import { useState, useCallback, useRef } from 'react';

interface TTSHook {
  isTTSEnabled: boolean;
  isSpeaking: boolean;
  toggleTTS: () => void;
  speak: (text: string) => void;
  stop: () => void;
}

export function useTTS(): TTSHook {
  const [isTTSEnabled, setIsTTSEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const toggleTTS = useCallback(() => {
    setIsTTSEnabled(prev => {
      if (prev) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      return !prev;
    });
  }, []);

  const speak = useCallback((text: string) => {
    if (!isTTSEnabled || !text) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // Clean markdown-style formatting for speech
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/#{1,6}\s/g, '')
      .replace(/[-*]\s/g, '')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.volume = 0.85;

    // Try to pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Samantha')) ||
                      voices.find(v => v.lang === 'en-US' && v.localService);
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, [isTTSEnabled]);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { isTTSEnabled, isSpeaking, toggleTTS, speak, stop };
}
