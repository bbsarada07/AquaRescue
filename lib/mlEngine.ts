'use client';

import { GPSCoordinate } from './kalman';

export type DetectionType = 'HUMAN_DISTRESS' | 'FLOATING_DEBRIS' | 'FALSE_POSITIVE';
export type DRIStage = 'DETECTION' | 'RECOGNITION' | 'IDENTIFICATION';
export type DistressSeverity = 'CRITICAL' | 'HIGH' | 'MODERATE';

export interface BoundingBox {
  x: number;      // percentage offset (0-100) or pixel x
  y: number;      // percentage offset (0-100) or pixel y
  width: number;  // percentage width (0-100) or pixel width
  height: number; // percentage height (0-100) or pixel height
}

export interface DroneTelemetryInput {
  droneLocation: GPSCoordinate;
  altitudeMeters: number;
  gimbalPitchDeg: number;  // 0° = pointing down (nadir), 90° = horizontal
  cameraTiltDeg?: number;  // optional fine-tilt adjustment
  headingDeg: number;       // drone compass heading (0-360°)
  thermalDeltaC: number;    // °C contrast against ambient water
  screechConfidence?: number;
  elapsedSeconds?: number;  // mission elapsed time in seconds
  activeDistress?: boolean;
}

export interface TargetDetectionResult {
  targetId: string;
  detectionType: DetectionType;
  driStage: DRIStage;
  confidenceScore: number;       // 0.0 to 1.0
  thermalDelta: number;          // °C
  boundingBox: BoundingBox;
  computedGPS: GPSCoordinate;
  distressSeverityIndex: DistressSeverity;
  stageProgressPct: number;      // 0 to 100% within current DRI stage
  lockTimestamp: number;
  georeferenceDistanceMeters: number;
}

/**
 * Georeferencing Math Function
 * Calculates target GPS location from drone telemetry by applying trigonometric forward offset math.
 * Pitch angle is strictly clamped to max 85° to prevent division-by-zero errors near the horizon.
 */
export function calculateGeoreferencedGPS(
  droneLocation: GPSCoordinate,
  altitudeMeters: number,
  gimbalPitchDeg: number,
  headingDeg: number
): { computedGPS: GPSCoordinate; offsetDistanceMeters: number } {
  // Clamp pitch angle to max 85° to avoid tan(90°) division by zero
  const clampedPitch = Math.min(Math.max(Math.abs(gimbalPitchDeg), 0), 85);
  const pitchRad = (clampedPitch * Math.PI) / 180;
  const headingRad = (headingDeg * Math.PI) / 180;

  // Ground distance offset from drone position
  const offsetDistanceMeters = altitudeMeters * Math.tan(pitchRad);

  // Earth radius approximation (~6,371,000 meters)
  const EARTH_RADIUS = 6371000;
  const deltaLat = (offsetDistanceMeters * Math.cos(headingRad)) / EARTH_RADIUS * (180 / Math.PI);
  const deltaLng = (offsetDistanceMeters * Math.sin(headingRad)) / (EARTH_RADIUS * Math.cos((droneLocation.lat * Math.PI) / 180)) * (180 / Math.PI);

  return {
    computedGPS: {
      lat: droneLocation.lat + deltaLat,
      lng: droneLocation.lng + deltaLng,
    },
    offsetDistanceMeters,
  };
}

/**
 * Computer Vision & Target Identification Simulator
 * Analyzes incoming drone camera feed + thermal data to determine DRI Stage, target lock, and severity.
 */
export function runMLTargetAnalysis(
  telemetry: DroneTelemetryInput,
  puckId: string = 'PUCK-ALPHA-04'
): TargetDetectionResult {
  const elapsed = telemetry.elapsedSeconds ?? 0;
  const isActive = telemetry.activeDistress ?? true;
  const screechConf = telemetry.screechConfidence ?? 0.96;
  const thermal = telemetry.thermalDeltaC ?? 5.2;

  // 1. Calculate Georeferenced GPS Location
  const { computedGPS, offsetDistanceMeters } = calculateGeoreferencedGPS(
    telemetry.droneLocation,
    telemetry.altitudeMeters,
    telemetry.gimbalPitchDeg,
    telemetry.headingDeg
  );

  // 2. Determine DRI Stage based on time windows:
  // DETECTION (0-15s) -> RECOGNITION (15-30s) -> IDENTIFICATION (30s+)
  let driStage: DRIStage = 'DETECTION';
  let stageProgressPct = 0;

  if (elapsed < 15) {
    driStage = 'DETECTION';
    stageProgressPct = Math.min(100, Math.round((elapsed / 15) * 100));
  } else if (elapsed < 30) {
    driStage = 'RECOGNITION';
    stageProgressPct = Math.min(100, Math.round(((elapsed - 15) / 15) * 100));
  } else {
    driStage = 'IDENTIFICATION';
    stageProgressPct = 100;
  }

  // 3. Determine Detection Type & Confidence Score
  let detectionType: DetectionType = 'HUMAN_DISTRESS';
  let confidenceScore = 0.984;

  if (!isActive) {
    detectionType = 'FALSE_POSITIVE';
    confidenceScore = 0.12;
  } else if (screechConf > 0.85 && thermal > 3.0) {
    detectionType = 'HUMAN_DISTRESS';
    confidenceScore = Math.min(0.995, +(0.70 * screechConf + 0.30 * Math.min(thermal / 7, 1)).toFixed(3));
  } else if (thermal > 1.5) {
    detectionType = 'FLOATING_DEBRIS';
    confidenceScore = 0.64;
  } else {
    detectionType = 'FALSE_POSITIVE';
    confidenceScore = 0.35;
  }

  // 4. Determine Distress Severity Index
  let distressSeverityIndex: DistressSeverity = 'CRITICAL';
  if (confidenceScore > 0.90 || thermal > 4.5) {
    distressSeverityIndex = 'CRITICAL';
  } else if (confidenceScore > 0.70 || thermal > 2.5) {
    distressSeverityIndex = 'HIGH';
  } else {
    distressSeverityIndex = 'MODERATE';
  }

  // 5. Dynamic Bounding Box Overlay coordinates (simulated center jitter)
  const jitterX = (Math.sin(elapsed * 0.8) * 2);
  const jitterY = (Math.cos(elapsed * 0.6) * 1.5);
  const boundingBox: BoundingBox = {
    x: 50 + jitterX - 12, // centered with slight jitter
    y: 50 + jitterY - 10,
    width: 24,
    height: 20,
  };

  const targetId = `TRG-${puckId.replace(/[^A-Z0-9]/g, '')}-${Math.floor(100 + (elapsed % 899))}`;

  return {
    targetId,
    detectionType,
    driStage,
    confidenceScore,
    thermalDelta: thermal,
    boundingBox,
    computedGPS,
    distressSeverityIndex,
    stageProgressPct,
    lockTimestamp: Date.now(),
    georeferenceDistanceMeters: offsetDistanceMeters,
  };
}
