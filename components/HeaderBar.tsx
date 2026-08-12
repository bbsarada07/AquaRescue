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
  Activity
} from 'lucide-react';

interface HeaderBarProps {
  isConnected: boolean;
  activeDistress: boolean;
  audioVoiceEnabled: boolean;
  onToggleAudio: () => void;
  onTriggerDemo: (scenario: 'SCREECH' | 'DRIFT' | 'INTERCEPT') => void;
  onResolve: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  isConnected,
  activeDistress,
  audioVoiceEnabled,
  onToggleAudio,
  onTriggerDemo,
  onResolve,
}) => {
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
    <header className="w-full bg-[#111827] border-b border-[#1F293D] px-4 py-2.5 flex flex-wrap items-center justify-between shadow-2xl select-none z-30">
      {/* Brand Title & System Status */}
      <div className="flex items-center space-x-3">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-[#EF4444]/20 to-[#06B6D4]/20 border border-[#06B6D4]/40">
          <Radio className="w-5 h-5 text-[#06B6D4] animate-pulse" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#EF4444]"></span>
          </span>
        </div>

        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-mono text-lg font-extrabold tracking-wider text-white uppercase flex items-center gap-2">
              AQUARESCUE <span className="text-[#06B6D4] text-xs font-semibold px-2 py-0.5 bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded">COMMAND OS v2.0</span>
            </h1>
          </div>
          <p className="text-[11px] text-gray-400 font-mono tracking-tight flex items-center space-x-2">
            <span>DISTRIBUTED DETECTION & AUTONOMOUS WATER RESCUE</span>
          </p>
        </div>
      </div>

      {/* Center Digital Telemetry Indicators */}
      <div className="hidden lg:flex items-center space-x-6 bg-[#090D16]/80 px-4 py-1.5 rounded-lg border border-[#1F293D]">
        {/* Dual Clocks */}
        <div className="flex items-center space-x-2 border-r border-[#1F293D] pr-4">
          <Clock className="w-4 h-4 text-[#F59E0B]" />
          <div className="font-mono text-xs text-gray-300 flex flex-col">
            <span className="text-white font-bold">{timeIst || '00:00:00 IST'}</span>
            <span className="text-[10px] text-gray-400">{timeUtc || '00:00:00 UTC'}</span>
          </div>
        </div>

        {/* Mesh RSSI Indicator */}
        <div className="flex items-center space-x-2 border-r border-[#1F293D] pr-4">
          <Activity className="w-4 h-4 text-[#10B981]" />
          <div className="font-mono text-xs flex flex-col">
            <span className="text-gray-400 text-[10px]">MESH RSSI</span>
            <span className="text-[#10B981] font-bold tracking-wider">-42 dBm (STRONG)</span>
          </div>
        </div>

        {/* WebSocket Connection Badge */}
        <div className="flex items-center space-x-2">
          {isConnected ? (
            <>
              <Wifi className="w-4 h-4 text-[#10B981] animate-pulse" />
              <div className="font-mono text-xs">
                <span className="text-[#10B981] font-bold tracking-wider flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#10B981] inline-block animate-ping"></span>
                  CONNECTED
                </span>
                <span className="text-[9px] text-gray-400 block">PORT 5000</span>
              </div>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-[#EF4444]" />
              <div className="font-mono text-xs">
                <span className="text-[#EF4444] font-bold tracking-wider">OFFLINE MODE</span>
                <span className="text-[9px] text-gray-400 block">RECONNECTING...</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Control Trigger Matrix */}
      <div className="flex items-center space-x-2">
        {/* Audio Voice Dispatch Toggle */}
        <button
          onClick={onToggleAudio}
          title="Toggle Tactical AI Voice Synthesis"
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all border ${
            audioVoiceEnabled
              ? 'bg-[#06B6D4]/15 border-[#06B6D4]/40 text-[#06B6D4] hover:bg-[#06B6D4]/25'
              : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white'
          }`}
        >
          {audioVoiceEnabled ? <Volume2 className="w-3.5 h-3.5 animate-pulse" /> : <VolumeX className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">{audioVoiceEnabled ? 'VOICE ON' : 'VOICE MUTED'}</span>
        </button>

        {/* Demo Trigger Dropdown / Buttons */}
        <div className="flex items-center space-x-1 bg-[#090D16] p-1 rounded-lg border border-[#1F293D]">
          <button
            onClick={() => onTriggerDemo('SCREECH')}
            className="px-2.5 py-1 text-[11px] font-mono rounded font-semibold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 hover:bg-[#EF4444]/30 transition-all flex items-center gap-1"
          >
            <Zap className="w-3 h-3" />
            SCREECH ALERT
          </button>
          <button
            onClick={() => onTriggerDemo('DRIFT')}
            className="px-2.5 py-1 text-[11px] font-mono rounded font-semibold bg-[#F59E0B]/15 text-[#F59E0B] border border-[#F59E0B]/30 hover:bg-[#F59E0B]/30 transition-all flex items-center gap-1"
          >
            <Compass className="w-3 h-3" />
            DRIFT SIM
          </button>
        </div>

        {/* Reset / Clear Button */}
        {activeDistress && (
          <button
            onClick={onResolve}
            className="flex items-center space-x-1 px-3 py-1.5 rounded bg-[#10B981]/20 border border-[#10B981]/50 text-[#10B981] hover:bg-[#10B981]/30 text-xs font-mono font-bold transition-all shadow-lg"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>RESET</span>
          </button>
        )}
      </div>
    </header>
  );
};

export default HeaderBar;
