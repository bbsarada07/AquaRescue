'use client';

import React from 'react';
import { HeaderBar } from '@/components/HeaderBar';
import { MapBoxView } from '@/components/MapBoxView';
import { TelemetryHUD } from '@/components/TelemetryHUD';
import { AIBriefing } from '@/components/AIBriefing';
import { AlertDrawer } from '@/components/AlertDrawer';
import { useSocketTelemetry } from '@/lib/socket';

export default function AquaRescueDashboard() {
  const {
    state,
    sendExecuteRescue,
    sendOverrideDispatch,
    sendManualPayloadDrop,
    resolveIncident,
    toggleAudioVoice,
    triggerDemoScenario,
  } = useSocketTelemetry();

  return (
    <div className="flex flex-col w-full h-screen bg-[#090D16] overflow-hidden">
      {/* Top Fixed Header Bar */}
      <HeaderBar
        isConnected={state.isConnected}
        activeDistress={state.activeDistress}
        audioVoiceEnabled={state.audioVoiceEnabled}
        onToggleAudio={toggleAudioVoice}
        onTriggerDemo={triggerDemoScenario}
        onResolve={resolveIncident}
      />

      {/* Main Command Grid Layout: 65% Interactive 3D Map | 35% Telemetry HUD & AI Panel */}
      <main className="flex-1 min-h-0 flex flex-col lg:flex-row w-full overflow-hidden">
        {/* 65% Interactive Spatial Map View */}
        <div className="w-full lg:w-[65%] h-[50vh] lg:h-full relative">
          <MapBoxView
            filteredTarget={state.filteredLocation}
            rawTarget={state.rawLocation}
            droneLocation={state.droneLocation}
            buoyLocation={state.buoyLocation}
            dronePath={state.dronePath}
            buoyPath={state.buoyPath}
            hydrodynamics={state.hydrodynamics}
            activeDistress={state.activeDistress}
            puckId={state.puckId}
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
              onResolveIncident={resolveIncident}
            />
          </div>

          {/* Gemini Tactical AI Incident Briefing Panel */}
          <div className="p-3 bg-[#090D16]/90 border-t border-[#1F293D]">
            <AIBriefing
              briefing={state.aiBriefing}
              audioVoiceEnabled={state.audioVoiceEnabled}
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
