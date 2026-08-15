'use client';

import React, { useEffect, useRef } from 'react';
import { AlertCircle, Activity } from 'lucide-react';

interface AudioWaveformProps {
  screechConfidence: number; // 0 to 1
  activeDistress: boolean;
  frequencyHz?: number;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  screechConfidence,
  activeDistress,
  frequencyHz = 2400,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isHighConfidence = screechConfidence > 0.70 || activeDistress;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const numBars = 32;
      const barWidth = (width - (numBars - 1) * 2) / numBars;

      for (let i = 0; i < numBars; i++) {
        let amplitude: number;

        if (isHighConfidence) {
          // High-frequency pulsing red spikes
          const freqMultiplier = 3.5;
          const noise = Math.sin(i * 0.8 + phase * freqMultiplier) * 0.4 + Math.cos(i * 1.5 - phase * 2) * 0.3;
          amplitude = Math.min(1, Math.max(0.2, Math.abs(noise) * screechConfidence + Math.random() * 0.25));
        } else {
          // Ambient dynamic blue frequency bars
          const ambientWave = Math.sin(i * 0.3 + phase) * 0.3 + Math.cos(i * 0.5 - phase * 0.7) * 0.2 + 0.3;
          amplitude = Math.min(0.6, Math.max(0.1, ambientWave));
        }

        const barHeight = amplitude * (height - 4);
        const x = i * (barWidth + 2);
        const y = (height - barHeight) / 2;

        // Gradient for bars
        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        if (isHighConfidence) {
          gradient.addColorStop(0, '#EF4444');
          gradient.addColorStop(0.5, '#F59E0B');
          gradient.addColorStop(1, '#DC2626');
        } else {
          gradient.addColorStop(0, '#06B6D4');
          gradient.addColorStop(0.5, '#3B82F6');
          gradient.addColorStop(1, '#0284C7');
        }

        ctx.fillStyle = gradient;
        ctx.shadowColor = isHighConfidence ? 'rgba(239, 68, 68, 0.6)' : 'rgba(6, 182, 212, 0.4)';
        ctx.shadowBlur = isHighConfidence ? 6 : 3;

        // Draw rounded bar rect
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      phase += isHighConfidence ? 0.15 : 0.05;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isHighConfidence, screechConfidence]);

  return (
    <div className="w-full bg-[#090D16] p-3 rounded-lg border border-[#1F293D] space-y-2 select-none">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Activity className={`w-3.5 h-3.5 ${isHighConfidence ? 'text-[#EF4444] animate-pulse' : 'text-[#06B6D4]'}`} />
          ACOUSTIC WAVEFORM ANALYZER
        </span>
        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
          isHighConfidence 
            ? 'bg-[#EF4444]/20 border-[#EF4444]/60 text-[#EF4444] animate-pulse' 
            : 'bg-[#06B6D4]/15 border-[#06B6D4]/30 text-[#06B6D4]'
        }`}>
          {isHighConfidence ? 'CRITICAL DETECT' : 'AMBIENT MONITOR'}
        </span>
      </div>

      {/* Waveform Canvas */}
      <div className="relative w-full h-12 bg-[#090D16] border border-[#1F293D] rounded overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={280}
          height={48}
          className="w-full h-full block"
        />
        {/* Background Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d15_1px,transparent_1px),linear-gradient(to_bottom,#1f293d15_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none" />
      </div>

      {/* Status Alert Banner */}
      {isHighConfidence ? (
        <div className="bg-[#EF4444]/15 border border-[#EF4444]/40 rounded p-1.5 text-[10px] font-mono text-[#EF4444] font-bold flex items-center gap-1.5 animate-pulse">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#EF4444]" />
          <span className="truncate">ACOUSTIC PATTERN DETECTED: {(frequencyHz / 1000).toFixed(1)}kHz DISTRESS SCREECH</span>
        </div>
      ) : (
        <div className="flex justify-between items-center text-[9px] font-mono text-gray-500">
          <span>Spectrum: 20Hz - 8kHz</span>
          <span>ScreechNet-v4 Model Active</span>
        </div>
      )}
    </div>
  );
};

export default AudioWaveform;
