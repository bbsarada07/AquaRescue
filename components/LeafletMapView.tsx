'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Compass, Locate, Sun, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { FilteredResult, GPSCoordinate, KalmanFilter2D } from '@/lib/kalman';
import { HydrodynamicVectorResult, calculatePredictiveDriftZone, offsetCoordinate } from '@/lib/hydrodynamics';

export interface LeafletMapViewProps {
  filteredTarget: FilteredResult | GPSCoordinate | null;
  rawTarget: GPSCoordinate | null;
  droneLocation: GPSCoordinate | null;
  droneHeading?: number;
  buoyLocation: GPSCoordinate | null;
  buoyHeading?: number;
  responderLocation?: GPSCoordinate | null;
  responderHeading?: number;
  dronePath: GPSCoordinate[];
  buoyPath: GPSCoordinate[];
  responderPath?: GPSCoordinate[];
  hydrodynamics: HydrodynamicVectorResult | null;
  activeDistress: boolean;
  puckId: string | null;
  predictionWindow?: number;
  setPredictionWindow?: (sec: 15 | 30 | 45 | 60) => void;
  sensorData?: {
    screechConfidence: number;
    thermalDelta: number;
    waterVelocity: number;
    driftHeading: number;
  };
  droneStatus?: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  buoyStatus?: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
  responderStatus?: 'STANDBY' | 'DISPATCHED' | 'EN_ROUTE' | 'TARGET_REACHED' | 'OFFLINE';
}

// Sub-component to dynamically fly/pan map camera when target updates
function MapFlyTo({ center }: { center: [number, number] }) {
  const map = useMap();
  const prevRef = React.useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!center || center[0] === 0 || center[1] === 0) return;
    const prev = prevRef.current;
    if (!prev) {
      map.flyTo(center, Math.max(map.getZoom(), 17), { animate: true, duration: 0.9 });
      prevRef.current = center;
      return;
    }
    const dist = KalmanFilter2D.haversineDistanceMeters(prev[0], prev[1], center[0], center[1]);
    if (dist >= 4) {
      map.flyTo(center, map.getZoom(), { animate: true, duration: 0.7 });
      prevRef.current = center;
    }
  }, [center, map]);
  return null;
}

// Sub-component to dynamically invalidate map size on rail expand/collapse
function MapResizeHandler({ railCollapsed }: { railCollapsed: boolean }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const t1 = setTimeout(() => map.invalidateSize(), 100);
    const t2 = setTimeout(() => map.invalidateSize(), 320);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [railCollapsed, map]);
  return null;
}

// Keyless fallback tile data URL: dark navy #0a0e14 with low-opacity grid lines
const FALLBACK_TILE_DATA_URL =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'><rect width='256' height='256' fill='%230a0e14'/><path d='M0 0h256M0 64h256M0 128h256M0 192h256M0 0v256M64 0v256M128 0v256M192 0v256' stroke='%2306b6d4' stroke-width='1' stroke-opacity='0.08'/></svg>";

// Leaflet DivIcons using inline HTML and Tailwind styling to bypass static image loading
const createTargetIcon = (puckId: string) =>
  L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10 -ml-5 -mt-5">
        <span class="absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75 animate-ping"></span>
        <span class="relative inline-flex rounded-full h-5 w-5 bg-[#EF4444] border-2 border-white shadow-lg"></span>
        <div class="absolute -top-7 whitespace-nowrap bg-[#EF4444] text-white font-mono text-[10px] font-extrabold px-2 py-0.5 rounded border border-white/40 shadow-xl">
          DISTRESS: ${puckId}
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

