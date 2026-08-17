'use client';

import { GPSCoordinate, KalmanFilter2D } from './kalman';
import { calculateBearingDeg } from './hydrodynamics';

export type ResponderType = 'UAV_DRONE' | 'AUTONOMOUS_BUOY' | 'HUMAN_BOAT';
export type ResponderStatus = 'ACTIVE' | 'STANDBY' | 'EN_ROUTE' | 'TARGET_REACHED' | 'UNAVAILABLE' | 'REROUTED';

export interface EnvironmentalVector {
  riverCurrentSpeedMS: number;
  riverCurrentHeadingDeg: number;
  windSpeedMS: number;
  windHeadingDeg: number;
}

export interface GeofencedHazard {
  id: string;
  name: string;
  center: GPSCoordinate;
  radiusMeters: number;
  type: 'SHALLOW_RAPIDS' | 'HIGH_TURBIDITY' | 'RESTRICTED_AIRSPACE';
}

export interface ResponderUnit {
  id: string;
  name: string;
  type: ResponderType;
  baseSpeedMS: number;         // Drone: 15 m/s, Buoy: 3.5 m/s, Boat: 8 m/s
  payload: string;             // 'Life Vest', 'Surface Buoy', 'Heavy Crew'
  batteryPct: number;          // Battery percentage (0 - 100)
  location: GPSCoordinate;
  status: ResponderStatus;
  deploymentDelaySec: number;  // Drone: 2s, Buoy: 5s, Boat: 15s
}

export interface CalculatedTTIResult {
  unitId: string;
  unitName: string;
  type: ResponderType;
  geodesicDistanceMeters: number;
  adjustedSpeedMS: number;
  ttiSeconds: number;
  batteryPct: number;
  isAvailable: boolean;
  status: ResponderStatus;
  lockoutReason?: string;
  penaltyBreakdown: {
    baseSpeed: number;
    environmentalPenaltyMS: number;
    deploymentDelaySec: number;
    geofenceRerouteAddedSec: number;
  };
}

export interface DispatchRecommendation {
  optimalUnitId: string | null;
  optimalUnitName: string | null;
  optimalUnitType: ResponderType | null;
  recommendedActionString: string; // e.g. "ASSIGNED: Autonomous Rescue Buoy Alpha — ETA 22s"
  rationaleEnglish: string;
  calculatedMatrix: CalculatedTTIResult[];
  timestamp: number;
}

/**
 * Default Fleet Parameters
 */
export const DEFAULT_RESPONDER_FLEET: ResponderUnit[] = [
  {
    id: 'UAV-RESCUE-01',
    name: 'UAV Drone Alpha',
    type: 'UAV_DRONE',
    baseSpeedMS: 15.0,
    payload: 'Rapid Life Vest Drop',
    batteryPct: 88,
    location: { lat: 17.387544, lng: 78.489171 },
    status: 'STANDBY',
    deploymentDelaySec: 2,
  },
  {
    id: 'BUOY-HYDRO-02',
    name: 'Autonomous Buoy Alpha',
    type: 'AUTONOMOUS_BUOY',
    baseSpeedMS: 3.5,
    payload: 'Surface Water Propulsion & Float',
    batteryPct: 92,
    location: { lat: 17.383044, lng: 78.485171 },
    status: 'STANDBY',
    deploymentDelaySec: 5,
  },
  {
    id: 'BOAT-CREW-01',
    name: 'Human Rescue Boat Crew',
    type: 'HUMAN_BOAT',
    baseSpeedMS: 8.0,
    payload: 'Heavy Medical & Crew Extraction',
    batteryPct: 100,
    location: { lat: 17.382044, lng: 78.488671 },
    status: 'STANDBY',
    deploymentDelaySec: 15,
  },
];

/**
 * Default Geofenced Hazard Zones
 */
export const DEFAULT_HAZARDS: GeofencedHazard[] = [
  {
    id: 'HAZARD-01',
    name: 'Submerged Debris & Rapids Zone',
    center: { lat: 17.384200, lng: 78.486100 },
    radiusMeters: 40,
    type: 'SHALLOW_RAPIDS',
  },
];

