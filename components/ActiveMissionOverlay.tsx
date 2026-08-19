'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Activity,
  Bot,
  Flame,
  LocateFixed,
  MapPinned,
  Mic,
  Navigation,
  RefreshCw,
  Send,
  ShieldAlert,
  UserRound,
  Waves,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Video,
} from 'lucide-react';
import { FilteredResult, GPSCoordinate, KalmanFilter2D } from '@/lib/kalman';
import { HydrodynamicVectorResult, RESPONDER_SPEEDS, calculateBearingDeg } from '@/lib/hydrodynamics';
import { BriefingResponse } from '@/lib/gemini';
import { LogEntry } from '@/lib/socket';
import AIBriefing from './AIBriefing';
import DroneCameraFeed, { DroneCameraMode } from './DroneCameraFeed';
import { Sidebar } from './Sidebar';
import { TelemetryRow } from './TelemetryRow';
import { IncidentTimeline } from './IncidentTimeline';
import {
  CRITICAL_PANEL_IDS,
  cloneLayoutMap,
  DEFAULT_PANEL_LAYOUTS,
  PANEL_ORDER,
  PanelId,
  PanelLayoutMap,
  PRESET_LAYOUTS,
  WorkspacePreset,
} from '@/lib/panelWorkspace';

// ── Dynamic Map Import (SSR-safe) ──────────────────────────────────────────
const LeafletMapView = dynamic(
  () => import('./LeafletMapView'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#090D16] flex items-center justify-center font-mono text-xs text-[#06B6D4]">
        LOADING INCIDENT MAP...
      </div>
    ),
  }
);

const STORAGE_KEY = 'aquarescue.workspace.v3';

// ── Props Interface ────────────────────────────────────────────────────────
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

// ── Helpers ────────────────────────────────────────────────────────────────
const isPreset = (v: string): v is WorkspacePreset =>
  v === 'COMMAND' || v === 'RESCUE' || v === 'DRONE' || v === 'FULL_TACTICAL';

const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const formatEtaClock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

// ── Panel Card Wrapper ─────────────────────────────────────────────────────
interface PanelCardProps {
  title: string;
  icon: React.ReactNode;
  headerColor?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const PanelCard: React.FC<PanelCardProps> = ({
  title,
  icon,
  headerColor = '#4B5563',
  badge,
  children,
  className = '',
}) => (
  <div className={`bg-[#0C1523] border border-[#1A2840] rounded-lg overflow-hidden flex-shrink-0 ${className}`}>
    <div
      className="px-3 py-2 border-b border-[#1A2840] flex items-center gap-2"
      style={{ background: 'rgba(8,13,22,0.9)' }}
    >
      <span style={{ color: headerColor, display: 'flex', alignItems: 'center' }}>{icon}</span>
      <span
        className="text-[9px] font-bold tracking-[0.15em] uppercase"
        style={{ color: headerColor === '#4B5563' ? '#4B5563' : headerColor }}
      >
        {title}
      </span>
      {badge && <div className="ml-auto flex items-center">{badge}</div>}
    </div>
    <div className="p-3">{children}</div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────
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
  // ── State ────────────────────────────────────────────────────────────────
  const [cameraMode, setCameraMode] = useState<DroneCameraMode>('RGB');
  const [elapsed, setElapsed] = useState('00:00');
  const [panels, setPanels] = useState<PanelLayoutMap>(() => cloneLayoutMap(DEFAULT_PANEL_LAYOUTS));
  const [activePreset, setActivePreset] = useState<WorkspacePreset>('FULL_TACTICAL');
  const [emergencyFocusMode, setEmergencyFocusMode] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [timeIst, setTimeIst] = useState('');
  const [timeUtc, setTimeUtc] = useState('');

  // ── Mission Elapsed Timer ────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      if (!missionStartTime) { setElapsed('00:00'); return; }
      const totalSec = Math.max(0, Math.floor((Date.now() - missionStartTime) / 1000));
      setElapsed(formatEtaClock(totalSec));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [missionStartTime]);

