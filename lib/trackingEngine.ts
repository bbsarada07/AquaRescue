/**
 * AquaRescue Real-Time Maritime & Aerial Asset Tracking Engine
 * 
 * Manages live geographic coordinates, waypoint circuits, velocity,
 * bearings, and smooth motion interpolation for:
 * 1. UAV-RESCUE-01 (Aerial Drone) - High-speed search patrol & tactical intercept
 * 2. BUOY-HYDRO-02 (Autonomous Hydro Buoy) - Natural water drift & hydrodynamic intercept
 * 3. RESCUE-TEAM-01 (Rescue Boat Vessel) - Maritime route patrol & fast response navigation
 */

import { GPSCoordinate, KalmanFilter2D } from './kalman';

export type AssetType = 'DRONE' | 'BUOY' | 'BOAT';
export type UnitStatus = 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'PATROL' | 'OFFLINE';

export interface TrackedAsset {
  id: string;
  type: AssetType;
  name: string;
  lat: number;
  lng: number;
  heading: number; // Degrees 0-360 (0 = North, 90 = East, 180 = South, 270 = West)
  speedKnots: number;
  altitudeMeters?: number;
  status: UnitStatus;
  path: GPSCoordinate[];
  currentWaypointIndex: number;
  waypoints: GPSCoordinate[];
}

export interface TrackingEngineState {
  drone: TrackedAsset;
  buoy: TrackedAsset;
  boat: TrackedAsset;
  lastUpdateTimestamp: number;
}

// ── Geographic Operational Waypoint Circuits (Around Hussain Sagar Water Sector) ──
// Center target area: ~17.385044, 78.486671

export const DRONE_PATROL_CIRCUIT: GPSCoordinate[] = [
  { lat: 17.388200, lng: 78.489800 }, // North-East Airspace Sector
  { lat: 17.389500, lng: 78.485200 }, // North Reconnaissance Zone
  { lat: 17.387200, lng: 78.482800 }, // North-West Search Leg
  { lat: 17.383800, lng: 78.483600 }, // South-West Air Corridor
  { lat: 17.382800, lng: 78.488500 }, // South Search Boundary
  { lat: 17.385800, lng: 78.491200 }, // East Perimeter Return
];

export const RESCUE_BOAT_PATROL_CIRCUIT: GPSCoordinate[] = [
  { lat: 17.382044, lng: 78.488671 }, // South Jetty / Marine Station
  { lat: 17.381400, lng: 78.485500 }, // Southern Navigation Channel
  { lat: 17.383200, lng: 78.483200 }, // Western Bay Patrol Point
  { lat: 17.386200, lng: 78.483800 }, // North-West Water Channel
  { lat: 17.385000, lng: 78.487200 }, // Central Basin Waypoint
  { lat: 17.383500, lng: 78.489500 }, // East Marine Route Return
];

export const BUOY_DRIFT_SECTOR: GPSCoordinate[] = [
  { lat: 17.383044, lng: 78.485171 }, // Station Anchor Alpha
  { lat: 17.382600, lng: 78.485800 }, // Tidal Current Drift 1
  { lat: 17.382100, lng: 78.486300 }, // Downstream Vector
  { lat: 17.382500, lng: 78.485600 }, // Eddying Return Leg
];

/**
 * Calculates geographic bearing (degrees 0-360) between two coordinates
 */
export function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

/**
 * Smooth circular interpolation of heading angles (avoids 359° -> 1° flip glitches)
 */
export function interpolateHeading(current: number, target: number, stepFactor: number = 0.12): number {
  let diff = (target - current) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return (current + diff * stepFactor + 360) % 360;
}

/**
 * Create initial tracked assets state
 */
