'use client';

import { useEffect } from 'react';

export interface HotkeyHandlers {
  onExecuteRescue?: () => void;
  onManualPayloadDrop?: () => void;
  onResolveIncident?: () => void;
  onToggleAudio?: () => void;
}

export function useHotkeys({
  onExecuteRescue,
  onManualPayloadDrop,
  onResolveIncident,
  onToggleAudio,
}: HotkeyHandlers) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;

      // Edge-Case Safeguard: Ignore keyboard shortcuts if user is typing inside input, textarea, or contentEditable
      if (
        target &&
        (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
      ) {
        return;
      }

      const key = event.key;

      if (key === ' ' || key === 'Spacebar') {
        event.preventDefault();
        onExecuteRescue?.();
      } else if (key === 'd' || key === 'D') {
        event.preventDefault();
        onManualPayloadDrop?.();
      } else if (key === 'r' || key === 'R') {
        event.preventDefault();
        onResolveIncident?.();
      } else if (key === 'm' || key === 'M') {
        event.preventDefault();
        onToggleAudio?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onExecuteRescue, onManualPayloadDrop, onResolveIncident, onToggleAudio]);
}
