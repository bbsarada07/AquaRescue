'use client';

import React from 'react';
import { Camera, Navigation, Radio, Users, Zap, Compass, CheckCircle2, AlertTriangle, LifeBuoy } from 'lucide-react';
import { Tooltip } from './Tooltip';

interface OperatorPanelProps {
  droneStatus: string;
  buoyStatus: string;
  responderStatus: string;
  puckId: string;
  filteredLocation: { lat: number; lng: number };
  droneLocation?: { lat: number; lng: number } | null;
  buoyLocation?: { lat: number; lng: number } | null;
  responderLocation?: { lat: number; lng: number } | null;
  sensorData: {
    screechConfidence: number;
    thermalDelta: number;
    waterVelocity: number;
    driftHeading: number;
  };
  activeDistress: boolean;
  onAutoDispatch: () => void;
  onOverrideDispatch: () => void;
  onManualPayloadDrop: () => void;
}

export function OperatorPanel({
  droneStatus,
  buoyStatus,
  responderStatus,
  puckId,
  filteredLocation,
  droneLocation,
  buoyLocation,
  responderLocation,
  sensorData,
  activeDistress,
  onAutoDispatch,
  onOverrideDispatch,
  onManualPayloadDrop,
}: OperatorPanelProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'EN_ROUTE':
      case 'DISPATCHED':
        return (
          <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-lg text-sm font-extrabold flex items-center gap-1.5 animate-pulse">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
            EN-ROUTE
          </span>
        );
      case 'TARGET_REACHED':
        return (
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-sm font-extrabold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            REACHED
          </span>
        );
      case 'OFFLINE':
        return (
          <span className="px-3 py-1 bg-slate-800 text-slate-400 border border-slate-700 rounded-lg text-sm font-bold">
            OFFLINE
          </span>
        );
      case 'STANDBY':
      default:
        return (
          <span className="px-3 py-1 bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 rounded-lg text-sm font-extrabold">
            ACTIVE PATROL
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:p-6 w-full max-w-4xl mx-auto h-full justify-between">
      
      {/* ── CARD 1: LIVE DRONE CAMERA FEED ─────────────────────────────────── */}
      <div id="tour-drone-feed" className="shrink-0 bg-[#131C31] rounded-2xl p-4 border border-slate-700/60 shadow-xl flex flex-col">
        <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-cyan-400" />
            <h3 className="font-extrabold text-lg text-white tracking-wide">LIVE DRONE CAMERA</h3>
          </div>
          <span className="px-2.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-full text-xs font-mono font-bold animate-pulse">
            LIVE 4K FEED
          </span>
        </div>

        {/* Video Canvas Container */}
        <div className="w-full rounded-xl overflow-hidden border border-slate-800 bg-black aspect-video relative flex items-center justify-center shadow-inner">
          <video
            src="/surveillance.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 left-2 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span>UAV-RESCUE-01 · AI OPTICAL TRACKING</span>
          </div>
          <div className="absolute bottom-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-1 rounded text-[10px] font-mono text-emerald-400 border border-emerald-500/30">
            AUTO TARGET LOCK: 98%
          </div>
        </div>

        {/* Tactical Telemetry Strip */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-300">
            <Tooltip term="Thermal Delta" content="Difference between victim body heat and water temp." />
            <span className="font-mono text-cyan-300 font-bold">+{sensorData.thermalDelta}°C</span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <Tooltip term="Drift Vector" content="Heading direction water current is carrying victim." />
            <span className="font-mono text-cyan-300 font-bold">{sensorData.driftHeading}°</span>
          </div>
        </div>
      </div>

      {/* ── CARD 2: UNIT STATUS & QUICK ACTIONS ────────────────────────────── */}
      <div id="tour-unit-status" className="shrink-0 bg-[#131C31] rounded-2xl p-4 border border-slate-700/60 shadow-xl flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Compass className="w-5 h-5 text-emerald-400" />
              <h3 className="font-extrabold text-lg text-white tracking-wide">UNIT STATUS & ACTIONS</h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">3 RESCUE ASSETS</span>
          </div>

          <div className="flex flex-col gap-3">
            
            {/* Unit 1: Aerial Rescue Drone */}
            <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">RESCUE DRONE (UAV-01)</h4>
                  <div className="font-mono text-xs text-cyan-300 font-semibold flex items-center gap-2 mt-0.5">
                    <span>LAT: {droneLocation ? droneLocation.lat.toFixed(6) : '17.387544'}</span>
                    <span>LON: {droneLocation ? droneLocation.lng.toFixed(6) : '78.489171'}</span>
                  </div>
                </div>
              </div>
              {getStatusBadge(droneStatus)}
            </div>

            {/* Unit 2: Autonomous Hydro-Buoy */}
            <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <LifeBuoy className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">HYDRO-BUOY (BUOY-02)</h4>
                  <div className="font-mono text-xs text-amber-300 font-semibold flex items-center gap-2 mt-0.5">
                    <span>LAT: {buoyLocation ? buoyLocation.lat.toFixed(6) : '17.383044'}</span>
                    <span>LON: {buoyLocation ? buoyLocation.lng.toFixed(6) : '78.485171'}</span>
                  </div>
                </div>
              </div>
              {getStatusBadge(buoyStatus)}
            </div>

            {/* Unit 3: Coast Guard Field Team */}
            <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <Users className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-white">FIELD RESPONSE TEAM</h4>
                  <div className="font-mono text-xs text-emerald-300 font-semibold flex items-center gap-2 mt-0.5">
                    <span>LAT: {responderLocation ? responderLocation.lat.toFixed(6) : '17.382044'}</span>
                    <span>LON: {responderLocation ? responderLocation.lng.toFixed(6) : '78.488671'}</span>
                  </div>
                </div>
              </div>
              {getStatusBadge(responderStatus)}
            </div>

          </div>
        </div>

        {/* Quick Action Buttons for Operator Mode */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex flex-col gap-2">
          <button
            onClick={onManualPayloadDrop}
            className="w-full min-h-[44px] px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 active:scale-98 shadow-lg shadow-cyan-600/20"
          >
            <Zap className="w-4 h-4" />
            <span>DROP LIFE FLOAT PAYLOAD</span>
          </button>
          
          <button
            onClick={onOverrideDispatch}
            className="w-full min-h-[44px] px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-sm rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4 text-emerald-400" />
            <span>DISPATCH FIELD RESPONSE TEAM</span>
          </button>
        </div>

      </div>

    </div>
  );
}