export function createInitialTrackingState(): TrackingEngineState {
  return {
    drone: {
      id: 'UAV-RESCUE-01',
      type: 'DRONE',
      name: 'UAV Aerial Recon',
      lat: DRONE_PATROL_CIRCUIT[0].lat,
      lng: DRONE_PATROL_CIRCUIT[0].lng,
      heading: 240,
      speedKnots: 38,
      altitudeMeters: 45,
      status: 'STANDBY',
      path: [DRONE_PATROL_CIRCUIT[0]],
      currentWaypointIndex: 1,
      waypoints: DRONE_PATROL_CIRCUIT,
    },
    buoy: {
      id: 'BUOY-HYDRO-02',
      type: 'BUOY',
      name: 'Hydro Buoy',
      lat: BUOY_DRIFT_SECTOR[0].lat,
      lng: BUOY_DRIFT_SECTOR[0].lng,
      heading: 138,
      speedKnots: 1.8,
      status: 'STANDBY',
      path: [BUOY_DRIFT_SECTOR[0]],
      currentWaypointIndex: 1,
      waypoints: BUOY_DRIFT_SECTOR,
    },
    boat: {
      id: 'RESCUE-TEAM-01',
      type: 'BOAT',
      name: 'Coast Guard Response Boat',
      lat: RESCUE_BOAT_PATROL_CIRCUIT[0].lat,
      lng: RESCUE_BOAT_PATROL_CIRCUIT[0].lng,
      heading: 290,
      speedKnots: 16,
      status: 'STANDBY',
      path: [RESCUE_BOAT_PATROL_CIRCUIT[0]],
      currentWaypointIndex: 1,
      waypoints: RESCUE_BOAT_PATROL_CIRCUIT,
    },
    lastUpdateTimestamp: Date.now(),
  };
}

/**
 * Steps the simulation forward by delta time (seconds)
 */
export function stepAssetTracking(
  state: TrackingEngineState,
  targetLocation: GPSCoordinate | null,
  activeDistress: boolean,
  dtSec: number
): TrackingEngineState {
  // Clamp dt to avoid huge jumps on tab switch / lag
  const dt = Math.min(Math.max(dtSec, 0.01), 0.3);

  // 1. Advance Drone
  const drone = advanceDrone(state.drone, targetLocation, activeDistress, dt);

  // 2. Advance Rescue Boat
  const boat = advanceBoat(state.boat, targetLocation, activeDistress, dt);

  // 3. Advance Buoy
  const buoy = advanceBuoy(state.buoy, targetLocation, activeDistress, dt);

  return {
    drone,
    buoy,
    boat,
    lastUpdateTimestamp: Date.now(),
  };
}

/**
 * Drone flight physics step
 */
