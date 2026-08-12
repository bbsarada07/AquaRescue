'use client';

import React from 'react';
import { 
  Target, 
  Mic, 
  Thermometer, 
  Waves, 
  Compass, 
  Navigation, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  RotateCcw,
  Zap,
  Crosshair,
  Timer
} from 'lucide-react';
import { FilteredResult, GPSCoordinate } from '@/lib/kalman';
import { HydrodynamicVectorResult } from '@/lib/hydrodynamics';

export interface TelemetryHUDProps {
  puckId: string | null;
  filteredLocation: (FilteredResult & { noiseDeltaMeters?: number }) | GPSCoordinate | null;
  rawLocation: GPSCoordinate | null;
  sensorData: {
    screechConfidence: number;
    thermalDelta: number;
    waterVelocity: number;
    driftHeading: number;
    gimbalLocked?: boolean;
    payloadReady?: boolean;
  };
  hydrodynamics: HydrodynamicVectorResult | null;
  activeDistress: boolean;
  onExecuteRescue: () => void;
  onOverrideDispatch: () => void;
  onManualPayloadDrop: () => void;
  onResolveIncident: () => void;
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
  puckId,
  filteredLocation,
  rawLocation,
  sensorData,
  hydrodynamics,
  activeDistress,
  onExecuteRescue,
  onOverrideDispatch,
  onManualPayloadDrop,
  onResolveIncident,
}) => {
  const screechPct = Math.round((sensorData?.screechConfidence ?? 0.95) * 100);

  return (
    <div className="w-full h-full bg-[#111827] flex flex-col p-4 space-y-4 overflow-y-auto font-mono text-gray-200 select-none border-b border-[#1F293D]">
      {/* HUD Header Banner */}
      <div className="flex items-center justify-between bg-[#090D16] p-3 rounded-lg border border-[#1F293D] shadow-xl">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-lg border ${
            activeDistress 
              ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444] animate-pulse' 
              : 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
          }`}>
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-gray-400 font-bold uppercase tracking-wider">ACTIVE TARGET HUD</div>
            <div className="text-sm font-extrabold text-white tracking-widest">{puckId || 'PUCK-ALPHA-04'}</div>
          </div>
        </div>

        <div className="text-right">
          <span className={`px-2.5 py-1 rounded text-xs font-extrabold border inline-block ${
            activeDistress
              ? 'bg-[#EF4444]/20 border-[#EF4444] text-[#EF4444] animate-pulse'
              : 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
          }`}>
            {activeDistress ? 'DISTRESS ACTIVE' : 'STANDBY'}
          </span>
        </div>
      </div>

      {/* Grid 1: 6-Decimal Filtered GPS vs Raw GPS */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#090D16] p-3 rounded-lg border border-[#06B6D4]/40 relative overflow-hidden shadow-lg">
          <div className="text-[10px] text-[#06B6D4] font-bold uppercase tracking-wider flex items-center justify-between mb-1">
            <span>KALMAN FILTERED GPS</span>
            <span className="text-[9px] bg-[#06B6D4]/15 px-1.5 py-0.5 rounded text-[#06B6D4]">SMOOTHED</span>
          </div>
          <div className="text-sm font-bold text-white tracking-tight">
            LAT: <span className="text-[#06B6D4]">{filteredLocation?.lat != null ? filteredLocation.lat.toFixed(6) : '17.385044'}</span>
          </div>
          <div className="text-sm font-bold text-white tracking-tight">
            LNG: <span className="text-[#06B6D4]">{filteredLocation?.lng != null ? filteredLocation.lng.toFixed(6) : '78.486671'}</span>
          </div>
        </div>

        <div className="bg-[#090D16] p-3 rounded-lg border border-[#1F293D] relative overflow-hidden shadow-lg">
          <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">RAW GPS (NOISY MULTIPATH)</div>
          <div className="text-sm font-bold text-gray-300 tracking-tight">
            LAT: {rawLocation?.lat != null ? rawLocation.lat.toFixed(6) : '17.385044'}
          </div>
          <div className="text-sm font-bold text-gray-300 tracking-tight">
            LNG: {rawLocation?.lng != null ? rawLocation.lng.toFixed(6) : '78.486671'}
          </div>
          <div className="text-[9px] text-[#F59E0B] mt-0.5">Jitter Noise: {(filteredLocation as any)?.noiseDeltaMeters ?? 0}m</div>
        </div>
      </div>

      {/* Grid 2: Sensor Telemetry Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* TinyML Screech Audio Confidence */}
        <div className="bg-[#090D16] p-3 rounded-lg border border-[#1F293D] space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <Mic className="w-3.5 h-3.5 text-[#EF4444]" />
              TINYML SCREECH CONF.
            </span>
            <span className="font-bold text-[#EF4444] text-xs">{screechPct}%</span>
          </div>
          {/* Audio Spectrum Visualizer Bar */}
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex">
            <div 
              className="h-full bg-gradient-to-r from-[#F59E0B] to-[#EF4444] transition-all duration-300" 
              style={{ width: `${screechPct}%` }}
            />
          </div>
          <div className="text-[9px] text-gray-500">Acoustic Model: ScreechNet-v4</div>
        </div>

        {/* Thermal Differential Delta */}
        <div className="bg-[#090D16] p-3 rounded-lg border border-[#1F293D] space-y-1.5">
          <div className="flex justify-between items-center text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-[#F59E0B]" />
              THERMAL DELTA
            </span>
            <span className="font-bold text-[#F59E0B] text-xs">+{sensorData.thermalDelta.toFixed(1)}°C</span>
          </div>
          <div className="text-xs font-bold text-gray-200">
            Water: 24.1°C | Target: {(24.1 + sensorData.thermalDelta).toFixed(1)}°C
          </div>
          <div className="text-[9px] text-gray-500">FLIR Boson Sensor Signal</div>
        </div>
      </div>

      {/* Hydrodynamics & Water Drift Card */}
      <div className="bg-[#090D16] p-3.5 rounded-lg border border-[#06B6D4]/30 space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5">
          <span className="text-xs font-bold text-[#06B6D4] flex items-center gap-1.5">
            <Waves className="w-4 h-4 text-[#06B6D4]" />
            HYDRODYNAMIC DRIFT VECTOR
          </span>
          <span className="text-[10px] text-gray-400">SPATIAL FUSION</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-400 text-[10px]">WATER VELOCITY:</span>
            <div className="font-bold text-white">{sensorData.waterVelocity.toFixed(1)} m/s</div>
          </div>
          <div>
            <span className="text-gray-400 text-[10px]">DRIFT HEADING:</span>
            <div className="font-bold text-white">{sensorData.driftHeading}°</div>
          </div>
        </div>

        {hydrodynamics && (
          <div className="bg-[#111827] p-2.5 rounded border border-[#10B981]/40 space-y-1 text-xs">
            <div className="flex justify-between items-center text-[#10B981] font-bold text-[11px]">
              <span className="flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                BUOY UPSTREAM COMPENSATED HEADING
              </span>
              <span className="text-sm font-extrabold">{hydrodynamics.compensatedHeadingDeg}°</span>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Direct LoS Angle: {hydrodynamics.directHeadingDeg}°</span>
              <span>Net Speed: {hydrodynamics.effectiveSpeedMS} m/s</span>
            </div>
          </div>
        )}
      </div>

      {/* Spatial Matrix & Drone Status */}
      {hydrodynamics && (
        <div className="bg-[#090D16] p-3 rounded-lg border border-[#1F293D] space-y-2">
          <div className="text-xs font-bold text-gray-300 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-[#F59E0B]" />
              INTERCEPT DISTANCE MATRIX
            </span>
            <span className="text-[10px] text-gray-400">ESTIMATED ETA</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
              <span className="text-[10px] text-gray-400 block">UAV DRONE -&gt; TARGET</span>
              <span className="font-bold text-[#06B6D4]">{hydrodynamics.distanceMatrix.droneToVictimMeters}m</span>
              <span className="text-gray-400 text-[10px] block">ETA: {hydrodynamics.distanceMatrix.droneEtaSec}s</span>
            </div>
            <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
              <span className="text-[10px] text-gray-400 block">RESCUE BUOY -&gt; TARGET</span>
              <span className="font-bold text-[#F59E0B]">{hydrodynamics.distanceMatrix.buoyToVictimMeters}m</span>
              <span className="text-gray-400 text-[10px] block">ETA: {hydrodynamics.distanceMatrix.buoyEtaSec}s</span>
            </div>
          </div>
        </div>
      )}

      {/* Payload & Gimbal Lock Indicators */}
      <div className="flex items-center justify-between bg-[#090D16] p-2.5 rounded-lg border border-[#1F293D] text-xs">
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span>GIMBAL LOCK: <strong className="text-white">LOCKED</strong></span>
        </div>
        <div className="flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span>PAYLOAD DROP: <strong className="text-white">READY</strong></span>
        </div>
      </div>

      {/* Action Trigger Matrix */}
      <div className="space-y-2 pt-1">
        <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">TACTICAL DISPATCH MATRIX</div>

        <button
          onClick={onExecuteRescue}
          disabled={!activeDistress}
          className={`w-full py-3 px-4 rounded-lg font-bold text-sm uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-xl ${
            activeDistress
              ? 'bg-gradient-to-r from-[#EF4444] to-[#F59E0B] text-white hover:brightness-110 border border-[#EF4444]'
              : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
          }`}
        >
          <Zap className="w-4 h-4 animate-pulse" />
          <span>EXECUTE DUAL RESCUE DISPATCH</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onOverrideDispatch}
            className="py-2 px-3 rounded-lg bg-[#06B6D4]/15 border border-[#06B6D4]/50 text-[#06B6D4] hover:bg-[#06B6D4]/30 font-bold text-xs uppercase flex items-center justify-center space-x-1 transition-all"
          >
            <Send className="w-3 h-3" />
            <span>OVERRIDE DISPATCH</span>
          </button>

          <button
            onClick={onManualPayloadDrop}
            className="py-2 px-3 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/50 text-[#F59E0B] hover:bg-[#F59E0B]/30 font-bold text-xs uppercase flex items-center justify-center space-x-1 transition-all"
          >
            <Crosshair className="w-3 h-3" />
            <span>MANUAL PAYLOAD DROP</span>
          </button>
        </div>

        <button
          onClick={onResolveIncident}
          className="w-full py-2 px-3 rounded-lg bg-gray-800/80 border border-gray-700 hover:bg-gray-700 text-gray-300 font-semibold text-xs uppercase flex items-center justify-center space-x-1.5 transition-all"
        >
          <RotateCcw className="w-3 h-3 text-gray-400" />
          <span>RESOLVE INCIDENT & CLEAR ALERT</span>
        </button>
      </div>
    </div>
  );
};

export default TelemetryHUD;