/**
 * Environmental Vector Adjustment Math
 * Computes the adjusted effective speed towards the target considering river current or headwind vectors.
 */
export function calculateAdjustedSpeed(
  unit: ResponderUnit,
  targetGPS: GPSCoordinate,
  env: EnvironmentalVector
): { adjustedSpeedMS: number; environmentalPenaltyMS: number } {
  const bearingToTarget = calculateBearingDeg(unit.location, targetGPS);
  const bearingRad = (bearingToTarget * Math.PI) / 180;

  let effectiveSpeed = unit.baseSpeedMS;
  let penalty = 0;

  if (unit.type === 'AUTONOMOUS_BUOY' || unit.type === 'HUMAN_BOAT') {
    // Water surface units: adjust for river current vector projection
    // Current heading is direction current flows TO.
    const currentHeadingRad = (env.riverCurrentHeadingDeg * Math.PI) / 180;
    // Angle difference between movement direction and current vector
    const angleDiff = currentHeadingRad - bearingRad;
    const currentAssistance = env.riverCurrentSpeedMS * Math.cos(angleDiff);

    effectiveSpeed = unit.baseSpeedMS + currentAssistance;
    penalty = -currentAssistance; // positive penalty means speed reduction
  } else if (unit.type === 'UAV_DRONE') {
    // Air unit: adjust for wind vector resistance
    const windHeadingRad = (env.windHeadingDeg * Math.PI) / 180;
    const windAngleDiff = windHeadingRad - bearingRad;
    // Headwind component opposes drone flight direction
    const headwindComponent = env.windSpeedMS * Math.cos(windAngleDiff);

    effectiveSpeed = unit.baseSpeedMS - headwindComponent;
    penalty = headwindComponent;
  }

  // Clamp speed to min 0.8 m/s so vehicle still makes forward progress
  const adjustedSpeedMS = Math.max(0.8, +effectiveSpeed.toFixed(2));
  return { adjustedSpeedMS, environmentalPenaltyMS: +penalty.toFixed(2) };
}

/**
 * Safety Safeguard Engine: Check Battery Lockout & Geofence Intersections
 */
export function evaluateSafetyLockouts(
  unit: ResponderUnit,
  targetGPS: GPSCoordinate,
  hazards: GeofencedHazard[]
): { isAvailable: boolean; status: ResponderStatus; lockoutReason?: string; geofenceRerouteAddedSec: number } {
  // Safeguard 1: Battery Level Lockout (< 15%)
  if (unit.batteryPct < 15) {
    return {
      isAvailable: false,
      status: 'UNAVAILABLE',
      lockoutReason: `CRITICAL BATTERY LOCKOUT (${unit.batteryPct}% < 15%)`,
      geofenceRerouteAddedSec: 0,
    };
  }

  // Safeguard 2: Status check
  if (unit.status === 'UNAVAILABLE' || unit.status === 'REROUTED') {
    return {
      isAvailable: false,
      status: unit.status,
      lockoutReason: `UNIT STATUS FLAG: ${unit.status}`,
      geofenceRerouteAddedSec: 0,
    };
  }

  // Safeguard 3: Geofenced Hazard Intersection Check (Line-segment to hazard center test)
  let geofenceRerouteAddedSec = 0;
  for (const hazard of hazards) {
    // Distance from hazard center to unit and target
    const distUnitToHazard = KalmanFilter2D.haversineDistanceMeters(unit.location.lat, unit.location.lng, hazard.center.lat, hazard.center.lng);
    const distTargetToHazard = KalmanFilter2D.haversineDistanceMeters(targetGPS.lat, targetGPS.lng, hazard.center.lat, hazard.center.lng);

    // If unit or direct path passes through shallow rapids for water units
    if ((distUnitToHazard < hazard.radiusMeters || distTargetToHazard < hazard.radiusMeters) && unit.type !== 'UAV_DRONE') {
      if (hazard.type === 'SHALLOW_RAPIDS') {
        geofenceRerouteAddedSec += 12; // 12 second detour penalty for routing around hazard
      }
    }
  }

  return {
    isAvailable: true,
    status: unit.status === 'STANDBY' ? 'ACTIVE' : unit.status,
    geofenceRerouteAddedSec,
  };
}

