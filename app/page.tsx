'use client';

import React, { useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { HeaderBar } from '@/components/HeaderBar';
import { TelemetryHUD } from '@/components/TelemetryHUD';
import { AIBriefing } from '@/components/AIBriefing';
import { AlertDrawer } from '@/components/AlertDrawer';
import { SignalHealthMonitor } from '@/components/SignalHealthMonitor';
import { MissionCompleteModal } from '@/components/MissionCompleteModal';
import { useSocketTelemetry } from '@/lib/socket';

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


export default function AquaRescueDashboard() {
  const [predictionWindow, setPredictionWindow] = useState<15 | 30 | 45 | 60>(30);
  const [showMissionComplete, setShowMissionComplete] = useState(false);
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
  } = useSocketTelemetry();

  // Custom resolve handler to snapshot metrics for completion modal
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
    }
    resolveIncident();
  }, [state, resolveIncident]);

  return (
    <div className="flex flex-col w-full h-screen bg-[#090D16] overflow-hidden relative">
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

      {/* ── NORMAL COMMAND DASHBOARD (MONITORING MODE) ────────────────────── */}
      <HeaderBar
        isConnected={state.isConnected}
        activeDistress={state.activeDistress}
        audioVoiceEnabled={state.audioVoiceEnabled}
        onToggleAudio={toggleAudioVoice}
        onTriggerDemo={triggerDemoScenario}
        onResolve={handleResolveIncident}
      />

      {/* Main Command Grid Layout: 65% Interactive 3D Map | 35% Telemetry HUD & AI Panel */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row w-full overflow-hidden">
        {/* 65% Interactive Spatial Map View */}
        <div className="w-full lg:w-[65%] h-[50vh] lg:h-full relative">
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

        {/* 35% Telemetry HUD & Intelligence Panel */}
        <div className="w-full lg:w-[35%] h-[50vh] lg:h-full bg-[#111827] flex flex-col overflow-y-auto border-l border-[#1F293D] shadow-2xl">
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
              droneStatus={state.droneStatus}
              buoyStatus={state.buoyStatus}
              responderStatus={state.responderStatus}
            />
          </div>

          {/* Gemini Tactical AI Incident Briefing Panel */}
          <div className="p-3 bg-[#090D16]/90 border-t border-[#1F293D]">
            <AIBriefing
              briefing={state.aiBriefing}
              audioVoiceEnabled={state.audioVoiceEnabled}
            />
          </div>

          {/* Live Signal Health Monitor */}
          <div className="p-3 bg-[#090D16]/90 border-t border-[#1F293D]">
            <SignalHealthMonitor
              isConnected={state.isConnected}
              activeDistress={state.activeDistress}
              puckId={state.puckId}
              lastPacketTimestamp={state.lastPacketTimestamp}
              sensorData={state.sensorData}
            />
          </div>

          {/* Real-time Event Stream Drawer */}
          <div className="p-3 bg-[#090D16] border-t border-[#1F293D]">
            <AlertDrawer logs={state.eventLogs} />
          </div>
        </div>
      </main>
    </div>
  );
}
