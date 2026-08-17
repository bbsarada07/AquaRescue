'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle,
  Bot,
  Crosshair,
  LifeBuoy,
  LocateFixed,
  MapPinned,
  Mic,
  Navigation,
  Radio,
  Send,
  Settings2,
  ShieldAlert,
  UserRound,
  Waves,
  Clock3,
  Video,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { FilteredResult, GPSCoordinate, KalmanFilter2D } from '@/lib/kalman';
import { HydrodynamicVectorResult, RESPONDER_SPEEDS, calculateBearingDeg } from '@/lib/hydrodynamics';
import { BriefingResponse } from '@/lib/gemini';
import { LogEntry } from '@/lib/socket';
import AIBriefing from './AIBriefing';
import DroneCameraFeed, { DroneCameraMode } from './DroneCameraFeed';
import WorkspacePanel from './WorkspacePanel';
import {
  CRITICAL_PANEL_IDS,
  cloneLayoutMap,
  DEFAULT_PANEL_LAYOUTS,
  DockTarget,
  getDockLayout,
  PANEL_ORDER,
  PanelId,
  PanelLayoutMap,
  PRESET_LAYOUTS,
  WorkspacePreset,
} from '@/lib/panelWorkspace';

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

const STORAGE_KEY = 'aquarescue.workspace.v2';

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

const isPreset = (value: string): value is WorkspacePreset =>
  value === 'COMMAND' || value === 'RESCUE' || value === 'DRONE' || value === 'FULL_TACTICAL';

const clampPct = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const formatEtaClock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

const panelIconMap: Record<PanelId, React.ReactNode> = {
  'active-target': <LocateFixed className="w-3.5 h-3.5" />,
  'kalman-gps': <MapPinned className="w-3.5 h-3.5" />,
  'raw-gps': <MapPinned className="w-3.5 h-3.5" />,
  'drone-camera': <Video className="w-3.5 h-3.5" />,
  'drone-sensors': <Crosshair className="w-3.5 h-3.5" />,
  'rescue-team': <UserRound className="w-3.5 h-3.5" />,
  'audio-analysis': <Mic className="w-3.5 h-3.5" />,
  hydrodynamics: <Waves className="w-3.5 h-3.5" />,
  'ai-briefing': <Bot className="w-3.5 h-3.5" />,
  'incident-timeline': <Clock3 className="w-3.5 h-3.5" />,
  'mission-controls': <Send className="w-3.5 h-3.5" />,
};

const panelTitleMap: Record<PanelId, string> = {
  'active-target': 'ACTIVE TARGET HUD',
  'kalman-gps': 'GPS / KALMAN TELEMETRY',
  'raw-gps': 'RAW GPS',
  'drone-camera': 'DRONE CAMERA / VIDEO FEED',
  'drone-sensors': 'DRONE SENSOR CONTROLS',
  'rescue-team': 'RESCUE TEAM LOCATION / TRACKING',
  'audio-analysis': 'AUDIO & THERMAL ANALYSIS',
  hydrodynamics: 'HYDRODYNAMIC DRIFT VECTOR',
  'ai-briefing': 'GEMINI TACTICAL AI BRIEFING',
  'incident-timeline': 'INCIDENT TIMELINE',
  'mission-controls': 'MISSION CONTROLS',
};

