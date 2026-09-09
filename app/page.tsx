'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { 
  Server, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Wifi, 
  WifiOff 
} from 'lucide-react';
import { HumanDetectedPayload } from '@/lib/detectionEvents';
import { HeaderBar } from '@/components/HeaderBar';
import { TelemetryHUD } from '@/components/TelemetryHUD';
import { AIBriefing } from '@/components/AIBriefing';
import { AlertDrawer } from '@/components/AlertDrawer';
import { SignalHealthMonitor } from '@/components/SignalHealthMonitor';
import { MissionCompleteModal } from '@/components/MissionCompleteModal';
import { FieldResponderDispatch } from '@/components/FieldResponderDispatch';
import { RedEmergencyBanner } from '@/components/RedEmergencyBanner';
import { OperatorPanel } from '@/components/OperatorPanel';
import { QuickTourOverlay } from '@/components/QuickTourOverlay';
import { UIProvider, useUI } from '@/lib/uiContext';
import { useSocketTelemetry } from '@/lib/socket';
import { useHotkeys } from '@/lib/useHotkeys';
import { type DroneCameraMode } from '@/components/DroneCameraFeed';

// FastAPI Backend Base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://aquarescue-backend.onrender.com';


interface BackendTelemetry {
  status?: string;
  message?: string;
  timestamp?: number | string;
  [key: string]: any;
}

const LeafletMapView = dynamic(
  () => import('@/components/LeafletMapView'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#090D16] flex items-center justify-center font-mono text-xs text-[#06B6D4]">
        INITIALIZING TACTICAL MAP MESH...
      </div>
    ),
  }
);

const ActiveMissionOverlay = dynamic(
  () => import('@/components/ActiveMissionOverlay'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#090D16] flex items-center justify-center font-mono text-xs text-[#EF4444]">
        INITIALIZING EMERGENCY MISSION MODE...
      </div>
    ),
  }
);

const DroneCameraFeed = dynamic(
  () => import('@/components/DroneCameraFeed'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#070C16] flex items-center justify-center font-mono text-xs text-[#06B6D4]">
        INITIALIZING UAV FEED...
      </div>
    ),
  }
);

