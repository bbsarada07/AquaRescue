'use client';

import React from 'react';
import { useUI } from '@/lib/uiContext';
import { ShieldAlert, Zap, Compass, ArrowRight, CheckCircle2, X } from 'lucide-react';

export function QuickTourOverlay() {
  const { isTourActive, tourStep, nextTourStep, endTour } = useUI();

  if (!isTourActive) return null;

  const steps = [
    {
      step: 1,
      title: '1. EMERGENCY ALERT & SIGNAL LOCK',
      icon: ShieldAlert,
      iconColor: 'text-red-400',
      description:
        'When a victim triggers a distress signal, AquaRescue automatically locks onto their GPS coordinates, verifies acoustic screech confidence, and sounds an emergency alert.',
      highlightText: 'Look at the top Red Emergency Banner for real-time status.',
    },
    {
      step: 2,
      title: '2. ONE-CLICK AUTO-DISPATCH',
      icon: Zap,
      iconColor: 'text-emerald-400',
      description:
        'No manual coordinate entry required! Click "ONE-CLICK AUTO DISPATCH" or press the [SPACEBAR] to instantly launch the drone and buoy on AI-calculated routes.',
      highlightText: 'Press SPACEBAR or click the green button to initiate rescue.',
    },
    {
      step: 3,
      title: '3. UNIT STATUS & LIVE DRONE CAMERA',
      icon: Compass,
      iconColor: 'text-cyan-400',
      description:
        'Monitor live 4K drone video feed with AI target identification, track real-time unit status (Drone, Buoy, Field Team), and complete the mission once victim is secured.',
      highlightText: 'Track asset progress on the right panel and interactive 3D map.',
    },
  ];

  const current = steps[tourStep - 1] || steps[0];
  const IconComponent = current.icon;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="max-w-lg w-full bg-[#0F172A] border-2 border-cyan-500/50 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold rounded">
              WALKTHROUGH STEP {tourStep} OF 3
            </span>
            <span className="text-xs text-slate-400 font-semibold">AquaRescue First-Responder Guide</span>
          </div>
          <button
            onClick={endTour}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Card */}
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-lg">
            <IconComponent className={`w-7 h-7 ${current.iconColor}`} />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white mb-2 tracking-wide">
              {current.title}
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed mb-3">
              {current.description}
            </p>
            <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-mono text-cyan-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{current.highlightText}</span>
            </div>
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={endTour}
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            Skip Guide
          </button>

          <button
            onClick={nextTourStep}
            className="min-h-[44px] px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-sm rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center gap-2"
          >
            <span>{tourStep === 3 ? 'FINISH TOUR' : 'NEXT STEP'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
