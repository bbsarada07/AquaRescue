'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  CalendarClock, 
  LocateFixed, 
  Radio, 
  Signal, 
  Thermometer, 
  MoonStar, 
  ChevronRight, 
  CheckCircle2, 
  Camera, 
  ZoomIn, 
  LifeBuoy, 
  Send,
  Minimize2,
  Maximize2,
  X
} from 'lucide-react';

export type DroneCameraMode = 'RGB' | 'THERMAL' | 'NIGHT';

interface DroneCameraFeedProps {
  mode: DroneCameraMode;
  onModeChange: (mode: DroneCameraMode) => void;
  detectionConfidence: number;
  targetLat: number;
  targetLng: number;
  altitudeM: number;
  headingDeg: number;
  signalDbm: number;
  distanceToTarget: number;
  droneId: string;
  isSimulated: boolean;
  onManualPayloadDrop?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
}

const MODE_META: Record<DroneCameraMode, { label: string; Icon: React.ComponentType<{ className?: string }> }> = {
  RGB: { label: 'RGB', Icon: Radio },
  THERMAL: { label: 'THERMAL', Icon: Thermometer },
  NIGHT: { label: 'NIGHT VISION', Icon: MoonStar }
};

export const DroneCameraFeed: React.FC<DroneCameraFeedProps> = ({
  mode,
  onModeChange,
  detectionConfidence,
  targetLat,
  targetLng,
  altitudeM,
  headingDeg,
  signalDbm,
  distanceToTarget,
  droneId,
  isSimulated,
  onManualPayloadDrop,
  onMinimize,
  onMaximize,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [timestamp, setTimestamp] = useState(() => new Date());
  const [zoomLevel, setZoomLevel] = useState<number>(1.8);

  useEffect(() => {
    const id = setInterval(() => setTimestamp(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const start = performance.now();

    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) {
        raf = requestAnimationFrame(draw);
        return;
      }

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.clearRect(0, 0, w, h);
      const horizon = h * 0.38 + Math.sin(t * 0.35) * 6;

      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      const water = ctx.createLinearGradient(0, horizon, 0, h);

      if (mode === 'RGB') {
        sky.addColorStop(0, '#1a3148');
        sky.addColorStop(1, '#365f7a');
        water.addColorStop(0, '#1e5f88');
        water.addColorStop(1, '#0b2c45');
      } else if (mode === 'THERMAL') {
        sky.addColorStop(0, '#2a1823');
        sky.addColorStop(1, '#412132');
        water.addColorStop(0, '#3b2432');
        water.addColorStop(1, '#1e1118');
      } else {
        sky.addColorStop(0, '#0d1a1f');
        sky.addColorStop(1, '#152c35');
        water.addColorStop(0, '#10232d');
        water.addColorStop(1, '#07131b');
      }

      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);
      ctx.fillStyle = water;
      ctx.fillRect(0, horizon, w, h - horizon);

      ctx.save();
      ctx.globalAlpha = mode === 'NIGHT' ? 0.22 : 0.18;
      for (let i = 0; i < 12; i++) {
        const y = horizon + 12 + i * ((h - horizon - 12) / 12);
        const amp = 3 + (i % 3);
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const waveY = y + Math.sin((x * 0.022) + t * 1.7 + i * 0.6) * amp;
          if (x === 0) ctx.moveTo(x, waveY);
          else ctx.lineTo(x, waveY);
        }
        ctx.strokeStyle = mode === 'THERMAL' ? '#f97316' : '#89d8ff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.restore();

      const victimX = w * 0.56 + Math.sin(t * 0.8) * 10;
      const victimY = h * 0.62 + Math.cos(t * 1.4) * 4;
      const heatColor = mode === 'THERMAL' ? '#f43f5e' : mode === 'NIGHT' ? '#84cc16' : '#fef3c7';

      ctx.save();
      ctx.fillStyle = heatColor;
      ctx.globalAlpha = mode === 'THERMAL' ? 0.92 : 0.7;
      ctx.beginPath();
      ctx.arc(victimX, victimY - 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = mode === 'THERMAL' ? 0.88 : 0.64;
      ctx.fillRect(victimX - 7, victimY - 2, 14, 20);
      ctx.restore();

      if (mode === 'THERMAL') {
        const flare = ctx.createRadialGradient(victimX, victimY, 6, victimX, victimY, 28);
        flare.addColorStop(0, 'rgba(244, 63, 94, 0.85)');
        flare.addColorStop(1, 'rgba(244, 63, 94, 0)');
        ctx.fillStyle = flare;
        ctx.fillRect(victimX - 30, victimY - 30, 60, 60);
      }

      if (mode === 'NIGHT') {
        ctx.fillStyle = 'rgba(132, 204, 22, 0.16)';
        ctx.fillRect(0, 0, w, h);
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mode]);

  const confidenceLabel = useMemo(() => `${Math.round(detectionConfidence)}%`, [detectionConfidence]);
  const modeMeta = MODE_META[mode];

  return (
    <section className="bg-[#070C16] rounded-xl border border-[#1F293D] overflow-hidden shadow-2xl flex flex-col select-none h-full">
      {/* Panel Top Title Header */}
      <div className="px-4 py-2 border-b border-[#1F293D] bg-[#0C1422] flex items-center justify-between">
        <div className="flex items-center gap-2 text-white font-mono">
          <modeMeta.Icon className="w-4 h-4 text-[#06B6D4]" />
          <h3 className="text-xs font-bold tracking-wider uppercase">DRONE CAMERA / AI VISION</h3>
        </div>
        <div className="flex items-center space-x-2 font-mono">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/10">
            {isSimulated ? 'SIMULATED SENSOR FEED' : 'CAMERA LINKED'}
          </span>
          {onMinimize && (
            <button onClick={onMinimize} className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800">
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onMaximize && (
            <button onClick={onMaximize} className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Video Screen Container */}
      <div className="relative flex-1 min-h-[240px] max-h-[340px] bg-black">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* Video Overlay Info Header */}
        <div className="absolute top-2 left-3 right-3 flex items-center justify-between font-mono text-[10px] text-white z-10">
          <div className="flex items-center space-x-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-white/10">
            <span className="font-bold text-[#06B6D4]">{droneId || 'UAV-RESCUE-01'}</span>
            <span>·</span>
            <span>ALT {Math.round(altitudeM || 48)} m</span>
            <span>·</span>
            <span>SPD 12.4 m/s</span>
            <span>·</span>
            <span className="flex items-center text-[#EF4444] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#EF4444] animate-ping mr-1 inline-block"></span>
              REC
            </span>
          </div>
          <div className="flex items-center space-x-2 bg-black/60 backdrop-blur px-2.5 py-1 rounded border border-white/10">
            <span>{timestamp.toLocaleTimeString('en-US', { hour12: false })}</span>
            <span>·</span>
            <span>LAT {targetLat ? targetLat.toFixed(6) : '17.385063'}</span>
            <span>·</span>
            <span>LNG {targetLng ? targetLng.toFixed(6) : '78.486812'}</span>
          </div>
        </div>

        {/* Target Bounding Box Overlay */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-[54%] top-[48%] -translate-x-1/2 -translate-y-1/2 w-24 h-28 border-2 border-[#EF4444] shadow-[0_0_20px_rgba(239,68,68,0.5)] flex flex-col justify-between p-1">
            <div className="w-2 h-2 border-t-2 border-l-2 border-[#EF4444]"></div>
            <div className="self-end w-2 h-2 border-b-2 border-r-2 border-[#EF4444]"></div>
          </div>
          <div className="absolute left-[54%] top-[34%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-[#EF4444] text-white text-[10px] font-mono font-black rounded shadow-lg">
            PERSON DETECTED
          </div>
          <div className="absolute left-[54%] top-[66%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-black/80 border border-[#EF4444]/60 text-white text-[10px] font-mono font-bold rounded">
            CONFIDENCE: {confidenceLabel}
          </div>
        </div>
      </div>

      {/* Mode Buttons & Zoom controls */}
      <div className="p-2 border-t border-[#1F293D] bg-[#0C1422] flex items-center justify-between gap-2 font-mono">
        <div className="flex gap-1.5 flex-1">
          {(Object.keys(MODE_META) as DroneCameraMode[]).map((item) => (
            <button
              key={item}
              onClick={() => onModeChange(item)}
              className={`px-3 py-1 text-[11px] font-bold rounded border transition ${
                mode === item
                  ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                  : 'bg-[#070C16] border-[#1F293D] text-gray-400 hover:text-white'
              }`}
            >
              {MODE_META[item].label}
            </button>
          ))}
        </div>
        <div className="flex items-center space-x-2 text-[10px] text-gray-400 bg-[#070C16] px-2 py-1 rounded border border-[#1F293D]">
          <span>ZOOM</span>
          <span className="text-white font-bold">{zoomLevel.toFixed(1)}x</span>
          <Camera className="w-3.5 h-3.5 text-[#06B6D4] cursor-pointer hover:text-white" />
        </div>
      </div>

      {/* ── AI VISION ANALYSIS (DIR PIPELINE) ─────────────────────────── */}
      <div className="p-3 border-t border-[#1F293D] bg-[#090F1B]">
        <h4 className="text-[10px] font-mono font-bold text-gray-400 uppercase tracking-widest mb-2">
          AI VISION ANALYSIS (DIR PIPELINE)
        </h4>
        <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
          <div className="bg-[#0C1422] p-2 rounded border border-[#1F293D]">
            <div className="text-[9px] text-[#06B6D4] font-bold uppercase">DETECTION</div>
            <div className="text-white font-bold truncate">Human-shaped object</div>
            <div className="text-[10px] text-[#06B6D4]">98%</div>
          </div>
          <div className="bg-[#0C1422] p-2 rounded border border-[#1F293D]">
            <div className="text-[9px] text-[#10B981] font-bold uppercase">RECOGNITION</div>
            <div className="text-white font-bold truncate">Human / Person</div>
            <div className="text-[10px] text-[#10B981]">96%</div>
          </div>
          <div className="bg-[#0C1422] p-2 rounded border border-[#1F293D]">
            <div className="text-[9px] text-[#EF4444] font-bold uppercase">IDENTIFICATION</div>
            <div className="text-white font-bold truncate">Person in Distress</div>
            <div className="text-[10px] text-[#EF4444]">94%</div>
          </div>
        </div>
      </div>

      {/* ── DRONE PAYLOAD STATUS & RELEASE BUTTON ─────────────────────── */}
      <div className="p-3 border-t border-[#1F293D] bg-[#070C16] flex items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded bg-[#EF4444]/15 border border-[#EF4444]/40 flex items-center justify-center text-[#EF4444]">
            <LifeBuoy className="w-6 h-6 animate-pulse" />
          </div>
          <div className="font-mono text-xs">
            <div className="text-gray-400 text-[10px] font-bold">DRONE PAYLOAD STATUS</div>
            <div className="text-white font-bold">LIFE JACKET PAYLOAD</div>
            <div className="text-[#10B981] text-[10px] font-extrabold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              READY
            </div>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-4 font-mono text-[10px] text-gray-300">
          <div>
            <div className="text-gray-500">TARGET LOCK</div>
            <div className="text-[#10B981] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> LOCKED
            </div>
          </div>
          <div>
            <div className="text-gray-500">DROP ZONE</div>
            <div className="text-[#10B981] font-bold">LOCKED</div>
          </div>
          <div>
            <div className="text-gray-500">DISTANCE TO TARGET</div>
            <div className="text-white font-bold text-xs">{Math.round(distanceToTarget || 42)} m</div>
          </div>
        </div>

        <button
          onClick={onManualPayloadDrop}
          className="px-4 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white font-mono font-black text-xs tracking-wider uppercase shadow-[0_0_15px_rgba(239,68,68,0.4)] transition flex flex-col items-center justify-center shrink-0"
        >
          <span>RELEASE PAYLOAD</span>
          <span className="text-[8px] font-normal text-red-200">SIMULATED COMMAND</span>
        </button>
      </div>
    </section>
  );
};

export default DroneCameraFeed;

