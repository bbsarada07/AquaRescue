'use client';

/**
 * DroneCameraFeed.tsx — v3
 *
 * Multi-sensor UAV camera monitor with real video integration.
 *
 * ── Architecture ─────────────────────────────────────────────────────────────
 *
 *   ONE <video> element  →  master playback state (currentTime, play/pause)
 *        │
 *        ├─ RGB mode:     <video> visible directly, canvas hidden
 *        ├─ THERMAL mode: <video> hidden; rAF loop reads frames → Ironbow LUT → <canvas>
 *        └─ NIGHT mode:   <video> hidden; rAF loop reads frames → NV filter → <canvas>
 *
 *   Canvas renders even when video is PAUSED (frozen frame stays visible).
 *   Mode switches cancel the old rAF loop and start a new one instantly.
 *   Bounding-box overlay is a separate <div> layer (NOT baked into canvas).
 *   Detection is driven purely off video.currentTime via `timeupdate` event.
 *
 * ── Fallback ─────────────────────────────────────────────────────────────────
 *   When videoSrc is absent or the video hasn't loaded yet, the canvas
 *   displays an animated simulation scene so the panel never shows blank.
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Flame,
  LifeBuoy,
  Maximize2,
  Minimize2,
  Moon,
  UserRound,
  Video,
  X,
} from 'lucide-react';
import {
  buildIronbowLUT,
  applyThermalFilter,
  applyNightFilter,
} from '@/lib/cameraFilters';
import {
  DEFAULT_DETECTION_EVENTS,
  DetectionEvent,
  HumanDetectedPayload,
  ScenarioEventName,
} from '@/lib/detectionEvents';

// ── Precompute LUT at module level — never rebuilt inside rAF ─────────────
const IRONBOW_LUT = buildIronbowLUT();

// ── Types ──────────────────────────────────────────────────────────────────
export type DroneCameraMode = 'RGB' | 'THERMAL' | 'NIGHT';

export interface DroneCameraFeedProps {
  // Core props (unchanged API — backward-compatible)
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

  // Video integration props
  /** Path to master UAV surveillance video. Falls back to canvas sim if absent. */
  videoSrc?: string;
  /** Detection event timeline — defaults to DEFAULT_DETECTION_EVENTS */
  detectionEvents?: DetectionEvent[];
  /** Called once per confirmed human target event */
  onHumanDetected?: (payload: HumanDetectedPayload) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const clamp01 = (v: number) => Math.max(0, Math.min(100, v));

