'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldAlert,
  Clock,
  Radio,
  Navigation,
  Send,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
  Crosshair,
  Compass,
  Waves,
  Cpu,
  Layers,
  Sparkles,
  RefreshCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { FilteredResult, GPSCoordinate, KalmanFilter2D } from '@/lib/kalman';
import { HydrodynamicVectorResult, RESPONDER_SPEEDS } from '@/lib/hydrodynamics';
import { BriefingResponse } from '@/lib/gemini';
import { LogEntry } from '@/lib/socket';
import AIBriefing from './AIBriefing';

const LeafletMapView = dynamic(
  () => import('./LeafletMapView'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#090D16] flex items-center justify-center font-mono text-xs text-[#06B6D4]">
        LOADING MISSION MAP...
      </div>
    ),
  }
);


export interface ActiveMissionOverlayProps {
  missionId: string | null;
  missionStartTime: number | null;
  puckId: string;
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
  droneLocation: GPSCoordinate | null;
  buoyLocation: GPSCoordinate | null;
  responderLocation: GPSCoordinate | null;
  dronePath: GPSCoordinate[];
  buoyPath: GPSCoordinate[];
  responderPath: GPSCoordinate[];
  droneStatus: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  buoyStatus: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  responderStatus: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  predictionWindow: 15 | 30 | 45 | 60;
  setPredictionWindow: (sec: 15 | 30 | 45 | 60) => void;
  aiBriefing: BriefingResponse | null;
  audioVoiceEnabled: boolean;
  eventLogs: LogEntry[];
  isConnected: boolean;
  onExecuteRescue: () => void;
  onOverrideDispatch: () => void;
  onManualPayloadDrop: () => void;
  onResolveIncident: () => void;
  onToggleAudio: () => void;
}