function advanceDrone(
  asset: TrackedAsset,
  target: GPSCoordinate | null,
  activeDistress: boolean,
  dt: number
): TrackedAsset {
  const isDispatched = asset.status === 'DISPATCHED' || asset.status === 'EN_ROUTE';
  let targetLat: number;
  let targetLng: number;
  let speedMetersPerSec: number;

  if (isDispatched && target) {
    targetLat = target.lat;
    targetLng = target.lng;
    speedMetersPerSec = 32; // ~62 knots fast tactical vector
  } else if (asset.status === 'TARGET_REACHED' && target) {
    // Orbit around target at 15m radius
    const nowSec = Date.now() / 1000;
    const orbitAngle = nowSec * 0.8;
    targetLat = target.lat + Math.sin(orbitAngle) * 0.00018;
    targetLng = target.lng + Math.cos(orbitAngle) * 0.00018;
    speedMetersPerSec = 14;
  } else {
    // Patrol circuit
    const currentWP = asset.waypoints[asset.currentWaypointIndex];
    targetLat = currentWP.lat;
    targetLng = currentWP.lng;
    speedMetersPerSec = 22; // ~42 knots search patrol
  }

  // Distance to target waypoint
  const distMeters = KalmanFilter2D.haversineDistanceMeters(asset.lat, asset.lng, targetLat, targetLng);

  let nextWaypointIndex = asset.currentWaypointIndex;
  let nextStatus = asset.status;

  if (isDispatched && distMeters < 12) {
    nextStatus = 'TARGET_REACHED';
  } else if (!isDispatched && distMeters < 25) {
    nextWaypointIndex = (asset.currentWaypointIndex + 1) % asset.waypoints.length;
  }

  // Calculate target bearing
  const targetBearing = calculateBearing(asset.lat, asset.lng, targetLat, targetLng);
  const newHeading = interpolateHeading(asset.heading, targetBearing, dt * 4.5);

  // Move along new heading
  const distanceToTravel = Math.min(speedMetersPerSec * dt, Math.max(distMeters, 0.1));
  const headingRad = (newHeading * Math.PI) / 180;

  // 1 deg lat ≈ 111,320m, 1 deg lng ≈ 111,320m * cos(lat)
  const dLat = (distanceToTravel * Math.cos(headingRad)) / 111320;
  const dLng = (distanceToTravel * Math.sin(headingRad)) / (111320 * Math.cos((asset.lat * Math.PI) / 180));

  const newLat = asset.lat + dLat;
  const newLng = asset.lng + dLng;

  // Append to trail path every ~25m
  const lastPathPoint = asset.path[asset.path.length - 1];
  const distSinceLastPath = lastPathPoint
    ? KalmanFilter2D.haversineDistanceMeters(newLat, newLng, lastPathPoint.lat, lastPathPoint.lng)
    : 999;

  const updatedPath = distSinceLastPath >= 15
    ? [...asset.path, { lat: newLat, lng: newLng }].slice(-50)
    : asset.path;

  return {
    ...asset,
    lat: newLat,
    lng: newLng,
    heading: newHeading,
    speedKnots: Math.round(speedMetersPerSec * 1.94384),
    status: nextStatus,
    currentWaypointIndex: nextWaypointIndex,
    path: updatedPath,
  };
}

/**
 * Rescue boat navigation physics step
 */
function advanceBoat(
  asset: TrackedAsset,
  target: GPSCoordinate | null,
  activeDistress: boolean,
  dt: number
): TrackedAsset {
  const isDispatched = asset.status === 'DISPATCHED' || asset.status === 'EN_ROUTE';
  let targetLat: number;
  let targetLng: number;
  let speedMetersPerSec: number;

  if (isDispatched && target) {
    targetLat = target.lat;
    targetLng = target.lng;
    speedMetersPerSec = 16; // ~31 knots emergency run
  } else if (asset.status === 'TARGET_REACHED' && target) {
    targetLat = target.lat;
    targetLng = target.lng;
    speedMetersPerSec = 0;
  } else {
    const currentWP = asset.waypoints[asset.currentWaypointIndex];
    targetLat = currentWP.lat;
    targetLng = currentWP.lng;
    speedMetersPerSec = 9.5; // ~18.5 knots maritime patrol
  }

  const distMeters = KalmanFilter2D.haversineDistanceMeters(asset.lat, asset.lng, targetLat, targetLng);

  let nextWaypointIndex = asset.currentWaypointIndex;
  let nextStatus = asset.status;

  if (isDispatched && distMeters < 14) {
    nextStatus = 'TARGET_REACHED';
  } else if (!isDispatched && distMeters < 20) {
    nextWaypointIndex = (asset.currentWaypointIndex + 1) % asset.waypoints.length;
  }

  if (distMeters <= 1) {
    return { ...asset, status: nextStatus };
  }

  const targetBearing = calculateBearing(asset.lat, asset.lng, targetLat, targetLng);
  const newHeading = interpolateHeading(asset.heading, targetBearing, dt * 2.8);

  const distanceToTravel = Math.min(speedMetersPerSec * dt, distMeters);
  const headingRad = (newHeading * Math.PI) / 180;

  const dLat = (distanceToTravel * Math.cos(headingRad)) / 111320;
  const dLng = (distanceToTravel * Math.sin(headingRad)) / (111320 * Math.cos((asset.lat * Math.PI) / 180));

  const newLat = asset.lat + dLat;
  const newLng = asset.lng + dLng;

  const lastPathPoint = asset.path[asset.path.length - 1];
  const distSinceLastPath = lastPathPoint
    ? KalmanFilter2D.haversineDistanceMeters(newLat, newLng, lastPathPoint.lat, lastPathPoint.lng)
    : 999;

  const updatedPath = distSinceLastPath >= 12
    ? [...asset.path, { lat: newLat, lng: newLng }].slice(-50)
    : asset.path;

  return {
    ...asset,
    lat: newLat,
    lng: newLng,
    heading: newHeading,
    speedKnots: Math.round(speedMetersPerSec * 1.94384),
    status: nextStatus,
    currentWaypointIndex: nextWaypointIndex,
    path: updatedPath,
  };
}

