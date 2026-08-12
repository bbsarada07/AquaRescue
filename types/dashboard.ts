import { FilteredResult, GPSCoordinate } from '@/lib/kalman';
import { HydrodynamicVectorResult } from '@/lib/hydrodynamics';
import { BriefingResponse } from '@/lib/gemini';
import { LogEntry } from '@/lib/socket';

export interface SensorDataState {
  screechConfidence: number;
  thermalDelta: number;
  waterVelocity: number;
  driftHeading: number;
  gimbalLocked?: boolean;
  payloadReady?: boolean;
}

export interface AquaRescueDashboardState {
  isConnected: boolean;
  activeDistress: boolean;
  audioVoiceEnabled: boolean;
  puckId: string | null;
  filteredLocation: FilteredResult | null;
  rawLocation: GPSCoordinate | null;
  droneLocation: GPSCoordinate | null;
  buoyLocation: GPSCoordinate | null;
  dronePath: GPSCoordinate[];
  buoyPath: GPSCoordinate[];
  hydrodynamics: HydrodynamicVectorResult | null;
  sensorData: SensorDataState;
  aiBriefing: BriefingResponse | string | null;
  eventLogs: LogEntry[];
}

export interface HeaderBarProps {
  isConnected: boolean;
  activeDistress: boolean;
  audioVoiceEnabled: boolean;
  onToggleAudio: () => void;
  onTriggerDemo: (scenario: 'SCREECH' | 'DRIFT' | 'INTERCEPT') => void;
  onResolve: () => void;
}

export interface MapBoxViewProps {
  filteredTarget: FilteredResult | GPSCoordinate | null;
  rawTarget: GPSCoordinate | null;
  droneLocation: GPSCoordinate | null;
  buoyLocation: GPSCoordinate | null;
  dronePath: GPSCoordinate[];
  buoyPath: GPSCoordinate[];
  hydrodynamics: HydrodynamicVectorResult | null;
  activeDistress: boolean;
  puckId: string | null;
}

export interface TelemetryHUDProps {
  puckId: string | null;
  filteredLocation: FilteredResult | GPSCoordinate | null;
  rawLocation: GPSCoordinate | null;
  sensorData: SensorDataState;
  hydrodynamics: HydrodynamicVectorResult | null;
  activeDistress: boolean;
  onExecuteRescue: () => void;
  onOverrideDispatch: () => void;
  onManualPayloadDrop: () => void;
  onResolveIncident: () => void;
}

export interface AIBriefingProps {
  briefing: BriefingResponse | string | null;
  audioVoiceEnabled: boolean;
}

export interface AlertDrawerProps {
  logs: LogEntry[];
}
