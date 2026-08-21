'use client';

<<<<<<< HEAD
import React, { useState, useCallback, useEffect, useRef } from 'react';
=======
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { HumanDetectedPayload } from '@/lib/detectionEvents';
>>>>>>> c9acf68d8dd79220906f9ad8ed5bc01018b10e07
import dynamic from 'next/dynamic';
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

const LeafletMapView = dynamic(
  () => import('@/components/LeafletMapView'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#090D16] flex items-center justify-center font-mono text-xs text-[#06B6D4]">
        INITIALIZING TACTICAL CARTO MAP MESH...
      </div>
    ),
  }
);

<<<<<<< HEAD
function DashboardContent() {
  const { mode, speakEvent } = useUI();
  const [predictionWindow, setPredictionWindow] = useState<15 | 30 | 45 | 60>(30);
  const [showMissionComplete, setShowMissionComplete] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const prevDistressRef = useRef(false);

=======
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


export default function AquaRescueDashboard() {
  const [predictionWindow, setPredictionWindow] = useState<15 | 30 | 45 | 60>(30);
  const [showMissionComplete, setShowMissionComplete] = useState(false);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [monitoringCameraMode, setMonitoringCameraMode] = useState<DroneCameraMode>('RGB');
>>>>>>> c9acf68d8dd79220906f9ad8ed5bc01018b10e07
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

<<<<<<< HEAD
  const handleAutoDispatch = useCallback(() => {
    sendExecuteRescue();
    speakEvent('Rescue units auto dispatched. Drone en route.');
  }, [sendExecuteRescue, speakEvent]);
=======
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
>>>>>>> c9acf68d8dd79220906f9ad8ed5bc01018b10e07

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
            buoyLocation={state.buoyLocation}
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

<<<<<<< HEAD
        {/* ── RIGHT PANEL (30% IN OPERATOR MODE | 35% IN TACTICAL MODE) ───── */}
        <div
          className={`w-full h-[50vh] lg:h-full bg-[#0D1322] flex flex-col overflow-y-auto border-l border-slate-800 transition-all duration-300 ${
            mode === 'OPERATOR' ? 'lg:w-[30%]' : 'lg:w-[35%]'
          }`}
        >
          {mode === 'OPERATOR' ? (
            /* OPERATOR MODE: Streamlined 2-Card Panel */
            <OperatorPanel
=======
        {/* 35% Telemetry HUD & Intelligence Panel */}
        <div className="w-full lg:w-[35%] h-[50vh] lg:h-full bg-[#111827] flex flex-col overflow-y-auto border-l border-[#1F293D] shadow-2xl">
          {/* UAV Optical & Thermal HUD — always visible in Monitoring */}
          <div className="shrink-0 p-3 border-b border-[#1F293D]" style={{ height: '300px', minHeight: '300px' }}>
            <DroneCameraFeed
              mode={monitoringCameraMode}
              onModeChange={setMonitoringCameraMode}
              detectionConfidence={state.sensorData.screechConfidence * 100}
              targetLat={state.filteredLocation?.lat ?? 17.385044}
              targetLng={state.filteredLocation?.lng ?? 78.486671}
              altitudeM={48}
              headingDeg={214}
              signalDbm={-42}
              distanceToTarget={120}
              droneId="UAV-RESCUE-01"
              isSimulated={!state.isConnected}
              videoSrc={process.env.NEXT_PUBLIC_SURVEILLANCE_VIDEO ?? undefined}
            />
          </div>

          {/* Top Telemetry Metrics & Action Console */}
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
>>>>>>> c9acf68d8dd79220906f9ad8ed5bc01018b10e07
              droneStatus={state.droneStatus}
              buoyStatus={state.buoyStatus}
              responderStatus={state.responderStatus}
              puckId={state.puckId}
              filteredLocation={state.filteredLocation}
              sensorData={state.sensorData}
              activeDistress={state.activeDistress}
              onAutoDispatch={handleAutoDispatch}
              onOverrideDispatch={sendOverrideDispatch}
              onManualPayloadDrop={sendManualPayloadDrop}
            />
          ) : (
            /* TACTICAL MODE: Full Multi-Panel Telemetry HUD & AI Panel */
            <>
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