/**
 * Buoy water drift & hydrodynamic intercept physics step
 */
function advanceBuoy(
  asset: TrackedAsset,
  target: GPSCoordinate | null,
  activeDistress: boolean,
  dt: number
): TrackedAsset {
  const isDispatched = asset.status === 'DISPATCHED' || asset.status === 'EN_ROUTE';
  let targetLat: number;
  let targetLng: number;
  let speedMetersPerSec: number;

  if (isDispatched && target) {
    targetLat = target.lat;
    targetLng = target.lng;
    speedMetersPerSec = 7.5; // ~14.5 knots propulsion assist to victim
  } else if (asset.status === 'TARGET_REACHED' && target) {
    targetLat = target.lat;
    targetLng = target.lng;
    speedMetersPerSec = 0;
  } else {
    const currentWP = asset.waypoints[asset.currentWaypointIndex];
    targetLat = currentWP.lat;
    targetLng = currentWP.lng;
    speedMetersPerSec = 1.8; // ~3.5 knots natural water current drift
  }

  const distMeters = KalmanFilter2D.haversineDistanceMeters(asset.lat, asset.lng, targetLat, targetLng);

  let nextWaypointIndex = asset.currentWaypointIndex;
  let nextStatus = asset.status;

  if (isDispatched && distMeters < 10) {
    nextStatus = 'TARGET_REACHED';
  } else if (!isDispatched && distMeters < 15) {
    nextWaypointIndex = (asset.currentWaypointIndex + 1) % asset.waypoints.length;
  }

  if (distMeters <= 0.5) {
    return { ...asset, status: nextStatus };
  }

  const targetBearing = calculateBearing(asset.lat, asset.lng, targetLat, targetLng);
  const newHeading = interpolateHeading(asset.heading, targetBearing, dt * 1.5);

  const distanceToTravel = Math.min(speedMetersPerSec * dt, distMeters);
  const headingRad = (newHeading * Math.PI) / 180;

  const dLat = (distanceToTravel * Math.cos(headingRad)) / 111320;
  const dLng = (distanceToTravel * Math.sin(headingRad)) / (111320 * Math.cos((asset.lat * Math.PI) / 180));

  const newLat = asset.lat + dLat;
  const newLng = asset.lng + dLng;

  const lastPathPoint = asset.path[asset.path.length - 1];
  const distSinceLastPath = lastPathPoint
    ? KalmanFilter2D.haversineDistanceMeters(newLat, newLng, lastPathPoint.lat, lastPathPoint.lng)
    : 999;

  const updatedPath = distSinceLastPath >= 10
    ? [...asset.path, { lat: newLat, lng: newLng }].slice(-50)
    : asset.path;

  return {
    ...asset,
    lat: newLat,
    lng: newLng,
    heading: newHeading,
    speedKnots: Math.round(speedMetersPerSec * 1.94384 * 10) / 10,
    status: nextStatus,
    currentWaypointIndex: nextWaypointIndex,
    path: updatedPath,
  };
}