const createRawGpsIcon = () =>
  L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div class="relative flex items-center justify-center w-6 h-6 -ml-3 -mt-3">
        <span class="inline-flex rounded-full h-3 w-3 bg-[#EF4444]/60 border border-[#EF4444]"></span>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const createDroneIcon = (status: string = 'STANDBY', heading: number = 0) => {
  const isEnRoute = status === 'DISPATCHED' || status === 'EN_ROUTE' || status === 'ACTIVE' || status === 'NAVIGATING';
  const isReached = status === 'TARGET_REACHED' || status === 'ARRIVED';
  const ringColor = isReached ? '#10B981' : '#06B6D4';
  const glowShadow = isReached ? '0 0 14px rgba(16,185,129,0.7)' : isEnRoute ? '0 0 20px rgba(6,182,212,0.95)' : '0 0 10px rgba(6,182,212,0.5)';

  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div class="relative flex flex-col items-center justify-center -ml-6 -mt-6">
        <div class="relative flex items-center justify-center w-12 h-12">
          ${isEnRoute ? '<span class="absolute inline-flex h-12 w-12 rounded-full bg-cyan-400 opacity-75 animate-ping"></span>' : ''}
          <div class="relative w-11 h-11 rounded-full bg-[#090D16]/90 border-2 flex items-center justify-center transition-all shadow-xl" style="border-color: ${ringColor}; box-shadow: ${glowShadow};">
            <img src="/drone.png" alt="UAV-RESCUE-01" class="w-[34px] h-[34px] object-contain drop-shadow pointer-events-none" style="transform: rotate(${Math.round(heading)}deg); transform-origin: center center; transition: transform 0.2s linear;" />
          </div>
        </div>
        <div class="mt-1 whitespace-nowrap bg-[#090D16]/95 text-[#06B6D4] font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#06B6D4]/50 shadow-xl flex items-center gap-1">
          <span>UAV-RESCUE-01</span>
          ${isEnRoute ? '<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>' : isReached ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>' : ''}
        </div>
      </div>
    `,
    iconSize: [48, 68],
    iconAnchor: [24, 24],
  });
};

const createBuoyIcon = (status: string = 'STANDBY') => {
  const isEnRoute = status === 'DISPATCHED' || status === 'EN_ROUTE' || status === 'ACTIVE' || status === 'NAVIGATING';
  const isReached = status === 'TARGET_REACHED' || status === 'ARRIVED';
  const ringColor = isReached ? '#10B981' : '#F59E0B';
  const glowShadow = isReached ? '0 0 14px rgba(16,185,129,0.7)' : isEnRoute ? '0 0 20px rgba(245,158,11,0.95)' : '0 0 10px rgba(245,158,11,0.5)';

  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div class="relative flex flex-col items-center justify-center -ml-6 -mt-6">
        <div class="relative flex items-center justify-center w-12 h-12">
          ${isEnRoute ? '<span class="absolute inline-flex h-12 w-12 rounded-full bg-amber-400 opacity-75 animate-ping"></span>' : ''}
          <div class="relative w-11 h-11 rounded-full bg-[#090D16]/90 border-2 flex items-center justify-center transition-all shadow-xl" style="border-color: ${ringColor}; box-shadow: ${glowShadow};">
            <img src="/buoy.png" alt="BUOY-HYDRO-02" class="w-[34px] h-[34px] object-contain drop-shadow pointer-events-none" />
          </div>
        </div>
        <div class="mt-1 whitespace-nowrap bg-[#090D16]/95 text-[#F59E0B] font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#F59E0B]/50 shadow-xl flex items-center gap-1">
          <span>BUOY-HYDRO-02</span>
          ${isEnRoute ? '<span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>' : isReached ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>' : ''}
        </div>
      </div>
    `,
    iconSize: [48, 68],
    iconAnchor: [24, 24],
  });
};