const panelControlList: Array<{ id: PanelId; label: string }> = [
  { id: 'drone-camera', label: 'Drone Camera' },
  { id: 'active-target', label: 'Target Telemetry' },
  { id: 'ai-briefing', label: 'AI Briefing' },
  { id: 'rescue-team', label: 'Rescue Team' },
  { id: 'audio-analysis', label: 'Audio Analysis' },
  { id: 'hydrodynamics', label: 'Hydrodynamics' },
  { id: 'incident-timeline', label: 'Incident Timeline' },
];

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
  const [cameraMode, setCameraMode] = useState<DroneCameraMode>('RGB');
  const [elapsed, setElapsed] = useState('00:00');
  const [panels, setPanels] = useState<PanelLayoutMap>(() => cloneLayoutMap(DEFAULT_PANEL_LAYOUTS));
  const [activePreset, setActivePreset] = useState<WorkspacePreset>('FULL_TACTICAL');
  const [emergencyFocusMode, setEmergencyFocusMode] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [dockPreview, setDockPreview] = useState<DockTarget | null>(null);
  const [highlightedPanel, setHighlightedPanel] = useState<PanelId | null>(null);
  const [workspaceSize, setWorkspaceSize] = useState({ width: 1400, height: 760 });
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const compactAppliedRef = useRef(false);

  useEffect(() => {
    const update = () => {
      if (!missionStartTime) {
        setElapsed('00:00');
        return;
      }
      const totalSec = Math.max(0, Math.floor((Date.now() - missionStartTime) / 1000));
      setElapsed(formatEtaClock(totalSec));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [missionStartTime]);

  useEffect(() => {
    const payload = localStorage.getItem(STORAGE_KEY);
    if (!payload) return;
    try {
      const parsed = JSON.parse(payload) as {
        preset?: string;
        emergencyFocusMode?: boolean;
        panels?: Partial<PanelLayoutMap>;
      };
      if (parsed.preset && isPreset(parsed.preset)) {
        setActivePreset(parsed.preset);
      }
      if (typeof parsed.emergencyFocusMode === 'boolean') {
        setEmergencyFocusMode(parsed.emergencyFocusMode);
      }
      if (parsed.panels) {
        setPanels((prev) => {
          const next = cloneLayoutMap(prev);
          for (const id of PANEL_ORDER) {
            const incoming = parsed.panels?.[id];
            if (!incoming) continue;
            next[id] = {
              ...next[id],
              ...incoming,
            };
          }
          return next;
        });
      }
    } catch (error) {
      console.warn('Failed to restore workspace state:', error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        preset: activePreset,
        emergencyFocusMode,
        panels,
      })
    );
  }, [activePreset, emergencyFocusMode, panels]);

  useEffect(() => {
    const updateSize = () => {
      if (!workspaceRef.current) return;
      setWorkspaceSize({
        width: workspaceRef.current.clientWidth,
        height: workspaceRef.current.clientHeight,
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (workspaceSize.width >= 1366) {
      compactAppliedRef.current = false;
      return;
    }
    if (compactAppliedRef.current) return;
    compactAppliedRef.current = true;
    setPanels((prev) => {
      const next = cloneLayoutMap(prev);
      next['ai-briefing'].collapsed = true;
      next['audio-analysis'].collapsed = true;
      next['raw-gps'].collapsed = true;
      return next;
    });
  }, [workspaceSize.width]);

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
      const current = dronePath[dronePath.length - 1];
      return calculateBearingDeg(prev, current);
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

  const timelineEntries = useMemo(() => {
    if (eventLogs.length === 0) {
      return [
        { time: '--:--:--', message: 'DISTRESS DETECTED' },
        { time: '--:--:--', message: 'GPS LOCATION FILTERED' },
        { time: '--:--:--', message: 'DRONE TARGET LOCKED' },
      ];
    }
    return eventLogs.slice(0, 12).reverse().map((log) => ({
      time: log.time,
      message: log.message.toUpperCase(),
    }));
  }, [eventLogs]);

  const bringToFront = useCallback((id: PanelId) => {
    setPanels((prev) => {
      const next = cloneLayoutMap(prev);
      const maxZ = Math.max(...PANEL_ORDER.map((key) => next[key].z));
      next[id] = { ...next[id], z: maxZ + 1 };
      return next;
    });
  }, []);

  const updatePanel = useCallback((id: PanelId, patch: Partial<PanelLayoutMap[PanelId]>) => {
    setPanels((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const applyPreset = useCallback((preset: WorkspacePreset) => {
    setActivePreset(preset);
    setEmergencyFocusMode(false);
    setPanels((prev) => {
      const baseline = PRESET_LAYOUTS[preset];
      const next = cloneLayoutMap(prev);
      for (const id of PANEL_ORDER) {
        next[id] = {
          ...baseline[id],
          z: next[id].z,
        };
      }
      return next;
    });
  }, []);

  const applyEmergencyFocus = useCallback((active: boolean) => {
    setEmergencyFocusMode(active);
    setPanels((prev) => {
      const next = cloneLayoutMap(prev);
      for (const id of PANEL_ORDER) {
        const critical = CRITICAL_PANEL_IDS.includes(id);
        if (active) {
          next[id].visible = critical;
          next[id].collapsed = !critical;
        } else {
          const presetLayouts = PRESET_LAYOUTS[activePreset];
          next[id].visible = presetLayouts[id].visible;
          next[id].collapsed = presetLayouts[id].collapsed;
        }
      }
      return next;
    });
  }, [activePreset]);

  const handlePanelSnapCommit = useCallback((id: PanelId, target: DockTarget) => {
    setPanels((prev) => {
      const next = cloneLayoutMap(prev);
      const dockLayout = getDockLayout(target);
      next[id] = { ...next[id], ...dockLayout };
      return next;
    });
  }, []);

  useEffect(() => {
    if (!missionId) return;
    setPanels((prev) => {
      const next = cloneLayoutMap(prev);
      for (const id of CRITICAL_PANEL_IDS) {
        next[id].visible = true;
        next[id].collapsed = false;
      }
      return next;
    });
    setHighlightedPanel('active-target');
    const timer = setTimeout(() => setHighlightedPanel(null), 1800);
    return () => clearTimeout(timer);
  }, [missionId]);

  const handleOpenNavigation = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${targetLat},${targetLng}`, '_blank', 'noopener,noreferrer');
  }, [targetLat, targetLng]);

  const panelContent: Record<PanelId, React.ReactNode> = {
    'active-target': (
      <div className="space-y-2 text-xs">
        <div className="text-lg font-extrabold text-white">{puckId || 'PUCK-ALPHA-04'}</div>
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-gray-400">STATUS</span><span className="text-[#EF4444] font-bold">CRITICAL DISTRESS</span>
          <span className="text-gray-400">LAT</span><span className="font-bold">{targetLat.toFixed(6)}</span>
          <span className="text-gray-400">LNG</span><span className="font-bold">{targetLng.toFixed(6)}</span>
          <span className="text-gray-400">GPS</span><span className="text-[#10B981] font-bold">FILTERED / STABLE</span>
          <span className="text-gray-400">LOCK</span><span className="font-bold text-[#10B981]">{isConnected ? 'LIVE TARGET LOCK' : 'SIM TARGET LOCK'}</span>
        </div>
      </div>
    ),
    'kalman-gps': (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#111827] border border-[#1f293d] rounded p-2">
            <div className="text-gray-400 text-[10px]">FILTERED LAT</div>
            <div className="text-[#67e8f9] font-bold">{targetLat.toFixed(6)}</div>
          </div>
          <div className="bg-[#111827] border border-[#1f293d] rounded p-2">
            <div className="text-gray-400 text-[10px]">FILTERED LNG</div>
            <div className="text-[#67e8f9] font-bold">{targetLng.toFixed(6)}</div>
          </div>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-gray-400">NOISE DELTA</span>
          <span className="text-[#F59E0B] font-bold">{(filteredLocation as FilteredResult)?.noiseDeltaMeters ?? 0}m</span>
        </div>
      </div>
    ),
    'raw-gps': (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-gray-400">RAW LAT</span><span className="font-bold">{(rawLocation?.lat ?? targetLat).toFixed(6)}</span>
          <span className="text-gray-400">RAW LNG</span><span className="font-bold">{(rawLocation?.lng ?? targetLng).toFixed(6)}</span>
          <span className="text-gray-400">MODE</span><span className="text-[#F59E0B] font-bold">MULTIPATH NOISY</span>
        </div>
      </div>
    ),
    'drone-camera': (
      <DroneCameraFeed
        mode={cameraMode}
        onModeChange={setCameraMode}
        detectionConfidence={recognitionConfidence}
        targetLat={targetLat}
        targetLng={targetLng}
        altitudeM={Math.max(20, Math.min(95, droneDist * 0.18))}
        headingDeg={droneHeading}
        signalDbm={isConnected ? -42 : -67}
        distanceToTarget={droneDist}
        droneId="UAV-RESCUE-01"
        isSimulated={true}
      />
    ),
    'drone-sensors': (
      <div className="space-y-2.5 text-xs">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#111827] border border-[#1f293d] rounded p-2"><div className="text-gray-400">CAMERA</div><div className="font-bold text-[#10B981]">{cameraMode} ACTIVE</div></div>
          <div className="bg-[#111827] border border-[#1f293d] rounded p-2"><div className="text-gray-400">TARGET</div><div className="font-bold text-[#10B981]">PERSON LOCKED</div></div>
          <div className="bg-[#111827] border border-[#1f293d] rounded p-2"><div className="text-gray-400">DISTANCE</div><div className="font-bold">{Math.round(droneDist)} m</div></div>
          <div className="bg-[#111827] border border-[#1f293d] rounded p-2"><div className="text-gray-400">ETA</div><div className="font-bold">{formatEtaClock(droneEta)}</div></div>
        </div>
        <div className="border-t border-[#1f293d] pt-2">
          <div className="text-[#67e8f9] font-bold mb-1">LIFE JACKET PAYLOAD</div>
          <div className="grid grid-cols-2 gap-y-1">
            <span className="text-gray-400">STATUS</span><span className="text-[#10B981] font-bold">READY</span>
            <span className="text-gray-400">TARGET LOCK</span><span className="text-[#10B981] font-bold">✓</span>
            <span className="text-gray-400">DROP ZONE</span><span className="text-[#10B981] font-bold">LOCKED</span>
          </div>
          <button
            onClick={onManualPayloadDrop}
            className="mt-2 w-full py-1.5 rounded border border-[#06b6d4]/60 bg-[#06b6d4]/15 text-[#67e8f9] font-bold"
          >
            RELEASE PAYLOAD (SIMULATED COMMAND)
          </button>
        </div>
      </div>
    ),
    'rescue-team': (
      <div className="space-y-2 text-xs">
        <div className="text-white font-bold">RESCUE TEAM-01</div>
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-gray-400">GPS</span><span className="font-bold">{(responderLocation?.lat ?? 17.384721).toFixed(6)}, {(responderLocation?.lng ?? 78.485932).toFixed(6)}</span>
          <span className="text-gray-400">DISTANCE</span><span className="font-bold">{Math.round(responderDist)} m</span>
          <span className="text-gray-400">ETA</span><span className="font-bold">{formatEtaClock(responderEta)}</span>
          <span className="text-gray-400">STATUS</span><span className="text-[#10B981] font-bold">{responderStatus === 'STANDBY' ? 'EN ROUTE' : responderStatus}</span>
          <span className="text-gray-400">BEARING</span><span className="font-bold">{responderLocation ? Math.round(calculateBearingDeg(responderLocation, { lat: targetLat, lng: targetLng })) : 0}°</span>
        </div>
        <button
          onClick={handleOpenNavigation}
          className="w-full py-1.5 rounded border border-[#a78bfa]/60 bg-[#a78bfa]/15 text-[#c4b5fd] font-bold flex items-center justify-center gap-1.5"
        >
          <Navigation className="w-3.5 h-3.5" />
          OPEN NAVIGATION
        </button>
      </div>
    ),
    'audio-analysis': (
      <div className="space-y-2 text-xs">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-gray-400">ACOUSTIC DISTRESS CONF.</span>
            <span className="text-[#EF4444] font-bold">{Math.round(sensorData.screechConfidence * 100)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-800 rounded overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#f59e0b] to-[#ef4444]" style={{ width: `${Math.round(sensorData.screechConfidence * 100)}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-gray-400">THERMAL DELTA</span><span className="text-[#F59E0B] font-bold">+{sensorData.thermalDelta.toFixed(1)}°C</span>
          <span className="text-gray-400">DETECTION</span><span className="font-bold">{detectionConfidence}%</span>
          <span className="text-gray-400">RECOGNITION</span><span className="font-bold">{recognitionConfidence}%</span>
          <span className="text-gray-400">RISK</span><span className="text-[#EF4444] font-bold">{riskConfidence}%</span>
        </div>
      </div>
    ),
    hydrodynamics: (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-gray-400">CURRENT</span><span className="font-bold">{sensorData.waterVelocity.toFixed(1)} m/s</span>
          <span className="text-gray-400">DRIFT HEADING</span><span className="font-bold">{sensorData.driftHeading}°</span>
          <span className="text-gray-400">COMP HEADING</span><span className="text-[#10B981] font-bold">{hydrodynamics?.compensatedHeadingDeg ?? sensorData.driftHeading}°</span>
          <span className="text-gray-400">BUOY ETA</span><span className="font-bold">{formatEtaClock(buoyEta)}</span>
          <span className="text-gray-400">BUOY DIST</span><span className="font-bold">{Math.round(buoyDist)} m</span>
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-[#1f293d]">
          <span className="text-gray-400">PREDICTION WINDOW</span>
          <div className="flex gap-1">
            {([15, 30, 45, 60] as const).map((sec) => (
              <button
                key={sec}
                onClick={() => setPredictionWindow(sec)}
                className={`px-2 py-0.5 rounded border text-[10px] font-bold ${predictionWindow === sec ? 'border-[#06b6d4] text-[#67e8f9] bg-[#06b6d4]/15' : 'border-[#374151] text-gray-300'}`}
              >
                {sec}s
              </button>
            ))}
          </div>
        </div>
      </div>
    ),
    'ai-briefing': <AIBriefing briefing={aiBriefing} audioVoiceEnabled={audioVoiceEnabled} />,
    'incident-timeline': (
      <div className="space-y-1.5 text-xs">
        {timelineEntries.map((entry, idx) => (
          <div key={`${entry.time}-${idx}`} className="flex gap-2">
            <span className="w-[68px] shrink-0 text-[#67e8f9] font-bold">{entry.time}</span>
            <span className="text-gray-200">{entry.message}</span>
          </div>
        ))}
      </div>
    ),
    'mission-controls': (
      <div className="space-y-2 text-xs">
        <div className="grid grid-cols-2 gap-y-1.5">
          <span className="text-gray-400">DRONE</span><span className="font-bold text-[#67e8f9]">{droneStatus}</span>
          <span className="text-gray-400">BUOY</span><span className="font-bold text-[#fbbf24]">{buoyStatus}</span>
          <span className="text-gray-400">TEAM</span><span className="font-bold text-[#c4b5fd]">{responderStatus}</span>
          <span className="text-gray-400">RESPONSE TIMER</span><span className="font-bold text-[#F59E0B]">{elapsed}</span>
        </div>
        <button
          onClick={onExecuteRescue}
          className="w-full py-2 rounded bg-gradient-to-r from-[#ef4444] to-[#f59e0b] text-white font-extrabold"
        >
          EXECUTE DUAL DISPATCH
        </button>
        <button
          onClick={onOverrideDispatch}
          className="w-full py-1.5 rounded border border-[#a78bfa]/60 bg-[#a78bfa]/15 text-[#c4b5fd] font-bold"
        >
          OVERRIDE TEAM DISPATCH
        </button>
        <button
          onClick={onResolveIncident}
          className="w-full py-1.5 rounded border border-[#10b981]/70 bg-[#10b981]/15 text-[#6ee7b7] font-bold"
        >
          RESOLVE INCIDENT
        </button>
      </div>
    ),
  };

  const dockPreviewLayout = dockPreview ? getDockLayout(dockPreview) : null;

  return (
    <div className="fixed inset-0 z-[4000] bg-[#090D16] text-[#F3F4F6] font-mono flex flex-col overflow-hidden emergency-border-pulse">
      <header className="px-4 py-2.5 border-b border-[#ef4444]/40 bg-[#111827]/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg border border-[#ef4444]/70 bg-[#ef4444]/20 flex items-center justify-center relative">
            <ShieldAlert className="w-5 h-5 text-[#ef4444]" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-ping" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold tracking-wider text-[#ef4444]">ACTIVE DISTRESS RESPONSE</h1>
            <p className="text-[11px] text-gray-300">MISSION {missionId || 'AR-000'} · TARGET {puckId || 'PUCK-ALPHA-04'} · {elapsed}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleAudio}
            className="px-2.5 py-1.5 rounded border border-[#374151] bg-[#0b1420] text-gray-200 text-xs font-bold flex items-center gap-1"
          >
            {audioVoiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-[#67e8f9]" /> : <VolumeX className="w-3.5 h-3.5 text-gray-400" />}
            {audioVoiceEnabled ? 'VOICE ON' : 'VOICE MUTED'}
          </button>
          <button
            onClick={() => applyEmergencyFocus(!emergencyFocusMode)}
            className={`px-3 py-1.5 rounded border text-xs font-bold ${
              emergencyFocusMode
                ? 'border-[#ef4444] bg-[#ef4444]/20 text-[#fecaca]'
                : 'border-[#374151] bg-[#0b1420] text-gray-200'
            }`}
          >
            EMERGENCY FOCUS
          </button>
          <div className="relative">
            <button
              onClick={() => setWorkspaceMenuOpen((prev) => !prev)}
              className="px-3 py-1.5 rounded border border-[#06b6d4]/50 bg-[#06b6d4]/10 text-[#67e8f9] text-xs font-bold flex items-center gap-1.5"
            >
              <Settings2 className="w-3.5 h-3.5" />
              WORKSPACE
            </button>
            {workspaceMenuOpen && (
              <div className="absolute right-0 top-10 w-72 bg-[#0b1420] border border-[#1f293d] rounded-lg p-3 z-[6000] shadow-2xl">
                <div className="text-[11px] font-bold text-gray-300 border-b border-[#1f293d] pb-1 mb-2">LAYOUT</div>
                <div className="space-y-1.5 text-xs">
                  {([
                    ['COMMAND', 'Command View'],
                    ['RESCUE', 'Rescue View'],
                    ['DRONE', 'Drone View'],
                    ['FULL_TACTICAL', 'Full Tactical View'],
                  ] as [WorkspacePreset, string][]).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" checked={activePreset === value} onChange={() => applyPreset(value)} />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>

                <div className="text-[11px] font-bold text-gray-300 border-b border-[#1f293d] pb-1 mb-2 mt-3">PANEL CONTROL</div>
                <div className="space-y-1 text-xs">
                  {panelControlList.map(({ id, label }) => (
                    <label key={id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={panels[id].visible}
                        onChange={() => updatePanel(id, { visible: !panels[id].visible })}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main ref={workspaceRef} className="relative flex-1 min-h-0">
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

        {dockPreviewLayout && (
          <div
            className="absolute border-2 border-dashed border-[#06B6D4]/70 bg-[#06B6D4]/10 rounded-lg pointer-events-none z-[5500]"
            style={{
              left: `${dockPreviewLayout.x * workspaceSize.width}px`,
              top: `${dockPreviewLayout.y * workspaceSize.height}px`,
              width: `${dockPreviewLayout.w * workspaceSize.width}px`,
              height: `${dockPreviewLayout.h * workspaceSize.height}px`,
            }}
          />
        )}

        <div className="absolute left-2 top-1/2 -translate-y-1/2 z-[5600] bg-[#111827]/90 border border-[#1f293d] rounded-lg p-1.5 flex flex-col gap-1.5">
          {([
            ['drone-camera', '🚁 Drone Camera'],
            ['active-target', '📍 Target Location'],
            ['rescue-team', '👥 Rescue Team'],
            ['ai-briefing', '🧠 AI Briefing'],
            ['audio-analysis', '🔊 Audio Analysis'],
            ['hydrodynamics', '🌊 Hydrodynamics'],
          ] as [PanelId, string][]).map(([id, title]) => (
            <button
              key={id}
              title={title}
              onClick={() => updatePanel(id, { visible: !panels[id].visible, collapsed: false })}
              className={`w-8 h-8 rounded border text-xs font-bold ${
                panels[id].visible ? 'border-[#06b6d4]/70 bg-[#06b6d4]/15 text-[#67e8f9]' : 'border-[#374151] bg-[#0b1420] text-gray-300'
              }`}
            >
              {title.split(' ')[0]}
            </button>
          ))}
        </div>

        {PANEL_ORDER.map((id) => {
          const isHighlighted = highlightedPanel === id;
          return (
            <div key={id} className={isHighlighted ? 'animate-pulse' : undefined}>
              <WorkspacePanel
                title={panelTitleMap[id]}
                icon={panelIconMap[id]}
                layout={panels[id]}
                workspaceWidth={workspaceSize.width}
                workspaceHeight={workspaceSize.height}
                onLayoutChange={(patch) => updatePanel(id, patch)}
                onBringToFront={() => bringToFront(id)}
                onSnapPreview={setDockPreview}
                onSnapCommit={(target) => handlePanelSnapCommit(id, target)}
              >
                {panelContent[id]}
              </WorkspacePanel>
            </div>
          );
        })}
      </main>

      <footer className="px-4 py-1.5 border-t border-[#1f293d] bg-[#111827]/95 text-[10px] text-gray-300 flex flex-wrap items-center gap-x-3 gap-y-1 shrink-0">
        <span className="font-bold text-[#ef4444] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> PRIORITY: DISTRESS / VICTIM LOCATION / DRONE / TEAM</span>
        <span className="flex items-center gap-1"><LocateFixed className="w-3 h-3 text-[#06b6d4]" /> {targetLat.toFixed(6)}, {targetLng.toFixed(6)}</span>
        <span className="flex items-center gap-1"><Navigation className="w-3 h-3 text-[#06b6d4]" /> DRONE {Math.round(droneDist)}m · BUOY {Math.round(buoyDist)}m · TEAM {Math.round(responderDist)}m</span>
        <span className="flex items-center gap-1"><LifeBuoy className="w-3 h-3 text-[#10b981]" /> SINGLE INCIDENT COORDINATION</span>
        {!isConnected && <span className="text-[#f59e0b] flex items-center gap-1"><Radio className="w-3 h-3" /> SIMULATED TELEMETRY MODE</span>}
      </footer>
    </div>
  );
};

export default ActiveMissionOverlay;
