'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Wifi,
  WifiOff,
  Signal,
  Activity,
  Database,
  Cpu,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';

export interface SignalHealthMonitorProps {
  isConnected: boolean;
  activeDistress: boolean;
  puckId: string;
  lastPacketTimestamp: number | null;
  sensorData: {
    screechConfidence: number;
    thermalDelta: number;
    waterVelocity: number;
    driftHeading: number;
  };
}

type SignalStatus = 'HEALTHY' | 'DEGRADED' | 'LOST';
type SystemStatus = 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';

// ── Styling helpers ──────────────────────────────────────────────────────────
const sigColor = (s: SignalStatus) =>
  s === 'HEALTHY' ? 'text-[#10B981]' : s === 'DEGRADED' ? 'text-[#F59E0B]' : 'text-[#EF4444]';

const sigBorder = (s: SignalStatus) =>
  s === 'HEALTHY' ? 'border-[#10B981]/30' : s === 'DEGRADED' ? 'border-[#F59E0B]/30' : 'border-[#EF4444]/30';

const sigBg = (s: SignalStatus) =>
  s === 'HEALTHY' ? 'bg-[#10B981]/5' : s === 'DEGRADED' ? 'bg-[#F59E0B]/5' : 'bg-[#EF4444]/5';

const SigIcon = ({ status }: { status: SignalStatus }) =>
  status === 'HEALTHY' ? (
    <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
  ) : status === 'DEGRADED' ? (
    <AlertCircle className="w-3 h-3 text-[#F59E0B]" />
  ) : (
    <XCircle className="w-3 h-3 text-[#EF4444]" />
  );

