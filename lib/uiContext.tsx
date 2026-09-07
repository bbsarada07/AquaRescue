'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export type UIMode = 'OPERATOR' | 'TACTICAL';

export interface UIContextType {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  toggleMode: () => void;
  isTourActive: boolean;
  tourStep: number;
  startTour: () => void;
  nextTourStep: () => void;
  prevTourStep: () => void;
  endTour: () => void;
  speakEvent: (message: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UIMode>('OPERATOR');
  const [isTourActive, setIsTourActive] = useState<boolean>(false);
  const [tourStep, setTourStep] = useState<number>(1);

  const setMode = useCallback((newMode: UIMode) => {
    setModeState(newMode);
  }, []);

  const toggleMode = useCallback(() => {
    setModeState(prev => (prev === 'OPERATOR' ? 'TACTICAL' : 'OPERATOR'));
  }, []);

  const startTour = useCallback(() => {
    setTourStep(1);
    setIsTourActive(true);
  }, []);

  const nextTourStep = useCallback(() => {
    setTourStep(prev => {
      if (prev >= 3) {
        setIsTourActive(false);
        return 1;
      }
      return prev + 1;
    });
  }, []);

  const prevTourStep = useCallback(() => {
    setTourStep(prev => (prev <= 1 ? 1 : prev - 1));
  }, []);

  const endTour = useCallback(() => {
    setIsTourActive(false);
    setTourStep(1);
  }, []);

  // Browser Speech Synthesis with strict queue cancellation to avoid audio overlap
  const speakEvent = useCallback((message: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Always cancel playing utterances before starting new one
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const EnglishVoice = voices.find(v => v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Samantha') || v.name.includes('Daniel'))) || voices.find(v => v.lang.startsWith('en'));
      if (EnglishVoice) utterance.voice = EnglishVoice;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }, []);

  return (
    <UIContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        isTourActive,
        tourStep,
        startTour,
        nextTourStep,
        prevTourStep,
        endTour,
        speakEvent,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}

export function useUI(): UIContextType {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
}