const formatTime = (s: number) => {
  if (!isFinite(s)) return '00:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// ── Fallback canvas simulation ─────────────────────────────────────────────
function drawFallback(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: DroneCameraMode,
  t: number,
): void {
  ctx.clearRect(0, 0, w, h);
  const horizon = h * 0.38 + Math.sin(t * 0.35) * 6;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  const water = ctx.createLinearGradient(0, horizon, 0, h);

  if (mode === 'THERMAL') {
    sky.addColorStop(0, '#1a0e1a'); sky.addColorStop(1, '#2e1428');
    water.addColorStop(0, '#1a0a16'); water.addColorStop(1, '#0c0810');
  } else if (mode === 'NIGHT') {
    sky.addColorStop(0, '#021108'); sky.addColorStop(1, '#041f10');
    water.addColorStop(0, '#031509'); water.addColorStop(1, '#010a05');
  } else {
    sky.addColorStop(0, '#1a3148'); sky.addColorStop(1, '#365f7a');
    water.addColorStop(0, '#1e5f88'); water.addColorStop(1, '#0b2c45');
  }

  ctx.fillStyle = sky;   ctx.fillRect(0, 0, w, horizon);
  ctx.fillStyle = water; ctx.fillRect(0, horizon, w, h - horizon);

  // Waves
  ctx.save();
  ctx.globalAlpha = 0.18;
  for (let i = 0; i < 10; i++) {
    const y = horizon + 14 + i * ((h - horizon - 14) / 10);
    const amp = 2 + (i % 3);
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) {
      const wy = y + Math.sin(x * 0.022 + t * 1.7 + i * 0.6) * amp;
      x === 0 ? ctx.moveTo(x, wy) : ctx.lineTo(x, wy);
    }
    ctx.strokeStyle = mode === 'THERMAL' ? '#f97316' : mode === 'NIGHT' ? '#22c55e' : '#89d8ff';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // Subject silhouette
  const vx = w * 0.55 + Math.sin(t * 0.7) * 8;
  const vy = h * 0.6 + Math.cos(t * 1.2) * 4;
  const fillColor = mode === 'THERMAL' ? '#f43f5e' : mode === 'NIGHT' ? '#4ade80' : '#fef3c7';

  ctx.save();
  ctx.fillStyle = fillColor;
  ctx.globalAlpha = mode === 'THERMAL' ? 0.92 : 0.72;
  ctx.beginPath(); ctx.arc(vx, vy - 8, 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(vx - 7, vy - 2, 14, 20);
  ctx.restore();

  // Thermal radial heat bloom
  if (mode === 'THERMAL') {
    const g = ctx.createRadialGradient(vx, vy, 4, vx, vy, 32);
    g.addColorStop(0, 'rgba(244,63,94,0.7)');
    g.addColorStop(1, 'rgba(244,63,94,0)');
    ctx.fillStyle = g;
    ctx.fillRect(vx - 35, vy - 35, 70, 70);
  }

  // Night IR green tint overlay
  if (mode === 'NIGHT') {
    ctx.fillStyle = 'rgba(34,197,94,0.08)';
    ctx.fillRect(0, 0, w, h);
    // Scanlines
    for (let y = 0; y < h; y += 4) {
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, y, w, 1);
    }
  }
}

// ── Active overlay state ───────────────────────────────────────────────────
interface ActiveOverlay {
  event: DetectionEvent;
  dismissAt?: number;
}

// ── DRI stage labels ───────────────────────────────────────────────────────
const DRI_STAGE_LABELS: Record<string, string> = {
  UAV_SCAN_START:      'SCANNING CORRIDOR',
  OBJECT_DETECTED:     'OBJECT DETECTED',
  NON_HUMAN_CLASSIFIED:'NON-HUMAN CLASSIFIED',
  HUMAN_DETECTED:      'HUMAN DETECTED',
  TARGET_CONFIRMED:    'TARGET CONFIRMED',
  LOCATION_LOCKED:     'LOCATION LOCKED',
  RESCUE_DISPATCHED:   'RESCUE DISPATCHED',
  INCIDENT_RESOLVED:   'INCIDENT RESOLVED',
};

// ── Main component ─────────────────────────────────────────────────────────
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
  videoSrc,
  detectionEvents = DEFAULT_DETECTION_EVENTS,
  onHumanDetected,
}) => {
  // ── Refs ────────────────────────────────────────────────────────────────
  const videoRef     = useRef<HTMLVideoElement | null>(null);
  const canvasRef    = useRef<HTMLCanvasElement | null>(null);
  const offRef       = useRef<HTMLCanvasElement | null>(null);
  const rafRef       = useRef<number>(0);
  const firedRef     = useRef<Set<number>>(new Set());
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sorted once so timeupdate scan is O(n)
  const sortedEvents = useMemo(
    () => [...detectionEvents].sort((a, b) => a.time - b.time),
    [detectionEvents],
  );

  // ── State ───────────────────────────────────────────────────────────────
  const [wallClock, setWallClock] = useState(() => new Date());
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [overlay, setOverlay] = useState<ActiveOverlay | null>(null);
  const [lastScenario, setLastScenario] = useState<ScenarioEventName>('UAV_SCAN_START');
  const [zoomLevel, setZoomLevel] = useState(1.8);

  // Wall-clock ticker (1Hz)
  useEffect(() => {
    const id = setInterval(() => setWallClock(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // Dismiss timer cleanup
  useEffect(() => () => { if (dismissTimer.current) clearTimeout(dismissTimer.current); }, []);

  // ── Detection handler ────────────────────────────────────────────────────
  const handleDetection = useCallback(
    (event: DetectionEvent) => {
      if (firedRef.current.has(event.time)) return;
      firedRef.current.add(event.time);

      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setLastScenario(event.scenario);

      if (event.target) {
        // GREEN human-target — persistent until video ends
        setOverlay({ event });
        if (onHumanDetected && event.lat != null && event.lng != null) {
          onHumanDetected({
            lat: event.lat,
            lng: event.lng,
            confidence: event.confidence ?? 95,
            timestamp: new Date().toISOString(),
            label: event.label,
            scenario: event.scenario,
          });
        }
      } else if (event.type === 'SCAN') {
        // Scanning event — no box, just update scenario label briefly
        setOverlay(null);
      } else {
        // RED debris — auto-dismiss
        const ms = event.dismissAfterMs ?? 3000;
        setOverlay({ event, dismissAt: Date.now() + ms });
        dismissTimer.current = setTimeout(() => {
          setOverlay(null);
          dismissTimer.current = null;
        }, ms);
      }
    },
    [onHumanDetected],
  );

  // ── Video event listeners ────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const ct = video.currentTime;
      setVideoCurrentTime(ct);
      for (const ev of sortedEvents) {
        if (ct >= ev.time && !firedRef.current.has(ev.time)) {
          handleDetection(ev);
        }
      }
    };

    const onLoaded  = () => setVideoDuration(video.duration || 0);
    const onPlay    = () => setIsPlaying(true);
    const onPause   = () => setIsPlaying(false);
    const onEnded   = () => setIsPlaying(false);

    video.addEventListener('timeupdate',      onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('durationchange', onLoaded);
    video.addEventListener('play',           onPlay);
    video.addEventListener('pause',          onPause);
    video.addEventListener('ended',          onEnded);

    return () => {
      video.removeEventListener('timeupdate',      onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('durationchange', onLoaded);
      video.removeEventListener('play',           onPlay);
      video.removeEventListener('pause',          onPause);
      video.removeEventListener('ended',          onEnded);
    };
  }, [sortedEvents, handleDetection]);

  // ── rAF canvas render loop ───────────────────────────────────────────────
  // Runs for ALL modes — RGB mode skips pixel processing but keeps loop alive
  // so switching modes is instant (no loop restart delay).
  // IMPORTANT: Renders even when video is paused (frozen frame).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Lazy-create offscreen scratch canvas
    if (!offRef.current) offRef.current = document.createElement('canvas');
    const offscreen = offRef.current;

    let cancelled = false;
    const simStart = performance.now();

    const draw = (now: number) => {
      if (cancelled) return;

      const w = canvas.clientWidth  || 640;
      const h = canvas.clientHeight || 360;

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width       = w;
        canvas.height      = h;
        offscreen.width    = w;
        offscreen.height   = h;
      }

      if (mode === 'RGB') {
        // RGB: video element is visible directly — canvas not needed.
        // Keep loop spinning for instant mode switches.
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const video = videoRef.current;
      const hasFrame = video != null && video.readyState >= 2 && video.videoWidth > 0;

      if (hasFrame) {
        // ── Real video frame processing ───────────────────────────────────
        const octx = offscreen.getContext('2d', { willReadFrequently: true })!;
        octx.drawImage(video, 0, 0, w, h);
        const src  = octx.getImageData(0, 0, w, h);
        const dest = ctx.createImageData(w, h);

        if (mode === 'THERMAL') {
          applyThermalFilter(src, dest, IRONBOW_LUT);
        } else {
          // NIGHT — pass dimensions for vignette
          applyNightFilter(src, dest, now, w, h);
        }

        ctx.putImageData(dest, 0, 0);

        // Scanlines on top of processed frame (for both modes)
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);

      } else {
        // ── Fallback simulation (no video loaded yet) ─────────────────────
        const t = (now - simStart) / 1000;
        drawFallback(ctx, w, h, mode, t);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [mode]); // only re-run when mode changes

  // ── Derived display values ──────────────────────────────────────────────
  const boxIsHuman = overlay?.event.target ?? false;
  const boxColor   = boxIsHuman ? '#10B981' : '#EF4444';
  const boxGlow    = boxIsHuman
    ? '0 0 20px rgba(16,185,129,0.65)'
    : '0 0 16px rgba(239,68,68,0.55)';
  const bbox = overlay?.event.bbox ?? { left: 44, top: 42, width: 14, height: 24 };

  // DRI pipeline states derived from lastScenario
  const driDetect  = ['OBJECT_DETECTED','NON_HUMAN_CLASSIFIED','HUMAN_DETECTED','TARGET_CONFIRMED','LOCATION_LOCKED'].includes(lastScenario);
  const driRecog   = ['NON_HUMAN_CLASSIFIED','HUMAN_DETECTED','TARGET_CONFIRMED','LOCATION_LOCKED'].includes(lastScenario);
  const driIdent   = ['TARGET_CONFIRMED','LOCATION_LOCKED','RESCUE_DISPATCHED'].includes(lastScenario);

  const scenarioLabel = DRI_STAGE_LABELS[lastScenario] ?? 'SCANNING CORRIDOR';
  const hasHumanConfirmed = ['TARGET_CONFIRMED','LOCATION_LOCKED','RESCUE_DISPATCHED'].includes(lastScenario);

  const modeAccent = mode === 'THERMAL' ? '#F59E0B' : mode === 'NIGHT' ? '#10B981' : '#06B6D4';
  const modeLabel  = mode === 'THERMAL' ? 'FLIR · SIMULATION' : mode === 'NIGHT' ? 'NIGHT IR · SIM' : 'UAV-01 · OPTICAL FEED';

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <section className="bg-[#070C16] rounded-xl border border-[#1F293D] overflow-hidden shadow-2xl flex flex-col select-none h-full">

      {/* ── Panel header bar ─────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-[#1F293D] bg-[#0C1422] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 font-mono">
          {mode === 'THERMAL' ? (
            <Flame className="w-4 h-4 text-[#F59E0B]" />
          ) : mode === 'NIGHT' ? (
            <Moon className="w-4 h-4 text-[#10B981]" />
          ) : (
            <Video className="w-4 h-4 text-[#06B6D4]" />
          )}
          <h3 className="text-xs font-bold tracking-wider uppercase text-white">
            UAV OPTICAL &amp; THERMAL HD
          </h3>
          {/* Live scenario stage pill */}
          <span
            className="text-[9px] font-bold px-1.5 py-0.5 rounded font-mono"
            style={{ background: `${modeAccent}22`, color: modeAccent, border: `1px solid ${modeAccent}55` }}
          >
            {scenarioLabel}
          </span>
        </div>
        <div className="flex items-center space-x-1.5 font-mono">
          <span className="text-[9px] font-bold px-2 py-0.5 rounded border border-[#F59E0B]/40 text-[#F59E0B] bg-[#F59E0B]/10">
            {isSimulated ? 'SIMULATION FEED' : 'CAMERA LINKED'}
          </span>
          {onMinimize && (
            <button onClick={onMinimize} className="p-1 text-gray-500 hover:text-white rounded hover:bg-white/5">
              <Minimize2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onMaximize && (
            <button onClick={onMaximize} className="p-1 text-gray-500 hover:text-white rounded hover:bg-white/5">
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-white rounded hover:bg-white/5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Video viewport ───────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-[220px] bg-black overflow-hidden">

        {/* Master <video> — single source of truth for all three modes */}
        <video
          ref={videoRef}
          src={videoSrc}
          autoPlay
          muted
          playsInline
          loop={true}
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-100 ${
            mode === 'RGB' ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        />

        {/* Filter canvas — visible in THERMAL/NIGHT, also fallback when no video */}
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 w-full h-full transition-opacity duration-100 ${
            mode === 'RGB' && videoSrc ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        />

        {/* Scanlines overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'repeating-linear-gradient(to bottom,transparent 0,transparent 2px,rgba(0,0,0,0.07) 2px,rgba(0,0,0,0.07) 4px)',
          }}
        />

        {/* ── HUD top-left: drone ID + telemetry ──────────────────────── */}
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between font-mono text-[10px] text-white z-20 gap-1">
          <div className="flex items-center gap-1.5 bg-black/65 backdrop-blur-sm px-2 py-1 rounded border border-white/10">
            <span className="font-bold" style={{ color: modeAccent }}>{droneId || 'UAV-RESCUE-01'}</span>
            <span className="text-gray-500">·</span>
            <span>ALT {Math.round(altitudeM || 48)} m</span>
            <span className="text-gray-500">·</span>
            <span className="hidden sm:inline">HDG {Math.round(headingDeg || 214)}°</span>
            <span className="hidden sm:inline text-gray-500">·</span>
            <span className="flex items-center text-[#EF4444] font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444] animate-ping mr-1 inline-block shrink-0" />
              REC
            </span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/65 backdrop-blur-sm px-2 py-1 rounded border border-white/10 text-right">
            <span>{wallClock.toLocaleTimeString('en-US', { hour12: false })}</span>
            <span className="text-gray-500">·</span>
            <span>LAT {(targetLat || 17.385044).toFixed(5)}</span>
            <span className="text-gray-500">·</span>
            <span>LNG {(targetLng || 78.486671).toFixed(5)}</span>
          </div>
        </div>

        {/* ── Mode label badge (bottom-left) ──────────────────────────── */}
        <div className="absolute bottom-10 left-2 z-20">
          <span
            className="text-[8px] font-bold font-mono px-2 py-0.5 rounded"
            style={{
              color: modeAccent,
              border: `1px solid ${modeAccent}55`,
              background: `${modeAccent}18`,
            }}
          >
            {modeLabel}
          </span>
        </div>

        {/* ── Zoom badge (bottom-right) ────────────────────────────────── */}
        <div className="absolute bottom-10 right-2 z-20 flex items-center gap-1.5">
          <button
            className="text-[8px] font-mono font-bold px-2 py-0.5 rounded border border-white/10 bg-black/60 text-gray-300 hover:text-white"
            onClick={() => setZoomLevel(z => parseFloat(Math.max(1, z - 0.5).toFixed(1)))}
          >−</button>
          <span className="text-[8px] font-mono text-gray-300 bg-black/60 px-1.5 py-0.5 rounded border border-white/10">
            {zoomLevel.toFixed(1)}×
          </span>
          <button
            className="text-[8px] font-mono font-bold px-2 py-0.5 rounded border border-white/10 bg-black/60 text-gray-300 hover:text-white"
            onClick={() => setZoomLevel(z => parseFloat(Math.min(8, z + 0.5).toFixed(1)))}
          >+</button>
        </div>

        {/* ── Mode selector tabs (bottom-center, inside viewport) ───────── */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 flex gap-0.5 bg-black/70 backdrop-blur-sm p-0.5 rounded-md border border-white/10">
          {(['RGB', 'THERMAL', 'NIGHT'] as DroneCameraMode[]).map((m) => {
            const labels: Record<DroneCameraMode, string> = { RGB: 'OPTICAL', THERMAL: 'THERMAL', NIGHT: 'NIGHT IR' };
            const accents: Record<DroneCameraMode, string> = { RGB: '#06B6D4', THERMAL: '#F59E0B', NIGHT: '#10B981' };
            const isActive = mode === m;
            return (
              <button
                key={m}
                id={`cam-mode-${m.toLowerCase()}`}
                onClick={() => onModeChange(m)}
                className="flex items-center gap-1 px-2 py-0.5 text-[8px] font-bold rounded transition-all"
                style={isActive ? {
                  background: `${accents[m]}30`,
                  border:     `1px solid ${accents[m]}`,
                  color:       accents[m],
                } : {
                  color:   '#6B7280',
                  border:  '1px solid transparent',
                }}
              >
                {m === 'RGB'     && <Eye   className="w-2 h-2" />}
                {m === 'THERMAL' && <Flame className="w-2 h-2" />}
                {m === 'NIGHT'   && <Moon  className="w-2 h-2" />}
                {labels[m]}
              </button>
            );
          })}
        </div>

        {/* ── Bounding-box overlay (NOT baked into canvas) ─────────────── */}
        {overlay && (
          <div className="absolute inset-0 pointer-events-none z-30">
            {/* Box frame */}
            <div
              className="absolute"
              style={{
                left:      `${clamp01(bbox.left)}%`,
                top:       `${clamp01(bbox.top)}%`,
                width:     `${clamp01(bbox.width)}%`,
                height:    `${clamp01(bbox.height)}%`,
                border:    `2px solid ${boxColor}`,
                boxShadow: boxGlow,
              }}
            >
              {/* Corner ticks */}
              {([
                'top-0 left-0 border-t-2 border-l-2',
                'top-0 right-0 border-t-2 border-r-2',
                'bottom-0 left-0 border-b-2 border-l-2',
                'bottom-0 right-0 border-b-2 border-r-2',
              ] as const).map((cls, i) => (
                <div
                  key={i}
                  className={`absolute w-2.5 h-2.5 ${cls}`}
                  style={{ borderColor: boxColor }}
                />
              ))}
            </div>

            {/* Label banner above box */}
            <div
              className="absolute font-mono text-[8px] font-black text-white px-1.5 py-0.5 rounded-sm whitespace-nowrap leading-none"
              style={{
                left:       `${clamp01(bbox.left)}%`,
                top:        `${Math.max(0.5, clamp01(bbox.top) - 4.5)}%`,
                background: boxColor,
                boxShadow:  boxGlow,
              }}
            >
              {boxIsHuman
                ? `[TARGET: HUMAN] [CONF: ${overlay.event.confidence?.toFixed(1)}%] [GPS: ${overlay.event.lat?.toFixed(5)}, ${overlay.event.lng?.toFixed(5)}]`
                : `[CLASS: ${overlay.event.type}] [NON-HUMAN] [${overlay.event.label?.toUpperCase()}] [NO RESCUE]`}
            </div>

            {/* Pulsing ring for confirmed human targets */}
            {boxIsHuman && (
              <div
                className="absolute rounded-full animate-ping"
                style={{
                  left:    `${clamp01(bbox.left + bbox.width / 2 - 4)}%`,
                  top:     `${clamp01(bbox.top  + bbox.height / 2 - 5)}%`,
                  width:   '8%',
                  height:  '10%',
                  border:  `1px solid ${boxColor}`,
                  opacity: 0.5,
                }}
              />
            )}
          </div>
        )}

        {/* ── Default scanning box (before any events fire) ─────────────── */}
        {!overlay && (
          <div className="absolute inset-0 pointer-events-none z-20">
            {/* Crosshair reticle */}
            <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 w-6 h-6 opacity-40">
              <div className="absolute inset-0 rounded-full border border-[#06B6D4]" />
              <div className="absolute top-1/2 left-0 w-full h-px bg-[#06B6D4]" />
              <div className="absolute left-1/2 top-0 h-full w-px bg-[#06B6D4]" />
            </div>
            <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 bg-black/70 border border-[#06B6D4]/40 text-[#06B6D4] text-[9px] font-mono font-bold rounded">
              SCANNING — AWAITING TARGET
            </div>
          </div>
        )}
      </div>

      {/* ── No video controls shown — feed appears live ─────────────────────── */}

      {/* ── AI Vision Analysis — DRI Pipeline ───────────────────────────── */}
      <div className="p-3 border-t border-[#1F293D] bg-[#090F1B] shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-[9px] font-mono font-bold text-gray-500 uppercase tracking-widest">
            AI VISION ANALYSIS — DRI PIPELINE
          </h4>
          <div className="flex gap-1">
            {(['DETECTION', 'RECOGNITION', 'IDENTIFICATION'] as const).map((stage, idx) => {
              const active = (idx === 0 && driDetect) || (idx === 1 && driRecog) || (idx === 2 && driIdent);
              const colors = ['#06B6D4', '#F59E0B', hasHumanConfirmed ? '#10B981' : '#EF4444'];
              return (
                <span
                  key={stage}
                  className="text-[8px] font-bold font-mono px-1.5 py-0.5 rounded border transition-all"
                  style={active ? {
                    background: `${colors[idx]}20`,
                    border:     `1px solid ${colors[idx]}`,
                    color:       colors[idx],
                  } : {
                    background: 'transparent',
                    border:     '1px solid #1F293D',
                    color:      '#374151',
                  }}
                >
                  {stage.slice(0, 6)}
                </span>
              );
            })}
          </div>
        </div>

        {/* 3-column DRI cards */}
        <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
          <div className="bg-[#0C1422] p-2 rounded border border-[#1F293D]">
            <div className="text-[8px] text-[#06B6D4] font-bold uppercase mb-0.5">DETECT</div>
            <div className="text-white font-bold text-[10px] truncate">
              {driDetect ? (overlay?.event.label ?? 'Object detected') : 'Scanning…'}
            </div>
            <div className="text-[9px] text-[#06B6D4]">{driDetect ? `${Math.min(detectionConfidence + 5, 99)}%` : '—'}</div>
          </div>
          <div className="bg-[#0C1422] p-2 rounded border border-[#1F293D]">
            <div className="text-[8px] text-[#F59E0B] font-bold uppercase mb-0.5">RECOGNISE</div>
            <div className="text-white font-bold text-[10px] truncate">
              {driRecog ? (boxIsHuman ? 'Human / Person' : 'Non-human debris') : '—'}
            </div>
            <div className="text-[9px] text-[#F59E0B]">{driRecog ? `${detectionConfidence}%` : '—'}</div>
          </div>
          <div className="bg-[#0C1422] p-2 rounded border border-[#1F293D]">
            <div
              className="text-[8px] font-bold uppercase mb-0.5"
              style={{ color: hasHumanConfirmed ? '#10B981' : '#EF4444' }}
            >
              IDENTIFY
            </div>
            <div className="text-white font-bold text-[10px] truncate">
              {hasHumanConfirmed ? 'Person in Distress' : driIdent ? 'Non-target' : '—'}
            </div>
            <div
              className="text-[9px] font-bold"
              style={{ color: hasHumanConfirmed ? '#10B981' : '#EF4444' }}
            >
              {driIdent ? `${Math.max(detectionConfidence - 2, 80)}%` : '—'}
            </div>
          </div>
        </div>

        {/* Live detection status banner */}
        {overlay && (
          <div
            className="mt-2 px-2.5 py-1.5 rounded border font-mono text-[9px] font-bold flex items-center gap-2"
            style={{
              background: `${boxColor}12`,
              border:     `1px solid ${boxColor}44`,
              color:       boxColor,
            }}
          >
            {boxIsHuman
              ? <UserRound className="w-3 h-3 shrink-0" />
              : <AlertTriangle className="w-3 h-3 shrink-0" />}
            <span>
              {boxIsHuman
                ? `HUMAN TARGET CONFIRMED — ${overlay.event.label} — ${overlay.event.confidence?.toFixed(1)}% conf. — GPS ${overlay.event.lat?.toFixed(5)}, ${overlay.event.lng?.toFixed(5)}`
                : `NON-HUMAN: ${overlay.event.label} — rejecting — no rescue action`}
            </span>
          </div>
        )}
      </div>

      {/* ── Drone payload + release ──────────────────────────────────────── */}
      <div className="p-2.5 border-t border-[#1F293D] bg-[#070C16] flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded bg-[#EF4444]/15 border border-[#EF4444]/40 flex items-center justify-center text-[#EF4444] shrink-0">
            <LifeBuoy className="w-5 h-5 animate-pulse" />
          </div>
          <div className="font-mono text-xs">
            <div className="text-gray-500 text-[9px] font-bold">DRONE PAYLOAD STATUS</div>
            <div className="text-white font-bold text-[10px]">LIFE JACKET PAYLOAD</div>
            <div className="text-[#10B981] text-[9px] font-extrabold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> READY
            </div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 font-mono text-[9px] text-gray-300">
          <div>
            <div className="text-gray-500">TARGET LOCK</div>
            <div className="text-[#10B981] font-bold flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> LOCKED
            </div>
          </div>
          <div>
            <div className="text-gray-500">DISTANCE</div>
            <div className="text-white font-bold">{Math.round(distanceToTarget || 42)} m</div>
          </div>
          <div>
            <div className="text-gray-500">SIGNAL</div>
            <div className="text-[#06B6D4] font-bold">{signalDbm || -42} dBm</div>
          </div>
        </div>

        <button
          onClick={onManualPayloadDrop}
          className="px-3 py-2 rounded-lg bg-[#EF4444] hover:bg-[#DC2626] text-white font-mono font-black text-[10px] tracking-wider uppercase shadow-[0_0_14px_rgba(239,68,68,0.4)] transition flex flex-col items-center shrink-0"
        >
          <span>RELEASE PAYLOAD</span>
          <span className="text-[8px] font-normal text-red-200 mt-0.5">SIMULATED COMMAND</span>
        </button>
      </div>
    </section>
  );
};

export default DroneCameraFeed;
