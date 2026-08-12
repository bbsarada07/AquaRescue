'use client';

import React from 'react';
import { Terminal, ShieldAlert, CheckCircle, Info, Cpu } from 'lucide-react';
import { LogEntry } from '@/lib/socket';

export interface AlertDrawerProps {
  logs: LogEntry[];
}

export const AlertDrawer: React.FC<AlertDrawerProps> = ({ logs }) => {
  return (
    <div className="bg-[#090D16] rounded-lg border border-[#1F293D] p-3 font-mono space-y-2 select-none shadow-xl flex-1 flex flex-col min-h-[140px] max-h-[220px]">
      <div className="flex items-center justify-between border-b border-[#1F293D] pb-1.5 shrink-0">
        <div className="flex items-center space-x-1.5 text-xs font-bold text-gray-300">
          <Terminal className="w-4 h-4 text-[#06B6D4]" />
          <span>LIVE COMMAND EVENT TELEMETRY STREAM</span>
        </div>
        <span className="text-[10px] text-gray-500">{logs.length} EVENTS</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin scrollbar-thumb-gray-800">
        {logs.length === 0 ? (
          <div className="text-[11px] text-gray-500 py-4 text-center">
            Awaiting WebSocket mesh events...
          </div>
        ) : (
          logs.map((log) => (
            <div
              key={log.id}
              className="text-[11px] bg-[#111827]/80 p-2 rounded border border-[#1F293D] flex items-start space-x-2 transition-all hover:border-gray-700"
            >
              {log.type === 'ALERT' && <ShieldAlert className="w-3.5 h-3.5 text-[#EF4444] shrink-0 mt-0.5" />}
              {log.type === 'COMMAND' && <Cpu className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />}
              {log.type === 'SYSTEM' && <Info className="w-3.5 h-3.5 text-[#06B6D4] shrink-0 mt-0.5" />}
              {log.type === 'AI' && <CheckCircle className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-bold ${
                    log.type === 'ALERT' ? 'text-[#EF4444]' :
                    log.type === 'COMMAND' ? 'text-[#F59E0B]' :
                    log.type === 'AI' ? 'text-[#10B981]' : 'text-[#06B6D4]'
                  }`}>
                    [{log.type}] {log.message}
                  </span>
                  <span className="text-[9px] text-gray-500 shrink-0 ml-2">{log.time}</span>
                </div>
                {log.details && (
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">{log.details}</div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AlertDrawer;
