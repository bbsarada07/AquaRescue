'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { ScatterplotLayer, PathLayer, TextLayer } from '@deck.gl/layers';
import { FlyToInterpolator } from '@deck.gl/core';
import { Compass, Locate, Sun, Flame } from 'lucide-react';
import { FilteredResult, GPSCoordinate } from '@/lib/kalman';
import { HydrodynamicVectorResult } from '@/lib/hydrodynamics';

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

export const MapBoxView: React.FC<MapBoxViewProps> = ({
  filteredTarget,
  rawTarget,
  droneLocation,
  buoyLocation,
  dronePath,
  buoyPath,
  hydrodynamics,
  activeDistress,
  puckId
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mapMode, setMapMode] = useState<'TACTICAL' | 'SATELLITE' | 'THERMAL'>('TACTICAL');

  // Default coordinate fallbacks for nullish safety
  const targetLng = filteredTarget?.lng ?? 78.486671;
  const targetLat = filteredTarget?.lat ?? 17.385044;

  // ViewState with smooth FlyTo camera pan/zoom
  const [viewState, setViewState] = useState({
    longitude: targetLng,
    latitude: targetLat,
    zoom: 17.5,
    pitch: 45,
    bearing: -15,
    transitionDuration: 1000,
    transitionInterpolator: new FlyToInterpolator()
  });

  // Pulse animation state for distress puck
  const [pulseRadius, setPulseRadius] = useState<number>(10);
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseRadius(prev => (prev >= 60 ? 10 : prev + 2.5));
    }, 40);
    return () => clearInterval(interval);
  }, []);

  // FlyTo camera when target position updates
  useEffect(() => {
    if (activeDistress && filteredTarget) {
      setViewState(prev => ({
        ...prev,
        longitude: filteredTarget.lng,
        latitude: filteredTarget.lat,
        transitionDuration: 800,
        transitionInterpolator: new FlyToInterpolator()
      }));
    }
  }, [filteredTarget?.lat, filteredTarget?.lng, activeDistress]);

  // Recenter button trigger
  const handleRecenter = () => {
    setViewState(prev => ({
      ...prev,
      longitude: targetLng,
      latitude: targetLat,
      zoom: 18,
      pitch: 50,
      transitionDuration: 1200,
      transitionInterpolator: new FlyToInterpolator()
    }));
  };

  // Canvas offline backdrop renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let gridOffset = 0;

    const renderCanvasGrid = () => {
      const width = (canvas.width = canvas.clientWidth);
      const height = (canvas.height = canvas.clientHeight);

      // Background gradient based on mapMode
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      if (mapMode === 'TACTICAL') {
        bgGrad.addColorStop(0, '#070B12');
        bgGrad.addColorStop(1, '#0C1322');
      } else if (mapMode === 'SATELLITE') {
        bgGrad.addColorStop(0, '#041017');
        bgGrad.addColorStop(1, '#091d29');
      } else {
        bgGrad.addColorStop(0, '#15060A');
        bgGrad.addColorStop(1, '#0C0A1A');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Hydrodynamic Current Flow Vectors background simulation
      gridOffset = (gridOffset + 0.3) % 40;
      ctx.strokeStyle = mapMode === 'THERMAL' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(6, 182, 212, 0.07)';
      ctx.lineWidth = 1;

      for (let x = -40 + gridOffset; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + height * 0.3, height);
        ctx.stroke();
      }

      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw simulated body of water coastline contour
      ctx.beginPath();
      ctx.strokeStyle = '#06B6D4';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.moveTo(0, height * 0.45);
      ctx.quadraticCurveTo(width * 0.4, height * 0.35, width, height * 0.6);
      ctx.stroke();
      ctx.setLineDash([]);

      animId = requestAnimationFrame(renderCanvasGrid);
    };

    renderCanvasGrid();
    return () => cancelAnimationFrame(animId);
  }, [mapMode]);

  // Deck.gl Layers Configuration
  const layers = useMemo(() => {
    const layerList: any[] = [];
    const fTarget = filteredTarget || { lat: 17.385044, lng: 78.486671 };
    const rTarget = rawTarget || { lat: 17.385044, lng: 78.486671 };
    const dLoc = droneLocation || { lat: 17.387544, lng: 78.489171 };
    const bLoc = buoyLocation || { lat: 17.383044, lng: 78.485171 };
    const activePuckId = puckId || 'PUCK-ALPHA-04';

    // 1. DYNAMIC PATH LAYERS (Drone flight trajectory & Buoy hydrodynamic intercept vector)
    if (dronePath && dronePath.length > 1) {
      layerList.push(
        new PathLayer({
          id: 'drone-flight-path',
          data: [{ path: dronePath.map(p => [p.lng, p.lat]) }],
          getPath: (d: any) => d.path,
          getColor: [6, 182, 212, 220],
          getWidth: 3.5,
          widthMinPixels: 2.5,
          dashJustified: true,
        })
      );
    }

    if (buoyPath && buoyPath.length > 1) {
      layerList.push(
        new PathLayer({
          id: 'buoy-hydrodynamic-path',
          data: [{ path: buoyPath.map(p => [p.lng, p.lat]) }],
          getPath: (d: any) => d.path,
          getColor: [245, 158, 11, 220],
          getWidth: 3.5,
          widthMinPixels: 2.5,
        })
      );
    }

    // Direct Hydrodynamic Intercept Vector Line
    if (hydrodynamics && activeDistress) {
      layerList.push(
        new PathLayer({
          id: 'hydrodynamic-vector-line',
          data: [{ path: [[bLoc.lng, bLoc.lat], [fTarget.lng, fTarget.lat]] }],
          getPath: (d: any) => d.path,
          getColor: [16, 185, 129, 230],
          getWidth: 2.5,
          widthMinPixels: 2,
        })
      );
    }

    // 2. PUCK DISTRESS NODE LAYERS (Pulsing Red Sonar Ring + Raw vs Kalman position)
    if (activeDistress) {
      // Raw GPS position indicator
      layerList.push(
        new ScatterplotLayer({
          id: 'raw-gps-jitter-point',
          data: [{ position: [rTarget.lng, rTarget.lat] }],
          getPosition: (d: any) => d.position,
          getFillColor: [239, 68, 68, 80],
          getLineColor: [239, 68, 68, 160],
          getRadius: 5,
          radiusMinPixels: 4,
          lineWidthMinPixels: 1,
          stroked: true,
        })
      );

      // Pulsing outer sonar ring for target
      layerList.push(
        new ScatterplotLayer({
          id: 'puck-sonar-pulse',
          data: [{ position: [fTarget.lng, fTarget.lat] }],
          getPosition: (d: any) => d.position,
          getFillColor: [239, 68, 68, 30],
          getLineColor: [239, 68, 68, 220],
          getRadius: pulseRadius,
          radiusMinPixels: pulseRadius,
          lineWidthMinPixels: 2,
          stroked: true,
        })
      );

      // Solid inner core target marker
      layerList.push(
        new ScatterplotLayer({
          id: 'puck-filtered-core',
          data: [{ position: [fTarget.lng, fTarget.lat] }],
          getPosition: (d: any) => d.position,
          getFillColor: [239, 68, 68, 255],
          getLineColor: [255, 255, 255, 255],
          getRadius: 8,
          radiusMinPixels: 7,
          lineWidthMinPixels: 2,
          stroked: true,
        })
      );

      // Target Label
      layerList.push(
        new TextLayer({
          id: 'puck-target-label',
          data: [{ position: [fTarget.lng, fTarget.lat], text: `DISTRESS: ${activePuckId}` }],
          getPosition: (d: any) => d.position,
          getText: (d: any) => d.text,
          getSize: 13,
          getColor: [255, 255, 255, 255],
          getBackgroundColor: [239, 68, 68, 200],
          backgroundPadding: [6, 4],
          characterSet: 'auto',
          fontFamily: 'monospace',
          fontWeight: 'bold',
          pixelOffset: [0, -28]
        })
      );
    }

    // 3. DRONE & BUOY MARKER LAYERS
    // UAV Drone Marker
    layerList.push(
      new ScatterplotLayer({
        id: 'uav-drone-marker',
        data: [{ position: [dLoc.lng, dLoc.lat] }],
        getPosition: (d: any) => d.position,
        getFillColor: [6, 182, 212, 255],
        getLineColor: [255, 255, 255, 255],
        getRadius: 10,
        radiusMinPixels: 9,
        lineWidthMinPixels: 2,
        stroked: true,
      })
    );

    layerList.push(
      new TextLayer({
        id: 'uav-drone-label',
        data: [{ position: [dLoc.lng, dLoc.lat], text: 'UAV-RESCUE-01' }],
        getPosition: (d: any) => d.position,
        getText: (d: any) => d.text,
        getSize: 11,
        getColor: [6, 182, 212, 255],
        getBackgroundColor: [9, 13, 22, 220],
        backgroundPadding: [4, 3],
        fontFamily: 'monospace',
        fontWeight: 'bold',
        pixelOffset: [0, 22]
      })
    );

    // Autonomous Rescue Buoy Marker
    layerList.push(
      new ScatterplotLayer({
        id: 'buoy-marker',
        data: [{ position: [bLoc.lng, bLoc.lat] }],
        getPosition: (d: any) => d.position,
        getFillColor: [245, 158, 11, 255],
        getLineColor: [255, 255, 255, 255],
        getRadius: 9,
        radiusMinPixels: 8,
        lineWidthMinPixels: 2,
        stroked: true,
      })
    );

    layerList.push(
      new TextLayer({
        id: 'buoy-label',
        data: [{ position: [bLoc.lng, bLoc.lat], text: 'BUOY-HYDRO-02' }],
        getPosition: (d: any) => d.position,
        getText: (d: any) => d.text,
        getSize: 11,
        getColor: [245, 158, 11, 255],
        getBackgroundColor: [9, 13, 22, 220],
        backgroundPadding: [4, 3],
        fontFamily: 'monospace',
        fontWeight: 'bold',
        pixelOffset: [0, 22]
      })
    );

    return layerList;
  }, [
    dronePath,
    buoyPath,
    hydrodynamics,
    activeDistress,
    rawTarget,
    filteredTarget,
    pulseRadius,
    puckId,
    droneLocation,
    buoyLocation
  ]);

  const noiseDelta = (filteredTarget as FilteredResult)?.noiseDeltaMeters ?? 0;

  return (
    <div className="relative w-full h-full bg-[#090D16] overflow-hidden select-none border-r border-[#1F293D]">
      {/* Offline Canvas Mesh Backdrop */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Deck.gl 3D Interactive Spatial Layer */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: newVs }) => setViewState(newVs as any)}
        controller={{ dragRotate: true, touchRotate: true }}
        layers={layers}
        style={{ position: 'absolute', width: '100%', height: '100%', zIndex: '10' }}
      />

      {/* Tactical Map Header Overlay & Mode Controls */}
      <div className="absolute top-4 left-4 z-20 flex flex-col space-y-2">
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
            <span>TACTICAL</span>
          </button>
          <button
            onClick={() => setMapMode('SATELLITE')}
            className={`px-2.5 py-1 text-xs font-mono rounded flex items-center space-x-1 font-semibold transition-all ${
              mapMode === 'SATELLITE'
                ? 'bg-[#06B6D4]/20 border border-[#06B6D4] text-[#06B6D4]'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
            <span>HYBRID</span>
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
      </div>

      {/* Quick Action Map Controls (Bottom Right) */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col space-y-2">
        <button
          onClick={handleRecenter}
          className="p-3 bg-[#111827]/90 hover:bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 rounded-lg shadow-2xl transition-all flex items-center justify-center group"
          title="Recenter Camera on Filtered Target"
        >
          <Locate className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Map Legend Overlay (Bottom Left) */}
      <div className="absolute bottom-6 left-4 z-20 bg-[#111827]/85 backdrop-blur border border-[#1F293D] rounded-lg p-2.5 font-mono text-[10px] text-gray-300 space-y-1.5 shadow-2xl">
        <div className="font-bold text-gray-200 border-b border-[#1F293D] pb-1 mb-1">MAP LEGEND</div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#EF4444] inline-block animate-ping"></span>
          <span>DISTRESS TARGET ({puckId || 'PUCK-ALPHA-04'})</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#06B6D4] inline-block"></span>
          <span>UAV DRONE VECTOR</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#F59E0B] inline-block"></span>
          <span>AUTONOMOUS BUOY TRAJECTORY</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3.5 h-0.5 bg-[#10B981] inline-block"></span>
          <span>DRIFT COMPENSATED INTERCEPT</span>
        </div>
      </div>
    </div>
  );
};

export default MapBoxView;
