'use client';

import React, { useEffect } from 'react';
import { ShieldAlert, Zap, CheckCircle2, Navigation, Radio, Package, Award } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface RedEmergencyBannerProps {
  activeDistress: boolean;
  puckId: string;
  droneStatus: string;
  buoyStatus: string;
  responderStatus: string;
  filteredLocation: { lat: number; lng: number };
  onAutoDispatch: () => void;
  onResolveIncident: () => void;
}

export function RedEmergencyBanner({
  activeDistress,
  puckId,
  droneStatus,
  buoyStatus,
  responderStatus,
  filteredLocation,
  onAutoDispatch,
  onResolveIncident,
}: RedEmergencyBannerProps) {
  // Determine dispatch state and step 1..4
  const isDispatched = droneStatus !== 'STANDBY' || buoyStatus !== 'STANDBY' || responderStatus !== 'STANDBY';
  const isEnRoute = droneStatus === 'EN_ROUTE' || buoyStatus === 'EN_ROUTE';
  const isTargetReached = droneStatus === 'TARGET_REACHED' || buoyStatus === 'TARGET_REACHED';

  let currentStep = 1;
  if (isTargetReached) {
    currentStep = 4;
  } else if (isEnRoute) {
    currentStep = 3;
  } else if (isDispatched) {
    currentStep = 2;
  }

  // Keyboard shortcut listener for Spacebar to trigger 1-Click Auto Dispatch
  useEffect(() => {
    if (!activeDistress) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isDispatched) {
        e.preventDefault();
        onAutoDispatch();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDistress, isDispatched, onAutoDispatch]);

  if (!activeDistress) return null;

  return (
    <div className="w-full bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b-2 border-red-500 shadow-2xl p-4 md:px-6 transition-all duration-300 relative z-30 animate-in slide-in-from-top">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Left Side: Critical Signal Alert Status */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex items-center justify-center">
            <span className="animate-ping absolute inline-flex h-10 w-10 rounded-full bg-red-400 opacity-75"></span>
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/50">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="bg-red-600 text-white text-xs font-black px-2 py-0.5 rounded tracking-wider uppercase animate-pulse">
                CRITICAL DISTRESS SIGNAL
              </span>
              <Tooltip
                term={puckId}
                content="Unique identifier of the victim's automated acoustic/GPS emergency distress puck."
              />
            </div>
            <p className="text-sm font-semibold text-white mt-0.5 flex items-center gap-2">
              <span>Target Coordinates:</span>
              <span className="font-mono text-cyan-300 bg-black/40 px-2 py-0.5 rounded border border-cyan-500/30">
                {filteredLocation.lat.toFixed(5)}°, {filteredLocation.lng.toFixed(5)}°
              </span>
            </p>
          </div>
        </div>

        {/* Center: 4-Step Progress Indicator */}
        <div className="flex items-center justify-center gap-1 sm:gap-3 bg-black/40 px-3 py-2 rounded-xl border border-red-500/30 w-full md:w-auto overflow-x-auto">
          
          {/* Step 1 */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-all ${currentStep >= 1 ? 'bg-red-600 text-white shadow' : 'text-slate-500'}`}>
            <Radio className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">1. Signal Locked</span>
          </div>

          <span className="text-slate-600 font-bold">➔</span>

          {/* Step 2 */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-all ${currentStep >= 2 ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-500'}`}>
            <Navigation className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">2. Dispatched</span>
          </div>

          <span className="text-slate-600 font-bold">➔</span>

          {/* Step 3 */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-all ${currentStep >= 3 ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-500'}`}>
            <Package className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">3. Payload Dropped</span>
          </div>

          <span className="text-slate-600 font-bold">➔</span>

          {/* Step 4 */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold transition-all ${currentStep >= 4 ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-500'}`}>
            <Award className="w-4 h-4 shrink-0" />
            <span className="whitespace-nowrap">4. Complete</span>
          </div>
        </div>

        {/* Right Side: 1-CLICK AUTO DISPATCH BUTTON */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          {!isDispatched ? (
            <button
              onClick={onAutoDispatch}
              id="tour-auto-dispatch"
              className="w-full md:w-auto min-h-[48px] px-6 py-3 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-base md:text-lg rounded-xl shadow-lg shadow-emerald-500/40 hover:shadow-emerald-400/60 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-emerald-300"
            >
              <Zap className="w-5 h-5 fill-current animate-bounce" />
              <span>ONE-CLICK AUTO DISPATCH</span>
              <span className="hidden lg:inline-block ml-1 text-xs bg-slate-950/40 text-emerald-200 px-2 py-0.5 rounded font-mono border border-emerald-400/40">
                [SPACEBAR]
              </span>
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/50 px-4 py-2 rounded-xl text-emerald-300 text-sm font-bold">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                <span>UNITS EN ROUTE TO TARGET</span>
              </div>
              <button
                onClick={onResolveIncident}
                className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl border border-slate-600 hover:border-slate-400 transition-all"
              >
                COMPLETE MISSION
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
