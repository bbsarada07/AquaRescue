/**
 * AquaRescue Hydrodynamic Pathfinder & Spatial Fusion Module
 * 
 * Computes upstream vector offset compensation for autonomous water buoys 
 * taking water current drift into account, and calculates spatial distance matrices.
 */

import { KalmanFilter2D, GPSCoordinate } from './kalman';

export const RESPONDER_SPEEDS = {
  DRONE: 12.0,       // m/s
  BUOY: 2.5,         // m/s
  HUMAN_TEAM: 1.5,   // m/s
};

export interface HydrodynamicVectorResult {
  compensatedHeadingDeg: number;  // Steering angle buoy must take upstream
  directHeadingDeg: number;       // Direct line-of-sight angle to victim
  driftOffsetAngleDeg: number;    // Angle deviation added for current compensation
  effectiveSpeedMS: number;       // Net speed over ground towards victim (m/s)
  estimatedTimeToInterceptSec: number; // ETA in seconds
  distanceMatrix: {
    buoyToVictimMeters: number;
    droneToVictimMeters: number;
    droneToBuoyMeters: number;
    buoyEtaSec: number;
    droneEtaSec: number;
  };
}

/**
 * Calculates direct bearing angle in degrees (0 = North, 90 = East, 180 = South, 270 = West)
 */
export function calculateBearingDeg(start: GPSCoordinate, end: GPSCoordinate): number {
  const lat1 = start.lat * (Math.PI / 180);
  const lat2 = end.lat * (Math.PI / 180);
  const dLng = (end.lng - start.lng) * (Math.PI / 180);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Calculates offset heading for the rescue buoy to steer upstream,
 * allowing current to drift the buoy directly to target coordinates.
 * 
 * @param victimCoords Lat/Lng of victim puck
 * @param waterVelocity Speed of water current in m/s
 * @param waterHeading Direction water current is flowing TOWARDS in degrees (0-360)
 * @param buoyCoords Lat/Lng of autonomous buoy (defaults to near location if not provided)
 * @param droneCoords Lat/Lng of UAV drone (defaults to launch location if not provided)
 * @param buoyBaseSpeed Cruise speed of buoy in still water (default: 4.5 m/s)
 * @param droneBaseSpeed Cruise speed of UAV drone (default: 18.0 m/s)
 */
export function calculateDriftCompensatedVector(
  victimCoords: GPSCoordinate,
  waterVelocity: number,
  waterHeading: number,
  buoyCoords: GPSCoordinate = { lat: victimCoords.lat - 0.0018, lng: victimCoords.lng - 0.0012 },
  droneCoords: GPSCoordinate = { lat: victimCoords.lat + 0.0025, lng: victimCoords.lng + 0.0020 },
  buoyBaseSpeed: number = RESPONDER_SPEEDS.BUOY,
  droneBaseSpeed: number = RESPONDER_SPEEDS.DRONE
): HydrodynamicVectorResult {
  // 1. Calculate direct distance & line-of-sight bearing
  const buoyToVictimMeters = KalmanFilter2D.haversineDistanceMeters(
    buoyCoords.lat, buoyCoords.lng,
    victimCoords.lat, victimCoords.lng
  );
  const droneToVictimMeters = KalmanFilter2D.haversineDistanceMeters(
    droneCoords.lat, droneCoords.lng,
    victimCoords.lat, victimCoords.lng
  );
  const droneToBuoyMeters = KalmanFilter2D.haversineDistanceMeters(
    droneCoords.lat, droneCoords.lng,
    buoyCoords.lat, buoyCoords.lng
  );

  const directBearing = calculateBearingDeg(buoyCoords, victimCoords);

  // 2. Compute Hydrodynamic Vector Compensation
  // Angle difference between direct target bearing and water flow direction
  const relativeWaterAngleRad = ((waterHeading - directBearing) * Math.PI) / 180;

  // Law of sines for velocity triangle:
  // sin(offset) / v_water = sin(180 - relativeWaterAngle) / v_buoy
  const sinOffset = (waterVelocity / buoyBaseSpeed) * Math.sin(relativeWaterAngleRad);

  // Clamp sinOffset to [-1, 1] for safety
  const clampedSin = Math.max(-1, Math.min(1, sinOffset));
  const offsetAngleRad = Math.asin(clampedSin);
  const offsetAngleDeg = (offsetAngleRad * 180) / Math.PI;

  // Steering angle subtracts the drift component to steer upstream
  let compensatedHeadingDeg = (directBearing - offsetAngleDeg + 360) % 360;

  // Effective net ground speed towards victim using law of cosines
  // v_net = v_buoy * cos(offsetAngle) - v_water * cos(relativeWaterAngle)
  const effectiveSpeedMS = Math.max(
    0.5,
    buoyBaseSpeed * Math.cos(offsetAngleRad) - waterVelocity * Math.cos(relativeWaterAngleRad)
  );

  // ETAs in seconds
  const buoyEtaSec = Math.round(buoyToVictimMeters / effectiveSpeedMS);
  const droneEtaSec = Math.round(droneToVictimMeters / droneBaseSpeed);

  return {
    compensatedHeadingDeg: Math.round(compensatedHeadingDeg),
    directHeadingDeg: Math.round(directBearing),
    driftOffsetAngleDeg: Number(offsetAngleDeg.toFixed(1)),
    effectiveSpeedMS: Number(effectiveSpeedMS.toFixed(2)),
    estimatedTimeToInterceptSec: buoyEtaSec,
    distanceMatrix: {
      buoyToVictimMeters: Number(buoyToVictimMeters.toFixed(1)),
      droneToVictimMeters: Number(droneToVictimMeters.toFixed(1)),
      droneToBuoyMeters: Number(droneToBuoyMeters.toFixed(1)),
      buoyEtaSec,
      droneEtaSec
    }
  };
}

// Earth's radius in meters
const EARTH_RADIUS = 6371000;

/**
 * Offsets a coordinate by a distance in meters along a bearing in degrees.
 * Uses a standard spherical geometry/great-circle path formula.
 */
export function offsetCoordinate(coord: GPSCoordinate, distanceMeters: number, bearingDeg: number): GPSCoordinate {
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const latRad = (coord.lat * Math.PI) / 180;
  const lngRad = (coord.lng * Math.PI) / 180;

  const destLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(distanceMeters / EARTH_RADIUS) +
      Math.cos(latRad) * Math.sin(distanceMeters / EARTH_RADIUS) * Math.cos(bearingRad)
  );
  const destLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(distanceMeters / EARTH_RADIUS) * Math.cos(latRad),
      Math.cos(distanceMeters / EARTH_RADIUS) - Math.sin(latRad) * Math.sin(destLatRad)
    );

  return {
    lat: Number(((destLatRad * 180) / Math.PI).toFixed(6)),
    lng: Number((((destLngRad * 180) / Math.PI + 540) % 360 - 180).toFixed(6)),
  };
}

