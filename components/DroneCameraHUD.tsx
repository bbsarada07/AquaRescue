'use client';

import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  Flame, 
  Moon, 
  Crosshair, 
  Battery, 
  Compass, 
  ArrowUp, 
  Zap, 
  ShieldCheck, 
  CheckCircle2, 
  Radio,
  Video
} from 'lucide-react';
import { runMLTargetAnalysis, TargetDetectionResult } from '@/lib/mlEngine';
import { GPSCoordinate } from '@/lib/kalman';

export interface DroneCameraHUDProps {
  puckId: string | null;
  activeDistress: boolean;
  droneStatus?: string;
  droneLocation?: GPSCoordinate | null;
  thermalDelta?: number;
  screechConfidence?: number;
  elapsedSeconds?: number;
  onManualPayloadDrop: () => void;
}

export type ViewMode = 'RGB' | 'THERMAL' | 'IR';

export const DroneCameraHUD: React.FC<DroneCameraHUDProps> = ({
  puckId,
  activeDistress,
  droneStatus = 'STANDBY',
  droneLocation = null,
  thermalDelta = 5.2,
  screechConfidence = 0.96,
  elapsedSeconds = 24,
  onManualPayloadDrop,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('RGB');
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [deploySuccess, setDeploySuccess] = useState<boolean>(false);
  const [altitude, setAltitude] = useState<number>(42.8);
  const [heading, setHeading] = useState<number>(214);
  const [battery, setBattery] = useState<number>(88);

  // Simulated flight telemetry jitter
  useEffect(() => {
    const interval = setInterval(() => {
      setAltitude((prev) => +(prev + (Math.random() - 0.5) * 0.4).toFixed(1));
      setHeading((prev) => (prev + Math.floor(Math.random() * 3) - 1 + 360) % 360);
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  // Run ML DRI Target Analysis Engine
  const driResult: TargetDetectionResult = runMLTargetAnalysis({
    droneLocation: droneLocation || { lat: 17.387544, lng: 78.489171 },
    altitudeMeters: altitude,
    gimbalPitchDeg: 45,
    headingDeg: heading,
    thermalDeltaC: thermalDelta,
    screechConfidence,
    elapsedSeconds,
    activeDistress,
  }, puckId || 'PUCK-ALPHA-04');

  const handlePayloadDeploy = () => {
    if (isDeploying || deploySuccess) return;
    setIsDeploying(true);
    onManualPayloadDrop();

    setTimeout(() => {
      setIsDeploying(false);
      setDeploySuccess(true);
      setTimeout(() => {
        setDeploySuccess(false);
      }, 5000);
    }, 1500);
  };

  return (
    <div className="w-full bg-[#090D16] border border-[#1F293D] rounded-lg p-3 space-y-3 font-mono text-gray-200 select-none shadow-2xl">
      {/* Top Title & Battery Header */}
      <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded bg-[#06B6D4]/15 border border-[#06B6D4]/40 text-[#06B6D4]">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-white tracking-wider flex items-center gap-1.5">
              <span>UAV OPTICAL & THERMAL HUD</span>
              <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping inline-block" />
            </div>
            <div className="text-[9px] text-gray-400">FLIR BOSON 640 x 512 | 60 FPS</div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-[10px]">
          <div className="flex items-center space-x-1 text-[#10B981]">
            <Battery className="w-3.5 h-3.5" />
            <span className="font-bold">{battery}%</span>
          </div>
          <div className="flex items-center space-x-1 text-[#06B6D4]">
            <Compass className="w-3.5 h-3.5" />
            <span className="font-bold">{heading}° NW</span>
          </div>
          <div className="flex items-center space-x-1 text-[#F59E0B]">
            <ArrowUp className="w-3.5 h-3.5" />
            <span className="font-bold">{altitude}m</span>
          </div>
        </div>
      </div>

      {/* Main Tactical Video Feed Frame */}
      <div className={`relative w-full h-48 rounded border overflow-hidden transition-colors duration-500 ${
        viewMode === 'THERMAL' 
          ? 'bg-gradient-to-br from-[#0c0414] via-[#24061a] to-[#0d1624] border-[#F59E0B]/50'
          : viewMode === 'IR'
          ? 'bg-gradient-to-b from-[#021d0d] via-[#043317] to-[#011409] border-[#10B981]/50'
          : 'bg-gradient-to-b from-[#060c18] via-[#09152a] to-[#040810] border-[#06B6D4]/50'
      }`}>
        {/* Scanlines visual overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[size:100%_4px] pointer-events-none z-10" />

        {/* Dynamic Simulated Background Water/Heat Pattern */}
        {viewMode === 'THERMAL' && (
          <div className="absolute inset-0 opacity-40 mix-blend-screen bg-[radial-gradient(circle_at_50%_50%,#f97316_0%,#dc2626_25%,#4c0519_60%,transparent_100%)] animate-pulse" />
        )}
        {viewMode === 'IR' && (
          <div className="absolute inset-0 opacity-30 mix-blend-screen bg-[radial-gradient(circle_at_50%_50%,#22c55e_0%,#15803d_30%,transparent_80%)]" />
        )}

        {/* Tactical Crosshair Overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Center Reticle */}
            <div className={`w-8 h-8 border rounded-full flex items-center justify-center ${
              activeDistress 
                ? viewMode === 'IR' ? 'border-[#22c55e]' : viewMode === 'THERMAL' ? 'border-[#f97316]' : 'border-[#EF4444] animate-ping'
                : 'border-[#06B6D4]'
            }`}>
              <div className="w-1 h-1 rounded-full bg-white" />
            </div>
            {/* Crosshair Lines */}
            <div className="absolute top-0 w-0.5 h-6 bg-white/40" />
            <div className="absolute bottom-0 w-0.5 h-6 bg-white/40" />
            <div className="absolute left-0 h-0.5 w-6 bg-white/40" />
            <div className="absolute right-0 h-0.5 w-6 bg-white/40" />
          </div>
        </div>

        {/* DRI Bounding Box Overlay over Simulated Target */}
        {activeDistress && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-24 border-2 border-dashed border-[#EF4444] rounded bg-[#EF4444]/10 pointer-events-none z-20 flex flex-col justify-between p-1 animate-pulse">
            <div className="flex justify-between items-center text-[8px] bg-[#EF4444] text-white px-1 py-0.5 font-bold rounded-sm">
              <span>LOCK: {driResult.targetId}</span>
              <span>{(driResult.confidenceScore * 100).toFixed(1)}%</span>
            </div>
            <div className="text-[8px] font-extrabold text-white bg-black/80 px-1 py-0.5 rounded text-center tracking-tight flex justify-between">
              <span>{driResult.detectionType}</span>
              <span className="text-[#00FF88] font-bold">STAGE: {driResult.driStage}</span>
            </div>
          </div>
        )}

        {/* Corner HUD Telemetry Overlays */}
        <div className="absolute top-2 left-2 z-20 text-[9px] font-mono space-y-0.5 bg-black/60 px-2 py-1 rounded border border-white/10">
          <div className="text-gray-300">PITCH: +0.4° | ROLL: -0.1°</div>
          <div className="text-[#06B6D4]">GEOREF DIST: {driResult.georeferenceDistanceMeters.toFixed(1)}m</div>
        </div>

        <div className="absolute top-2 right-2 z-20 text-[9px] font-mono space-y-0.5 bg-black/60 px-2 py-1 rounded border border-white/10 text-right">
          <div className="text-gray-300">MODE: {viewMode}</div>
          <div className={activeDistress ? 'text-[#EF4444] font-bold animate-pulse' : 'text-[#10B981]'}>
            {activeDistress ? `DRI: ${driResult.driStage}` : 'SCANNING CORRIDOR'}
          </div>
        </div>

        {/* Bottom Feed Status Banner */}
        <div className="absolute bottom-2 left-2 right-2 z-20 flex items-center justify-between text-[9px] font-mono bg-black/75 px-2.5 py-1 rounded border border-white/10">
          <span className="text-gray-300">PUCK: <strong className="text-white">{puckId || 'PUCK-ALPHA-04'}</strong></span>
          <span className="text-gray-400">GPS: <strong className="text-[#00FF88]">{driResult.computedGPS.lat.toFixed(6)}, {driResult.computedGPS.lng.toFixed(6)}</strong></span>
        </div>
      </div>

      {/* DRI (Detection, Recognition, Identification) Status Banner */}
      <div className="bg-[#090D16] p-2.5 rounded border border-[#1F293D] flex items-center justify-between text-[10px]">
        <div className="flex items-center space-x-2">
          <ShieldCheck className={`w-4 h-4 ${activeDistress ? 'text-[#EF4444] animate-pulse' : 'text-[#10B981]'}`} />
          <div>
            <div className="text-gray-400 font-bold uppercase">DRI TARGET ANALYSIS SYSTEM</div>
            <div className="text-white font-extrabold text-xs flex items-center gap-2">
              <span>{activeDistress ? `TARGET LOCKED: ${driResult.detectionType} — ${(driResult.confidenceScore * 100).toFixed(1)}%` : 'NOMINAL — NO DISTRESS PATTERN'}</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold ${
                driResult.distressSeverityIndex === 'CRITICAL' ? 'bg-[#FF3366]/20 border border-[#FF3366] text-[#FF3366]' : 'bg-[#FFB000]/20 border border-[#FFB000] text-[#FFB000]'
              }`}>
                {driResult.distressSeverityIndex}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-1.5 font-mono text-[9px]">
          <span className={`px-1.5 py-0.5 rounded font-bold border ${
            driResult.driStage === 'DETECTION' ? 'bg-[#00FF88]/20 border-[#00FF88] text-[#00FF88] animate-pulse' : 'bg-gray-800 text-gray-400 border-gray-700'
          }`}>DETECTION</span>
          <span className={`px-1.5 py-0.5 rounded font-bold border ${
            driResult.driStage === 'RECOGNITION' ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4] animate-pulse' : 'bg-gray-800 text-gray-400 border-gray-700'
          }`}>RECOGNITION</span>
          <span className={`px-1.5 py-0.5 rounded font-bold border ${
            driResult.driStage === 'IDENTIFICATION' ? 'bg-[#FFB000]/20 border-[#FFB000] text-[#FFB000] animate-pulse' : 'bg-gray-800 text-gray-400 border-gray-700'
          }`}>IDENTIFICATION</span>
        </div>
      </div>

      {/* Multi-Spectral View Toggles & Payload Release Action Row */}
      <div className="flex items-center justify-between gap-2 pt-1">
        {/* Spectral View Mode Selectors */}
        <div className="flex items-center space-x-1 bg-[#111827] p-1 rounded border border-[#1F293D]">
          <button
            onClick={() => setViewMode('RGB')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-all ${
              viewMode === 'RGB'
                ? 'bg-[#06B6D4] text-black font-extrabold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>RGB OPTICAL</span>
          </button>

          <button
            onClick={() => setViewMode('THERMAL')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-all ${
              viewMode === 'THERMAL'
                ? 'bg-[#F59E0B] text-black font-extrabold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span>FLIR THERMAL</span>
          </button>

          <button
            onClick={() => setViewMode('IR')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded flex items-center gap-1 transition-all ${
              viewMode === 'IR'
                ? 'bg-[#10B981] text-black font-extrabold'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Moon className="w-3 h-3" />
            <span>NIGHT IR</span>
          </button>
        </div>

        {/* Tactical One-Click Payload Release Button */}
        <button
          onClick={handlePayloadDeploy}
          disabled={isDeploying}
          className={`px-3 py-1.5 rounded-md font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all shadow-lg border ${
            deploySuccess
              ? 'bg-[#10B981] border-[#10B981] text-black'
              : isDeploying
              ? 'bg-[#F59E0B] border-[#F59E0B] text-black animate-pulse'
              : 'bg-gradient-to-r from-[#EF4444] to-[#F59E0B] border-[#EF4444] text-white hover:brightness-125'
          }`}
        >
          {deploySuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>VEST DROPPED!</span>
            </>
          ) : isDeploying ? (
            <>
              <Zap className="w-3.5 h-3.5 animate-spin" />
              <span>DROPPING...</span>
            </>
          ) : (
            <>
              <Crosshair className="w-3.5 h-3.5" />
              <span>DEPLOY LIFE VEST</span>
            </>
          )}
        </button>
      </div>

      {/* Deployment Banner Toast */}
      {deploySuccess && (
        <div className="bg-[#10B981]/20 border border-[#10B981] text-[#10B981] text-[10px] font-bold p-2 rounded flex items-center justify-between animate-fade-in">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PAYLOAD RELEASE CONFIRMED - LIFE VEST DROPPED AT TARGET GPS
          </span>
          <span className="text-white font-mono">LAT: 17.385044</span>
        </div>
      )}
    </div>
  );
};

export default DroneCameraHUD;
