'use client';

import React, { useEffect, useRef } from 'react';
import { LocateFixed, UserRound, LifeBuoy, Mic, Waves, Navigation } from 'lucide-react';
import { FilteredResult, GPSCoordinate } from '@/lib/kalman';
import { HydrodynamicVectorResult } from '@/lib/hydrodynamics';

export interface TelemetryRowProps {
  puckId: string;
  activeDistress: boolean;
  filteredLocation: (FilteredResult & { noiseDeltaMeters?: number }) | GPSCoordinate | null;
  rawLocation: GPSCoordinate | null;
  sensorData: {
    screechConfidence: number;
    thermalDelta: number;
    waterVelocity: number;
    driftHeading: number;
  };
  hydrodynamics: HydrodynamicVectorResult | null;
  droneLocation: GPSCoordinate | null;
  buoyLocation: GPSCoordinate | null;
  responderLocation: GPSCoordinate | null;
  droneStatus: string;
  buoyStatus: string;
  responderStatus: string;
  onOverrideDispatch: () => void;
  onExecuteRescue: () => void;
}

export const TelemetryRow: React.FC<TelemetryRowProps> = ({
  puckId,
  activeDistress,
  filteredLocation,
  rawLocation,
  sensorData,
  hydrodynamics,
  droneLocation,
  buoyLocation,
  responderLocation,
  droneStatus,
  buoyStatus,
  responderStatus,
  onOverrideDispatch,
  onExecuteRescue,
}) => {
  const audioCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const vectorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Audio Waveform Sparkline animation
  useEffect(() => {
    const canvas = audioCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = (time: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);

      ctx.beginPath();
      ctx.strokeStyle = activeDistress ? '#EF4444' : '#06B6D4';
      ctx.lineWidth = 1.5;

      const centerY = h / 2;
      const t = time / 200;

      for (let x = 0; x < w; x += 3) {
        const freq = activeDistress ? 0.08 : 0.03;
        const amp = activeDistress ? (h / 2.5) * (0.4 + Math.sin(x * 0.1 + t) * 0.5) : (h / 5) * Math.sin(x * 0.05 + t);
        const y = centerY + Math.sin(x * freq + t) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [activeDistress]);

  // Hydrodynamic Vector Canvas Diagram animation
  useEffect(() => {
    const canvas = vectorCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const draw = (time: number) => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.38;

      // Background Compass Ring
      ctx.strokeStyle = '#1F293D';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();

      // Drift heading vector (Cyan)
      const headingDeg = sensorData.driftHeading || 140;
      const headingRad = ((headingDeg - 90) * Math.PI) / 180;
      const dx = cx + Math.cos(headingRad) * r;
      const dy = cy + Math.sin(headingRad) * r;

      ctx.beginPath();
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 2;
      ctx.moveTo(cx, cy);
      ctx.lineTo(dx, dy);
      ctx.stroke();

      // Arrow head for drift
      const angle = Math.atan2(dy - cy, dx - cx);
      ctx.beginPath();
      ctx.fillStyle = '#06B6D4';
      ctx.moveTo(dx, dy);
      ctx.lineTo(dx - 6 * Math.cos(angle - Math.PI / 6), dy - 6 * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(dx - 6 * Math.cos(angle + Math.PI / 6), dy - 6 * Math.sin(angle + Math.PI / 6));
      ctx.fill();

      // Center dot
      ctx.beginPath();
      ctx.fillStyle = '#EF4444';
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [sensorData.driftHeading]);

  const lat = filteredLocation ? filteredLocation.lat : 17.385063;
  const lng = filteredLocation ? filteredLocation.lng : 78.486812;
  const noiseDelta = filteredLocation && 'noiseDeltaMeters' in filteredLocation ? filteredLocation.noiseDeltaMeters : 3.5;

  const screechPct = Math.round((sensorData.screechConfidence || 0.96) * 100);
  const hydroCompensatedHeading = hydrodynamics ? hydrodynamics.compensatedHeadingDeg : 355;
  const hydroImpact = Math.round((sensorData.waterVelocity || 1.8) * 45);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 w-full bg-[#070C16] p-3 border-t border-[#1F293D] select-none">
      {/* ── CARD 1: ACTIVE TARGET TELEMETRY ───────────────────────────── */}
      <div className="bg-[#0C1422] rounded-lg p-3 border border-[#1F293D] flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5 mb-2">
          <div className="flex items-center space-x-1.5">
            <LocateFixed className="w-3.5 h-3.5 text-[#EF4444]" />
            <h3 className="text-[11px] font-mono font-bold text-white tracking-wider">ACTIVE TARGET TELEMETRY</h3>
          </div>
          <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping"></span>
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-400">TARGET ID</span>
            <span className="text-white font-bold">{puckId || 'PUCK-ALPHA-04'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">STATUS</span>
            <span className={`font-bold ${activeDistress ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
              {activeDistress ? 'CRITICAL DISTRESS' : 'STANDBY MONITOR'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">FILTERED LAT</span>
            <span className="text-[#06B6D4] font-bold">{lat.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">FILTERED LNG</span>
            <span className="text-[#06B6D4] font-bold">{lng.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">NOISE DELTA</span>
            <span className="text-[#F59E0B] font-bold">{noiseDelta ? noiseDelta.toFixed(1) : '3.5'} m (FILTERED)</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-[#1F293D]/60 text-[10px]">
            <span className="text-gray-500">LAST UPDATE</span>
            <span className="text-gray-300">{new Date().toLocaleTimeString('en-US', { hour12: false })} IST</span>
          </div>
        </div>
      </div>

      {/* ── CARD 2: RESCUE TEAM ───────────────────────────────────────── */}
      <div className="bg-[#0C1422] rounded-lg p-3 border border-[#1F293D] flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5 mb-2">
          <div className="flex items-center space-x-1.5">
            <UserRound className="w-3.5 h-3.5 text-[#A78BFA]" />
            <h3 className="text-[11px] font-mono font-bold text-white tracking-wider">RESCUE TEAM-01</h3>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#A78BFA]/20 text-[#A78BFA] border border-[#A78BFA]/40">
            {responderStatus}
          </span>
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-400">STATUS</span>
            <span className="text-[#A78BFA] font-bold">{responderStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">GPS</span>
            <span className="text-gray-200">
              {responderLocation ? `${responderLocation.lat.toFixed(5)}, ${responderLocation.lng.toFixed(5)}` : '17.38246, 78.48839'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">DISTANCE TO TARGET</span>
            <span className="text-white font-bold">325 m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">ETA</span>
            <span className="text-[#A78BFA] font-black text-xs">03:37</span>
          </div>
        </div>
        <button
          onClick={onOverrideDispatch}
          className="mt-2 w-full py-1 text-[10px] font-mono font-bold rounded bg-[#A78BFA]/15 border border-[#A78BFA]/40 text-[#A78BFA] hover:bg-[#A78BFA]/30 transition flex items-center justify-center space-x-1"
        >
          <Navigation className="w-3 h-3" />
          <span>OPEN NAVIGATION</span>
        </button>
      </div>

      {/* ── CARD 3: BUOY ──────────────────────────────────────────────── */}
      <div className="bg-[#0C1422] rounded-lg p-3 border border-[#1F293D] flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5 mb-2">
          <div className="flex items-center space-x-1.5">
            <LifeBuoy className="w-3.5 h-3.5 text-[#F59E0B]" />
            <h3 className="text-[11px] font-mono font-bold text-white tracking-wider">BUOY-HYDRO-02</h3>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40">
            {buoyStatus}
          </span>
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-400">STATUS</span>
            <span className="text-[#F59E0B] font-bold">{buoyStatus === 'STANDBY' ? 'NAVIGATING' : buoyStatus}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">CURRENT SPEED</span>
            <span className="text-white font-bold">{sensorData.waterVelocity || 1.8} m/s</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">COMP HEADING</span>
            <span className="text-[#06B6D4] font-bold">{hydroCompensatedHeading}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">TARGET HEADING</span>
            <span className="text-gray-200">{sensorData.driftHeading || 140}°</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">DISTANCE</span>
            <span className="text-white font-bold">218 m</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-[#1F293D]/60 text-[10px]">
            <span className="text-gray-500">ETA</span>
            <span className="text-[#F59E0B] font-bold">01:46</span>
          </div>
        </div>
      </div>

      {/* ── CARD 4: AUDIO ANALYSIS ────────────────────────────────────── */}
      <div className="bg-[#0C1422] rounded-lg p-3 border border-[#1F293D] flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5 mb-1">
          <div className="flex items-center space-x-1.5">
            <Mic className="w-3.5 h-3.5 text-[#06B6D4]" />
            <h3 className="text-[11px] font-mono font-bold text-white tracking-wider">AUDIO ANALYSIS</h3>
          </div>
          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40">
            CONF {screechPct}%
          </span>
        </div>
        <div className="w-full h-9 my-1">
          <canvas ref={audioCanvasRef} className="w-full h-full" />
        </div>
        <div className="space-y-1 font-mono text-[11px]">
          <div className="flex justify-between">
            <span className="text-gray-400">ACOUSTIC CONFIDENCE</span>
            <span className="text-[#EF4444] font-extrabold">{screechPct}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">DOMINANT FREQUENCY</span>
            <span className="text-white font-bold">2.4 kHz</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">MATCH STATUS</span>
            <span className="text-[#EF4444] font-bold">DISTRESS MATCH</span>
          </div>
        </div>
      </div>

      {/* ── CARD 5: HYDRODYNAMIC DRIFT VECTOR ─────────────────────────── */}
      <div className="bg-[#0C1422] rounded-lg p-3 border border-[#1F293D] flex flex-col justify-between shadow-lg">
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5 mb-1">
          <div className="flex items-center space-x-1.5">
            <Waves className="w-3.5 h-3.5 text-[#06B6D4]" />
            <h3 className="text-[11px] font-mono font-bold text-white tracking-wider">HYDRODYNAMIC DRIFT VECTOR</h3>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="w-16 h-16 shrink-0">
            <canvas ref={vectorCanvasRef} className="w-full h-full" />
          </div>
          <div className="flex-1 space-y-1 font-mono text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-400">CURRENT SPEED</span>
              <span className="text-white font-bold">{sensorData.waterVelocity || 1.8} m/s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">DRIFT HEADING</span>
              <span className="text-[#06B6D4] font-bold">{sensorData.driftHeading || 140}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">COMP HEADING</span>
              <span className="text-[#F59E0B] font-bold">{hydroCompensatedHeading}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">DRIFT IMPACT (45s)</span>
              <span className="text-[#EF4444] font-bold">~{hydroImpact} m</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelemetryRow;