const createResponderIcon = (status: string = 'STANDBY', heading: number = 0) => {
  const isEnRoute = status === 'DISPATCHED' || status === 'EN_ROUTE' || status === 'ACTIVE' || status === 'NAVIGATING';
  const isReached = status === 'TARGET_REACHED' || status === 'ARRIVED';
  const ringColor = isReached ? '#10B981' : '#A78BFA';
  const glowShadow = isReached ? '0 0 14px rgba(16,185,129,0.7)' : isEnRoute ? '0 0 20px rgba(167,139,250,0.95)' : '0 0 10px rgba(167,139,250,0.5)';

  return L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div class="relative flex flex-col items-center justify-center -ml-6 -mt-6">
        <div class="relative flex items-center justify-center w-12 h-12">
          ${isEnRoute ? '<span class="absolute inline-flex h-12 w-12 rounded-full bg-purple-400 opacity-75 animate-ping"></span>' : ''}
          <div class="relative w-11 h-11 rounded-full bg-[#090D16]/90 border-2 flex items-center justify-center transition-all shadow-xl" style="border-color: ${ringColor}; box-shadow: ${glowShadow};">
            <img src="/rescue-boat.png" alt="RESCUE-TEAM-01" class="w-[34px] h-[34px] object-contain drop-shadow pointer-events-none" style="transform: rotate(${Math.round(heading)}deg); transform-origin: center center; transition: transform 0.2s linear;" />
          </div>
        </div>
        <div class="mt-1 whitespace-nowrap bg-[#090D16]/95 text-[#A78BFA] font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#A78BFA]/50 shadow-xl flex items-center gap-1">
          <span>RESCUE-TEAM-01</span>
          ${isEnRoute ? '<span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>' : isReached ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>' : ''}
        </div>
      </div>
    `,
    iconSize: [48, 68],
    iconAnchor: [24, 24],
  });
};

// Sub-component for smooth animated glide between GPS coordinates
interface SmoothAnimatedMarkerProps {
  position: [number, number];
  icon: L.DivIcon;
  isMoving: boolean;
  children?: React.ReactNode;
}

const SmoothAnimatedMarker: React.FC<SmoothAnimatedMarkerProps> = ({
  position,
  icon,
  children,
}) => {
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker) return;
    marker.setLatLng(position);
  }, [position[0], position[1]]);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setIcon(icon);
    }
  }, [icon]);

  return (
    <Marker ref={markerRef} position={position} icon={icon}>
      {children}
    </Marker>
  );
};



export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  filteredTarget,
  rawTarget,
  droneLocation,
  buoyLocation,
  responderLocation = null,
  droneHeading = 0,
  buoyHeading = 0,
  responderHeading = 0,
  dronePath,
  buoyPath,
  responderPath = [],
  hydrodynamics,
  activeDistress,
  puckId,
  predictionWindow = 30,
  setPredictionWindow,
  sensorData,
  droneStatus = 'STANDBY',
  buoyStatus = 'STANDBY',
  responderStatus = 'STANDBY',
}) => {
  const [mapMode, setMapMode] = useState<'TACTICAL' | 'HYBRID' | 'THERMAL'>('TACTICAL');
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);

  // Coordinate fallbacks
  const targetLat = filteredTarget?.lat ?? 17.385044;
  const targetLng = filteredTarget?.lng ?? 78.486671;
  const centerPos: [number, number] = [targetLat, targetLng];

  const rawLat = rawTarget?.lat ?? targetLat;
  const rawLng = rawTarget?.lng ?? targetLng;

  const droneLat = droneLocation?.lat ?? 17.387544;
  const droneLng = droneLocation?.lng ?? 78.489171;

  const buoyLat = buoyLocation?.lat ?? 17.383044;
  const buoyLng = buoyLocation?.lng ?? 78.485171;

  const responderLat = responderLocation?.lat ?? 17.382044;
  const responderLng = responderLocation?.lng ?? 78.488671;

  const activePuckId = puckId || 'PUCK-ALPHA-04';

  // TileLayer Configuration based on map mode (100% keyless OpenStreetMap + CSS Tactical Filters)
  const tileConfig = useMemo(() => {
    switch (mapMode) {
      case 'HYBRID':
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          subdomains: ['a', 'b', 'c'],
          className: '',
        };
      case 'THERMAL':
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          subdomains: ['a', 'b', 'c'],
          className: 'leaflet-thermal-tiles',
        };
      case 'TACTICAL':
      default:
        return {
          url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          subdomains: ['a', 'b', 'c'],
          className: 'leaflet-dark-tiles',
        };
    }
  }, [mapMode]);

  // Recenter trigger
  const handleRecenter = () => {
    if (mapInstance) {
      mapInstance.flyTo(centerPos, 17, { animate: true, duration: 1 });
    }
  };

  // Convert GPSCoordinate array to Leaflet LatLngExpression tuple array
  const dronePolyline: [number, number][] = useMemo(
    () => dronePath.map(p => [p.lat, p.lng]),
    [dronePath]
  );

  const buoyPolyline: [number, number][] = useMemo(
    () => buoyPath.map(p => [p.lat, p.lng]),
    [buoyPath]
  );

  const responderPolyline: [number, number][] = useMemo(
    () => responderPath.map(p => [p.lat, p.lng]),
    [responderPath]
  );

  // Icon instances based on current unit status and heading rotation
  const droneIcon = useMemo(
    () => createDroneIcon(droneStatus, droneHeading),
    [droneStatus, Math.round(droneHeading / 2) * 2]
  );
  const buoyIcon = useMemo(
    () => createBuoyIcon(buoyStatus, buoyHeading),
    [buoyStatus, Math.round(buoyHeading / 2) * 2]
  );
  const responderIcon = useMemo(
    () => createResponderIcon(responderStatus, responderHeading),
    [responderStatus, Math.round(responderHeading / 2) * 2]
  );

  const isDroneMoving = droneStatus === 'DISPATCHED' || droneStatus === 'EN_ROUTE';
  const isBuoyMoving = buoyStatus === 'DISPATCHED' || buoyStatus === 'EN_ROUTE';
  const isResponderMoving = responderStatus === 'DISPATCHED' || responderStatus === 'EN_ROUTE';


  // ETA connection line from responder to target
  const responderToTargetLine: [number, number][] = useMemo(
    () => activeDistress && responderStatus !== 'STANDBY'
      ? [[responderLat, responderLng], [targetLat, targetLng]]
      : [],
    [activeDistress, responderStatus, responderLat, responderLng, targetLat, targetLng]
  );

  const interceptPolyline: [number, number][] = useMemo(
    () => [
      [buoyLat, buoyLng],
      [targetLat, targetLng],
    ],
    [buoyLat, buoyLng, targetLat, targetLng]
  );

  const driftZonePoints = useMemo<[number, number][]>(() => {
    if (!activeDistress || !filteredTarget || !sensorData) return [];
    const points = calculatePredictiveDriftZone(
      { lat: targetLat, lng: targetLng },
      sensorData.waterVelocity,
      sensorData.driftHeading,
      predictionWindow
    );
    return points.map(p => [p.lat, p.lng]);
  }, [activeDistress, filteredTarget, targetLat, targetLng, sensorData, predictionWindow]);

  const centerlinePoints = useMemo<[number, number][]>(() => {
    if (!activeDistress || !filteredTarget || !sensorData || sensorData.waterVelocity === 0) return [];
    const start = { lat: targetLat, lng: targetLng };
    const distance = sensorData.waterVelocity * predictionWindow;
    const end = offsetCoordinate(start, distance, sensorData.driftHeading);
    return [
      [start.lat, start.lng],
      [end.lat, end.lng]
    ];
  }, [activeDistress, filteredTarget, targetLat, targetLng, sensorData, predictionWindow]);

  const noiseDelta = (filteredTarget as FilteredResult)?.noiseDeltaMeters ?? 0;

  const droneToTargetLine: [number, number][] = useMemo(
    () => [[droneLat, droneLng], [targetLat, targetLng]],
    [droneLat, droneLng, targetLat, targetLng]
  );

  const buoyToTargetLine: [number, number][] = useMemo(
    () => [[buoyLat, buoyLng], [targetLat, targetLng]],
    [buoyLat, buoyLng, targetLat, targetLng]
  );

  return (
    <div className="relative w-full h-full bg-[#0a0e14] flex flex-row overflow-hidden select-none border-r border-[#1F293D] z-0">
      {/* ── COLLAPSIBLE LEFT-SIDE NAVIGATION & DRIFT RAIL ──────────────── */}
      <aside
        className={`relative z-20 h-full bg-[#0B1220] border-r border-[#1F293D] transition-all duration-300 ease-in-out flex flex-col shrink-0 overflow-hidden shadow-2xl ${
          railCollapsed ? 'w-0 border-r-0' : 'w-72 lg:w-80'
        }`}
      >
        <div className="w-72 lg:w-80 h-full flex flex-col p-3 space-y-3 overflow-y-auto">
          {/* Rail Header with Title and Collapse Toggle */}
          <div className="flex items-center justify-between border-b border-[#1F293D] pb-2 shrink-0">
            <span className="font-mono text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-[#06B6D4]" />
              MAP & SENSOR RAIL
            </span>
            <button
              onClick={() => setRailCollapsed(true)}
              className="p-1 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              title="Collapse Rail (Full Width Map)"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Map Mode Controls */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-lg p-1.5 flex items-center justify-between gap-1 shadow-md shrink-0">
            <button
              onClick={() => setMapMode('TACTICAL')}
              className={`flex-1 py-1 text-[10px] font-mono rounded flex items-center justify-center space-x-1 font-semibold transition-all ${
                mapMode === 'TACTICAL'
                  ? 'bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4]'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              <Compass className="w-3 h-3" />
              <span>TACTICAL</span>
            </button>

            <button
              onClick={() => setMapMode('HYBRID')}
              className={`flex-1 py-1 text-[10px] font-mono rounded flex items-center justify-center space-x-1 font-semibold transition-all ${
                mapMode === 'HYBRID'
                  ? 'bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4]'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              <Sun className="w-3 h-3" />
              <span>STREETS</span>
            </button>

            <button
              onClick={() => setMapMode('THERMAL')}
              className={`flex-1 py-1 text-[10px] font-mono rounded flex items-center justify-center space-x-1 font-semibold transition-all ${
                mapMode === 'THERMAL'
                  ? 'bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444]'
                  : 'text-gray-400 hover:text-white border border-transparent'
              }`}
            >
              <Flame className="w-3 h-3" />
              <span>THERMAL</span>
            </button>
          </div>

          {/* Dynamic Coordinates HUD Box — Kalman 2D Smoothed */}
          <div className="bg-[#111827] border border-[#1F293D] rounded-lg p-3 font-mono text-[11px] text-gray-300 space-y-1.5 shadow-md shrink-0">
            <div className="flex justify-between items-center border-b border-[#1F293D] pb-1.5">
              <span className="text-[#06B6D4] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-ping" />
                KALMAN 2D SMOOTHED
              </span>
              <span className="text-gray-400 text-[10px] bg-[#06B6D4]/10 border border-[#06B6D4]/30 px-1.5 py-0.5 rounded text-[#06B6D4]">SUB-METER</span>
            </div>
            <div className="flex justify-between pt-0.5">
              <span className="text-gray-400">LAT:</span>
              <span className="text-white font-bold tabular-nums">{targetLat.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">LNG:</span>
              <span className="text-white font-bold tabular-nums">{targetLng.toFixed(6)}</span>
            </div>
            <div className="flex justify-between text-[10px] pt-1 border-t border-[#1F293D]/60">
              <span className="text-gray-500">NOISE DELTA:</span>
              <span className="text-[#F59E0B] font-semibold">{noiseDelta.toFixed(1)}m (FILTERED)</span>
            </div>
          </div>

          {/* Predictive Drift Control & HUD */}
          {activeDistress && sensorData && (
            <div className="bg-[#111827] border border-[#06B6D4]/40 rounded-lg p-3 font-mono text-[11px] text-gray-300 space-y-2 shadow-md shrink-0">
              <div className="flex justify-between items-center border-b border-[#1F293D] pb-1.5">
                <span className="text-[#06B6D4] font-bold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-pulse" />
                  PREDICTIVE DRIFT
                </span>
                <span className="text-gray-400 text-[10px]">T+{predictionWindow}s</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] pt-0.5">
                <div>
                  <span className="text-gray-500 block">CURRENT VEL</span>
                  <span className="text-white font-bold">{sensorData.waterVelocity.toFixed(2)} m/s</span>
                </div>
                <div>
                  <span className="text-gray-500 block">DRIFT HDG</span>
                  <span className="text-white font-bold">{sensorData.driftHeading.toFixed(0)}°</span>
                </div>
              </div>

              {setPredictionWindow && (
                <div className="pt-2 border-t border-[#1F293D]/60">
                  <div className="text-[10px] text-gray-400 mb-1.5">DRIFT WINDOW:</div>
                  <div className="grid grid-cols-4 gap-1">
                    {([15, 30, 45, 60] as const).map(sec => (
                      <button
                        key={sec}
                        onClick={() => setPredictionWindow(sec)}
                        className={`py-1 text-[10px] font-mono rounded font-semibold border transition-all ${
                          predictionWindow === sec
                            ? 'bg-[#06B6D4] text-black border-[#06B6D4]'
                            : 'bg-[#1F293D]/50 text-gray-400 hover:text-white border-transparent'
                        }`}
                      >
                        +{sec}s
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── MAP CONTAINER VIEW AREA ────────────────────────────────────── */}
      <div className="flex-1 min-w-0 h-full relative overflow-hidden">
        {/* Floating Expand Rail Button (visible only when rail is collapsed) */}
        {railCollapsed && (
          <button
            onClick={() => setRailCollapsed(false)}
            className="absolute top-4 left-4 z-[1000] p-2 bg-[#0B1220]/90 hover:bg-[#06B6D4]/20 border border-[#1F293D] hover:border-[#06B6D4] text-gray-300 hover:text-white rounded-lg shadow-2xl transition-all flex items-center gap-1.5 font-mono text-[10px] font-bold"
            title="Expand Map & Sensor Rail"
          >
            <ChevronRight className="w-4 h-4 text-[#06B6D4]" />
            <span>PANELS</span>
          </button>
        )}

        <MapContainer
          center={centerPos}
          zoom={17}
          scrollWheelZoom={true}
          zoomControl={false}
          className="w-full h-full"
          style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#0a0e14',
            backgroundImage:
              'linear-gradient(to right, rgba(6, 182, 212, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(6, 182, 212, 0.04) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
          ref={setMapInstance}
        >
          {/* Base Map Tile Layer with Free OpenStreetMap & Tactical CSS dark/thermal filter */}
          <TileLayer
            key={mapMode}
            url={tileConfig.url}
            subdomains={tileConfig.subdomains}
            className={tileConfig.className}
            errorTileUrl={FALLBACK_TILE_DATA_URL}
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />

          {/* Dynamic map controllers */}
          <MapFlyTo center={centerPos} />
          <MapResizeHandler railCollapsed={railCollapsed} />

          {/* Drone Path Polyline */}
          {dronePolyline.length > 1 && (
            <Polyline
              positions={dronePolyline}
              pathOptions={{ color: '#06B6D4', weight: 2.5, opacity: 0.7, dashArray: '6, 6' }}
            />
          )}

          {/* Buoy Path Polyline */}
          {buoyPolyline.length > 1 && (
            <Polyline
              positions={buoyPolyline}
              pathOptions={{ color: '#F59E0B', weight: 2, opacity: 0.6, dashArray: '3, 6' }}
            />
          )}

          {/* Drone Vector Direct Intercept Polyline */}
          {activeDistress && droneStatus !== 'STANDBY' && (
            <Polyline
              positions={droneToTargetLine}
              pathOptions={{ color: '#06B6D4', weight: 2.5, opacity: 0.9, className: 'route-drone-line' }}
            />
          )}

          {/* Buoy Direct Intercept Polyline */}
          {activeDistress && (
            <Polyline
              positions={buoyToTargetLine}
              pathOptions={{ color: '#F59E0B', weight: 2.4, opacity: 0.85, className: 'route-water-line' }}
            />
          )}

          {/* Direct Hydrodynamic Intercept Vector Line */}
          {activeDistress && (
            <Polyline
              positions={interceptPolyline}
              pathOptions={{
                color: '#10B981',
                weight: 2,
                dashArray: '4, 6',
                opacity: 0.85,
              }}
            />
          )}

          {/* Predictive Drift Impact Zone (Cyan Corridor) */}
          {activeDistress && driftZonePoints.length > 0 && (
            <Polygon
              positions={driftZonePoints}
              pathOptions={{
                color: '#06B6D4',
                fillColor: '#06B6D4',
                weight: 1.5,
                className: 'drift-corridor-polygon',
              }}
            />
          )}

          {/* Predictive Drift Flow Centerline */}
          {activeDistress && centerlinePoints.length > 0 && (
            <Polyline
              positions={centerlinePoints}
              pathOptions={{
                color: '#06B6D4',
                weight: 2,
                className: 'drift-corridor-centerline',
              }}
            />
          )}

          {/* Raw GPS Jitter Point */}
          {activeDistress && rawTarget && (
            <Marker position={[rawLat, rawLng]} icon={createRawGpsIcon()}>
              <Tooltip direction="bottom" opacity={0.9} permanent={false}>
                <span className="font-mono text-xs">RAW NOISY GPS</span>
              </Tooltip>
            </Marker>
          )}

          {/* Distress Target Puck Marker */}
          {activeDistress && (
            <Marker position={centerPos} icon={createTargetIcon(activePuckId)}>
              <Tooltip direction="top" opacity={0.95} permanent={false}>
                <span className="font-mono text-xs font-bold text-red-500">
                  DISTRESS TARGET: {activePuckId}
                </span>
              </Tooltip>
            </Marker>
          )}

          {/* UAV Drone Marker */}
          <SmoothAnimatedMarker
            position={[droneLat, droneLng]}
            icon={droneIcon}
            isMoving={isDroneMoving}
          >
            <Tooltip direction="bottom" opacity={0.95} permanent={false}>
              <span className="font-mono text-xs text-cyan-400">UAV-RESCUE-01 [{droneStatus}]</span>
            </Tooltip>
          </SmoothAnimatedMarker>

          {/* Autonomous Rescue Buoy Marker */}
          <SmoothAnimatedMarker
            position={[buoyLat, buoyLng]}
            icon={buoyIcon}
            isMoving={isBuoyMoving}
          >
            <Tooltip direction="bottom" opacity={0.95} permanent={false}>
              <span className="font-mono text-xs text-amber-400">BUOY-HYDRO-02 [{buoyStatus}]</span>
            </Tooltip>
          </SmoothAnimatedMarker>

          {/* Responder Path Trail */}
          {responderPolyline.length > 1 && responderStatus !== 'STANDBY' && (
            <Polyline
              positions={responderPolyline}
              pathOptions={{ color: '#A78BFA', weight: 2.5, opacity: 0.75, dashArray: '4, 4' }}
            />
          )}

          {/* Responder → Target ETA Connection Line */}
          {responderToTargetLine.length > 0 && (
            <Polyline
              positions={responderToTargetLine}
              pathOptions={{ color: '#A78BFA', weight: 1.8, opacity: 0.75, className: 'route-team-line' }}
            />
          )}

          {/* Human Rescue Team Marker */}
          <SmoothAnimatedMarker
            position={[responderLat, responderLng]}
            icon={responderIcon}
            isMoving={isResponderMoving}
          >
            <Tooltip direction="bottom" opacity={0.95} permanent={false}>
              <span className="font-mono text-xs" style={{ color: '#A78BFA' }}>RESCUE-TEAM-01 [{responderStatus}]</span>
            </Tooltip>
          </SmoothAnimatedMarker>
        </MapContainer>

        {/* Recenter + Legend Controls (Bottom Right Overlay) */}
        <div className="absolute bottom-6 right-6 z-[1000] flex flex-col items-end space-y-2 pointer-events-auto">
          {/* Legend panel (collapsible) */}
          {legendOpen && (
            <div className="bg-[#111827]/90 backdrop-blur border border-[#1F293D] rounded-lg p-2.5 font-mono text-[10px] text-gray-300 space-y-1.5 shadow-2xl">
              <div className="font-bold text-gray-200 border-b border-[#1F293D] pb-1 mb-1">MAP LEGEND</div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-[#EF4444] inline-block animate-ping"></span>
                <span>DISTRESS TARGET ({activePuckId})</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-[#06B6D4] rotate-45 inline-block"></span>
                <span>UAV DRONE VECTOR</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-[#F59E0B] inline-block"></span>
                <span>AUTONOMOUS BUOY</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3.5 h-0.5 bg-[#10B981] inline-block"></span>
                <span>DRIFT INTERCEPT</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3.5 h-2 bg-[#06B6D4]/30 border border-[#06B6D4] inline-block"></span>
                <span>DRIFT IMPACT ZONE</span>
              </div>
            </div>
          )}
          {/* Legend toggle button */}
          <button
            onClick={() => setLegendOpen(o => !o)}
            className="px-2.5 py-1.5 bg-[#111827]/90 hover:bg-[#06B6D4]/20 text-gray-400 hover:text-[#06B6D4] border border-[#1F293D] rounded-lg shadow-2xl transition-all flex items-center gap-1.5 font-mono text-[9px] font-bold"
            title="Toggle Map Legend"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-ping inline-block"></span>
            LEGEND
          </button>
          {/* Recenter Button */}
          <button
            onClick={handleRecenter}
            className="p-3 bg-[#111827]/90 hover:bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 rounded-lg shadow-2xl transition-all flex items-center justify-center group"
            title="Recenter Camera on Target"
          >
            <Locate className="w-5 h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeafletMapView;