  // ── Header Clocks ────────────────────────────────────────────────────────
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + ' UTC');
      setTimeIst(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' IST'
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  // ── Workspace Persistence ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const payload = localStorage.getItem(STORAGE_KEY);
      if (!payload) return;
      const parsed = JSON.parse(payload) as { preset?: string; emergencyFocusMode?: boolean };
      if (parsed.preset && isPreset(parsed.preset)) setActivePreset(parsed.preset);
      if (typeof parsed.emergencyFocusMode === 'boolean') setEmergencyFocusMode(parsed.emergencyFocusMode);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ preset: activePreset, emergencyFocusMode }));
  }, [activePreset, emergencyFocusMode]);

  // ── Computed Positions & Distances ───────────────────────────────────────
  const targetLat = filteredLocation?.lat ?? 17.385044;
  const targetLng = filteredLocation?.lng ?? 78.486671;

  const droneDist = useMemo(
    () => (droneLocation ? KalmanFilter2D.haversineDistanceMeters(droneLocation.lat, droneLocation.lng, targetLat, targetLng) : 0),
    [droneLocation, targetLat, targetLng]
  );
  const buoyDist = useMemo(
    () => (buoyLocation ? KalmanFilter2D.haversineDistanceMeters(buoyLocation.lat, buoyLocation.lng, targetLat, targetLng) : 0),
    [buoyLocation, targetLat, targetLng]
  );
  const responderDist = useMemo(
    () => (responderLocation ? KalmanFilter2D.haversineDistanceMeters(responderLocation.lat, responderLocation.lng, targetLat, targetLng) : 0),
    [responderLocation, targetLat, targetLng]
  );

  const droneEta = Math.round(droneDist / RESPONDER_SPEEDS.DRONE);
  const buoyEta = hydrodynamics?.distanceMatrix?.buoyEtaSec ?? Math.round(buoyDist / RESPONDER_SPEEDS.BUOY);
  const responderEta = Math.round(responderDist / RESPONDER_SPEEDS.HUMAN_TEAM);

  const droneHeading = useMemo(() => {
    if (dronePath.length > 1) {
      const prev = dronePath[dronePath.length - 2];
      const cur = dronePath[dronePath.length - 1];
      return calculateBearingDeg(prev, cur);
    }
    return hydrodynamics?.directHeadingDeg ?? 0;
  }, [dronePath, hydrodynamics]);

  const detectionConfidence = clampPct(
    ((sensorData.screechConfidence || 0.9) * 70) + (Math.min(sensorData.thermalDelta / 7, 1) * 30)
  );
  const recognitionConfidence = clampPct(
    ((sensorData.screechConfidence || 0.9) * 65) + (Math.min(sensorData.thermalDelta / 8, 1) * 35)
  );
  const riskConfidence = clampPct(
    ((sensorData.screechConfidence || 0.9) * 55) + (Math.min(sensorData.waterVelocity / 3, 1) * 45)
  );

  // ── Derived State ────────────────────────────────────────────────────────
  const visiblePanels = useMemo(() => {
    const result = {} as Record<PanelId, boolean>;
    for (const id of PANEL_ORDER) result[id] = panels[id].visible;
    return result;
  }, [panels]);

  // Map / right-panel width split per workspace view
  const { mapWidthClass, rightWidthClass } = useMemo(() => {
    switch (activePreset) {
      case 'DRONE':         return { mapWidthClass: 'w-[38%]', rightWidthClass: 'w-[62%]' };
      case 'FULL_TACTICAL': return { mapWidthClass: 'w-[50%]', rightWidthClass: 'w-[50%]' };
      default:              return { mapWidthClass: 'w-[60%]', rightWidthClass: 'w-[40%]' };
    }
  }, [activePreset]);

  // ── Callbacks ────────────────────────────────────────────────────────────
  const updatePanel = useCallback((id: PanelId, patch: Partial<PanelLayoutMap[PanelId]>) => {
    setPanels(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const togglePanelVisibility = useCallback((panelId: PanelId) => {
    updatePanel(panelId, { visible: !panels[panelId].visible });
  }, [panels, updatePanel]);

  const applyPreset = useCallback((preset: WorkspacePreset) => {
    setActivePreset(preset);
    setEmergencyFocusMode(false);
    setPanels(cloneLayoutMap(PRESET_LAYOUTS[preset]));
  }, []);

  const applyEmergencyFocus = useCallback((active: boolean) => {
    setEmergencyFocusMode(active);
    setPanels(prev => {
      const next = cloneLayoutMap(prev);
      for (const id of PANEL_ORDER) {
        if (active) {
          next[id].visible = CRITICAL_PANEL_IDS.includes(id);
        } else {
          next[id].visible = PRESET_LAYOUTS[activePreset][id].visible;
        }
      }
      return next;
    });
  }, [activePreset]);

  const handleOpenNavigation = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`,
      '_blank', 'noopener,noreferrer'
    );
  }, [targetLat, targetLng]);

  // ── Panel Content Definitions ─────────────────────────────────────────────
  // Defined as variables (not in panelContent map) so they're clearly readable
  // and used directly in the per-view layout functions below.

  const activeTargetContent = (
    <div className="space-y-2.5 text-xs">
      <div className="text-base font-extrabold text-white tracking-wider leading-none">{puckId || 'PUCK-ALPHA-04'}</div>
      <div className="grid grid-cols-2 gap-y-2 gap-x-2">
        <span className="text-gray-500 text-[10px] uppercase tracking-wider">Status</span>
        <span className="text-[#EF4444] font-bold">CRITICAL DISTRESS</span>
        <span className="text-gray-500 text-[10px] uppercase tracking-wider">Lat</span>
        <span className="font-bold text-[#06B6D4] tabular-nums">{targetLat.toFixed(6)}</span>
        <span className="text-gray-500 text-[10px] uppercase tracking-wider">Lng</span>
        <span className="font-bold text-[#06B6D4] tabular-nums">{targetLng.toFixed(6)}</span>
        <span className="text-gray-500 text-[10px] uppercase tracking-wider">GPS</span>
        <span className="text-[#10B981] font-bold">FILTERED / STABLE</span>
        <span className="text-gray-500 text-[10px] uppercase tracking-wider">Lock</span>
        <span className="font-bold text-[#10B981]">{isConnected ? 'LIVE TARGET LOCK' : 'SIM TARGET LOCK'}</span>
      </div>
      <div className="flex items-center gap-2 pt-1 border-t border-[#1A2840]">
        <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping inline-block shrink-0" />
        <span className="text-[9px] text-[#EF4444] font-bold tracking-wider uppercase">Distress Signal Active</span>
      </div>
    </div>
  );

  const kalmanGpsContent = (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#111827] border border-[#1A2840] rounded p-2">
          <div className="text-gray-500 text-[9px] uppercase tracking-wider">Filtered Lat</div>
          <div className="text-[#67e8f9] font-bold tabular-nums text-[11px]">{targetLat.toFixed(6)}</div>
        </div>
        <div className="bg-[#111827] border border-[#1A2840] rounded p-2">
          <div className="text-gray-500 text-[9px] uppercase tracking-wider">Filtered Lng</div>
          <div className="text-[#67e8f9] font-bold tabular-nums text-[11px]">{targetLng.toFixed(6)}</div>
        </div>
      </div>
      <div className="flex justify-between text-[11px]">
        <span className="text-gray-500">Noise Delta</span>
        <span className="text-[#F59E0B] font-bold">{(filteredLocation as FilteredResult)?.noiseDeltaMeters ?? 0} m</span>
      </div>
    </div>
  );

  const rescueTeamContent = (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-y-2 gap-x-2">
        <span className="text-gray-500 text-[10px] uppercase">GPS</span>
        <span className="font-bold tabular-nums text-[10px]">
          {(responderLocation?.lat ?? 17.384721).toFixed(5)},&nbsp;
          {(responderLocation?.lng ?? 78.485932).toFixed(5)}
        </span>
        <span className="text-gray-500 text-[10px] uppercase">Distance</span>
        <span className="font-bold">{Math.round(responderDist)} m</span>
        <span className="text-gray-500 text-[10px] uppercase">ETA</span>
        <span className="font-bold text-[#A855F7] tabular-nums">{formatEtaClock(responderEta)}</span>
        <span className="text-gray-500 text-[10px] uppercase">Status</span>
        <span className="text-[#10B981] font-bold">{responderStatus === 'STANDBY' ? 'EN ROUTE' : responderStatus}</span>
        <span className="text-gray-500 text-[10px] uppercase">Bearing</span>
        <span className="font-bold">
          {responderLocation ? Math.round(calculateBearingDeg(responderLocation, { lat: targetLat, lng: targetLng })) : 0}°
        </span>
      </div>
      <button
        onClick={handleOpenNavigation}
        className="w-full py-1.5 rounded border border-[#a78bfa]/50 bg-[#a78bfa]/10 text-[#c4b5fd] font-bold text-[10px] flex items-center justify-center gap-1.5 hover:bg-[#a78bfa]/20 transition-all"
      >
        <Navigation className="w-3 h-3" />
        OPEN NAVIGATION
      </button>
    </div>
  );

  const audioAnalysisContent = (
    <div className="space-y-2 text-xs">
      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-gray-500 text-[10px] uppercase">Acoustic Distress Conf.</span>
          <span className="text-[#EF4444] font-bold">{Math.round(sensorData.screechConfidence * 100)}%</span>
        </div>
        <div className="w-full h-1.5 bg-[#111827] rounded overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#f59e0b] to-[#ef4444] transition-all duration-500 rounded"
            style={{ width: `${Math.round(sensorData.screechConfidence * 100)}%` }}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-y-1.5">
        <span className="text-gray-500 text-[10px] uppercase">Thermal Delta</span>
        <span className="text-[#F59E0B] font-bold">+{sensorData.thermalDelta.toFixed(1)}°C</span>
        <span className="text-gray-500 text-[10px] uppercase">Detection</span>
        <span className="font-bold">{detectionConfidence}%</span>
        <span className="text-gray-500 text-[10px] uppercase">Recognition</span>
        <span className="font-bold">{recognitionConfidence}%</span>
        <span className="text-gray-500 text-[10px] uppercase">Risk Score</span>
        <span className="text-[#EF4444] font-bold">{riskConfidence}%</span>
      </div>
    </div>
  );

  const hydrodynamicsContent = (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-y-1.5">
        <span className="text-gray-500 text-[10px] uppercase">Current Speed</span>
        <span className="font-bold">{sensorData.waterVelocity.toFixed(1)} m/s</span>
        <span className="text-gray-500 text-[10px] uppercase">Drift Heading</span>
        <span className="font-bold">{sensorData.driftHeading}°</span>
        <span className="text-gray-500 text-[10px] uppercase">Comp. Heading</span>
        <span className="text-[#10B981] font-bold">{hydrodynamics?.compensatedHeadingDeg ?? sensorData.driftHeading}°</span>
        <span className="text-gray-500 text-[10px] uppercase">Buoy ETA</span>
        <span className="font-bold tabular-nums">{formatEtaClock(buoyEta)}</span>
        <span className="text-gray-500 text-[10px] uppercase">Buoy Distance</span>
        <span className="font-bold">{Math.round(buoyDist)} m</span>
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-[#1A2840]">
        <span className="text-gray-500 text-[9px] uppercase tracking-wider">Prediction</span>
        <div className="flex gap-1">
          {([15, 30, 45, 60] as const).map((sec) => (
            <button
              key={sec}
              onClick={() => setPredictionWindow(sec)}
              className={`px-2 py-0.5 rounded border text-[9px] font-bold transition-all ${
                predictionWindow === sec
                  ? 'border-[#06b6d4] text-[#67e8f9] bg-[#06b6d4]/15'
                  : 'border-[#374151] text-gray-500 hover:text-white hover:border-[#374151]'
              }`}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const missionControlsContent = (
    <div className="space-y-2 text-xs">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <span className="text-gray-500 text-[10px] uppercase">Drone</span>
        <span className="font-bold text-[#67e8f9]">{droneStatus}</span>
        <span className="text-gray-500 text-[10px] uppercase">Buoy</span>
        <span className="font-bold text-[#fbbf24]">{buoyStatus}</span>
        <span className="text-gray-500 text-[10px] uppercase">Rescue Team</span>
        <span className="font-bold text-[#c4b5fd]">{responderStatus}</span>
        <span className="text-gray-500 text-[10px] uppercase">Mission Timer</span>
        <span className="font-bold text-[#F59E0B] tabular-nums">{elapsed}</span>
      </div>
      <button
        onClick={onExecuteRescue}
        className="w-full py-2 rounded bg-gradient-to-r from-[#ef4444] to-[#f59e0b] text-white font-extrabold text-[10px] tracking-widest uppercase hover:opacity-90 transition-all shadow-lg"
      >
        EXECUTE DUAL DISPATCH
      </button>
      <button
        onClick={onOverrideDispatch}
        className="w-full py-1.5 rounded border border-[#a78bfa]/50 bg-[#a78bfa]/10 text-[#c4b5fd] font-bold text-[10px] uppercase hover:bg-[#a78bfa]/20 transition-all"
      >
        OVERRIDE TEAM DISPATCH
      </button>
      <button
        onClick={onResolveIncident}
        className="w-full py-1.5 rounded border border-[#10b981]/50 bg-[#10b981]/10 text-[#6ee7b7] font-bold text-[10px] uppercase hover:bg-[#10b981]/20 transition-all"
      >
        RESOLVE INCIDENT
      </button>
    </div>
  );

  // Shared drone camera props
  const droneCameraProps = {
    mode: cameraMode,
    onModeChange: setCameraMode,
    detectionConfidence: recognitionConfidence,
    targetLat,
    targetLng,
    altitudeM: Math.max(20, Math.min(95, droneDist * 0.18)),
    headingDeg: droneHeading,
    signalDbm: isConnected ? -42 : -67,
    distanceToTarget: droneDist,
    droneId: 'UAV-RESCUE-01',
    isSimulated: true,
    onManualPayloadDrop: onManualPayloadDrop,
  } as const;

  // ── Right Panel Per Workspace View ────────────────────────────────────────
  const renderRightPanel = () => {
    switch (activePreset) {

      // ── COMMAND: Situational awareness — target, AI briefing, controls ──
      case 'COMMAND':
        return (
          <div className="h-full flex flex-col gap-3 p-3 overflow-y-auto">
            {panels['active-target'].visible && (
              <PanelCard
                title="Active Target HUD"
                icon={<LocateFixed className="w-3 h-3" />}
                headerColor="#EF4444"
                badge={<span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping inline-block" />}
              >
                {activeTargetContent}
              </PanelCard>
            )}
            {panels['ai-briefing'].visible && (
              <PanelCard
                title="Gemini AI Briefing"
                icon={<Bot className="w-3 h-3" />}
                headerColor="#A855F7"
                className="flex-1 flex flex-col"
              >
                <AIBriefing briefing={aiBriefing} audioVoiceEnabled={audioVoiceEnabled} />
              </PanelCard>
            )}
            {panels['kalman-gps'].visible && (
              <PanelCard
                title="GPS / Kalman Filter"
                icon={<MapPinned className="w-3 h-3" />}
              >
                {kalmanGpsContent}
              </PanelCard>
            )}
            {panels['mission-controls'].visible && (
              <PanelCard
                title="Mission Controls"
                icon={<Send className="w-3 h-3" />}
                headerColor="#06B6D4"
              >
                {missionControlsContent}
              </PanelCard>
            )}
          </div>
        );

      // ── RESCUE: Field coordination — team, hydro, GPS, audio, controls ──
      case 'RESCUE':
        return (
          <div className="h-full flex flex-col gap-3 p-3 overflow-y-auto">
            {panels['rescue-team'].visible && (
              <PanelCard
                title="Rescue Team-01"
                icon={<UserRound className="w-3 h-3" />}
                headerColor="#A855F7"
                badge={
                  <span className="text-[8px] font-bold text-[#A855F7] bg-[#A855F7]/10 border border-[#A855F7]/30 px-1.5 py-0.5 rounded">
                    {responderStatus}
                  </span>
                }
              >
                {rescueTeamContent}
              </PanelCard>
            )}
            {panels['hydrodynamics'].visible && (
              <PanelCard
                title="Hydrodynamic Drift"
                icon={<Waves className="w-3 h-3" />}
                headerColor="#06B6D4"
              >
                {hydrodynamicsContent}
              </PanelCard>
            )}
            {panels['kalman-gps'].visible && (
              <PanelCard
                title="GPS / Kalman Filter"
                icon={<MapPinned className="w-3 h-3" />}
              >
                {kalmanGpsContent}
              </PanelCard>
            )}
            {panels['audio-analysis'].visible && (
              <PanelCard
                title="Audio Analysis"
                icon={<Mic className="w-3 h-3" />}
                headerColor="#EF4444"
              >
                {audioAnalysisContent}
              </PanelCard>
            )}
            {panels['mission-controls'].visible && (
              <PanelCard
                title="Mission Controls"
                icon={<Send className="w-3 h-3" />}
                headerColor="#06B6D4"
              >
                {missionControlsContent}
              </PanelCard>
            )}
          </div>
        );

      // ── DRONE: UAV operations — drone feed dominates ─────────────────────
      case 'DRONE':
        return (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Drone camera — fills the available vertical space */}
            {panels['drone-camera'].visible && (
              <div className="flex-1 min-h-0 overflow-hidden">
                <DroneCameraFeed {...droneCameraProps} />
              </div>
            )}
            {/* Mission controls pinned at bottom */}
            <div className="shrink-0 p-3 border-t border-[#1A2840]">
              <PanelCard
                title="Mission Controls"
                icon={<Send className="w-3 h-3" />}
                headerColor="#06B6D4"
              >
                {missionControlsContent}
              </PanelCard>
            </div>
          </div>
        );

      // ── FULL TACTICAL: All information, scrollable ────────────────────────
      case 'FULL_TACTICAL':
      default:
        return (
          <div className="h-full flex flex-col gap-3 p-3 overflow-y-auto">
            {/* Drone camera at top, fixed height */}
            {panels['drone-camera'].visible && (
              <div className="shrink-0" style={{ height: '460px', minHeight: '460px' }}>
                <DroneCameraFeed {...droneCameraProps} />
              </div>
            )}
            {panels['active-target'].visible && (
              <PanelCard
                title="Active Target HUD"
                icon={<LocateFixed className="w-3 h-3" />}
                headerColor="#EF4444"
                badge={<span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-ping inline-block" />}
              >
                {activeTargetContent}
              </PanelCard>
            )}
            {panels['rescue-team'].visible && (
              <PanelCard
                title="Rescue Team-01"
                icon={<UserRound className="w-3 h-3" />}
                headerColor="#A855F7"
                badge={
                  <span className="text-[8px] font-bold text-[#A855F7] bg-[#A855F7]/10 border border-[#A855F7]/30 px-1.5 py-0.5 rounded">
                    {responderStatus}
                  </span>
                }
              >
                {rescueTeamContent}
              </PanelCard>
            )}
            {panels['hydrodynamics'].visible && (
              <PanelCard
                title="Hydrodynamics"
                icon={<Waves className="w-3 h-3" />}
                headerColor="#06B6D4"
              >
                {hydrodynamicsContent}
              </PanelCard>
            )}
            {panels['audio-analysis'].visible && (
              <PanelCard
                title="Audio Analysis"
                icon={<Mic className="w-3 h-3" />}
                headerColor="#EF4444"
              >
                {audioAnalysisContent}
              </PanelCard>
            )}
            {panels['ai-briefing'].visible && (
              <PanelCard
                title="Gemini AI Briefing"
                icon={<Bot className="w-3 h-3" />}
                headerColor="#A855F7"
              >
                <AIBriefing briefing={aiBriefing} audioVoiceEnabled={audioVoiceEnabled} />
              </PanelCard>
            )}
            {panels['mission-controls'].visible && (
              <PanelCard
                title="Mission Controls"
                icon={<Send className="w-3 h-3" />}
                headerColor="#06B6D4"
              >
                {missionControlsContent}
              </PanelCard>
            )}
          </div>
        );
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[4000] bg-[#090D16] text-[#F3F4F6] font-mono flex flex-col overflow-hidden animate-mission-slide-in emergency-border-pulse">

      {/* ═══════════════════════════════════════════════════════════════════
          A. GLOBAL HEADER
      ═══════════════════════════════════════════════════════════════════ */}
      <header
        className="shrink-0 px-4 py-2.5 flex items-center justify-between gap-4 select-none"
        style={{
          background: 'linear-gradient(90deg, #080D18 0%, #0A111E 100%)',
          borderBottom: '1px solid rgba(239,68,68,0.2)',
        }}
      >
        {/* ── LEFT: Brand ── */}
        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="relative w-9 h-9 rounded-lg border border-[#EF4444]/50 bg-[#EF4444]/10 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-[#EF4444]" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-ping" />
          </div>
          <div className="hidden sm:block">
            <div className="flex items-center gap-2">
              <span className="text-white font-extrabold text-sm tracking-[0.1em]">AQUA RESCUE</span>
              <span className="text-[#06B6D4] text-[8px] font-bold px-1.5 py-0.5 bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded tracking-wider">
                COMMAND OS V2.0
              </span>
            </div>
            <div className="text-[9px] text-gray-600 tracking-wider uppercase mt-0.5">
              Distributed Detection & Autonomous Rescue
            </div>
          </div>
        </div>

        {/* ── CENTER: Mission Status ── */}
        <div className="flex flex-col items-center text-center min-w-0">
          <div className="flex items-center gap-2 text-[#EF4444] font-extrabold text-[13px] tracking-[0.12em] uppercase">
            <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping shrink-0" />
            Active Distress Response
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono mt-0.5 flex-wrap justify-center">
            <span className="text-gray-400">
              MISSION&nbsp;<span className="text-white font-bold">{missionId || 'AR-000'}</span>
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-gray-400">
              TARGET&nbsp;<span className="text-[#EF4444] font-bold">{puckId || 'PUCK-ALPHA-04'}</span>
            </span>
            <span className="text-gray-700">·</span>
            <span className="text-[#F59E0B] font-bold tabular-nums">{elapsed}</span>
          </div>
        </div>

        {/* ── RIGHT: System Status & Controls ── */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* IST / UTC clocks */}
          <div className="hidden xl:flex flex-col items-end text-[9px] font-mono mr-2 gap-0.5">
            <span className="text-white font-bold">{timeIst}</span>
            <span className="text-gray-500">{timeUtc}</span>
          </div>

          {/* Mesh RSSI */}
          <div className="hidden lg:flex items-center gap-1 px-2 py-1 bg-[#0C1523] border border-[#1A2840] rounded text-[9px] font-mono">
            <Activity className="w-3 h-3 text-[#10B981]" />
            <span className="text-[#10B981] font-bold">-42 dBm</span>
          </div>

          {/* WebSocket status */}
          <div className="flex items-center gap-1 px-2 py-1 bg-[#0C1523] border border-[#1A2840] rounded text-[9px] font-mono">
            {isConnected ? (
              <><Wifi className="w-3 h-3 text-[#10B981]" /><span className="text-[#10B981] font-bold">LIVE</span></>
            ) : (
              <><WifiOff className="w-3 h-3 text-[#EF4444]" /><span className="text-[#EF4444] font-bold">SIM</span></>
            )}
          </div>

          {/* Voice toggle */}
          <button
            onClick={onToggleAudio}
            title="Toggle Tactical Voice Synthesis"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold border transition-all ${
              audioVoiceEnabled
                ? 'border-[#06B6D4]/40 bg-[#06B6D4]/10 text-[#06B6D4] hover:bg-[#06B6D4]/15'
                : 'border-[#1A2840] bg-[#0C1523] text-gray-500 hover:text-gray-300'
            }`}
          >
            {audioVoiceEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
            <span className="hidden md:inline">{audioVoiceEnabled ? 'VOICE ON' : 'MUTED'}</span>
          </button>

          {/* Emergency focus */}
          <button
            onClick={() => applyEmergencyFocus(!emergencyFocusMode)}
            title="Toggle Emergency Focus Mode — critical panels only"
            className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono font-bold border transition-all ${
              emergencyFocusMode
                ? 'border-[#EF4444]/60 bg-[#EF4444]/10 text-[#EF4444]'
                : 'border-[#1A2840] bg-[#0C1523] text-gray-400 hover:text-white'
            }`}
          >
            <Flame className="w-3 h-3" />
            <span className="hidden md:inline">FOCUS</span>
          </button>

          {/* Resolve incident */}
          <button
            onClick={onResolveIncident}
            title="Resolve Incident — return to Normal Monitoring"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981] text-[9px] font-mono font-bold hover:bg-[#10B981]/25 transition-all"
          >
            <RefreshCw className="w-3 h-3" />
            RESOLVE
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════
          BODY: B. LEFT SIDEBAR + MAIN CONTENT COLUMN
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── B. LEFT WORKSPACE SIDEBAR ── */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          activeWorkspace={activePreset}
          onSelectWorkspace={applyPreset}
          visiblePanels={visiblePanels}
          onTogglePanelVisibility={togglePanelVisibility}
          emergencyFocus={emergencyFocusMode}
          onToggleEmergencyFocus={() => applyEmergencyFocus(!emergencyFocusMode)}
          onClearAlerts={() => {/* alert clearing handled at page level */}}
          onResetWorkspace={() => applyPreset(activePreset)}
        />

        {/* ── MAIN CONTENT COLUMN (map + right intel + strips) ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* ── C. CENTRAL MAP  +  D. RIGHT INTEL PANEL ── */}
          <div className="flex flex-1 min-h-0 overflow-hidden">

            {/* C. CENTRAL MAP — spatial source of truth */}
            <div className={`relative ${mapWidthClass} min-h-0 transition-all duration-300 ease-in-out`}>
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
            </div>

            {/* D. RIGHT INTELLIGENCE PANEL — view-contextual content */}
            <div
              className={`${rightWidthClass} flex flex-col overflow-hidden transition-all duration-300 ease-in-out`}
              style={{ borderLeft: '1px solid #1A2840', background: '#060B15' }}
            >
              {renderRightPanel()}
            </div>
          </div>

          {/* ── E. BOTTOM TELEMETRY STRIP ── */}
          <div className="shrink-0" style={{ borderTop: '1px solid #1A2840' }}>
            <TelemetryRow
              puckId={puckId}
              activeDistress={true}
              filteredLocation={filteredLocation}
              rawLocation={rawLocation}
              sensorData={sensorData}
              hydrodynamics={hydrodynamics}
              droneLocation={droneLocation}
              buoyLocation={buoyLocation}
              responderLocation={responderLocation}
              droneStatus={droneStatus}
              buoyStatus={buoyStatus}
              responderStatus={responderStatus}
              onOverrideDispatch={onOverrideDispatch}
              onExecuteRescue={onExecuteRescue}
            />
          </div>

          {/* ── F. INCIDENT TIMELINE ── */}
          <div
            className="shrink-0 px-3 py-2"
            style={{ borderTop: '1px solid #1A2840', background: '#060B15' }}
          >
            <IncidentTimeline
              logs={eventLogs}
              activeDistress={true}
              droneStatus={droneStatus}
              buoyStatus={buoyStatus}
              responderStatus={responderStatus}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveMissionOverlay;
