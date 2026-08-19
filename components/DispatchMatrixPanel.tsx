'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Zap, 
  Send, 
  ShieldCheck, 
  QrCode, 
  X, 
  Copy, 
  Check, 
  Navigation, 
  Waves, 
  Bot, 
  Battery, 
  AlertTriangle,
  ArrowRight,
  Crosshair
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { GPSCoordinate } from '@/lib/kalman';
import { 
  calculateDynamicTTIAllocation, 
  DEFAULT_RESPONDER_FLEET, 
  DEFAULT_HAZARDS, 
  DispatchRecommendation,
  ResponderType
} from '@/lib/dispatchAllocation';

export interface DispatchMatrixPanelProps {
  activeDistress: boolean;
  puckId: string | null;
  targetLocation: GPSCoordinate | null;
  waterVelocity?: number;
  driftHeading?: number;
  droneLocation?: GPSCoordinate | null;
  buoyLocation?: GPSCoordinate | null;
  responderLocation?: GPSCoordinate | null;
  droneStatus?: string;
  buoyStatus?: string;
  responderStatus?: string;
  onExecuteRescue: () => void;
  onOverrideDispatch?: (unitId: string) => void;
  onShareTrack?: () => void;
}

export const DispatchMatrixPanel: React.FC<DispatchMatrixPanelProps> = ({
  activeDistress,
  puckId,
  targetLocation,
  waterVelocity = 1.8,
  driftHeading = 140,
  droneLocation,
  buoyLocation,
  responderLocation,
  droneStatus = 'STANDBY',
  buoyStatus = 'STANDBY',
  responderStatus = 'STANDBY',
  onExecuteRescue,
  onOverrideDispatch,
  onShareTrack,
}) => {
  const [showQRModal, setShowQRModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [lowBatterySim, setLowBatterySim] = useState<boolean>(false);

  const targetGPS: GPSCoordinate = targetLocation || { lat: 17.385044, lng: 78.486671 };

  // Prepare active fleet copy with dynamic location updates and optional battery test toggle
  const activeFleet = DEFAULT_RESPONDER_FLEET.map((unit) => {
    let loc = unit.location;
    let status = unit.status;
    let battery = unit.batteryPct;

    if (unit.type === 'UAV_DRONE') {
      if (droneLocation) loc = droneLocation;
      if (droneStatus) status = droneStatus as any;
    } else if (unit.type === 'AUTONOMOUS_BUOY') {
      if (buoyLocation) loc = buoyLocation;
      if (buoyStatus) status = buoyStatus as any;
      if (lowBatterySim) battery = 12; // Simulate battery lockout safeguard (<15%)
    } else if (unit.type === 'HUMAN_BOAT') {
      if (responderLocation) loc = responderLocation;
      if (responderStatus) status = responderStatus as any;
    }

    return { ...unit, location: loc, status, batteryPct: battery };
  });

  // Calculate dynamic TTI allocation matrix
  const dispatchRec: DispatchRecommendation = calculateDynamicTTIAllocation(
    targetGPS,
    activeFleet,
    { riverCurrentSpeedMS: waterVelocity, riverCurrentHeadingDeg: driftHeading, windSpeedMS: 4.5, windHeadingDeg: 220 },
    DEFAULT_HAZARDS
  );

  const optimalUnit = dispatchRec.calculatedMatrix.find((u) => u.unitId === dispatchRec.optimalUnitId);

  // Keyboard shortcut listener for [SPACEBAR] Hero Auto-Dispatch
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (activeDistress) {
          onExecuteRescue();
        }
      }
    },
    [activeDistress, onExecuteRescue]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const fieldShareUrl = `https://aquarescue.mesh/nav?lat=${targetGPS.lat.toFixed(6)}&lng=${targetGPS.lng.toFixed(6)}&puck=${puckId || 'PUCK-ALPHA-04'}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fieldShareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const renderUnitIcon = (type: ResponderType) => {
    switch (type) {
      case 'UAV_DRONE':
        return <Navigation className="w-4 h-4 text-[#06B6D4]" />;
      case 'AUTONOMOUS_BUOY':
        return <Waves className="w-4 h-4 text-[#FFB000]" />;
      case 'HUMAN_BOAT':
        return <Send className="w-4 h-4 text-[#A78BFA]" />;
    }
  };

  return (
    <div className="w-full bg-[#090D16] border border-[#1F293D] rounded-lg p-3 space-y-3 font-mono text-gray-200 select-none shadow-2xl">
      {/* Header Banner */}
      <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded bg-[#00FF88]/15 border border-[#00FF88]/40 text-[#00FF88]">
            <Crosshair className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-white tracking-wider flex items-center gap-1.5">
              <span>DYNAMIC TTI DISPATCH MATRIX</span>
              <span className="w-2 h-2 rounded-full bg-[#00FF88] animate-ping inline-block" />
            </div>
            <div className="text-[9px] text-gray-400 uppercase">ZERO-COGNITIVE-LOAD EMERGENCY ENGINE</div>
          </div>
        </div>

        {/* Safeguard Simulator Toggle */}
        <button
          onClick={() => setLowBatterySim((prev) => !prev)}
          className={`text-[9px] px-2 py-0.5 rounded border transition-all ${
            lowBatterySim
              ? 'bg-[#FF3366]/20 border-[#FF3366] text-[#FF3366] font-bold'
              : 'bg-gray-800/40 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          {lowBatterySim ? 'SAFEGUARD TEST: BUOY BATTERY LOW (<15%)' : 'TEST BATTERY SAFEGUARD'}
        </button>
      </div>

      {/* ONE-TAP HERO DISPATCH BUTTON */}
      <div className="space-y-1.5">
        <button
          onClick={onExecuteRescue}
          disabled={!activeDistress}
          className={`w-full py-3.5 px-4 rounded-lg font-extrabold text-xs uppercase tracking-wider flex flex-col items-center justify-center space-y-1 transition-all shadow-2xl border ${
            activeDistress
              ? 'bg-gradient-to-r from-[#00FF88] via-[#10B981] to-[#06B6D4] text-black border-[#00FF88] hover:brightness-125 shadow-[0_0_25px_rgba(0,255,136,0.35)] animate-pulse'
              : 'bg-gray-800/60 border-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          <div className="flex items-center space-x-2 text-sm font-black">
            <Zap className="w-5 h-5 fill-current" />
            <span>CONFIRM & AUTO-DISPATCH OPTIMAL RESPONDER (SPACEBAR)</span>
          </div>
          {optimalUnit && activeDistress && (
            <div className="text-[10px] text-black/80 font-bold flex items-center space-x-2 bg-white/20 px-2.5 py-0.5 rounded-full">
              <span>RECOMMENDED: {optimalUnit.unitName}</span>
              <span>•</span>
              <span>ETA {optimalUnit.ttiSeconds}s</span>
              <span>•</span>
              <span>{dispatchRec.rationaleEnglish}</span>
            </div>
          )}
        </button>
      </div>

      {/* COMPARATIVE MATRIX TABLE */}
      <div className="bg-[#090D16] rounded border border-[#1F293D] overflow-hidden text-[11px]">
        <div className="bg-[#111827] px-3 py-1.5 border-b border-[#1F293D] flex justify-between items-center text-[10px] font-bold text-gray-400">
          <span>COMPARATIVE RESPONDER TTI MATRIX</span>
          <span className="text-[#00FF88]">AUTO-SELECTION: ACTIVE</span>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1F293D] text-[9px] text-gray-400 bg-black/40">
              <th className="py-1.5 px-2">RESPONDER NAME</th>
              <th className="py-1.5 px-2">TYPE</th>
              <th className="py-1.5 px-2 text-right">DIST</th>
              <th className="py-1.5 px-2 text-right">TTI</th>
              <th className="py-1.5 px-2">STATUS</th>
              <th className="py-1.5 px-2 text-center">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1F293D]/60">
            {dispatchRec.calculatedMatrix.map((item) => {
              const isOptimal = item.unitId === dispatchRec.optimalUnitId;
              const isLockedOut = !item.isAvailable;

              return (
                <tr
                  key={item.unitId}
                  className={`transition-all ${
                    isOptimal
                      ? 'bg-[#00FF88]/10 border-l-4 border-l-[#00FF88] font-bold text-white shadow-[inset_0_0_12px_rgba(0,255,136,0.15)]'
                      : isLockedOut
                      ? 'bg-gray-900/40 text-gray-500 opacity-60'
                      : 'hover:bg-[#111827] text-gray-300'
                  }`}
                >
                  <td className="py-2 px-2">
                    <div className="flex items-center space-x-1.5">
                      {renderUnitIcon(item.type)}
                      <span className={isOptimal ? 'text-[#00FF88] font-extrabold' : undefined}>{item.unitName}</span>
                      {isOptimal && (
                        <span className="text-[8px] bg-[#00FF88]/20 border border-[#00FF88] text-[#00FF88] px-1 py-0.2 rounded font-bold">
                          OPTIMAL
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-2 px-2 text-[9px] text-gray-400">{item.type.replace('_', ' ')}</td>

                  <td className="py-2 px-2 text-right font-mono text-white">{item.geodesicDistanceMeters}m</td>

                  <td className="py-2 px-2 text-right font-mono">
                    {isLockedOut ? (
                      <span className="text-[#FF3366] font-bold">LOCKOUT</span>
                    ) : (
                      <span className={isOptimal ? 'text-[#00FF88] font-black text-xs' : 'text-white font-bold'}>
                        {item.ttiSeconds}s
                      </span>
                    )}
                  </td>

                  <td className="py-2 px-2 text-[9px]">
                    {isLockedOut ? (
                      <span className="text-[#FF3366] font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        {item.lockoutReason || 'UNAVAILABLE'}
                      </span>
                    ) : (
                      <span className="text-[#00FF88] font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        {item.status}
                      </span>
                    )}
                  </td>

                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => onOverrideDispatch && onOverrideDispatch(item.unitId)}
                      disabled={isLockedOut}
                      className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase transition-all border ${
                        isOptimal
                          ? 'bg-[#00FF88]/20 border-[#00FF88] text-[#00FF88] hover:bg-[#00FF88] hover:text-black'
                          : isLockedOut
                          ? 'border-gray-800 text-gray-600 cursor-not-allowed'
                          : 'bg-[#06B6D4]/15 border-[#06B6D4]/50 text-[#06B6D4] hover:bg-[#06B6D4] hover:text-black'
                      }`}
                    >
                      OVERRIDE
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* FIELD RESPONDER MOBILE SYNC & SHARE LINK */}
      <div className="flex items-center justify-between bg-[#111827] p-2.5 rounded border border-[#1F293D]">
        <div className="text-[10px] space-y-0.5">
          <div className="text-gray-400 font-bold uppercase flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-[#06B6D4]" />
            FIELD RESPONDER MOBILE SYNC
          </div>
          <div className="text-white font-mono text-[11px] font-bold">
            GPS: <span className="text-[#00FF88]">Lat: {targetGPS.lat.toFixed(6)}, Lng: {targetGPS.lng.toFixed(6)}</span>
          </div>
        </div>

        <button
          onClick={() => {
            if (onShareTrack) onShareTrack();
            setShowQRModal(true);
          }}
          className="px-3 py-1.5 rounded bg-[#06B6D4]/20 border border-[#06B6D4]/60 text-[#06B6D4] hover:bg-[#06B6D4] hover:text-black text-xs font-extrabold uppercase flex items-center space-x-1.5 transition-all shadow-lg"
        >
          <QrCode className="w-4 h-4" />
          <span>SHARE FIELD LINK</span>
        </button>
      </div>

      {/* MOBILE FIELD SYNC QR CODE MODAL */}
      {showQRModal && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#090D16] border border-[#00FF88] rounded-xl p-5 max-w-sm w-full space-y-4 shadow-[0_0_40px_rgba(0,255,136,0.2)] font-mono">
            <div className="flex justify-between items-center border-b border-[#1F293D] pb-2">
              <div className="flex items-center space-x-2 text-[#00FF88]">
                <QrCode className="w-5 h-5" />
                <span className="font-extrabold text-sm tracking-wider text-white">FIELD TEAM MOBILE SYNC</span>
              </div>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-center space-y-3">
              <p className="text-xs text-gray-300">
                Scan QR code with mobile field device to load real-time victim GPS telemetry & turn-by-turn navigation.
              </p>

              {/* QR Code Container */}
              <div className="bg-white p-3 rounded-lg inline-block shadow-xl border-2 border-[#00FF88]">
                <QRCodeSVG value={fieldShareUrl} size={150} level="H" />
              </div>

              <div className="bg-[#111827] p-2.5 rounded border border-[#1F293D] text-[10px] text-left space-y-1">
                <div className="text-gray-400">TARGET PUCK: <strong className="text-white">{puckId || 'PUCK-ALPHA-04'}</strong></div>
                <div className="text-gray-400">COORDINATES: <strong className="text-[#00FF88]">17.385044, 78.486671</strong></div>
                <div className="text-gray-400">TACTICAL ROUTE: <strong className="text-[#06B6D4]">DIRECT WATER CORRIDOR</strong></div>
              </div>
            </div>

            <div className="flex space-x-2 pt-1">
              <button
                onClick={copyToClipboard}
                className="flex-1 py-2 rounded bg-gray-800 border border-gray-700 hover:bg-gray-700 text-xs font-bold text-gray-200 flex items-center justify-center space-x-1.5 transition-all"
              >
                {copiedLink ? <Check className="w-4 h-4 text-[#00FF88]" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'COPIED LINK!' : 'COPY FIELD LINK'}</span>
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="px-4 py-2 rounded bg-[#00FF88] text-black font-extrabold text-xs uppercase hover:brightness-110"
              >
                DONE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatchMatrixPanel;
