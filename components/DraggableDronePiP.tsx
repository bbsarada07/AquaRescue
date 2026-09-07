'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, Minimize2, Maximize2, Move, Eye, Flame, Moon } from 'lucide-react';
import DroneCameraFeed, { DroneCameraFeedProps, DroneCameraMode } from './DroneCameraFeed';

export interface DraggableDronePiPProps extends DroneCameraFeedProps {
  initialPosition?: { x: number; y: number };
  defaultMinimized?: boolean;
  onToggleMinimize?: (minimized: boolean) => void;
}

export const DraggableDronePiP: React.FC<DraggableDronePiPProps> = ({
  initialPosition,
  defaultMinimized = false,
  onToggleMinimize,
  ...droneProps
}) => {
  const [minimized, setMinimized] = useState(defaultMinimized);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    if (initialPosition) return initialPosition;
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(16, window.innerWidth - 410),
        y: Math.max(80, window.innerHeight - 340),
      };
    }
    return { x: 50, y: 100 };
  });

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number }>({
    mouseX: 0,
    mouseY: 0,
    startX: 0,
    startY: 0,
  });

  // Clamp window position on window resize
  useEffect(() => {
    const handleResize = () => {
      setPos((prev) => {
        const maxX = Math.max(10, window.innerWidth - (minimized ? 220 : 390));
        const maxY = Math.max(10, window.innerHeight - (minimized ? 60 : 300));
        return {
          x: Math.min(Math.max(10, prev.x), maxX),
          y: Math.min(Math.max(60, prev.y), maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [minimized]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only drag from header handle
    if ((e.target as HTMLElement).closest('button')) return;
    isDraggingRef.current = true;
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: pos.x,
      startY: pos.y,
    };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      const maxX = Math.max(10, window.innerWidth - (minimized ? 220 : 390));
      const maxY = Math.max(10, window.innerHeight - (minimized ? 60 : 300));
      setPos({
        x: Math.min(Math.max(10, dragStartRef.current.startX + dx), maxX),
        y: Math.min(Math.max(60, dragStartRef.current.startY + dy), maxY),
      });
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [minimized]);

  const toggleMin = () => {
    setMinimized((prev) => {
      const next = !prev;
      onToggleMinimize?.(next);
      return next;
    });
  };

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className={`fixed z-[4500] font-mono select-none transition-shadow ${
        minimized ? 'w-56' : 'w-80 sm:w-96'
      }`}
    >
      <div className="bg-[#0C1523]/95 backdrop-blur-md border border-[#06B6D4]/40 rounded-xl overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.8)] border-glow flex flex-col">
        {/* Header / Drag Bar */}
        <div
          onMouseDown={handleMouseDown}
          className="px-2.5 py-1.5 bg-[#080E1A] border-b border-[#1A2840] flex items-center justify-between cursor-move"
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Move className="w-3 h-3 text-gray-500" />
            <div className="w-2 h-2 rounded-full bg-[#10B981] animate-ping shrink-0" />
            <span className="text-[9px] font-extrabold text-white tracking-wider truncate">
              {droneProps.droneId || 'UAV-RESCUE-01'} · PIP
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={toggleMin}
              className="p-1 rounded text-gray-400 hover:text-[#06B6D4] hover:bg-white/10 transition-all"
              title={minimized ? 'Maximize PiP Feed' : 'Minimize PiP Feed to Pill'}
            >
              {minimized ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Minimized Pill View */}
        {minimized ? (
          <div
            onClick={toggleMin}
            className="p-2 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all text-[10px]"
          >
            <div className="flex items-center gap-2">
              <Video className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span className="text-gray-300 font-bold">OPTICAL STREAM</span>
            </div>
            <span className="text-[8px] font-bold text-[#10B981] bg-[#10B981]/15 px-1.5 py-0.5 rounded border border-[#10B981]/30">
              ACTIVE
            </span>
          </div>
        ) : (
          /* Expanded Full UAV Feed View */
          <div className="w-full" style={{ height: '270px' }}>
            <DroneCameraFeed {...droneProps} />
          </div>
        )}
      </div>
    </div>
  );
};

export default DraggableDronePiP;
