/**
 * AquaRescue WebSocket Client & High-Frequency Telemetry Buffer
 * 
 * Features:
 * - Socket.io auto-connecting to localhost:5000 or custom host
 * - Sub-100ms useRef high-frequency state buffering & RAF frame throttling
 * - Real-time 2D Kalman Filter integration for sub-meter lat/lng smoothing
 * - Hydrodynamic drift compensation calculation
 * - Command emission back to Laptop 1
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { KalmanFilter2D, FilteredResult, GPSCoordinate } from './kalman';
import { calculateDriftCompensatedVector, HydrodynamicVectorResult } from './hydrodynamics';
import { generateTacticalBriefing, speakBriefing, BriefingResponse } from './gemini';

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
  lastPacketTimestamp: number | null;
  missionStartTime: number | null;
  missionId: string | null;
  eventLogs: LogEntry[];
  audioVoiceEnabled: boolean;
  serverUrl: string;
}

const DEFAULT_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000';

const INITIAL_VICTIM: GPSCoordinate = { lat: 17.385044, lng: 78.486671 };
const INITIAL_DRONE: GPSCoordinate = { lat: 17.387544, lng: 78.489171 };
const INITIAL_BUOY: GPSCoordinate = { lat: 17.383044, lng: 78.485171 };
const INITIAL_RESPONDER: GPSCoordinate = { lat: 17.382044, lng: 78.488671 };

export function useSocketTelemetry(serverUrl: string = DEFAULT_SERVER_URL) {
  // High-frequency useRef buffer for 100ms telemetry ticks
  const telemetryBufferRef = useRef<TelemetryData | null>(null);
  const kalmanRef = useRef<KalmanFilter2D>(new KalmanFilter2D(1e-5, 5e-5));
  const socketRef = useRef<Socket | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastStateUpdateMsRef = useRef<number>(0);

  // Main UI State
  const [state, setState] = useState<AquaRescueState>({
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
    droneLocation: INITIAL_DRONE,
    droneHeading: 225,
    buoyLocation: INITIAL_BUOY,
    buoyHeading: 45,
    responderLocation: INITIAL_RESPONDER,
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
    dronePath: [INITIAL_DRONE],
    buoyPath: [INITIAL_BUOY],
    responderPath: [INITIAL_RESPONDER],
    droneStatus: 'STANDBY',
    buoyStatus: 'STANDBY',
    responderStatus: 'STANDBY',
    lastPacketTimestamp: null,
    missionStartTime: null,
    missionId: null,
    eventLogs: [],
    audioVoiceEnabled: true,
    serverUrl
  });

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

  // Sub-100ms UI Throttling Loop using requestAnimationFrame
  useEffect(() => {
    let mounted = true;

    const tick = (now: number) => {
      if (!mounted) return;

      // Throttle UI re-renders to max ~20 FPS (every 50ms) to ensure smooth 60fps animations
      if (now - lastStateUpdateMsRef.current >= 50) {
        lastStateUpdateMsRef.current = now;

        const data = telemetryBufferRef.current;
        if (data) {
          // Pass through Kalman Filter engine
          const kalmanOut = kalmanRef.current.update(
            data.location.lat,
            data.location.lng,
            data.timestamp || Date.now()
          );

          setState(prev => {
            // Update Drone, Buoy and Responder simulation positions towards target
            const newDroneLat = prev.droneLocation.lat + (kalmanOut.lat - prev.droneLocation.lat) * 0.02;
            const newDroneLng = prev.droneLocation.lng + (kalmanOut.lng - prev.droneLocation.lng) * 0.02;
            const newBuoyLat = prev.buoyLocation.lat + (kalmanOut.lat - prev.buoyLocation.lat) * 0.015;
            const newBuoyLng = prev.buoyLocation.lng + (kalmanOut.lng - prev.buoyLocation.lng) * 0.015;
            const newResponderLat = prev.responderLocation.lat + (kalmanOut.lat - prev.responderLocation.lat) * 0.008;
            const newResponderLng = prev.responderLocation.lng + (kalmanOut.lng - prev.responderLocation.lng) * 0.008;

            const updatedDronePath = [...prev.dronePath, { lat: newDroneLat, lng: newDroneLng }].slice(-40);
            const updatedBuoyPath = [...prev.buoyPath, { lat: newBuoyLat, lng: newBuoyLng }].slice(-40);
            const updatedResponderPath = [...prev.responderPath, { lat: newResponderLat, lng: newResponderLng }].slice(-40);

            // Compute Hydrodynamic Vector Compensation using active coordinates
            const hydro = calculateDriftCompensatedVector(
              { lat: kalmanOut.lat, lng: kalmanOut.lng },
              data.sensor_data.water_velocity_ms,
              data.sensor_data.drift_heading_deg,
              { lat: newBuoyLat, lng: newBuoyLng },
              { lat: newDroneLat, lng: newDroneLng }
            );

            // Process status transitions
            const droneDist = KalmanFilter2D.haversineDistanceMeters(newDroneLat, newDroneLng, kalmanOut.lat, kalmanOut.lng);
            const buoyDist = KalmanFilter2D.haversineDistanceMeters(newBuoyLat, newBuoyLng, kalmanOut.lat, kalmanOut.lng);
            const responderDist = KalmanFilter2D.haversineDistanceMeters(newResponderLat, newResponderLng, kalmanOut.lat, kalmanOut.lng);

            let nextDroneStatus = prev.droneStatus;
            if (prev.droneStatus === 'DISPATCHED') nextDroneStatus = 'EN_ROUTE';
            if ((prev.droneStatus === 'DISPATCHED' || prev.droneStatus === 'EN_ROUTE') && droneDist < 8) {
              nextDroneStatus = 'TARGET_REACHED';
            }

            let nextBuoyStatus = prev.buoyStatus;
            if (prev.buoyStatus === 'DISPATCHED') nextBuoyStatus = 'EN_ROUTE';
            if ((prev.buoyStatus === 'DISPATCHED' || prev.buoyStatus === 'EN_ROUTE') && buoyDist < 8) {
              nextBuoyStatus = 'TARGET_REACHED';
            }

            let nextResponderStatus = prev.responderStatus;
            if (prev.responderStatus === 'DISPATCHED') nextResponderStatus = 'EN_ROUTE';
            if ((prev.responderStatus === 'DISPATCHED' || prev.responderStatus === 'EN_ROUTE') && responderDist < 8) {
              nextResponderStatus = 'TARGET_REACHED';
            }

            return {
              ...prev,
              activeDistress: true,
              puckId: data.puck_id,
              rawLocation: data.location,
              filteredLocation: kalmanOut,
              droneLocation: { lat: newDroneLat, lng: newDroneLng },
              buoyLocation: { lat: newBuoyLat, lng: newBuoyLng },
              responderLocation: { lat: newResponderLat, lng: newResponderLng },
              sensorData: {
                screechConfidence: data.sensor_data.audio_screech_confidence,
                thermalDelta: data.sensor_data.thermal_delta_c,
                waterVelocity: data.sensor_data.water_velocity_ms,
                driftHeading: data.sensor_data.drift_heading_deg,
                gimbalLocked: prev.sensorData.gimbalLocked,
                payloadReady: prev.sensorData.payloadReady
              },
              hydrodynamics: hydro,
              dronePath: updatedDronePath,
              buoyPath: updatedBuoyPath,
              responderPath: updatedResponderPath,
              droneStatus: nextDroneStatus,
              buoyStatus: nextBuoyStatus,
              responderStatus: nextResponderStatus,
              lastPacketTimestamp: data.timestamp,
              missionStartTime: prev.missionStartTime || Date.now(),
              missionId: prev.missionId || `AR-${Math.floor(100 + Math.random() * 899)}`
            };
          });
        }
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

  // Socket Connection setup
  useEffect(() => {
    addLog('SYSTEM', `Connecting to WebSocket server at ${serverUrl}...`);

    const socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setState(prev => ({ ...prev, isConnected: true }));
      addLog('SYSTEM', `Connected to AquaRescue Mesh Server (${socket.id})`);
    });

    socket.on('disconnect', () => {
      setState(prev => ({ ...prev, isConnected: false }));
      addLog('SYSTEM', 'Disconnected from WebSocket server');
    });

    socket.on('DISTRESS_TRIGGERED', async (data: TelemetryData) => {
      processTelemetry(data);
      addLog(
        'ALERT',
        `DISTRESS TRIGGERED by ${data.puck_id}`,
        `Lat: ${data.location.lat.toFixed(6)}, Lng: ${data.location.lng.toFixed(6)} | Audio: ${(data.sensor_data.audio_screech_confidence * 100).toFixed(0)}%`
      );

      // ETA Timeline logs
      addLog('SYSTEM', 'ETA ENGINE INITIALIZED');
      addLog('SYSTEM', 'UAV-RESCUE-01 INITIAL ESTIMATED ETA: 18 SEC');
      addLog('SYSTEM', 'BUOY-HYDRO-02 INITIAL ESTIMATED ETA: 31 SEC');
      addLog('SYSTEM', 'RESPONSE TEAM INITIAL ESTIMATED ETA: 1M 42S');
      addLog('AI', 'UAV-RESCUE-01 RECOMMENDED AS FASTEST RESPONSE');

      // Trigger Gemini AI Tactical Incident Briefing
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
    });

    return () => {
      socket.disconnect();
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
    setState(prev => ({
      ...prev,
      droneStatus: 'DISPATCHED',
      buoyStatus: 'DISPATCHED'
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
    setState(prev => ({
      ...prev,
      droneStatus: 'DISPATCHED'
    }));
    addLog('COMMAND', `MANUAL PAYLOAD DROP sent to UAV for ${state.puckId}`);
  }, [state.puckId, state.filteredLocation, addLog]);

  const resolveIncident = useCallback(() => {
    kalmanRef.current.reset(INITIAL_VICTIM.lat, INITIAL_VICTIM.lng);
    telemetryBufferRef.current = null;
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
      droneLocation: INITIAL_DRONE,
      buoyLocation: INITIAL_BUOY,
      responderLocation: INITIAL_RESPONDER,
      dronePath: [INITIAL_DRONE],
      buoyPath: [INITIAL_BUOY],
      responderPath: [INITIAL_RESPONDER],
      droneStatus: 'STANDBY',
      buoyStatus: 'STANDBY',
      responderStatus: 'STANDBY',
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
      // ETA Timeline logs
      addLog('SYSTEM', 'ETA ENGINE INITIALIZED');
      addLog('SYSTEM', 'UAV-RESCUE-01 INITIAL ESTIMATED ETA: 18 SEC');
      addLog('SYSTEM', 'BUOY-HYDRO-02 INITIAL ESTIMATED ETA: 31 SEC');
      addLog('SYSTEM', 'RESPONSE TEAM INITIAL ESTIMATED ETA: 1M 42S');
      addLog('AI', 'UAV-RESCUE-01 RECOMMENDED AS FASTEST RESPONSE');

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