export const ActiveMissionOverlay: React.FC<ActiveMissionOverlayProps> = ({
  missionId,
  missionStartTime,
  puckId,
  filteredLocation,
  rawLocation,
  sensorData,
  hydrodynamics,
  droneLocation,
  buoyLocation,
  responderLocation,
  dronePath,
  buoyPath,
  responderPath,
  droneStatus,
  buoyStatus,
  responderStatus,
  predictionWindow,
  setPredictionWindow,
  aiBriefing,
  audioVoiceEnabled,
  eventLogs,
  isConnected,
  onExecuteRescue,
  onOverrideDispatch,
  onManualPayloadDrop,
  onResolveIncident,
  onToggleAudio,
}) => {
  // ── Mission Elapsed Timer ──────────────────────────────────────────────────
  const [elapsedFormatted, setElapsedFormatted] = useState('00:00 ELAPSED');

  useEffect(() => {
    const updateTimer = () => {
      if (!missionStartTime) {
        setElapsedFormatted('00:00 ELAPSED');
        return;
      }
      const totalSec = Math.floor((Date.now() - missionStartTime) / 1000);
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      setElapsedFormatted(
        `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} ELAPSED`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [missionStartTime]);

  // ── Target Coordinates Format ──────────────────────────────────────────────
  const targetLat = filteredLocation?.lat ?? 17.385044;
  const targetLng = filteredLocation?.lng ?? 78.486671;

  // ── Haversine Distances & ETAs ─────────────────────────────────────────────
  const droneDist = useMemo(() => {
    if (!droneLocation) return 0;
    return KalmanFilter2D.haversineDistanceMeters(
      droneLocation.lat,
      droneLocation.lng,
      targetLat,
      targetLng
    );
  }, [droneLocation, targetLat, targetLng]);

  const buoyDist = useMemo(() => {
    if (!buoyLocation) return 0;
    return KalmanFilter2D.haversineDistanceMeters(
      buoyLocation.lat,
      buoyLocation.lng,
      targetLat,
      targetLng
    );
  }, [buoyLocation, targetLat, targetLng]);

  const responderDist = useMemo(() => {
    if (!responderLocation) return 0;
    return KalmanFilter2D.haversineDistanceMeters(
      responderLocation.lat,
      responderLocation.lng,
      targetLat,
      targetLng
    );
  }, [responderLocation, targetLat, targetLng]);

  const droneEtaSec = Math.round(droneDist / RESPONDER_SPEEDS.DRONE);
  const buoyEtaSec = hydrodynamics?.distanceMatrix?.buoyEtaSec ?? Math.round(buoyDist / RESPONDER_SPEEDS.BUOY);
  const responderEtaSec = Math.round(responderDist / RESPONDER_SPEEDS.HUMAN_TEAM);

  const formatSec = (s: number) => {
    if (s <= 0) return '0s';
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}m ${r}s`;
  };

  // ── Mission Timeline Stages ────────────────────────────────────────────────
  const timelineStages = useMemo(() => {
    const s1Completed = true; // DISTRESS DETECTED
    const s2Completed = !!filteredLocation; // LOCATION LOCKED
    const s3Completed = true; // RESCUE TEAM ALERTED
    const s4Completed = droneStatus !== 'STANDBY'; // DRONE DISPATCHED
    const s5Completed = droneStatus === 'TARGET_REACHED'; // LIFE JACKET DELIVERED
    const s6Completed = buoyStatus !== 'STANDBY'; // BUOY DISPATCHED
    const s7Completed = droneStatus === 'TARGET_REACHED' || buoyStatus === 'TARGET_REACHED'; // VICTIM REACHED
    const s8Completed = responderStatus === 'TARGET_REACHED'; // SAFE DESTINATION

    return [
      {
        id: 1,
        title: 'DISTRESS DETECTED',
        status: s1Completed ? 'COMPLETED' : 'ACTIVE',
      },
      {
        id: 2,
        title: 'LOCATION LOCKED',
        status: s2Completed ? 'COMPLETED' : 'ACTIVE',
      },
      {
        id: 3,
        title: 'TEAM ALERTED',
        status: s3Completed ? 'COMPLETED' : 'ACTIVE',
      },
      {
        id: 4,
        title: 'DRONE DISPATCHED',
        status: s4Completed ? 'COMPLETED' : droneStatus === 'STANDBY' ? 'ACTIVE' : 'PENDING',
      },
      {
        id: 5,
        title: 'PAYLOAD DELIVERED',
        status: s5Completed ? 'COMPLETED' : droneStatus === 'EN_ROUTE' ? 'ACTIVE' : 'PENDING',
      },
      {
        id: 6,
        title: 'BUOY DISPATCHED',
        status: s6Completed ? 'COMPLETED' : buoyStatus === 'STANDBY' ? 'ACTIVE' : 'PENDING',
      },
      {
        id: 7,
        title: 'VICTIM REACHED',
        status: s7Completed ? 'COMPLETED' : (buoyStatus === 'EN_ROUTE' || droneStatus === 'EN_ROUTE') ? 'ACTIVE' : 'PENDING',
      },
      {
        id: 8,
        title: 'SAFE DESTINATION',
        status: s8Completed ? 'COMPLETED' : responderStatus === 'EN_ROUTE' ? 'ACTIVE' : 'PENDING',
      },
    ];
  }, [filteredLocation, droneStatus, buoyStatus, responderStatus]);

  return (
    <div className="fixed inset-0 z-[4000] flex flex-col bg-[#090D16] text-[#F3F4F6] font-mono overflow-hidden animate-mission-slide-in emergency-border-pulse">
      {/* ── 1. ACTIVE MISSION HEADER ───────────────────────────────────────── */}
      <header className="w-full bg-[#111827]/95 border-b border-[#EF4444]/40 px-4 py-2.5 flex items-center justify-between shadow-2xl shrink-0">
        <div className="flex items-center space-x-3">
          {/* Emergency Alert Indicator */}
          <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-[#EF4444]/20 border border-[#EF4444]/60 shadow-[0_0_15px_rgba(239,68,68,0.4)]">
            <Radio className="w-5 h-5 text-[#EF4444] animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EF4444]"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-extrabold tracking-wider text-white uppercase flex items-center gap-2">
                <span className="text-[#EF4444]">ACTIVE RESCUE MISSION</span>
                <span className="text-xs font-bold text-gray-400 bg-gray-800/80 border border-gray-700 px-2 py-0.5 rounded">
                  {missionId || 'MISSION #AR-042'}
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-gray-400 tracking-tight flex items-center space-x-3 mt-0.5">
              <span>TARGET: <strong className="text-white">{puckId || 'PUCK-ALPHA-04'}</strong></span>
              <span>•</span>
              <span>COORDS: <strong className="text-[#06B6D4]">{targetLat.toFixed(6)}, {targetLng.toFixed(6)}</strong></span>
            </p>
          </div>
        </div>

        {/* Center Live Mission Status Badge & Timer */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-[#EF4444]/15 border border-[#EF4444]/50 px-3 py-1 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping" />
            <span className="text-xs font-extrabold text-[#EF4444] tracking-wider">CRITICAL / ACTIVE</span>
          </div>

          <div className="flex items-center space-x-2 bg-[#090D16] border border-[#1F293D] px-3.5 py-1 rounded-lg shadow-inner">
            <Clock className="w-4 h-4 text-[#F59E0B] animate-pulse" />
            <span className="text-sm font-extrabold text-[#F59E0B] tracking-wider font-mono">
              {elapsedFormatted}
            </span>
          </div>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center space-x-2">
          {/* Audio Voice Toggle */}
          <button
            onClick={onToggleAudio}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all border ${
              audioVoiceEnabled
                ? 'bg-[#06B6D4]/15 border-[#06B6D4]/40 text-[#06B6D4]'
                : 'bg-gray-800/60 border-gray-700 text-gray-400'
            }`}
          >
            {audioVoiceEnabled ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{audioVoiceEnabled ? 'VOICE ON' : 'VOICE MUTED'}</span>
          </button>

          {/* Resolve Incident Button */}
          <button
            onClick={onResolveIncident}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded bg-[#10B981] hover:bg-[#10B981]/90 text-black font-extrabold text-xs transition-all shadow-lg border border-[#10B981]"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RESOLVE INCIDENT</span>
          </button>
        </div>
      </header>

      {/* ── MAIN EMERGENCY COMMAND CONTENT ───────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row w-full overflow-hidden">
        {/* ── 2. MAP BECOMES PRIMARY VIEW (70% WIDTH) ───────────────────────── */}
        <div className="w-full lg:w-[70%] h-[55vh] lg:h-full relative border-r border-[#1F293D]">
          <LeafletMapView
            filteredTarget={filteredLocation}
            rawTarget={rawLocation}
            droneLocation={droneLocation}
            buoyLocation={buoyLocation}
            responderLocation={responderLocation}
            dronePath={dronePath}
            buoyPath={buoyPath}
            responderPath={responderPath}
            hydrodynamics={hydrodynamics}
            activeDistress={true}
            puckId={puckId}
            predictionWindow={predictionWindow}
            setPredictionWindow={setPredictionWindow}
            sensorData={sensorData}
            droneStatus={droneStatus}
            buoyStatus={buoyStatus}
            responderStatus={responderStatus}
          />

          {/* Map Overlay Badge */}
          <div className="absolute top-4 right-4 z-[1000] bg-[#090D16]/90 backdrop-blur border border-[#EF4444]/50 rounded-lg p-2 flex items-center space-x-2 text-xs font-mono shadow-2xl pointer-events-auto">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping" />
            <span className="text-white font-bold">TACTICAL MISSION VIEW</span>
          </div>
        </div>

        {/* ── 3 RESPONSE UNIT COMMAND CARDS + AI BRIEFING (30% WIDTH) ───────── */}
        <div className="w-full lg:w-[30%] h-[45vh] lg:h-full bg-[#111827] flex flex-col overflow-y-auto border-l border-[#1F293D] p-3 space-y-3 shadow-2xl">
          <div className="text-xs font-bold text-gray-300 uppercase tracking-wider border-b border-[#1F293D] pb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#06B6D4]" />
              RESPONSE UNIT COMMAND CARDS
            </span>
            <span className="text-[10px] text-[#06B6D4] font-semibold">3 UNITS</span>
          </div>

          {/* ── CARD 1: UAV DRONE ───────────────────────────────────────────── */}
          <div className="bg-[#090D16] p-3 rounded-lg border border-[#06B6D4]/40 space-y-2 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-[#06B6D4] rotate-45" />
                <span className="text-xs font-extrabold text-white">UAV DRONE (RESCUE-01)</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                droneStatus === 'TARGET_REACHED' ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]' :
                droneStatus === 'EN_ROUTE' || droneStatus === 'DISPATCHED' ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4] animate-pulse' :
                'bg-gray-800 border-gray-700 text-gray-400'
              }`}>
                {droneStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">DISTANCE</span>
                <span className="text-white font-bold text-xs">{droneDist.toFixed(0)}m</span>
              </div>
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">EST. ETA</span>
                <span className="text-[#06B6D4] font-bold text-xs">
                  {droneStatus === 'TARGET_REACHED' ? 'REACHED' : formatSec(droneEtaSec)}
                </span>
              </div>
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">GIMBAL</span>
                <span className="text-[#10B981] font-bold">LOCKED (98%)</span>
              </div>
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">PAYLOAD</span>
                <span className="text-[#10B981] font-bold">READY (FLOAT)</span>
              </div>
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                onClick={onManualPayloadDrop}
                className="flex-1 py-1.5 bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 border border-[#06B6D4]/50 text-[#06B6D4] text-[11px] font-bold rounded transition-all flex items-center justify-center gap-1"
              >
                <Zap className="w-3 h-3" />
                PAYLOAD AIR-DROP
              </button>
            </div>
          </div>

          {/* ── CARD 2: AUTONOMOUS RESCUE BUOY ─────────────────────────────── */}
          <div className="bg-[#090D16] p-3 rounded-lg border border-[#F59E0B]/40 space-y-2 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-[#F59E0B] rounded-full" />
                <span className="text-xs font-extrabold text-white">AUTONOMOUS BUOY (HYDRO-02)</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                buoyStatus === 'TARGET_REACHED' ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]' :
                buoyStatus === 'EN_ROUTE' || buoyStatus === 'DISPATCHED' ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B] animate-pulse' :
                'bg-gray-800 border-gray-700 text-gray-400'
              }`}>
                {buoyStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">DISTANCE</span>
                <span className="text-white font-bold text-xs">{buoyDist.toFixed(0)}m</span>
              </div>
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">EST. ETA</span>
                <span className="text-[#F59E0B] font-bold text-xs">
                  {buoyStatus === 'TARGET_REACHED' ? 'REACHED' : formatSec(buoyEtaSec)}
                </span>
              </div>
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">WATER CURRENT</span>
                <span className="text-[#06B6D4] font-bold">{sensorData.waterVelocity} m/s</span>
              </div>
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">DRIFT VECTOR</span>
                <span className="text-[#F59E0B] font-bold">{hydrodynamics ? `${hydrodynamics.compensatedHeadingDeg}°` : `${sensorData.driftHeading}°`}</span>
              </div>
            </div>
          </div>

          {/* ── CARD 3: HUMAN RESCUE TEAM ────────────────────────────────────── */}
          <div className="bg-[#090D16] p-3 rounded-lg border border-[#A78BFA]/40 space-y-2 relative overflow-hidden shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#A78BFA]" />
                <span className="text-xs font-extrabold text-white">RESCUE TEAM (GROUND-01)</span>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                responderStatus === 'TARGET_REACHED' ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]' :
                responderStatus === 'EN_ROUTE' || responderStatus === 'DISPATCHED' ? 'bg-[#A78BFA]/20 border-[#A78BFA] text-[#A78BFA] animate-pulse' :
                'bg-gray-800 border-gray-700 text-gray-400'
              }`}>
                {responderStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">DISTANCE</span>
                <span className="text-white font-bold text-xs">{responderDist.toFixed(0)}m</span>
              </div>
              <div className="bg-[#111827] p-2 rounded border border-[#1F293D]">
                <span className="text-gray-500 block">EST. ETA</span>
                <span className="text-[#A78BFA] font-bold text-xs">
                  {responderStatus === 'TARGET_REACHED' ? 'REACHED' : formatSec(responderEtaSec)}
                </span>
              </div>
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                onClick={onOverrideDispatch}
                className="flex-1 py-1.5 bg-[#A78BFA]/20 hover:bg-[#A78BFA]/30 border border-[#A78BFA]/50 text-[#A78BFA] text-[11px] font-bold rounded transition-all flex items-center justify-center gap-1"
              >
                <Send className="w-3 h-3" />
                OVERRIDE TEAM DISPATCH
              </button>
            </div>
          </div>

          {/* DUAL DISPATCH MASTER BUTTON */}
          <button
            onClick={onExecuteRescue}
            className="w-full py-2.5 bg-gradient-to-r from-[#06B6D4] to-[#10B981] hover:from-[#06B6D4]/90 hover:to-[#10B981]/90 text-black font-extrabold text-xs rounded-lg transition-all shadow-xl flex items-center justify-center gap-2 border border-[#10B981]"
          >
            <Send className="w-4 h-4" />
            EXECUTE DUAL RESCUE DISPATCH
          </button>

          {/* Gemini AI Briefing in Panel */}
          <div className="pt-1">
            <AIBriefing briefing={aiBriefing} audioVoiceEnabled={audioVoiceEnabled} />
          </div>
        </div>
      </div>

      {/* ── 3. LIVE RESCUE MISSION TIMELINE (HORIZONTAL STRIP AT BOTTOM) ────── */}
      <footer className="w-full bg-[#111827] border-t border-[#1F293D] px-4 py-2 flex items-center overflow-x-auto shrink-0 select-none shadow-2xl">
        <div className="flex items-center space-x-1.5 pr-4 border-r border-[#1F293D] shrink-0 text-xs font-bold text-gray-300">
          <Layers className="w-4 h-4 text-[#06B6D4]" />
          <span>MISSION TIMELINE</span>
        </div>

        <div className="flex-1 flex items-center justify-between min-w-[750px] px-4 py-1">
          {timelineStages.map((stage, idx) => (
            <React.Fragment key={stage.id}>
              {/* Stage Node */}
              <div className="flex flex-col items-center space-y-1 relative">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center border text-[9px] font-extrabold transition-all ${
                    stage.status === 'COMPLETED'
                      ? 'bg-[#10B981] border-[#10B981] text-black'
                      : stage.status === 'ACTIVE'
                      ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4] animate-ping-slow'
                      : 'bg-gray-800 border-gray-700 text-gray-500'
                  }`}
                >
                  {stage.status === 'COMPLETED' ? '✓' : stage.id}
                </div>
                <span
                  className={`text-[9px] font-bold tracking-tight text-center whitespace-nowrap ${
                    stage.status === 'COMPLETED'
                      ? 'text-[#10B981]'
                      : stage.status === 'ACTIVE'
                      ? 'text-[#06B6D4]'
                      : 'text-gray-500'
                  }`}
                >
                  {stage.title}
                </span>
              </div>

              {/* Connecting Line between nodes */}
              {idx < timelineStages.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded transition-all ${
                    stage.status === 'COMPLETED' ? 'bg-[#10B981]' : 'bg-gray-800'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </footer>
    </div>
  );
};

export default ActiveMissionOverlay;
