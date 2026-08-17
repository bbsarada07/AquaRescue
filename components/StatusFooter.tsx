'use client';

import React, { useEffect, useRef } from 'react';
import { ShieldCheck, Wifi, WifiOff, Activity, Database, Globe, Cpu } from 'lucide-react';

export interface StatusFooterProps {
  isConnected: boolean;
  dataRateKbps?: number;
  packetRatePkts?: number;
}

export const StatusFooter: React.FC<StatusFooterProps> = ({
  isConnected,
  dataRateKbps = 125,
  packetRatePkts = 512,
}) => {
  const sparklineRef1 = useRef<HTMLCanvasElement | null>(null);
  const sparklineRef2 = useRef<HTMLCanvasElement | null>(null);

  // Data rate sparkline
  useEffect(() => {
    const canvas = sparklineRef1.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (t: number) => {
      const w = canvas.offsetWidth || 60;
      const h = canvas.offsetHeight || 16;
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(16,185,129,0)');
      grad.addColorStop(1, 'rgba(16,185,129,0.8)');
      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      for (let x = 0; x < w; x += 2) {
        const y = (h / 2) + Math.sin(x * 0.22 + t / 280) * (h * 0.38) + Math.sin(x * 0.05 + t / 600) * (h * 0.15);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Packet rate sparkline
  useEffect(() => {
    const canvas = sparklineRef2.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const draw = (t: number) => {
      const w = canvas.offsetWidth || 60;
      const h = canvas.offsetHeight || 16;
      canvas.width = w;
      canvas.height = h;
      ctx.clearRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, 0);
      grad.addColorStop(0, 'rgba(6,182,212,0)');
      grad.addColorStop(1, 'rgba(6,182,212,0.8)');
      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      for (let x = 0; x < w; x += 2) {
        const y = (h / 2) + Math.cos(x * 0.28 + t / 220) * (h * 0.38) + Math.cos(x * 0.07 + t / 500) * (h * 0.12);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '9px',
    letterSpacing: '0.06em',
  };

  const labelStyle: React.CSSProperties = {
    color: '#374151',
    fontWeight: 500,
    textTransform: 'uppercase',
  };

  return (
    <footer
      style={{
        width: '100%',
        background: 'rgba(5,9,18,0.95)',
        borderTop: '1px solid #1A2840',
        padding: '5px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '8px',
        userSelect: 'none',
        flexShrink: 0,
        minHeight: '32px',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* System Status */}
      <div style={itemStyle}>
        <ShieldCheck style={{ width: '12px', height: '12px', color: '#10B981' }} />
        <span style={labelStyle}>SYSTEM</span>
        <span style={{ color: '#10B981', fontWeight: 700 }}>ALL SYSTEMS OPERATIONAL</span>
      </div>

      {/* Connection */}
      <div style={itemStyle}>
        {isConnected
          ? <Wifi style={{ width: '12px', height: '12px', color: '#10B981' }} />
          : <WifiOff style={{ width: '12px', height: '12px', color: '#EF4444' }} />
        }
        <span style={labelStyle}>LINK</span>
        <span style={{ color: isConnected ? '#10B981' : '#EF4444', fontWeight: 700 }}>
          {isConnected ? 'WEBSOCKET LIVE' : 'DISCONNECTED'}
        </span>
      </div>

      {/* Data Rate */}
      <div style={{ ...itemStyle }}>
        <Activity style={{ width: '12px', height: '12px', color: '#10B981' }} />
        <span style={labelStyle}>DATA</span>
        <span style={{ color: '#F3F4F6', fontWeight: 700 }}>{dataRateKbps} KB/s</span>
        <div style={{ width: '56px', height: '16px' }}>
          <canvas ref={sparklineRef1} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>

      {/* Packet Rate */}
      <div style={itemStyle}>
        <Database style={{ width: '12px', height: '12px', color: '#06B6D4' }} />
        <span style={labelStyle}>PKTS</span>
        <span style={{ color: '#F3F4F6', fontWeight: 700 }}>{packetRatePkts} pkt/s</span>
        <div style={{ width: '56px', height: '16px' }}>
          <canvas ref={sparklineRef2} style={{ width: '100%', height: '100%', display: 'block' }} />
        </div>
      </div>

      {/* Coordinate System */}
      <div style={itemStyle}>
        <Globe style={{ width: '12px', height: '12px', color: '#06B6D4' }} />
        <span style={labelStyle}>CRS</span>
        <span style={{ color: '#06B6D4', fontWeight: 700 }}>WGS84 / EPSG:4326</span>
      </div>

      {/* CPU/GPU Status */}
      <div style={itemStyle}>
        <Cpu style={{ width: '12px', height: '12px', color: '#9CA3AF' }} />
        <span style={labelStyle}>ENGINE</span>
        <span style={{ color: '#9CA3AF', fontWeight: 600 }}>KALMAN 2D · HYDRO · GEMINI-2.5</span>
      </div>
    </footer>
  );
};

export default StatusFooter;
