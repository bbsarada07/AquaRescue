'use client';

import React from 'react';
import { Clock3, CheckCircle2, AlertCircle } from 'lucide-react';
import { LogEntry } from '@/lib/socket';

export interface IncidentTimelineProps {
  logs?: LogEntry[];
  activeDistress: boolean;
  droneStatus: string;
  buoyStatus: string;
  responderStatus: string;
}

interface TimelineStep {
  id: string;
  time: string;
  label: string;
  sublabel: string;
  color: string;
  active: boolean;
  completed: boolean;
}

export const IncidentTimeline: React.FC<IncidentTimelineProps> = ({
  logs = [],
  activeDistress,
  droneStatus,
  buoyStatus,
  responderStatus,
}) => {
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const t = (offsetSec: number) => fmt(new Date(now.getTime() - offsetSec * 1000));

  const steps: TimelineStep[] = [
    {
      id: 'distress',
      time: activeDistress ? t(60) : '--:--:--',
      label: 'DISTRESS DETECTED',
      sublabel: 'TinyML SCREECH 96%',
      color: '#EF4444',
      active: activeDistress,
      completed: activeDistress,
    },
    {
      id: 'kalman',
      time: activeDistress ? t(58) : '--:--:--',
      label: 'LOCATION FILTERED',
      sublabel: 'Kalman 2D smoothed',
      color: '#10B981',
      active: activeDistress,
      completed: activeDistress,
    },
    {
      id: 'drone',
      time: droneStatus !== 'STANDBY' ? t(50) : '--:--:--',
      label: 'DRONE DISPATCHED',
      sublabel: 'UAV-RESCUE-01 en route',
      color: '#06B6D4',
      active: droneStatus !== 'STANDBY',
      completed: droneStatus === 'EN_ROUTE' || droneStatus === 'TARGET_REACHED',
    },
    {
      id: 'buoy',
      time: buoyStatus !== 'STANDBY' ? t(48) : '--:--:--',
      label: 'BUOY DISPATCHED',
      sublabel: 'Buoy-Hydro-02 active',
      color: '#F59E0B',
      active: buoyStatus !== 'STANDBY',
      completed: buoyStatus === 'EN_ROUTE' || buoyStatus === 'TARGET_REACHED',
    },
    {
      id: 'lifejacket',
      time: droneStatus === 'TARGET_REACHED' ? t(30) : '--:--:--',
      label: 'PAYLOAD READY',
      sublabel: 'Life jacket armed',
      color: '#F97316',
      active: droneStatus === 'TARGET_REACHED',
      completed: droneStatus === 'TARGET_REACHED',
    },
    {
      id: 'rescue',
      time: responderStatus !== 'STANDBY' ? t(45) : '--:--:--',
      label: 'RESCUE TEAM ALERTED',
      sublabel: 'Team-01 dispatched',
      color: '#A78BFA',
      active: responderStatus !== 'STANDBY',
      completed: responderStatus === 'EN_ROUTE' || responderStatus === 'TARGET_REACHED',
    },
    {
      id: 'victim',
      time: '--:--:--',
      label: 'VICTIM REACHED',
      sublabel: 'Awaiting confirmation',
      color: '#6B7280',
      active: false,
      completed: false,
    },
    {
      id: 'destination',
      time: '--:--:--',
      label: 'SAFE DESTINATION',
      sublabel: 'Mission complete',
      color: '#6B7280',
      active: false,
      completed: false,
    },
  ];

  return (
    <div
      style={{
        width: '100%',
        background: 'rgba(7,12,22,0.95)',
        borderTop: '1px solid #1A2840',
        borderRadius: '8px',
        border: '1px solid #1F293D',
        padding: '8px 14px',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: '#4B5563',
        }}
      >
        <Clock3 style={{ width: '11px', height: '11px', color: '#06B6D4' }} />
        <span>INCIDENT TIMELINE</span>
        {activeDistress && (
          <span
            style={{
              marginLeft: 'auto',
              color: '#EF4444',
              fontSize: '8px',
              fontWeight: 700,
              letterSpacing: '0.1em',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          >
            ● LIVE
          </span>
        )}
      </div>

      {/* Steps */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '0 6px' }}>
        {/* Connector line */}
        <div
          style={{
            position: 'absolute',
            top: '18px',
            left: '20px',
            right: '20px',
            height: '2px',
            background: 'linear-gradient(90deg, #1F293D 0%, #2A3A52 50%, #1F293D 100%)',
            zIndex: 0,
          }}
        >
          {/* Active progress fill */}
          {activeDistress && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: '100%',
                width: `${(steps.filter(s => s.completed).length / steps.length) * 100}%`,
                background: 'linear-gradient(90deg, #10B981, #06B6D4)',
                transition: 'width 0.8s ease',
                borderRadius: '2px',
              }}
            />
          )}
        </div>

        {steps.map((step) => {
          const isCompleted = step.completed;
          const isActive = step.active && !step.completed;
          const nodeColor = isCompleted || isActive ? step.color : '#1F293D';

          return (
            <div
              key={step.id}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: '60px',
                maxWidth: '80px',
              }}
            >
              {/* Timestamp */}
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '8px',
                  fontWeight: isCompleted ? 700 : 500,
                  color: isCompleted ? '#9CA3AF' : '#374151',
                  marginBottom: '4px',
                  letterSpacing: '0.04em',
                  lineHeight: 1,
                }}
              >
                {step.time}
              </span>

              {/* Node */}
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: isCompleted
                    ? `radial-gradient(circle, ${step.color}22, #070C16 70%)`
                    : '#070C16',
                  border: `2px solid ${nodeColor}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isCompleted
                    ? `0 0 10px ${step.color}55`
                    : isActive
                    ? `0 0 14px ${step.color}66`
                    : 'none',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      border: `2px solid ${step.color}`,
                      animation: 'ping 1.5s ease-out infinite',
                      opacity: 0.5,
                    }}
                  />
                )}
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: isCompleted || isActive ? step.color : '#2A3A52',
                    transition: 'background 0.3s ease',
                  }}
                />
              </div>

              {/* Label */}
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '8px',
                  fontWeight: 700,
                  color: isCompleted || isActive ? step.color : '#374151',
                  marginTop: '4px',
                  textAlign: 'center',
                  letterSpacing: '0.03em',
                  lineHeight: 1.2,
                  textTransform: 'uppercase',
                }}
              >
                {step.label}
              </span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '7px',
                  color: isCompleted ? '#4B5563' : '#2A3A52',
                  textAlign: 'center',
                  lineHeight: 1.2,
                  marginTop: '1px',
                }}
              >
                {step.sublabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default IncidentTimeline;