function DashboardContent() {
  const { mode, speakEvent } = useUI();
  const [predictionWindow, setPredictionWindow] = useState<15 | 30 | 45 | 60>(30);
  const [showMissionComplete, setShowMissionComplete] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [monitoringCameraMode, setMonitoringCameraMode] = useState<DroneCameraMode>('RGB');
  const prevDistressRef = useRef(false);

  // FastAPI dynamic telemetry state
  const [telemetry, setTelemetry] = useState<BackendTelemetry | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [lastMissionSummary, setLastMissionSummary] = useState<{
    puckId: string;
    missionId: string | null;
    durationFormatted: string;
    detectionTime: string;
    screechConfidence: number;
    filteredLocation: any;
    droneStatus: string;
    buoyStatus: string;
    responderStatus: string;
  } | null>(null);

  const {
    state,
    sendExecuteRescue,
    sendOverrideDispatch,
    sendManualPayloadDrop,
    resolveIncident,
    toggleAudioVoice,
    triggerDemoScenario,
    addLog,
  } = useSocketTelemetry();

  // Asynchronous fetch for FastAPI backend telemetry
  const fetchTelemetry = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_URL}/`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText || 'Failed to fetch backend telemetry'}`);
      }

      const data: BackendTelemetry = await res.json();
      setTelemetry(data);
    } catch (err: any) {
      console.warn('FastAPI backend fetch notice:', err);
      setError(err?.message || 'Unable to establish connection with FastAPI backend service');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Voice announcements on critical emergency events
  useEffect(() => {
    if (state.activeDistress && !prevDistressRef.current) {
      speakEvent('Critical distress signal detected. One click auto dispatch ready.');
    }
    prevDistressRef.current = state.activeDistress;
  }, [state.activeDistress, speakEvent]);

  // Handle mission completion and snapshot metrics
  const handleResolveIncident = useCallback(() => {
    if (state.activeDistress) {
      const elapsedSec = state.missionStartTime
        ? Math.floor((Date.now() - state.missionStartTime) / 1000)
        : 0;
      const mins = Math.floor(elapsedSec / 60);
      const secs = elapsedSec % 60;
      const durationFormatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

      setLastMissionSummary({
        puckId: state.puckId,
        missionId: state.missionId,
        durationFormatted,
        detectionTime: new Date().toLocaleTimeString('en-US', { hour12: false }),
        screechConfidence: state.sensorData.screechConfidence,
        filteredLocation: state.filteredLocation,
        droneStatus: state.droneStatus,
        buoyStatus: state.buoyStatus,
        responderStatus: state.responderStatus,
      });

      setShowMissionComplete(true);
      speakEvent('Mission completed. Victim secured.');
    }
    resolveIncident();
  }, [state, resolveIncident, speakEvent]);

  const handleAutoDispatch = useCallback(() => {
    sendExecuteRescue();
    speakEvent('Rescue units auto dispatched. Drone en route.');
  }, [sendExecuteRescue, speakEvent]);

  // Global Keyboard Hotkey Handler
  useHotkeys({
    onExecuteRescue: () => {
      sendExecuteRescue();
      speakEvent('Rescue units auto dispatched. Drone en route.');
    },
    onManualPayloadDrop: () => {
      sendManualPayloadDrop();
      speakEvent('Drone payload dropped at target coordinates.');
    },
    onResolveIncident: handleResolveIncident,
    onToggleAudio: toggleAudioVoice,
  });

  // Camera-pipeline human detection → push to incident log + trigger distress if needed
  useEffect(() => {
    const handler = (e: Event) => {
      const payload = (e as CustomEvent<HumanDetectedPayload>).detail;
      const stage = payload.scenario ?? 'HUMAN_DETECTED';
      addLog(
        'ALERT',
        `[UAV CAM] ${stage.replace(/_/g, ' ')} — ${payload.label}`,
        `GPS: ${payload.lat.toFixed(6)}, ${payload.lng.toFixed(6)} · Conf: ${payload.confidence.toFixed(1)}% · ${new Date(payload.timestamp).toLocaleTimeString('en-US', { hour12: false })}`,
      );
    };
    window.addEventListener('aquarescue:human-detected', handler);
    return () => window.removeEventListener('aquarescue:human-detected', handler);
  }, [addLog]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#090D16] overflow-hidden relative font-sans text-slate-100">
      
      {/* ── RESPONDER MOBILE GPS LINK & QR DISPATCH MODAL ────────────────── */}
      <FieldResponderDispatch
        isOpen={isDispatchModalOpen}
        onClose={() => setIsDispatchModalOpen(false)}
        puckId={state.puckId}
        targetLocation={state.filteredLocation}
        waterSpeed={state.sensorData.waterVelocity}
        driftHeading={state.sensorData.driftHeading}
        buoyEtaSec={state.hydrodynamics?.distanceMatrix?.buoyEtaSec}
      />

      {/* ── FULL-SCREEN ACTIVE RESCUE MISSION OVERLAY (WHEN DISTRESS ACTIVE) ── */}
      {state.activeDistress && (
        <ActiveMissionOverlay
          missionId={state.missionId}
          missionStartTime={state.missionStartTime}
          puckId={state.puckId}
          filteredLocation={state.filteredLocation}
          rawLocation={state.rawLocation}
          sensorData={state.sensorData}
          hydrodynamics={state.hydrodynamics}
          droneLocation={state.droneLocation}
          buoyLocation={state.buoyLocation}
          responderLocation={state.responderLocation}
          dronePath={state.dronePath}
          buoyPath={state.buoyPath}
          responderPath={state.responderPath}
          droneStatus={state.droneStatus}
          buoyStatus={state.buoyStatus}
          responderStatus={state.responderStatus}
          payloadStatus={state.payloadStatus}
          payloadStatusTimestamp={state.payloadStatusTimestamp}
          predictionWindow={predictionWindow}
          setPredictionWindow={setPredictionWindow}
          aiBriefing={state.aiBriefing}
          audioVoiceEnabled={state.audioVoiceEnabled}
          eventLogs={state.eventLogs}
          isConnected={state.isConnected}
          onExecuteRescue={sendExecuteRescue}
          onOverrideDispatch={sendOverrideDispatch}
          onManualPayloadDrop={sendManualPayloadDrop}
          onResolveIncident={handleResolveIncident}
          onToggleAudio={toggleAudioVoice}
        />
      )}

      {/* ── INTERACTIVE QUICK TOUR DEMO WALKTHROUGH OVERLAY ──────────────── */}
      <QuickTourOverlay />

      {/* ── MISSION COMPLETE MODAL (WHEN INCIDENT RESOLVED) ────────────────── */}
      {showMissionComplete && lastMissionSummary && (
        <MissionCompleteModal
          isOpen={showMissionComplete}
          onClose={() => setShowMissionComplete(false)}
          puckId={lastMissionSummary.puckId}
          missionId={lastMissionSummary.missionId}
          durationFormatted={lastMissionSummary.durationFormatted}
          detectionTime={lastMissionSummary.detectionTime}
          screechConfidence={lastMissionSummary.screechConfidence}
          filteredLocation={lastMissionSummary.filteredLocation}
          droneStatus={lastMissionSummary.droneStatus}
          buoyStatus={lastMissionSummary.buoyStatus}
          responderStatus={lastMissionSummary.responderStatus}
        />
      )}

      {/* ── TOP HEADER BAR WITH DUAL UI MODE TOGGLE & QUICK TOUR ────────── */}
      <HeaderBar
        isConnected={state.isConnected}
        activeDistress={state.activeDistress}
        audioVoiceEnabled={state.audioVoiceEnabled}
        onToggleAudio={toggleAudioVoice}
        onTriggerDemo={triggerDemoScenario}
        onResolve={handleResolveIncident}
        onShareTrack={() => setIsDispatchModalOpen(true)}
      />

      {/* ── FASTAPI BACKEND TELEMETRY INTEGRATION STATUS STRIP ─────────── */}
      <div className="w-full bg-[#0B111E] border-b border-slate-800/80 px-4 py-1.5 flex flex-wrap items-center justify-between text-xs font-mono select-none z-20 gap-2">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Server className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[11px] font-semibold tracking-wider text-slate-300 uppercase">
              FastAPI API Service:
            </span>
            <span className="text-[10px] text-cyan-400/80 max-w-[200px] sm:max-w-xs truncate" title={API_URL}>
              {API_URL}
            </span>
          </div>

          <div className="h-3 w-px bg-slate-800 hidden sm:block" />

          {/* Dynamic API Status Indicators */}
          {loading ? (
            <div className="flex items-center space-x-1.5 text-amber-400 animate-pulse">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-[11px] font-medium">QUERYING ENDPOINT...</span>
            </div>
          ) : error ? (
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-[11px] font-medium truncate max-w-xs sm:max-w-md">
                ENDPOINT OFFLINE: {error}
              </span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] font-bold tracking-wide">
                {telemetry?.status || 'CONNECTED'}
              </span>
              {telemetry?.message && (
                <span className="text-[10px] text-slate-400 hidden md:inline">
                  — {telemetry.message}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action / Fallback Retry Button */}
        <div className="flex items-center space-x-2">
          <button
            onClick={fetchTelemetry}
            disabled={loading}
            title="Refresh FastAPI Backend Telemetry"
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-cyan-300 text-[10px] transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>SYNC API</span>
          </button>
        </div>
      </div>

      {/* ── PERSISTENT RED EMERGENCY BANNER WITH 1-CLICK AUTO DISPATCH ───── */}
      {state.activeDistress && (
        <RedEmergencyBanner
          activeDistress={state.activeDistress}
          puckId={state.puckId}
          droneStatus={state.droneStatus}
          buoyStatus={state.buoyStatus}
          responderStatus={state.responderStatus}
          filteredLocation={state.filteredLocation}
          onAutoDispatch={handleAutoDispatch}
          onResolveIncident={handleResolveIncident}
        />
      )}

      {/* ── MAIN COMMAND CENTER DUAL-MODE LAYOUT ─────────────────────────── */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row w-full overflow-hidden transition-all duration-300">
        
        {/* ── MAP CANVAS (70% IN OPERATOR MODE | 65% IN TACTICAL MODE) ────── */}
        <div
          className={`w-full h-[50vh] lg:h-full relative transition-all duration-300 ${
            mode === 'OPERATOR' ? 'lg:w-[70%]' : 'lg:w-[65%]'
          }`}
        >
          <LeafletMapView
            filteredTarget={state.filteredLocation}
            rawTarget={state.rawLocation}
            droneLocation={state.droneLocation}
            droneHeading={state.droneHeading}
            buoyLocation={state.buoyLocation}
            buoyHeading={state.buoyHeading}
            responderLocation={state.responderLocation}
            dronePath={state.dronePath}
            buoyPath={state.buoyPath}
            responderPath={state.responderPath}
            hydrodynamics={state.hydrodynamics}
            activeDistress={state.activeDistress}
            puckId={state.puckId}
            predictionWindow={predictionWindow}
            setPredictionWindow={setPredictionWindow}
            sensorData={state.sensorData}
            droneStatus={state.droneStatus}
            buoyStatus={state.buoyStatus}
            responderStatus={state.responderStatus}
          />
        </div>

        {/* ── RIGHT PANEL (30% IN OPERATOR MODE | 35% IN TACTICAL MODE) ───── */}
        <div
          className={`w-full h-[50vh] lg:h-full bg-[#0D1322] flex flex-col overflow-y-auto border-l border-slate-800 transition-all duration-300 ${
            mode === 'OPERATOR' ? 'lg:w-[30%]' : 'lg:w-[35%]'
          }`}
        >
          {mode === 'OPERATOR' ? (
            /* OPERATOR MODE: Streamlined 2-Card Panel */
            <OperatorPanel
              droneStatus={state.droneStatus}
              buoyStatus={state.buoyStatus}
              responderStatus={state.responderStatus}
              puckId={state.puckId}
              filteredLocation={state.filteredLocation}
              droneLocation={state.droneLocation}
              buoyLocation={state.buoyLocation}
              responderLocation={state.responderLocation}
              sensorData={state.sensorData}
              activeDistress={state.activeDistress}
              onAutoDispatch={handleAutoDispatch}
              onOverrideDispatch={sendOverrideDispatch}
              onManualPayloadDrop={sendManualPayloadDrop}
            />
          ) : (
            /* TACTICAL MODE: Full Multi-Panel Telemetry HUD & AI Panel */
            <>
              {/* UAV Optical & Thermal HUD */}
              <div className="shrink-0 p-3 border-b border-[#1F293D]" style={{ height: '300px', minHeight: '300px' }}>
                <DroneCameraFeed
                  mode={monitoringCameraMode}
                  onModeChange={setMonitoringCameraMode}
                  detectionConfidence={state.sensorData.screechConfidence * 100}
                  targetLat={state.droneLocation.lat}
                  targetLng={state.droneLocation.lng}
                  altitudeM={48}
                  headingDeg={Math.round(state.droneHeading)}
                  signalDbm={-42}
                  distanceToTarget={120}
                  droneId="UAV-RESCUE-01"
                  isSimulated={!state.isConnected}
                  videoSrc={process.env.NEXT_PUBLIC_SURVEILLANCE_VIDEO ?? undefined}
                />
              </div>

              <div className="flex-1 min-h-[360px]">
                <TelemetryHUD
                  puckId={state.puckId}
                  filteredLocation={state.filteredLocation}
                  rawLocation={state.rawLocation}
                  sensorData={state.sensorData}
                  hydrodynamics={state.hydrodynamics}
                  activeDistress={state.activeDistress}
                  onExecuteRescue={sendExecuteRescue}
                  onOverrideDispatch={sendOverrideDispatch}
                  onManualPayloadDrop={sendManualPayloadDrop}
                  onResolveIncident={handleResolveIncident}
                  predictionWindow={predictionWindow}
                  setPredictionWindow={setPredictionWindow}
                  isConnected={state.isConnected}
                  droneLocation={state.droneLocation}
                  buoyLocation={state.buoyLocation}
                  responderLocation={state.responderLocation}
                  droneStatus={state.droneStatus}
                  buoyStatus={state.buoyStatus}
                  responderStatus={state.responderStatus}
                />
              </div>

              <div className="p-3 bg-[#090D16]/90 border-t border-slate-800">
                <AIBriefing briefing={state.aiBriefing} audioVoiceEnabled={state.audioVoiceEnabled} />
              </div>

              <div className="p-3 bg-[#090D16]/90 border-t border-slate-800">
                <SignalHealthMonitor
                  isConnected={state.isConnected}
                  activeDistress={state.activeDistress}
                  puckId={state.puckId}
                  lastPacketTimestamp={state.lastPacketTimestamp}
                  sensorData={state.sensorData}
                />
              </div>

              <div className="p-3 bg-[#090D16] border-t border-slate-800">
                <AlertDrawer logs={state.eventLogs} />
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default function AquaRescueDashboard() {
  return (
    <UIProvider>
      <DashboardContent />
    </UIProvider>
  );
}
