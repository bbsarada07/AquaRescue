'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock, ShieldCheck, MapPin, X, Navigation, Cpu, Award } from 'lucide-react';
import { FilteredResult, GPSCoordinate } from '@/lib/kalman';

export interface MissionCompleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  puckId: string;
  missionId: string | null;
  durationFormatted: string;
  detectionTime: string;
  screechConfidence: number;
  filteredLocation: (FilteredResult & { noiseDeltaMeters?: number }) | GPSCoordinate | null;
  droneStatus?: string;
  buoyStatus?: string;
  responderStatus?: string;
}

export const MissionCompleteModal: React.FC<MissionCompleteModalProps> = ({
  isOpen,
  onClose,
  puckId,
  missionId,
  durationFormatted,
  detectionTime,
  screechConfidence,
  filteredLocation,
  droneStatus = 'STANDBY',
  buoyStatus = 'STANDBY',
  responderStatus = 'STANDBY',
}) => {
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (!isOpen) return;
    setCountdown(8);
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const latStr = filteredLocation?.lat ? filteredLocation.lat.toFixed(6) : '17.385044';
  const lngStr = filteredLocation?.lng ? filteredLocation.lng.toFixed(6) : '78.486671';
  const confPct = Math.round((screechConfidence || 0.96) * 100);

  // Non-blocking toast — Monitoring is immediately visible behind this
  return (
    <div className="fixed bottom-6 right-6 z-[5000] max-w-sm w-full select-none animate-mission-slide-in pointer-events-auto">
      <div className="bg-[#090D16] border-2 border-[#10B981]/60 rounded-xl p-4 shadow-[0_0_40px_rgba(16,185,129,0.25)] font-mono space-y-3 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#10B981]/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-[#10B981]/15 border border-[#10B981]/40 rounded-lg text-[#10B981]">
              <CheckCircle2 className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="text-[9px] font-extrabold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 px-1.5 py-0.5 rounded uppercase tracking-wider inline-block">
                MISSION COMPLETE
              </div>
              <div className="text-[10px] text-gray-400 font-bold mt-0.5">{missionId || '#AR-042'}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-all shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compact metrics */}
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
            <div className="text-gray-500 text-[9px]">TARGET</div>
            <div className="text-white font-bold truncate">{puckId || 'PUCK-ALPHA-04'}</div>
          </div>
          <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
            <div className="text-gray-500 text-[9px]">DURATION</div>
            <div className="text-[#F59E0B] font-bold">{durationFormatted}</div>
          </div>
          <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
            <div className="text-gray-500 text-[9px]">CONFIDENCE</div>
            <div className="text-[#10B981] font-bold">{confPct}%</div>
          </div>
          <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
            <div className="text-gray-500 text-[9px]">GPS</div>
            <div className="text-[#67e8f9] font-bold text-[9px] tabular-nums">{latStr.slice(0,9)}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#1F293D] pt-2 text-[10px]">
          <span className="text-gray-500">
            Closing in <span className="text-white font-bold">{countdown}s</span>
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold text-[9px] transition-all"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissionCompleteModal;
