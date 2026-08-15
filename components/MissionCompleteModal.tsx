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

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-mission-slide-in select-none">
      <div className="bg-[#090D16] border-2 border-[#10B981]/60 rounded-xl max-w-lg w-full p-6 shadow-[0_0_50px_rgba(16,185,129,0.2)] font-mono space-y-5 relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-gray-800 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 border-b border-[#1F293D] pb-4">
          <div className="p-3 bg-[#10B981]/15 border border-[#10B981]/40 rounded-xl text-[#10B981] shadow-lg">
            <CheckCircle2 className="w-8 h-8 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-extrabold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40 px-2 py-0.5 rounded uppercase tracking-wider">
                MISSION COMPLETE
              </span>
              <span className="text-[10px] text-gray-400 font-bold">{missionId || '#AR-042'}</span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-wide mt-0.5">
              INCIDENT RESOLVED & TARGET SECURED
            </h2>
          </div>
        </div>

        {/* Mission Metrics Summary Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="bg-[#111827] p-3 rounded-lg border border-[#1F293D] space-y-1">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-[#06B6D4]" />
              TARGET ID
            </span>
            <div className="text-white font-extrabold text-sm truncate">{puckId || 'PUCK-ALPHA-04'}</div>
          </div>

          <div className="bg-[#111827] p-3 rounded-lg border border-[#1F293D] space-y-1">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#F59E0B]" />
              MISSION DURATION
            </span>
            <div className="text-[#F59E0B] font-extrabold text-sm">{durationFormatted}</div>
          </div>

          <div className="bg-[#111827] p-3 rounded-lg border border-[#1F293D] space-y-1">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Award className="w-3 h-3 text-[#10B981]" />
              DETECTION CONFIDENCE
            </span>
            <div className="text-[#10B981] font-extrabold text-sm">{confPct}% Screech Match</div>
          </div>

          <div className="bg-[#111827] p-3 rounded-lg border border-[#1F293D] space-y-1">
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-[#EF4444]" />
              FINAL COORDINATES
            </span>
            <div className="text-white font-mono text-[11px] font-bold">
              {latStr}, {lngStr}
            </div>
          </div>
        </div>

        {/* Response Units Status Summary */}
        <div className="bg-[#111827]/80 p-3 rounded-lg border border-[#1F293D] space-y-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
            <Cpu className="w-3 h-3 text-[#06B6D4]" />
            DISPATCHED RESPONSE UNITS STATUS
          </span>

          <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
            <div className="bg-[#090D16] p-2 rounded border border-[#06B6D4]/30 text-center">
              <div className="text-gray-400 text-[9px]">UAV DRONE</div>
              <div className="text-[#06B6D4] font-bold mt-0.5">SECURED</div>
            </div>
            <div className="bg-[#090D16] p-2 rounded border border-[#F59E0B]/30 text-center">
              <div className="text-gray-400 text-[9px]">HYDRO BUOY</div>
              <div className="text-[#F59E0B] font-bold mt-0.5">DEPLOYED</div>
            </div>
            <div className="bg-[#090D16] p-2 rounded border border-[#A78BFA]/30 text-center">
              <div className="text-gray-400 text-[9px]">RESCUE TEAM</div>
              <div className="text-[#A78BFA] font-bold mt-0.5">STANDBY</div>
            </div>
          </div>
        </div>

        {/* Footer & Auto-dismiss */}
        <div className="flex items-center justify-between border-t border-[#1F293D] pt-3 text-[11px]">
          <span className="text-gray-500 text-[10px]">
            Auto-returning to command dashboard in <span className="text-white font-bold">{countdown}s</span>...
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold text-xs transition-all shadow-lg"
          >
            RETURN TO MONITORING
          </button>
        </div>
      </div>
    </div>
  );
};

export default MissionCompleteModal;
