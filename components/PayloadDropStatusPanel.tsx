'use client';

import React from 'react';
import { LifeBuoy, CheckCircle2, Clock, ShieldCheck, Send } from 'lucide-react';

export type PayloadDropState = 'STANDBY' | 'EN_ROUTE' | 'RELEASED' | 'CONFIRMED_DEPLOYED';

export interface PayloadDropStatusPanelProps {
  status: PayloadDropState;
  timestamp?: number;
  onManualPayloadDrop?: () => void;
  targetLock?: boolean;
  distanceM?: number;
  className?: string;
}

const STAGES: { key: PayloadDropState; label: string; desc: string }[] = [
  { key: 'STANDBY', label: 'STANDBY', desc: 'Pod Secured' },
  { key: 'EN_ROUTE', label: 'EN ROUTE', desc: 'UAV Transit' },
  { key: 'RELEASED', label: 'RELEASED', desc: 'Jacket Dropped' },
  { key: 'CONFIRMED_DEPLOYED', label: 'DEPLOYED', desc: 'Target Reached' },
];

export const PayloadDropStatusPanel: React.FC<PayloadDropStatusPanelProps> = ({
  status = 'STANDBY',
  timestamp,
  onManualPayloadDrop,
  targetLock = true,
  distanceM = 42,
  className = '',
}) => {
  const currentIdx = STAGES.findIndex((s) => s.key === status);
  const activeIdx = currentIdx === -1 ? 0 : currentIdx;

  const timeFormatted = timestamp
    ? new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
    : new Date().toLocaleTimeString('en-US', { hour12: false });

  const getStatusBadge = () => {
    switch (status) {
      case 'CONFIRMED_DEPLOYED':
        return (
          <span className="text-[9px] font-bold text-[#10B981] bg-[#10B981]/15 border border-[#10B981]/40 px-2 py-0.5 rounded flex items-center gap-1">
            <ShieldCheck className="w-2.5 h-2.5" /> CONFIRMED DEPLOYED
          </span>
        );
      case 'RELEASED':
        return (
          <span className="text-[9px] font-bold text-[#06B6D4] bg-[#06B6D4]/15 border border-[#06B6D4]/40 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse">
            <LifeBuoy className="w-2.5 h-2.5" /> RELEASED
          </span>
        );
      case 'EN_ROUTE':
        return (
          <span className="text-[9px] font-bold text-[#F59E0B] bg-[#F59E0B]/15 border border-[#F59E0B]/40 px-2 py-0.5 rounded flex items-center gap-1">
            <Send className="w-2.5 h-2.5" /> EN ROUTE
          </span>
        );
      case 'STANDBY':
      default:
        return (
          <span className="text-[9px] font-bold text-[#10B981] bg-[#10B981]/10 border border-[#10B981]/30 px-2 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5" /> STANDBY / READY
          </span>
        );
    }
  };

  return (
    <div className={`space-y-2.5 text-xs font-mono ${className}`}>
      {/* Status Badges & Summary */}
      <div className="flex items-center justify-between">
        <div className="text-gray-400 text-[10px] uppercase tracking-wider">LIFECYCLE STATE</div>
        {getStatusBadge()}
      </div>

      {/* Visual Step Progression Bar */}
      <div className="grid grid-cols-4 gap-1 pt-1">
        {STAGES.map((stage, idx) => {
          const isPassed = idx < activeIdx;
          const isCurrent = idx === activeIdx;

          let barBg = 'bg-gray-800 border-gray-700/60 text-gray-500';
          if (isPassed) {
            barBg = 'bg-[#10B981]/20 border-[#10B981]/60 text-[#10B981]';
          } else if (isCurrent) {
            if (stage.key === 'CONFIRMED_DEPLOYED') barBg = 'bg-[#10B981]/30 border-[#10B981] text-[#10B981] shadow-[0_0_10px_rgba(16,185,129,0.3)]';
            else if (stage.key === 'RELEASED') barBg = 'bg-[#06B6D4]/30 border-[#06B6D4] text-[#06B6D4] shadow-[0_0_10px_rgba(6,182,212,0.3)] animate-pulse';
            else if (stage.key === 'EN_ROUTE') barBg = 'bg-[#F59E0B]/30 border-[#F59E0B] text-[#F59E0B] shadow-[0_0_10px_rgba(245,158,11,0.3)]';
            else barBg = 'bg-[#10B981]/20 border-[#10B981]/60 text-[#10B981]';
          }

          return (
            <div
              key={stage.key}
              className={`p-1.5 rounded border flex flex-col items-center justify-center text-center transition-all ${barBg}`}
            >
              <div className="text-[8px] font-bold tracking-tight uppercase leading-none">{stage.label}</div>
              <div className="text-[7px] text-gray-400 mt-0.5 leading-tight">{stage.desc}</div>
            </div>
          );
        })}
      </div>

      {/* Telemetry Detail Grid */}
      <div className="grid grid-cols-2 gap-y-1.5 gap-x-2 pt-1.5 border-t border-[#1A2840] text-[11px]">
        <span className="text-gray-500 text-[10px] uppercase">Payload Model</span>
        <span className="font-bold text-white">AUTO-INFLATABLE V3</span>

        <span className="text-gray-500 text-[10px] uppercase">Gimbal Target Lock</span>
        <span className="text-[#10B981] font-bold">{targetLock ? 'LOCKED (100%)' : 'ACQUIRING'}</span>

        <span className="text-gray-500 text-[10px] uppercase">Drop Distance</span>
        <span className="font-bold text-[#06B6D4]">{Math.round(distanceM)} m</span>

        <span className="text-gray-500 text-[10px] uppercase flex items-center gap-1">
          <Clock className="w-2.5 h-2.5 text-gray-400" /> Last State Change
        </span>
        <span className="font-bold text-[#F59E0B] tabular-nums">{timeFormatted} IST</span>
      </div>

      {/* Manual Drop Action Button */}
      {status !== 'CONFIRMED_DEPLOYED' && onManualPayloadDrop && (
        <button
          onClick={onManualPayloadDrop}
          className="w-full mt-1 py-1.5 rounded border border-[#ef4444]/60 bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#fca5a5] font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-md"
        >
          <LifeBuoy className="w-3 h-3 text-[#EF4444]" />
          {status === 'STANDBY' ? 'MANUAL PAYLOAD DROP' : 'FORCE RELEASE PAYLOAD'}
        </button>
      )}
    </div>
  );
};

export default PayloadDropStatusPanel;
