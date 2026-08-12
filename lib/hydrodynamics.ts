/**
 * AquaRescue Hydrodynamic Pathfinder & Spatial Fusion Module
 * 
 * Computes upstream vector offset compensation for autonomous water buoys 
 * taking water current drift into account, and calculates spatial distance matrices.
 */

import { KalmanFilter2D, GPSCoordinate } from './kalman';

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
  buoyBaseSpeed: number = 4.5,
  droneBaseSpeed: number = 18.0
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
