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
