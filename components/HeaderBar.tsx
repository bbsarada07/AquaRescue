'use client';

import React, { useState, useEffect } from 'react';
import { 
  Radio, 
  Wifi, 
  WifiOff, 
  Clock, 
  ShieldAlert, 
  Play, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Zap, 
  Compass,
  Activity,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  Layers
} from 'lucide-react';
import { useUI } from '@/lib/uiContext';

interface HeaderBarProps {
  isConnected: boolean;
  activeDistress: boolean;
  audioVoiceEnabled: boolean;
  onToggleAudio: () => void;
  onTriggerDemo: (scenario: 'SCREECH' | 'DRIFT' | 'INTERCEPT') => void;
  onResolve: () => void;
  onShareTrack?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  isConnected,
  activeDistress,
  audioVoiceEnabled,
  onToggleAudio,
  onTriggerDemo,
  onResolve,
  onShareTrack,
}) => {
  const { mode, toggleMode, startTour } = useUI();
  const [timeUtc, setTimeUtc] = useState<string>('');
  const [timeIst, setTimeIst] = useState<string>('');

  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 25) + ' UTC');
      setTimeIst(
        now.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' IST'
      );
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="w-full bg-[#0F172A] border-b border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between shadow-2xl select-none z-30 gap-3">
      {/* Brand Title & Mode Status */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-red-500/20 to-cyan-500/20 border border-cyan-500/40 shadow-lg">
          <Radio className="w-6 h-6 text-cyan-400 animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
          </span>
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-sans text-xl font-black tracking-wider text-white uppercase flex items-center gap-2">
              AQUARESCUE <span className="text-cyan-400 text-xs font-mono font-bold px-2 py-0.5 bg-cyan-950/60 border border-cyan-500/30 rounded-lg">OS v2.0</span>
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-medium tracking-tight">
            FIRST-RESPONDER EMERGENCY COMMAND CENTER
          </p>
        </div>
      </div>

      {/* ── TOP-LEVEL UI MODE TOGGLE SWITCH (OPERATOR vs TACTICAL) ────────────── */}
      <div className="flex items-center bg-slate-900/90 p-1.5 rounded-xl border border-slate-700/80 shadow-inner">
        <button
          onClick={toggleMode}
          id="tour-mode-toggle"
          title="Toggle UI Complexity Mode"
          className="min-h-[44px] px-4 py-2 rounded-lg flex items-center gap-2.5 font-black text-xs transition-all active:scale-95"
        >
          {mode === 'OPERATOR' ? (
            <>
              <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="text-emerald-300 tracking-wider">OPERATOR MODE (Simple)</span>
              <ToggleLeft className="w-6 h-6 text-emerald-400 ml-1" />
            </>
          ) : (
            <>
              <div className="w-3 h-3 rounded-full bg-cyan-400 animate-pulse"></div>
              <span className="text-cyan-300 tracking-wider">TACTICAL MODE (Advanced)</span>
              <ToggleRight className="w-6 h-6 text-cyan-400 ml-1" />
            </>
          )}
        </button>

        {/* Quick Tour Button */}
        <button
          onClick={startTour}
          className="min-h-[44px] px-3 py-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-all flex items-center gap-1.5 ml-2"
        >
          <HelpCircle className="w-4 h-4 text-cyan-400" />
          <span>QUICK TOUR</span>
        </button>
      </div>

      {/* Center Digital Telemetry Indicators */}
      <div className="hidden xl:flex items-center space-x-5 bg-slate-950/80 px-4 py-1.5 rounded-xl border border-slate-800">
        {/* Dual Clocks */}
        <div className="flex items-center space-x-2 border-r border-slate-800 pr-4">
          <Clock className="w-4 h-4 text-amber-400" />
          <div className="font-mono text-xs text-slate-300 flex flex-col">
            <span className="text-white font-bold">{timeIst || '00:00:00 IST'}</span>
            <span className="text-[10px] text-slate-400">{timeUtc || '00:00:00 UTC'}</span>
          </div>
        </div>

        {/* Mesh RSSI Indicator */}
        <div className="flex items-center space-x-2 border-r border-slate-800 pr-4">
          <Activity className="w-4 h-4 text-emerald-400" />
          <div className="font-mono text-xs flex flex-col">
            <span className="text-slate-400 text-[10px]">MESH SIGNAL</span>
            <span className="text-emerald-400 font-bold tracking-wider">-42 dBm (STRONG)</span>
          </div>
        </div>

        {/* WebSocket Connection Badge */}
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
              <div className="font-mono text-xs">
                <span className="text-emerald-400 font-bold tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-ping"></span>
                  CONNECTED
                </span>
                <span className="text-[9px] text-slate-400 block">SOCKET PORT 5000</span>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <div className="font-mono text-xs">
                <span className="text-red-500 font-bold tracking-wider">OFFLINE MODE</span>
                <span className="text-[9px] text-slate-400 block">RECONNECTING...</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Control Trigger Matrix */}
      <div className="flex items-center space-x-2">
        {/* Share Live Track Dispatch Button */}
        {onShareTrack && (
          <button
            onClick={onShareTrack}
            title="Open Responder Live GPS QR Dispatch"
            className="min-h-[44px] flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-cyan-950/60 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/60 text-xs font-mono font-bold transition-all shadow-lg active:scale-95"
          >
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>SHARE TRACK</span>
          </button>
        )}

        {/* Audio Voice Dispatch Toggle */}
        <button
          onClick={onToggleAudio}
          title="Toggle Tactical AI Voice Assistant"
          className={`min-h-[44px] flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-bold transition-all border active:scale-95 ${
            audioVoiceEnabled
              ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-300 hover:bg-cyan-900/60'
              : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
          }`}
        >
          {audioVoiceEnabled ? <Volume2 className="w-4 h-4 text-cyan-400 animate-pulse" /> : <VolumeX className="w-4 h-4" />}
          <span className="hidden sm:inline">{audioVoiceEnabled ? 'VOICE ON' : 'MUTED'}</span>
        </button>

        {/* Demo Trigger Dropdown / Buttons */}
        <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => onTriggerDemo('SCREECH')}
            className="min-h-[44px] px-3 py-2 text-xs font-bold rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all flex items-center gap-1 active:scale-95"
          >
            <Zap className="w-3.5 h-3.5" />
            DEMO ALERT
          </button>
        </div>

        {/* Reset / Clear Button */}
        {activeDistress && (
          <button
            onClick={onResolve}
            className="min-h-[44px] flex items-center space-x-1 px-3.5 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 text-xs font-mono font-bold transition-all shadow-lg active:scale-95"
          >
            <RefreshCw className="w-4 h-4 text-emerald-400" />
            <span>RESET</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default HeaderBar;
