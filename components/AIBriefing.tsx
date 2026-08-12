'use client';

import React from 'react';
import { 
  Bot, 
  Volume2, 
  ShieldAlert, 
  Sparkles, 
  CheckSquare, 
  Clock, 
  Cpu 
} from 'lucide-react';
import { BriefingResponse, speakBriefing } from '@/lib/gemini';

export interface AIBriefingProps {
  briefing: BriefingResponse | string | null;
  audioVoiceEnabled: boolean;
}

export const AIBriefing: React.FC<AIBriefingProps> = ({ briefing, audioVoiceEnabled }) => {
  const briefingData: BriefingResponse | null = typeof briefing === 'string'
    ? {
        summary: briefing,
        actionItems: ['UAV Aerial Payload Drop', 'Autonomous Buoy Intercept Navigation'],
        threatLevel: 'HIGH',
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
      }
    : briefing;

  const handleReplayVoice = () => {
    if (briefingData?.summary) {
      speakBriefing(briefingData.summary);
    }
  };

  if (!briefingData) {
    return (
      <div className="bg-[#090D16] p-4 rounded-lg border border-[#1F293D] flex items-center justify-between text-gray-500 font-mono text-xs">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-[#06B6D4]" />
          <span>GEMINI TACTICAL AI AGENT STANDBY...</span>
        </div>
        <span className="text-[10px] bg-gray-800 px-2 py-0.5 rounded text-gray-400">READY</span>
      </div>
    );
  }

  return (
    <div className="bg-[#090D16] p-4 rounded-lg border border-[#06B6D4]/40 space-y-3 font-mono shadow-2xl relative overflow-hidden">
      {/* Glow Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-[#06B6D4]/5 rounded-full blur-2xl pointer-events-none" />

      {/* Briefing Header */}
      <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded bg-[#06B6D4]/15 border border-[#06B6D4]/40 text-[#06B6D4]">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white tracking-wider flex items-center gap-1.5">
              GEMINI TACTICAL AI INCIDENT BRIEFING
            </h3>
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#06B6D4]" />
              GENERATED AT {briefingData.timestamp}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold border ${
            briefingData.threatLevel === 'CRITICAL' 
              ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444] animate-pulse'
              : 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B]'
          }`}>
            THREAT: {briefingData.threatLevel}
          </span>

          <button
            onClick={handleReplayVoice}
            className="p-1.5 rounded bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4]/50 text-[#06B6D4] transition-all"
            title="Replay Voice Dispatch"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2-Sentence Tactical Incident Briefing */}
      <div className="bg-[#111827] p-3 rounded border border-[#1F293D] text-xs text-gray-200 leading-relaxed">
        <p className="font-semibold text-white">{briefingData.summary}</p>
      </div>

      {/* Action Directives */}
      <div className="space-y-1">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
          <Cpu className="w-3 h-3 text-[#10B981]" />
          AUTOMATED DIRECTIVE LIST
        </div>
        <ul className="space-y-1">
          {briefingData.actionItems.map((item, idx) => (
            <li key={idx} className="flex items-start space-x-2 text-[11px] text-gray-300">
              <CheckSquare className="w-3.5 h-3.5 text-[#10B981] mt-0.5 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default AIBriefing;