/**
 * Calculates a list of GPSCoordinates representing a predictive drift corridor polygon.
 * The corridor starts narrow at the victim, expanding downstream according to water velocity,
 * drift heading, and elapsed time.
 * 
 * Incorporates a circular cap at both ends so the corridor remains circular/elliptical
 * when velocity is zero, and smoothly egg-shaped/capsular when velocity is positive.
 */
export function calculatePredictiveDriftZone(
  victimCoords: GPSCoordinate,
  waterVelocity: number | undefined | null,
  driftHeadingDeg: number | undefined | null,
  predictionTimeSec: number
): GPSCoordinate[] {
  if (!victimCoords || victimCoords.lat === 0 || victimCoords.lng === 0) {
    return [];
  }

  const velocity = waterVelocity ?? 0;
  const heading = driftHeadingDeg ?? 0;

  const points: GPSCoordinate[] = [];
  const initialRadius = 4; // meters width at the victim
  const radiusExpansionPerSec = 0.2; // half-width growth rate per second
  const radiusExpansionPerMeter = 0.08; // half-width growth rate per meter of drift

  // 1. Back cap (around the victim, from heading - 90 to heading - 270 relative)
  const backCapAngles = [-90, -135, -180, -225, -270];
  for (const relAngle of backCapAngles) {
    const angle = (heading + relAngle + 360) % 360;
    points.push(offsetCoordinate(victimCoords, initialRadius, angle));
  }

  // 2. Right side of the corridor (from t = 0 to t = T)
  const steps = 8;
  for (let i = 1; i < steps; i++) {
    const t = (predictionTimeSec * i) / steps;
    const distance = velocity * t;
    const center = offsetCoordinate(victimCoords, distance, heading);
    const radius = initialRadius + (radiusExpansionPerSec * t) + (radiusExpansionPerMeter * distance);
    const angle = (heading + 90) % 360;
    points.push(offsetCoordinate(center, radius, angle));
  }

  // 3. Front cap (around the destination, from heading + 90 to heading - 90 relative)
  const totalDistance = velocity * predictionTimeSec;
  const farCenter = offsetCoordinate(victimCoords, totalDistance, heading);
  const farRadius = initialRadius + (radiusExpansionPerSec * predictionTimeSec) + (radiusExpansionPerMeter * totalDistance);
  const frontCapAngles = [90, 45, 0, -45, -90];
  for (const relAngle of frontCapAngles) {
    const angle = (heading + relAngle + 360) % 360;
    points.push(offsetCoordinate(farCenter, farRadius, angle));
  }

  // 4. Left side of the corridor (from t = T back to t = 0)
  for (let i = steps - 1; i > 0; i--) {
    const t = (predictionTimeSec * i) / steps;
    const distance = velocity * t;
    const center = offsetCoordinate(victimCoords, distance, heading);
    const radius = initialRadius + (radiusExpansionPerSec * t) + (radiusExpansionPerMeter * distance);
    const angle = (heading - 90 + 360) % 360;
    points.push(offsetCoordinate(center, radius, angle));
  }

  return points;
}
