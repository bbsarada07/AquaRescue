/**
 * AquaRescue WebSocket Client & High-Frequency Telemetry Buffer
 * 
 * Features:
 * - Socket.io auto-connecting to NEXT_PUBLIC_WS_URL or fallback wss://aquarescue-backend.onrender.com
 * - Dynamic socket management & reconnection safety
 * - Fallback transport compatibility: ['websocket', 'polling']
 * - Reconnection attempts: Infinity
 * - Sub-100ms useRef high-frequency state buffering & RAF frame throttling
 * - Real-time 2D Kalman Filter integration for sub-meter lat/lng smoothing
 * - Hydrodynamic drift compensation calculation
 * - Command emission back to server / hardware
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { KalmanFilter2D, FilteredResult, GPSCoordinate } from './kalman';
import { calculateDriftCompensatedVector, HydrodynamicVectorResult } from './hydrodynamics';
import { generateTacticalBriefing, speakBriefing, BriefingResponse } from './gemini';
import {
  stepAssetTracking,
  createInitialTrackingState,
  TrackingEngineState,
} from './trackingEngine';

export interface TelemetryData {
  event: string;
  puck_id: string;
  location: GPSCoordinate;
  sensor_data: {
    audio_screech_confidence: number;
    thermal_delta_c: number;
    water_velocity_ms: number;
    drift_heading_deg: number;
  };
  timestamp: number;
}

export interface LogEntry {
  id: string;
  time: string;
  type: 'ALERT' | 'COMMAND' | 'SYSTEM' | 'AI';
  message: string;
  details?: string;
}

export interface AquaRescueState {
  isConnected: boolean;
  activeDistress: boolean;
  puckId: string;
  rawLocation: GPSCoordinate;
  filteredLocation: FilteredResult;
  droneLocation: GPSCoordinate;
  droneHeading: number;
  buoyLocation: GPSCoordinate;
  buoyHeading: number;
  responderLocation: GPSCoordinate;
  sensorData: {
    screechConfidence: number;
    thermalDelta: number;
    waterVelocity: number;
    driftHeading: number;
    gimbalLocked: boolean;
    payloadReady: boolean;
  };
  hydrodynamics: HydrodynamicVectorResult | null;
  aiBriefing: BriefingResponse | null;
  dronePath: GPSCoordinate[];
  buoyPath: GPSCoordinate[];
  responderPath: GPSCoordinate[];
  droneStatus: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  buoyStatus: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  responderStatus: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  payloadStatus: 'STANDBY' | 'EN_ROUTE' | 'RELEASED' | 'CONFIRMED_DEPLOYED';
  payloadStatusTimestamp: number;
  lastPacketTimestamp: number | null;
  missionStartTime: number | null;
  missionId: string | null;
  eventLogs: LogEntry[];
  audioVoiceEnabled: boolean;
  serverUrl: string;
}

// Environment bindings & dynamic connection URL fallback
export const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL || "https://aquarescue-backend.onrender.com";

const INITIAL_VICTIM: GPSCoordinate = { lat: 17.385044, lng: 78.486671 };
const INITIAL_DRONE: GPSCoordinate = { lat: 17.387544, lng: 78.489171 };
const INITIAL_BUOY: GPSCoordinate = { lat: 17.383044, lng: 78.485171 };
const INITIAL_RESPONDER: GPSCoordinate = { lat: 17.382044, lng: 78.488671 };

// Helper to sanitize & resolve connection URL protocol for Socket.io
export function resolveSocketUrl(overrideUrl?: string): string {
  const envUrl = overrideUrl || process.env.NEXT_PUBLIC_WS_URL;
  const fallback = "https://aquarescue-backend.onrender.com";
  const raw = envUrl && envUrl.trim() !== "" ? envUrl : fallback;
  // Standardize wss:// or ws:// to https:// or http:// for Socket.io engine client
  return raw.replace(/^wss:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
}

export const getResolvedWsUrl = resolveSocketUrl;

// Single unified Socket.io client instance
export const socket: Socket = io(resolveSocketUrl(), {
  transports: ['polling', 'websocket'], // Force polling handshake before upgrading
  upgrade: true,
  autoConnect: true,
  reconnectionAttempts: Infinity,
  withCredentials: true,
});

export function useSocketTelemetry(serverUrl?: string) {
  const socketRef = useRef<Socket | null>(null);

  // High-frequency useRef buffer for 100ms telemetry ticks
  const telemetryBufferRef = useRef<TelemetryData | null>(null);
  const kalmanRef = useRef<KalmanFilter2D>(new KalmanFilter2D(1e-5, 5e-5));
  const rafIdRef = useRef<number | null>(null);
  const lastStateUpdateMsRef = useRef<number>(0);
  const trackingEngineRef = useRef<TrackingEngineState>(createInitialTrackingState());
  const lastTickTimeRef = useRef<number>(typeof performance !== 'undefined' ? performance.now() : Date.now());

  // Main UI State
  const [state, setState] = useState<AquaRescueState>(() => {
    const initTracking = createInitialTrackingState();
    return {
      isConnected: false,
      activeDistress: false,
      puckId: 'PUCK-ALPHA-04',
      rawLocation: INITIAL_VICTIM,
      filteredLocation: {
        lat: INITIAL_VICTIM.lat,
        lng: INITIAL_VICTIM.lng,
        latVelocity: 0,
        lngVelocity: 0,
        variance: 0.1,
        noiseDeltaMeters: 0
      },
      droneLocation: { lat: initTracking.drone.lat, lng: initTracking.drone.lng },
      droneHeading: initTracking.drone.heading,
      buoyLocation: { lat: initTracking.buoy.lat, lng: initTracking.buoy.lng },
      buoyHeading: initTracking.buoy.heading,
      responderLocation: { lat: initTracking.boat.lat, lng: initTracking.boat.lng },
      responderHeading: initTracking.boat.heading,
      sensorData: {
        screechConfidence: 0.96,
        thermalDelta: 5.2,
        waterVelocity: 1.8,
        driftHeading: 140,
        gimbalLocked: true,
        payloadReady: true
      },
      hydrodynamics: null,
      aiBriefing: null,
      dronePath: initTracking.drone.path,
      buoyPath: initTracking.buoy.path,
      responderPath: initTracking.boat.path,
      droneStatus: 'STANDBY',
      buoyStatus: 'STANDBY',
      responderStatus: 'STANDBY',
      payloadStatus: 'STANDBY',
      payloadStatusTimestamp: Date.now(),
      lastPacketTimestamp: null,
      missionStartTime: null,
      missionId: null,
      eventLogs: [],
      audioVoiceEnabled: true,
      serverUrl: getResolvedWsUrl(serverUrl)
    };
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  const addLog = useCallback((type: LogEntry['type'], message: string, details?: string) => {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      type,
      message,
      details
    };
    setState(prev => ({
      ...prev,
      eventLogs: [entry, ...prev.eventLogs.slice(0, 49)]
    }));
  }, []);

  // Process Telemetry Payload with Kalman Filter & Hydrodynamics
  const processTelemetry = useCallback((data: TelemetryData) => {
    telemetryBufferRef.current = data;
  }, []);

  // Real-time tracking physics & UI update loop using requestAnimationFrame
  useEffect(() => {
    let mounted = true;

    const tick = (now: number) => {
      if (!mounted) return;

      const elapsed = now - lastTickTimeRef.current;
      if (elapsed >= 35) {
        const dtSec = Math.min(elapsed / 1000, 0.1);
        lastTickTimeRef.current = now;

        const data = telemetryBufferRef.current;
        let kalmanOut: FilteredResult | null = null;
        if (data) {
          kalmanOut = kalmanRef.current.update(
            data.location.lat,
            data.location.lng,
            data.timestamp || Date.now()
          );
        }

        setState(prev => {
          const currentTarget = kalmanOut || prev.filteredLocation;

          // Step tracking engine forward
          trackingEngineRef.current = stepAssetTracking(
            trackingEngineRef.current,
            currentTarget,
            prev.activeDistress,
            dtSec
          );

          const { drone, buoy, boat } = trackingEngineRef.current;

          // Check if payload drop should deploy near victim
          const droneDist = KalmanFilter2D.haversineDistanceMeters(
            drone.lat,
            drone.lng,
            currentTarget.lat,
            currentTarget.lng
          );

          let nextPayloadStatus = prev.payloadStatus;
          let nextPayloadTimestamp = prev.payloadStatusTimestamp;
          if (
            (drone.status === 'TARGET_REACHED' || droneDist < 14) &&
            (prev.payloadStatus === 'RELEASED' || prev.payloadStatus === 'EN_ROUTE')
          ) {
            nextPayloadStatus = 'CONFIRMED_DEPLOYED';
            nextPayloadTimestamp = Date.now();
          }

          const hydro = (data && kalmanOut)
            ? calculateDriftCompensatedVector(
                { lat: kalmanOut.lat, lng: kalmanOut.lng },
                data.sensor_data.water_velocity_ms,
                data.sensor_data.drift_heading_deg,
                { lat: buoy.lat, lng: buoy.lng },
                { lat: drone.lat, lng: drone.lng }
              )
            : prev.hydrodynamics;

          return {
            ...prev,
            ...(data && kalmanOut ? {
              activeDistress: true,
              puckId: data.puck_id,
              rawLocation: data.location,
              filteredLocation: kalmanOut,
              sensorData: {
                screechConfidence: data.sensor_data.audio_screech_confidence,
                thermalDelta: data.sensor_data.thermal_delta_c,
                waterVelocity: data.sensor_data.water_velocity_ms,
                driftHeading: data.sensor_data.drift_heading_deg,
                gimbalLocked: prev.sensorData.gimbalLocked,
                payloadReady: prev.sensorData.payloadReady,
              },
              hydrodynamics: hydro,
              lastPacketTimestamp: data.timestamp,
              missionStartTime: prev.missionStartTime || Date.now(),
              missionId: prev.missionId || `AR-${Math.floor(100 + Math.random() * 899)}`,
            } : {}),
            droneLocation: { lat: drone.lat, lng: drone.lng },
            droneHeading: drone.heading,
            buoyLocation: { lat: buoy.lat, lng: buoy.lng },
            buoyHeading: buoy.heading,
            responderLocation: { lat: boat.lat, lng: boat.lng },
            responderHeading: boat.heading,
            dronePath: drone.path,
            buoyPath: buoy.path,
            responderPath: boat.path,
            droneStatus: drone.status,
            buoyStatus: buoy.status,
            responderStatus: boat.status,
            payloadStatus: nextPayloadStatus,
            payloadStatusTimestamp: nextPayloadTimestamp,
          };
        });
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      mounted = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  const audioVoiceEnabledRef = useRef(state.audioVoiceEnabled);
  useEffect(() => {
    audioVoiceEnabledRef.current = state.audioVoiceEnabled;
  }, [state.audioVoiceEnabled]);

  // Dynamic Socket Connection Management
  useEffect(() => {
    const targetEndpoint = resolveSocketUrl(serverUrl);
    console.log("[AquaRescue Socket] Connecting to endpoint:", targetEndpoint);
    addLog('SYSTEM', `Initializing Socket.io client to endpoint: ${targetEndpoint}`);

    const socketInstance = io(targetEndpoint, {
      transports: ['polling', 'websocket'], // Force polling handshake before upgrading
      upgrade: true,
      autoConnect: true,
      reconnectionAttempts: Infinity,
      withCredentials: true,
    });

    socketRef.current = socketInstance;

    const onConnect = () => {
      setState(prev => ({ ...prev, isConnected: true }));
      addLog('SYSTEM', `Connected to AquaRescue Socket.io Server (${socketInstance.id})`);
    };

    const onDisconnect = () => {
      setState(prev => ({ ...prev, isConnected: false }));
      addLog('SYSTEM', 'Disconnected from Socket.io server');
    };

    const onDistressTriggered = async (data: TelemetryData) => {
      processTelemetry(data);

      const droneLoc = stateRef.current.droneLocation;
      const buoyLoc = stateRef.current.buoyLocation;
      const respLoc = stateRef.current.responderLocation;

      const dDist = KalmanFilter2D.haversineDistanceMeters(droneLoc.lat, droneLoc.lng, data.location.lat, data.location.lng);
      const bDist = KalmanFilter2D.haversineDistanceMeters(buoyLoc.lat, buoyLoc.lng, data.location.lat, data.location.lng);
      const rDist = KalmanFilter2D.haversineDistanceMeters(respLoc.lat, respLoc.lng, data.location.lat, data.location.lng);

      const dEta = Math.max(Math.round(dDist / 28), 1);
      const bEta = Math.max(Math.round(bDist / 6.5), 1);
      const rEta = Math.max(Math.round(rDist / 14), 1);

      addLog(
        'ALERT',
        `DISTRESS TRIGGERED by ${data.puck_id}`,
        `Target: [${data.location.lat.toFixed(6)}, ${data.location.lng.toFixed(6)}] | Audio Conf: ${(data.sensor_data.audio_screech_confidence * 100).toFixed(0)}%`
      );

      addLog('SYSTEM', 'ETA ENGINE INITIALIZED WITH LIVE ASSET POSITIONS');
      addLog('SYSTEM', `UAV-RESCUE-01 [${droneLoc.lat.toFixed(5)}, ${droneLoc.lng.toFixed(5)}] -> Dist: ${Math.round(dDist)}m | ETA: ${dEta}s`);
      addLog('SYSTEM', `BUOY-HYDRO-02 [${buoyLoc.lat.toFixed(5)}, ${buoyLoc.lng.toFixed(5)}] -> Dist: ${Math.round(bDist)}m | ETA: ${bEta}s`);
      addLog('SYSTEM', `RESCUE-TEAM-01 [${respLoc.lat.toFixed(5)}, ${respLoc.lng.toFixed(5)}] -> Dist: ${Math.round(rDist)}m | ETA: ${rEta}s`);
      addLog('AI', `${dEta <= bEta && dEta <= rEta ? 'UAV-RESCUE-01' : bEta <= rEta ? 'BUOY-HYDRO-02' : 'RESCUE-TEAM-01'} RECOMMENDED AS FASTEST RESPONSE`);

      try {
        const briefing = await generateTacticalBriefing(data);
        setState(prev => ({ ...prev, aiBriefing: briefing }));
        addLog('AI', 'Tactical AI Incident Briefing generated');

        if (audioVoiceEnabledRef.current) {
          speakBriefing(briefing.summary);
        }
      } catch (err) {
        console.error('Error generating AI briefing:', err);
      }
    };

    if (socketInstance.connected) {
      onConnect();
    }

    socketInstance.on('connect', onConnect);
    socketInstance.on('disconnect', onDisconnect);
    socketInstance.on('DISTRESS_TRIGGERED', onDistressTriggered);

    return () => {
      socketInstance.off('connect', onConnect);
      socketInstance.off('disconnect', onDisconnect);
      socketInstance.off('DISTRESS_TRIGGERED', onDistressTriggered);
      socketInstance.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, processTelemetry, addLog]);

  // Action Dispatch Functions
  const sendExecuteRescue = useCallback(() => {
    if (!state.activeDistress) return;
    const hydro = state.hydrodynamics;
    const payload = {
      command: "EXECUTE_RESCUE",
      target_puck_id: state.puckId,
      drone_command: {
        action: "LOCK_GIMBAL_AND_DROP",
        target_coords: state.filteredLocation
      },
      buoy_command: {
        action: "NAVIGATE_DRIFT_VECTOR",
        compensated_heading_deg: hydro ? hydro.compensatedHeadingDeg : 128,
        target_coords: state.filteredLocation
      }
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit('EXECUTE_RESCUE', payload);
    }
    
    // Update live tracking engine state
    trackingEngineRef.current.drone.status = 'DISPATCHED';
    trackingEngineRef.current.buoy.status = 'DISPATCHED';

    setState(prev => ({
      ...prev,
      droneStatus: 'DISPATCHED',
      buoyStatus: 'DISPATCHED',
      payloadStatus: 'EN_ROUTE',
      payloadStatusTimestamp: Date.now()
    }));
    addLog('COMMAND', `EXECUTE_RESCUE sent for ${state.puckId}`, `Drone: LOCK_GIMBAL_AND_DROP | Buoy Drift Heading: ${hydro?.compensatedHeadingDeg || 128}°`);
  }, [state.activeDistress, state.puckId, state.filteredLocation, state.hydrodynamics, addLog]);

  const sendOverrideDispatch = useCallback(() => {
    const payload = {
      command: "OVERRIDE_DISPATCH",
      target_puck_id: state.puckId,
      location: state.filteredLocation,
      timestamp: Date.now()
    };
    if (socketRef.current?.connected) {
      socketRef.current.emit('OVERRIDE_DISPATCH', payload);
    }

    trackingEngineRef.current.boat.status = 'DISPATCHED';

    setState(prev => ({
      ...prev,
      responderStatus: 'DISPATCHED'
    }));
    addLog('COMMAND', `OVERRIDE DISPATCH triggered for target ${state.puckId}`);
  }, [state.puckId, state.filteredLocation, addLog]);

  const sendManualPayloadDrop = useCallback(() => {
    const payload = {
      command: "MANUAL_PAYLOAD_DROP",
      target_puck_id: state.puckId,
      target_coords: state.filteredLocation,
      timestamp: Date.now()
    };
    if (socketRef.current?.connected) {
      socketRef.current.emit('MANUAL_PAYLOAD_DROP', payload);
    }
    
    trackingEngineRef.current.drone.status = 'DISPATCHED';

    setState(prev => ({
      ...prev,
      droneStatus: 'DISPATCHED',
      payloadStatus: 'RELEASED',
      payloadStatusTimestamp: Date.now()
    }));
    addLog('COMMAND', `MANUAL PAYLOAD DROP sent to UAV for ${state.puckId}`);
  }, [state.puckId, state.filteredLocation, addLog]);

  const resolveIncident = useCallback(() => {
    kalmanRef.current.reset(INITIAL_VICTIM.lat, INITIAL_VICTIM.lng);
    telemetryBufferRef.current = null;
    const resetTracking = createInitialTrackingState();
    trackingEngineRef.current = resetTracking;

    setState(prev => ({
      ...prev,
      activeDistress: false,
      rawLocation: INITIAL_VICTIM,
      filteredLocation: {
        lat: INITIAL_VICTIM.lat,
        lng: INITIAL_VICTIM.lng,
        latVelocity: 0,
        lngVelocity: 0,
        variance: 0.1,
        noiseDeltaMeters: 0
      },
      droneLocation: { lat: resetTracking.drone.lat, lng: resetTracking.drone.lng },
      droneHeading: resetTracking.drone.heading,
      buoyLocation: { lat: resetTracking.buoy.lat, lng: resetTracking.buoy.lng },
      buoyHeading: resetTracking.buoy.heading,
      responderLocation: { lat: resetTracking.boat.lat, lng: resetTracking.boat.lng },
      responderHeading: resetTracking.boat.heading,
      dronePath: resetTracking.drone.path,
      buoyPath: resetTracking.buoy.path,
      responderPath: resetTracking.boat.path,
      droneStatus: 'STANDBY',
      buoyStatus: 'STANDBY',
      responderStatus: 'STANDBY',
      payloadStatus: 'STANDBY',
      payloadStatusTimestamp: Date.now(),
      lastPacketTimestamp: null,
      missionStartTime: null,
      missionId: null,
      aiBriefing: null,
      hydrodynamics: null
    }));
    if (socketRef.current?.connected) {
      socketRef.current.emit('RESOLVE_INCIDENT', { puck_id: state.puckId });
    }
    addLog('SYSTEM', `Incident ${state.puckId} RESOLVED & System Reset`);
  }, [state.puckId, addLog]);


  const toggleAudioVoice = useCallback(() => {
    setState(prev => {
      const next = !prev.audioVoiceEnabled;
      if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      return { ...prev, audioVoiceEnabled: next };
    });
  }, []);

  const triggerDemoScenario = useCallback((scenario: 'SCREECH' | 'DRIFT' | 'INTERCEPT') => {
    const mockPayload: TelemetryData = {
      event: "DISTRESS_TRIGGERED",
      puck_id: "PUCK-ALPHA-04",
      location: {
        lat: 17.385044 + (Math.random() - 0.5) * 0.0004,
        lng: 78.486671 + (Math.random() - 0.5) * 0.0004
      },
      sensor_data: {
        audio_screech_confidence: scenario === 'SCREECH' ? 0.98 : 0.89,
        thermal_delta_c: scenario === 'DRIFT' ? 6.4 : 5.2,
        water_velocity_ms: scenario === 'DRIFT' ? 2.6 : 1.8,
        drift_heading_deg: scenario === 'DRIFT' ? 165 : 140
      },
      timestamp: Date.now()
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit('SIMULATE_TELEMETRY', mockPayload);
    } else {
      processTelemetry(mockPayload);

      const droneLoc = stateRef.current.droneLocation;
      const buoyLoc = stateRef.current.buoyLocation;
      const respLoc = stateRef.current.responderLocation;

      const dDist = KalmanFilter2D.haversineDistanceMeters(droneLoc.lat, droneLoc.lng, mockPayload.location.lat, mockPayload.location.lng);
      const bDist = KalmanFilter2D.haversineDistanceMeters(buoyLoc.lat, buoyLoc.lng, mockPayload.location.lat, mockPayload.location.lng);
      const rDist = KalmanFilter2D.haversineDistanceMeters(respLoc.lat, respLoc.lng, mockPayload.location.lat, mockPayload.location.lng);

      const dEta = Math.max(Math.round(dDist / 28), 1);
      const bEta = Math.max(Math.round(bDist / 6.5), 1);
      const rEta = Math.max(Math.round(rDist / 14), 1);

      addLog('SYSTEM', 'ETA ENGINE INITIALIZED WITH LIVE ASSET POSITIONS');
      addLog('SYSTEM', `UAV-RESCUE-01 [${droneLoc.lat.toFixed(5)}, ${droneLoc.lng.toFixed(5)}] -> Dist: ${Math.round(dDist)}m | ETA: ${dEta}s`);
      addLog('SYSTEM', `BUOY-HYDRO-02 [${buoyLoc.lat.toFixed(5)}, ${buoyLoc.lng.toFixed(5)}] -> Dist: ${Math.round(bDist)}m | ETA: ${bEta}s`);
      addLog('SYSTEM', `RESCUE-TEAM-01 [${respLoc.lat.toFixed(5)}, ${respLoc.lng.toFixed(5)}] -> Dist: ${Math.round(rDist)}m | ETA: ${rEta}s`);
      addLog('AI', `${dEta <= bEta && dEta <= rEta ? 'UAV-RESCUE-01' : bEta <= rEta ? 'BUOY-HYDRO-02' : 'RESCUE-TEAM-01'} RECOMMENDED AS FASTEST RESPONSE`);

      generateTacticalBriefing(mockPayload).then(briefing => {
        setState(prev => ({ ...prev, aiBriefing: briefing }));
        if (state.audioVoiceEnabled) speakBriefing(briefing.summary);
      });
    }

    addLog('SYSTEM', `Triggered Demo Scenario: ${scenario}`);
  }, [processTelemetry, state.audioVoiceEnabled, addLog]);

  return {
    state,
    sendExecuteRescue,
    sendOverrideDispatch,
    sendManualPayloadDrop,
    resolveIncident,
    toggleAudioVoice,
    triggerDemoScenario,
    addLog
  };
}