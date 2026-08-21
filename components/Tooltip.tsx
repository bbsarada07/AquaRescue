'use client';

import React, { useState, ReactNode } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: ReactNode;
  term?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ content, children, term, position = 'top' }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  };

  return (
    <div
      className="relative inline-flex items-center group cursor-help"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children ? (
        children
      ) : (
        <span className="inline-flex items-center gap-1 font-semibold text-gray-200 border-b border-dotted border-cyan-400/60 hover:text-cyan-300 transition-colors">
          {term}
          <HelpCircle className="w-3.5 h-3.5 text-cyan-400 opacity-80 group-hover:opacity-100" />
        </span>
      )}

      {isVisible && (
        <div
          className={`absolute z-50 ${positionClasses[position]} w-64 p-3 bg-[#0F172A] border border-cyan-500/40 rounded-xl shadow-2xl backdrop-blur-md text-xs text-gray-200 pointer-events-none transition-all duration-200 animate-in fade-in zoom-in-95`}
        >
          {term && (
            <div className="font-bold text-cyan-400 mb-1 border-b border-slate-700/60 pb-1 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{term}</span>
            </div>
          )}
          <p className="leading-relaxed text-slate-300 font-normal">{content}</p>
        </div>
      )}
    </div>
  );
}