// ── Component ────────────────────────────────────────────────────────────────
export const SignalHealthMonitor: React.FC<SignalHealthMonitorProps> = ({
  isConnected,
  activeDistress,
  puckId,
  lastPacketTimestamp,
  sensorData,
}) => {
  // Offline demo mode detection
  const isSim = !isConnected && activeDistress;

  // ── Refs (avoid render churn on high-frequency updates) ──────────────────
  const lastPkgRef = useRef<number | null>(lastPacketTimestamp);
  const prevTimestampRef = useRef<number | null>(null);
  const packetCountRef = useRef(0);
  const windowStartRef = useRef(Date.now());

  // Sync latest timestamp into ref so the 1s interval always reads freshest value
  useEffect(() => {
    lastPkgRef.current = lastPacketTimestamp;
  }, [lastPacketTimestamp]);

  // Count distinct new packets (each unique timestamp = 1 packet)
  useEffect(() => {
    if (
      lastPacketTimestamp !== null &&
      lastPacketTimestamp !== prevTimestampRef.current
    ) {
      prevTimestampRef.current = lastPacketTimestamp;
      packetCountRef.current += 1;
    }
  }, [lastPacketTimestamp]);

  // ── 1-second display refresh ──────────────────────────────────────────────
  const [display, setDisplay] = useState({
    ageMs: null as number | null,
    pps: 0,
    lastSeen: '--:--:--',
  });

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const windowMs = Math.max(now - windowStartRef.current, 1);
      const pps = parseFloat((packetCountRef.current / (windowMs / 1000)).toFixed(1));

      packetCountRef.current = 0;
      windowStartRef.current = now;

      const ts = lastPkgRef.current;
      setDisplay({
        ageMs: ts !== null ? now - ts : null,
        pps,
        lastSeen: ts
          ? new Date(ts).toLocaleTimeString('en-US', { hour12: false })
          : '--:--:--',
      });
    };

    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []); // intentionally empty — relies on refs

  // ── Derive statuses ───────────────────────────────────────────────────────
  const { ageMs, pps, lastSeen } = display;

  const puckStatus: SignalStatus = !activeDistress
    ? 'HEALTHY'
    : ageMs === null ? 'LOST'
    : ageMs < 2000 ? 'HEALTHY'
    : ageMs < 5000 ? 'DEGRADED'
    : 'LOST';

  const telStatus: SignalStatus = !activeDistress
    ? 'HEALTHY'
    : ageMs === null ? 'LOST'
    : ageMs < 2000 ? 'HEALTHY'
    : ageMs < 5000 ? 'DEGRADED'
    : 'LOST';

  const wsStatus: SignalStatus = isConnected ? 'HEALTHY' : 'LOST';

  const overallStatus: SystemStatus =
    !isConnected && !activeDistress ? 'OFFLINE'
    : wsStatus === 'LOST' && telStatus === 'LOST' ? 'OFFLINE'
    : wsStatus === 'LOST' || puckStatus === 'LOST' || telStatus === 'DEGRADED' || puckStatus === 'DEGRADED' ? 'DEGRADED'
    : 'OPERATIONAL';

  const overallColor =
    overallStatus === 'OPERATIONAL' ? '#10B981'
    : overallStatus === 'DEGRADED' ? '#F59E0B'
    : '#EF4444';

  const ageLabel =
    ageMs === null ? 'N/A'
    : ageMs < 1000 ? `${ageMs}ms`
    : `${(ageMs / 1000).toFixed(1)}s`;

  // Data quality — real values only, no invented data
  const gpsOk = activeDistress;
  const audioOk = sensorData.screechConfidence > 0;
  const thermalOk = sensorData.thermalDelta > 0;
  const waterOk = sensorData.waterVelocity > 0;

  const telLabel =
    !activeDistress ? 'STANDBY'
    : telStatus === 'HEALTHY' ? 'LIVE'
    : 'STALE';

  return (
    <div className="bg-[#090D16] p-3.5 rounded-lg border border-[#1F293D] space-y-2.5 font-mono select-none">

      {/* ── Panel Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5">
        <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1.5 uppercase tracking-wider">
          <Signal className="w-3.5 h-3.5 text-[#06B6D4]" />
          Live Signal Health
        </span>
        <div className="flex items-center gap-2">
          {isSim && (
            <span className="text-[9px] font-extrabold bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#F59E0B] px-1.5 py-0.5 rounded tracking-wider">
              SIMULATION
            </span>
          )}
          <span
            className={`text-[10px] font-extrabold tracking-wider ${overallStatus === 'OPERATIONAL' ? 'animate-pulse' : ''}`}
            style={{ color: overallColor }}
          >
            ● {overallStatus}
          </span>
        </div>
      </div>

      {/* ── 1. Hardware / Puck Signal ─────────────────────────────────────── */}
      <div className={`p-2 rounded border ${sigBorder(puckStatus)} ${sigBg(puckStatus)} space-y-1.5`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            HARDWARE / PUCK
          </span>
          <span className={`text-[10px] font-bold flex items-center gap-1 ${sigColor(puckStatus)}`}>
            <SigIcon status={puckStatus} />
            {puckStatus}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 text-[10px] leading-5">
          <span className="text-gray-500">PUCK ID</span>
          <span className="text-white font-bold truncate">{puckId || '—'}</span>
          <span className="text-gray-500">PKT AGE</span>
          <span className={`font-bold ${sigColor(puckStatus)}`}>{ageLabel}</span>
          <span className="text-gray-500">LAST PKT</span>
          <span className="text-gray-300 font-mono">{lastSeen}</span>
        </div>
      </div>

      {/* ── 2. WebSocket Connection ───────────────────────────────────────── */}
      <div className={`p-2 rounded border ${sigBorder(wsStatus)} ${sigBg(wsStatus)} space-y-1.5`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
            WEBSOCKET
          </span>
          <span className={`text-[10px] font-bold flex items-center gap-1 ${sigColor(wsStatus)}`}>
            <SigIcon status={wsStatus} />
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 text-[10px] leading-5">
          <span className="text-gray-500">LAST MSG</span>
          <span className="text-gray-300 font-mono">{lastSeen}</span>
          <span className="text-gray-500">MODE</span>
          <span className="text-gray-300">
            {isConnected ? 'LIVE SOCKET' : isSim ? 'OFFLINE / SIM' : 'RECONNECTING'}
          </span>
        </div>
      </div>

      {/* ── 3. Telemetry Stream ───────────────────────────────────────────── */}
      <div className={`p-2 rounded border ${sigBorder(telStatus)} ${sigBg(telStatus)} space-y-1.5`}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-400 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            TELEMETRY STREAM
          </span>
          <span className={`text-[10px] font-bold flex items-center gap-1.5 ${
            telLabel === 'LIVE' ? 'text-[#06B6D4]'
            : telLabel === 'STALE' ? 'text-[#EF4444]'
            : 'text-gray-500'
          }`}>
            {telLabel === 'LIVE' && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#06B6D4] animate-ping inline-block" />
            )}
            {telLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 text-[10px] leading-5">
          <span className="text-gray-500">PKTS/SEC</span>
          <span className={`font-bold ${
            !activeDistress ? 'text-gray-500'
            : pps >= 3 ? 'text-[#10B981]'
            : pps >= 1 ? 'text-[#F59E0B]'
            : 'text-[#EF4444]'
          }`}>
            {activeDistress ? `${pps.toFixed(1)} pps` : '—'}
          </span>
          <span className="text-gray-500">FRESHNESS</span>
          <span className={`font-bold ${sigColor(telStatus)}`}>{ageLabel}</span>
        </div>
      </div>

      {/* ── 4. Data Quality ───────────────────────────────────────────────── */}
      <div className="p-2 rounded border border-[#1F293D] space-y-1.5">
        <span className="text-[10px] text-gray-400 flex items-center gap-1">
          <Database className="w-3 h-3" />
          DATA QUALITY
        </span>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
          {(
            [
              ['GPS', gpsOk],
              ['AUDIO SIG', audioOk],
              ['THERMAL', thermalOk],
              ['WATER VEL', waterOk],
            ] as [string, boolean][]
          ).map(([label, ok]) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 px-1.5 py-0.5 rounded ${
                ok
                  ? 'bg-[#10B981]/10 border border-[#10B981]/20'
                  : 'bg-gray-800/40 border border-gray-700/40'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  ok ? 'bg-[#10B981]' : 'bg-gray-600'
                }`}
              />
              <span className={ok ? 'text-[#10B981] font-bold' : 'text-gray-500'}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Simulation footer ────────────────────────────────────────────── */}
      {isSim && (
        <div className="text-[9px] text-[#F59E0B]/70 text-center border-t border-[#1F293D] pt-1.5 leading-relaxed">
          ⚠ OFFLINE SIMULATION MODE — No physical puck hardware connected
        </div>
      )}
    </div>
  );
};

export default SignalHealthMonitor;
