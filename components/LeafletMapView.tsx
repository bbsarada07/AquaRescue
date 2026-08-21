'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Polygon, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { Compass, Locate, Sun, Flame } from 'lucide-react';
import { FilteredResult, GPSCoordinate, KalmanFilter2D } from '@/lib/kalman';
import { HydrodynamicVectorResult, calculatePredictiveDriftZone, offsetCoordinate } from '@/lib/hydrodynamics';

export interface LeafletMapViewProps {
  filteredTarget: FilteredResult | GPSCoordinate | null;
  rawTarget: GPSCoordinate | null;
  droneLocation: GPSCoordinate | null;
  buoyLocation: GPSCoordinate | null;
  responderLocation?: GPSCoordinate | null;
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

const createDroneIcon = () =>
  L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10 -ml-5 -mt-5">
        <div class="w-5 h-5 bg-[#06B6D4] border-2 border-white rotate-45 shadow-lg flex items-center justify-center">
          <div class="w-1.5 h-1.5 bg-black rounded-full"></div>
        </div>
        <div class="absolute -bottom-6 whitespace-nowrap bg-[#090D16]/90 text-[#06B6D4] font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#06B6D4]/50 shadow-xl">
          UAV-RESCUE-01
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

const createBuoyIcon = () =>
  L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10 -ml-5 -mt-5">
        <div class="w-5 h-5 bg-[#F59E0B] rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
          <div class="w-2 h-2 bg-black rounded-full"></div>
        </div>
        <div class="absolute -bottom-6 whitespace-nowrap bg-[#090D16]/90 text-[#F59E0B] font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#F59E0B]/50 shadow-xl">
          BUOY-HYDRO-02
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

const createResponderIcon = () =>
  L.divIcon({
    className: 'custom-leaflet-icon',
    html: `
      <div class="relative flex items-center justify-center w-10 h-10 -ml-5 -mt-5">
        <div class="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-l-transparent border-r-transparent border-b-[#A78BFA] drop-shadow-lg"></div>
        <div class="absolute -bottom-6 whitespace-nowrap bg-[#090D16]/90 text-[#A78BFA] font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border border-[#A78BFA]/50 shadow-xl">
          RESCUE-TEAM-01
        </div>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  filteredTarget,
  rawTarget,
  droneLocation,
  buoyLocation,
  responderLocation = null,
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

  // TileLayer Matrix URL based on map mode
  const tileUrl = useMemo(() => {
    if (mapMode === 'HYBRID') {
      return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    }
    // CartoDB Dark Matter for TACTICAL & THERMAL
    return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
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
    <div className="relative w-full h-full bg-[#090D16] overflow-hidden select-none border-r border-[#1F293D] z-0">
      {/* 100% Free, Cardless Leaflet Map Container */}
      <MapContainer
        center={centerPos}
        zoom={17}
        zoomControl={false}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%', background: '#090D16' }}
        ref={setMapInstance}
      >
        <TileLayer
          url={tileUrl}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        {/* Dynamic FlyTo camera trigger */}
        {activeDistress && <MapFlyTo center={centerPos} />}

        {/* Trajectory Polylines */}
        {dronePolyline.length > 1 && (
          <Polyline
            positions={dronePolyline}
            pathOptions={{ color: '#06B6D4', weight: 3, opacity: 0.85, dashArray: '6, 6' }}
          />
        )}
        {activeDistress && (
          <Polyline
            positions={droneToTargetLine}
            pathOptions={{ color: '#38BDF8', weight: 2.2, opacity: 0.75, className: 'route-air-line' }}
          />
        )}

        {buoyPolyline.length > 1 && (
          <Polyline
            positions={buoyPolyline}
            pathOptions={{ color: '#F59E0B', weight: 3, opacity: 0.85 }}
          />
        )}
        {activeDistress && (
          <Polyline
            positions={buoyToTargetLine}
            pathOptions={{ color: '#F59E0B', weight: 2.4, opacity: 0.85, className: 'route-water-line' }}
          />
        )}

        {/* Direct Hydrodynamic Intercept Vector Line */}
        {hydrodynamics && activeDistress && (
          <Polyline
            positions={interceptPolyline}
            pathOptions={{ color: '#10B981', weight: 2.5, opacity: 0.9, dashArray: '4, 4' }}
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
              className: 'drift-corridor-polygon'
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
              className: 'drift-corridor-centerline'
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
        <Marker position={[droneLat, droneLng]} icon={createDroneIcon()}>
          <Tooltip direction="bottom" opacity={0.95} permanent={false}>
            <span className="font-mono text-xs text-cyan-400">UAV-RESCUE-01</span>
          </Tooltip>
        </Marker>

        {/* Autonomous Rescue Buoy Marker */}
        <Marker position={[buoyLat, buoyLng]} icon={createBuoyIcon()}>
          <Tooltip direction="bottom" opacity={0.95} permanent={false}>
            <span className="font-mono text-xs text-amber-400">BUOY-HYDRO-02</span>
          </Tooltip>
        </Marker>

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
        <Marker position={[responderLat, responderLng]} icon={createResponderIcon()}>
          <Tooltip direction="bottom" opacity={0.95} permanent={false}>
            <span className="font-mono text-xs" style={{ color: '#A78BFA' }}>RESCUE-TEAM-01</span>
          </Tooltip>
        </Marker>
      </MapContainer>

      {/* Map Mode Controls (Top Left Overlay) */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col space-y-2 pointer-events-auto">
        <div className="bg-[#111827]/90 backdrop-blur border border-[#1F293D] rounded-lg p-2 flex items-center space-x-2 shadow-2xl">
          <button
            onClick={() => setMapMode('TACTICAL')}
            className={`px-2.5 py-1 text-xs font-mono rounded flex items-center space-x-1 font-semibold transition-all ${
              mapMode === 'TACTICAL'
                ? 'bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>TACTICAL DARK</span>
          </button>

          <button
            onClick={() => setMapMode('HYBRID')}
            className={`px-2.5 py-1 text-xs font-mono rounded flex items-center space-x-1 font-semibold transition-all ${
              mapMode === 'HYBRID'
                ? 'bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>STREETS</span>
          </button>

          <button
            onClick={() => setMapMode('THERMAL')}
            className={`px-2.5 py-1 text-xs font-mono rounded flex items-center space-x-1 font-semibold transition-all ${
              mapMode === 'THERMAL'
                ? 'bg-[#EF4444]/20 border border-[#EF4444] text-[#EF4444]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>THERMAL HEATMAP</span>
          </button>
        </div>

        {/* Dynamic Coordinates HUD Box */}
        <div className="bg-[#111827]/90 backdrop-blur border border-[#1F293D] rounded-lg p-2.5 font-mono text-[11px] text-gray-300 space-y-1 shadow-2xl max-w-xs">
          <div className="flex justify-between items-center border-b border-[#1F293D] pb-1">
            <span className="text-[#06B6D4] font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-ping"></span>
              KALMAN 2D SMOOTHED
            </span>
            <span className="text-gray-400">SUB-METER</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">LAT:</span>
            <span className="text-white font-bold">{targetLat.toFixed(6)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">LNG:</span>
            <span className="text-white font-bold">{targetLng.toFixed(6)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-gray-500">NOISE DELTA:</span>
            <span className="text-[#F59E0B] font-semibold">{noiseDelta}m (FILTERED)</span>
          </div>
        </div>

        {/* Predictive Drift Control & HUD Overlay */}
        {activeDistress && sensorData && (
          <div className="bg-[#111827]/90 backdrop-blur border border-[#06B6D4]/40 rounded-lg p-2.5 font-mono text-[11px] text-gray-300 space-y-1.5 shadow-2xl max-w-xs">
            <div className="flex justify-between items-center border-b border-[#1F293D] pb-1">
              <span className="text-[#06B6D4] font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#06B6D4] animate-pulse"></span>
                DRIFT PREDICTION · {predictionWindow} SEC
              </span>
            </div>
            
            {/* Window selector */}
            <div className="flex items-center justify-between gap-4 pt-0.5">
              <span className="text-gray-400 text-[10px]">TIME WINDOW:</span>
              <div className="flex space-x-1">
                {([15, 30, 45, 60] as const).map(sec => (
                  <button
                    key={sec}
                    onClick={() => setPredictionWindow && setPredictionWindow(sec)}
                    className={`px-1.5 py-0.5 text-[9px] font-mono rounded font-bold transition-all border ${
                      predictionWindow === sec
                        ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

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
  );
};

export default LeafletMapView;