/**
 * Main TTI Calculation & Automated Dispatch Recommendation Engine
 */
export function calculateDynamicTTIAllocation(
  targetGPS: GPSCoordinate,
  fleet: ResponderUnit[] = DEFAULT_RESPONDER_FLEET,
  env: EnvironmentalVector = { riverCurrentSpeedMS: 1.8, riverCurrentHeadingDeg: 140, windSpeedMS: 4.5, windHeadingDeg: 220 },
  hazards: GeofencedHazard[] = DEFAULT_HAZARDS
): DispatchRecommendation {
  const calculatedMatrix: CalculatedTTIResult[] = fleet.map((unit) => {
    // 1. Geodesic distance calculation via Haversine formula
    const distanceMeters = KalmanFilter2D.haversineDistanceMeters(
      unit.location.lat,
      unit.location.lng,
      targetGPS.lat,
      targetGPS.lng
    );

    // 2. Adjusted speed math considering current/wind vectors
    const { adjustedSpeedMS, environmentalPenaltyMS } = calculateAdjustedSpeed(unit, targetGPS, env);

    // 3. Safety safeguard evaluation
    const safety = evaluateSafetyLockouts(unit, targetGPS, hazards);

    // 4. Compute TTI (Time-To-Intercept in seconds)
    // TTI = (Distance / AdjustedSpeed) + DeploymentDelay + DetourDelay
    const rawTTI = (distanceMeters / adjustedSpeedMS) + unit.deploymentDelaySec + safety.geofenceRerouteAddedSec;
    const ttiSeconds = safety.isAvailable ? Math.round(rawTTI) : Infinity;

    return {
      unitId: unit.id,
      unitName: unit.name,
      type: unit.type,
      geodesicDistanceMeters: Math.round(distanceMeters),
      adjustedSpeedMS,
      ttiSeconds,
      batteryPct: unit.batteryPct,
      isAvailable: safety.isAvailable,
      status: safety.status,
      lockoutReason: safety.lockoutReason,
      penaltyBreakdown: {
        baseSpeed: unit.baseSpeedMS,
        environmentalPenaltyMS,
        deploymentDelaySec: unit.deploymentDelaySec,
        geofenceRerouteAddedSec: safety.geofenceRerouteAddedSec,
      },
    };
  });

  // Filter available units and select responder with lowest valid TTI
  const availableUnits = calculatedMatrix.filter((u) => u.isAvailable && Number.isFinite(u.ttiSeconds));
  availableUnits.sort((a, b) => a.ttiSeconds - b.ttiSeconds);

  const optimal = availableUnits.length > 0 ? availableUnits[0] : null;

  if (!optimal) {
    return {
      optimalUnitId: null,
      optimalUnitName: null,
      optimalUnitType: null,
      recommendedActionString: 'NO VALID RESPONDER AVAILABLE — SAFETY LOCKOUT',
      rationaleEnglish: 'All assets currently unavailable or restricted by low battery / safety hazards.',
      calculatedMatrix,
      timestamp: Date.now(),
    };
  }

  const actionString = `ASSIGNED: ${optimal.unitName} — ETA ${optimal.ttiSeconds}s`;
  const rationale = `${optimal.unitName} yields lowest TTI (${optimal.ttiSeconds}s at ${optimal.adjustedSpeedMS} m/s) with nominal ${optimal.batteryPct}% battery.`;

  return {
    optimalUnitId: optimal.unitId,
    optimalUnitName: optimal.unitName,
    optimalUnitType: optimal.type,
    recommendedActionString: actionString,
    rationaleEnglish: rationale,
    calculatedMatrix,
    timestamp: Date.now(),
  };
}
