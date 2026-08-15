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
import { FilteredResult, GPSCoordinate, KalmanFilter2D } from '@/lib/kalman';
import { HydrodynamicVectorResult, RESPONDER_SPEEDS } from '@/lib/hydrodynamics';

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
  predictionWindow?: number;
  setPredictionWindow?: (sec: 15 | 30 | 45 | 60) => void;
  isConnected?: boolean;
  droneLocation?: GPSCoordinate | null;
  buoyLocation?: GPSCoordinate | null;
  responderLocation?: GPSCoordinate | null;
  droneStatus?: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  buoyStatus?: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  responderStatus?: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
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
  predictionWindow = 30,
  setPredictionWindow,
  isConnected = true,
  droneLocation = null,
  buoyLocation = null,
  responderLocation = null,
  droneStatus = 'STANDBY',
  buoyStatus = 'STANDBY',
  responderStatus = 'STANDBY',
}) => {
  const screechPct = Math.round((sensorData?.screechConfidence ?? 0.95) * 100);

  // ── Live ETA Computations ─────────────────────────────────────────────────
  const target = filteredLocation;
  const hasTarget = activeDistress && target != null;

  const droneDist = hasTarget && droneLocation
    ? KalmanFilter2D.haversineDistanceMeters(droneLocation.lat, droneLocation.lng, target.lat, target.lng)
    : null;
  const buoyDist = hasTarget && buoyLocation
    ? KalmanFilter2D.haversineDistanceMeters(buoyLocation.lat, buoyLocation.lng, target.lat, target.lng)
    : null;
  const responderDist = hasTarget && responderLocation
    ? KalmanFilter2D.haversineDistanceMeters(responderLocation.lat, responderLocation.lng, target.lat, target.lng)
    : null;

  // Buoy uses drift-compensated ETA from hydrodynamics if available, else straight-line
  const droneEtaSec  = droneDist != null     ? Math.round(droneDist / RESPONDER_SPEEDS.DRONE)      : null;
  const buoyEtaSec   = hydrodynamics?.distanceMatrix?.buoyEtaSec != null
    ? hydrodynamics.distanceMatrix.buoyEtaSec
    : buoyDist != null ? Math.round(buoyDist / RESPONDER_SPEEDS.BUOY) : null;
  const responderEtaSec = responderDist != null ? Math.round(responderDist / RESPONDER_SPEEDS.HUMAN_TEAM) : null;

  const formatEta = (sec: number | null): string => {
    if (sec === null) return '—';
    if (sec < 60) return `${sec}s`;
    return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  };

  // Determine fastest available responder (by live ETA)
  const etaEntries: { label: string; eta: number; status: string }[] = [];
  if (droneEtaSec != null && droneStatus !== 'OFFLINE' && droneStatus !== 'TARGET_REACHED')   etaEntries.push({ label: 'DRONE',     eta: droneEtaSec,     status: droneStatus ?? 'STANDBY' });
  if (buoyEtaSec  != null && buoyStatus  !== 'OFFLINE' && buoyStatus  !== 'TARGET_REACHED')   etaEntries.push({ label: 'BUOY',      eta: buoyEtaSec,      status: buoyStatus  ?? 'STANDBY' });
  if (responderEtaSec != null && responderStatus !== 'OFFLINE' && responderStatus !== 'TARGET_REACHED') etaEntries.push({ label: 'TEAM',  eta: responderEtaSec, status: responderStatus ?? 'STANDBY' });
  const fastestLabel = etaEntries.length > 0
    ? etaEntries.sort((a, b) => a.eta - b.eta)[0].label
    : null;

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
            <div className="font-bold text-white">{sensorData?.waterVelocity != null ? `${sensorData.waterVelocity.toFixed(1)} m/s` : 'N/A'}</div>
          </div>
          <div>
            <span className="text-gray-400 text-[10px]">DRIFT HEADING:</span>
            <div className="font-bold text-white">{sensorData?.driftHeading != null ? `${sensorData.driftHeading}°` : 'N/A'}</div>
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

      {/* Predictive Drift Section */}
      {activeDistress && (
        <div className="bg-[#090D16] p-3.5 rounded-lg border border-[#06B6D4]/30 space-y-2.5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5">
            <span className="text-xs font-bold text-[#06B6D4] flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-[#06B6D4]" />
              PREDICTIVE DRIFT IMPACT ZONE
            </span>
            <span className="text-[10px] text-gray-400">DECISION SUPPORT</span>
          </div>

          <div className="space-y-2 text-xs">
            {!isConnected && (
              <div className="bg-[#EF4444]/15 border border-[#EF4444]/30 rounded p-2 text-[10px] text-[#EF4444] font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 animate-pulse" />
                <span>OFFLINE MODE - LAST KNOWN TELEMETRY EST.</span>
              </div>
            )}

            {sensorData?.waterVelocity === undefined || sensorData?.waterVelocity === null ? (
              <div className="text-[#F59E0B] font-bold text-center py-2 bg-gray-900/50 rounded border border-dashed border-[#F59E0B]/30">
                DRIFT MODEL: WAITING FOR CURRENT DATA
              </div>
            ) : sensorData?.driftHeading === undefined || sensorData?.driftHeading === null ? (
              <div className="text-[#EF4444] font-bold text-center py-2 bg-gray-900/50 rounded border border-dashed border-[#EF4444]/30">
                DRIFT VECTOR: UNAVAILABLE
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-b border-[#1F293D]/50 pb-2">
                  <div>
                    <span className="text-gray-400 text-[10px] block">CURRENT:</span>
                    <span className="font-bold text-white">
                      {sensorData.waterVelocity.toFixed(1)} m/s
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] block">HEADING:</span>
                    <span className="font-bold text-white">{sensorData.driftHeading}°</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] block">WINDOW:</span>
                    <span className="font-bold text-[#06B6D4]">{predictionWindow} sec</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[10px] block">ESTIMATED DRIFT:</span>
                    <span className="font-bold text-white">~{(sensorData.waterVelocity * predictionWindow).toFixed(1)} m</span>
                  </div>
                </div>

                <div className="bg-[#111827] p-2.5 rounded border border-[#06B6D4]/20 text-[10px] space-y-1 text-gray-400">
                  <div className="flex justify-between">
                    <span>PROJECTED POSITION:</span>
                    <span className="font-mono text-white">Estimated Downstream</span>
                  </div>
                  <div className="flex justify-between">
                    <span>UNCERTAINTY CORRIDOR:</span>
                    <span className="font-mono text-[#06B6D4]">
                      {((4 + 0.2 * predictionWindow + 0.08 * (sensorData.waterVelocity * predictionWindow)) * 2).toFixed(1)}m Max Width
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>CONFIDENCE:</span>
                    <span className="font-mono text-[#F59E0B] uppercase tracking-wider font-bold">SIMULATED MODEL</span>
                  </div>
                </div>

                {/* Prediction Window Selector Control */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">PREDICTOR WINDOW:</span>
                  <div className="flex space-x-1.5">
                    {([15, 30, 45, 60] as const).map((sec) => (
                      <button
                        key={sec}
                        onClick={() => setPredictionWindow && setPredictionWindow(sec)}
                        className={`px-2 py-0.5 text-[10px] font-mono rounded font-bold transition-all border ${
                          predictionWindow === sec
                            ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                            : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-white'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[9px] text-gray-500 italic leading-snug pt-1 border-t border-[#1F293D]/30 mt-1">
                  * Note: This is a simplified first-order drift prediction model. Real deployments incorporate measured currents, wind, obstacles, bathymetry and other environmental variables.
                </div>
              </>
            )}
          </div>
        </div>
      )}

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

      {/* ── RESCUE RESPONSE ETA ENGINE ─────────────────────────────────── */}
      <div className="bg-[#090D16] p-3.5 rounded-lg border border-[#10B981]/30 space-y-2.5">
        <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5">
          <span className="text-xs font-bold text-[#10B981] flex items-center gap-1.5">
            <Timer className="w-4 h-4 text-[#10B981]" />
            RESCUE RESPONSE ETA
          </span>
          <span className="text-[10px] text-gray-400">PROJECTED ARRIVAL</span>
        </div>

        {!hasTarget ? (
          <div className="text-[11px] text-gray-500 italic text-center py-2">Awaiting distress event...</div>
        ) : (
          <>
            {/* Drone Row */}
            {(()=> {
              const isFastest = fastestLabel === 'DRONE';
              const reached   = droneStatus === 'TARGET_REACHED';
              const offline   = droneStatus === 'OFFLINE';
              const stale     = !isConnected;
              return (
                <div className={`p-2.5 rounded border text-xs ${
                  reached  ? 'bg-[#10B981]/10 border-[#10B981]/50' :
                  offline  ? 'bg-gray-800/30 border-gray-700' :
                  isFastest? 'bg-[#10B981]/10 border-[#10B981]/60' :
                             'bg-[#111827] border-[#1F293D]'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold text-[11px] flex items-center gap-1 ${
                      reached ? 'text-[#10B981]' : offline ? 'text-gray-500' : isFastest ? 'text-[#10B981]' : 'text-[#06B6D4]'
                    }`}>
                      <Navigation className="w-3 h-3" />
                      UAV-RESCUE-01
                      {isFastest && !reached && !offline && (
                        <span className="ml-1 text-[9px] bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] px-1 py-0.5 rounded">FASTEST</span>
                      )}
                    </span>
                    <span className={`text-[10px] font-bold ${
                      reached ? 'text-[#10B981]' : offline ? 'text-gray-500' : stale ? 'text-[#F59E0B]' : 'text-gray-400'
                    }`}>
                      {reached ? 'TARGET REACHED' : offline ? 'OFFLINE' : stale ? 'STALE TELEMETRY' : droneStatus}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-[10px]">
                    <span>DIST: <span className="text-white font-bold">{droneDist != null ? `${Math.round(droneDist)}m` : '—'}</span></span>
                    <span>EST. ETA: <span className={`font-bold ${
                      reached ? 'text-[#10B981]' : isFastest ? 'text-[#10B981]' : 'text-gray-200'
                    }`}>{reached ? '0s' : formatEta(droneEtaSec)}</span></span>
                  </div>
                </div>
              );
            })()}

            {/* Buoy Row */}
            {(()=> {
              const isFastest = fastestLabel === 'BUOY';
              const reached   = buoyStatus === 'TARGET_REACHED';
              const offline   = buoyStatus === 'OFFLINE';
              const stale     = !isConnected;
              return (
                <div className={`p-2.5 rounded border text-xs ${
                  reached  ? 'bg-[#10B981]/10 border-[#10B981]/50' :
                  offline  ? 'bg-gray-800/30 border-gray-700' :
                  isFastest? 'bg-[#10B981]/10 border-[#10B981]/60' :
                             'bg-[#111827] border-[#1F293D]'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold text-[11px] flex items-center gap-1 ${
                      reached ? 'text-[#10B981]' : offline ? 'text-gray-500' : isFastest ? 'text-[#10B981]' : 'text-[#F59E0B]'
                    }`}>
                      <Waves className="w-3 h-3" />
                      BUOY-HYDRO-02
                      {isFastest && !reached && !offline && (
                        <span className="ml-1 text-[9px] bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] px-1 py-0.5 rounded">FASTEST</span>
                      )}
                    </span>
                    <span className={`text-[10px] font-bold ${
                      reached ? 'text-[#10B981]' : offline ? 'text-gray-500' : stale ? 'text-[#F59E0B]' : 'text-gray-400'
                    }`}>
                      {reached ? 'TARGET REACHED' : offline ? 'OFFLINE' : stale ? 'STALE TELEMETRY' : buoyStatus}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-[10px]">
                    <span>DIST: <span className="text-white font-bold">{buoyDist != null ? `${Math.round(buoyDist)}m` : '—'}</span></span>
                    <span>SIMULATED ETA: <span className={`font-bold ${
                      reached ? 'text-[#10B981]' : isFastest ? 'text-[#10B981]' : 'text-gray-200'
                    }`}>{reached ? '0s' : formatEta(buoyEtaSec)}</span></span>
                  </div>
                </div>
              );
            })()}

            {/* Human Responder Row */}
            {(()=> {
              const isFastest = fastestLabel === 'TEAM';
              const reached   = responderStatus === 'TARGET_REACHED';
              const offline   = responderStatus === 'OFFLINE';
              const stale     = !isConnected;
              return (
                <div className={`p-2.5 rounded border text-xs ${
                  reached  ? 'bg-[#10B981]/10 border-[#10B981]/50' :
                  offline  ? 'bg-gray-800/30 border-gray-700' :
                  isFastest? 'bg-[#10B981]/10 border-[#10B981]/60' :
                             'bg-[#111827] border-[#1F293D]'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold text-[11px] flex items-center gap-1 ${
                      reached ? 'text-[#10B981]' : offline ? 'text-gray-500' : isFastest ? 'text-[#10B981]' : 'text-[#A78BFA]'
                    }`}>
                      <Send className="w-3 h-3" />
                      RESCUE TEAM-01
                      {isFastest && !reached && !offline && (
                        <span className="ml-1 text-[9px] bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] px-1 py-0.5 rounded">FASTEST</span>
                      )}
                    </span>
                    <span className={`text-[10px] font-bold ${
                      reached ? 'text-[#10B981]' : offline ? 'text-gray-500' : stale ? 'text-[#F59E0B]' : 'text-gray-400'
                    }`}>
                      {reached ? 'TARGET REACHED' : offline ? 'OFFLINE' : stale ? 'STALE TELEMETRY' : responderStatus}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-[10px]">
                    <span>DIST: <span className="text-white font-bold">{responderDist != null ? `${Math.round(responderDist)}m` : '—'}</span></span>
                    <span>EST. ETA: <span className={`font-bold ${
                      reached ? 'text-[#10B981]' : isFastest ? 'text-[#10B981]' : 'text-gray-200'
                    }`}>{reached ? '0s' : formatEta(responderEtaSec)}</span></span>
                  </div>
                </div>
              );
            })()}

            {/* Recommended First Response Banner */}
            {fastestLabel && (
              <div className="bg-[#10B981]/10 border border-[#10B981]/40 rounded p-2 text-[10px] text-[#10B981] font-bold flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>
                  RECOMMENDED FIRST RESPONSE:{' '}
                  <span className="text-white">
                    {fastestLabel === 'DRONE' ? 'UAV-RESCUE-01' : fastestLabel === 'BUOY' ? 'BUOY-HYDRO-02' : 'RESCUE TEAM-01'}
                  </span>
                </span>
              </div>
            )}
          </>
        )}
      </div>

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
