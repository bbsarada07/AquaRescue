'use client';

import React from 'react';
import {
  LayoutGrid,
  Map,
  Video,
  Grid,
  CheckSquare,
  Square,
  Flame,
  AlertCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  LocateFixed,
  UserRound,
  Mic,
  Waves,
  Bot,
  Clock3,
} from 'lucide-react';
import { WorkspacePreset, PanelId } from '@/lib/panelWorkspace';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeWorkspace: WorkspacePreset;
  onSelectWorkspace: (workspace: WorkspacePreset) => void;
  visiblePanels: Record<PanelId, boolean>;
  onTogglePanelVisibility: (panelId: PanelId) => void;
  emergencyFocus: boolean;
  onToggleEmergencyFocus: () => void;
  onClearAlerts: () => void;
  onResetWorkspace: () => void;
}

const WORKSPACE_OPTIONS: Array<{
  id: WorkspacePreset;
  title: string;
  subtitle: string;
  Icon: React.ComponentType<{ style?: React.CSSProperties }>;
}> = [
  { id: 'COMMAND',      title: 'Command View',     subtitle: 'Overview & All Systems',   Icon: LayoutGrid },
  { id: 'RESCUE',       title: 'Rescue View',      subtitle: 'Map + Teams + Logistics',  Icon: Map },
  { id: 'DRONE',        title: 'Drone View',       subtitle: 'UAV Ops & AI Vision',      Icon: Video },
  { id: 'FULL_TACTICAL',title: 'Full Tactical',    subtitle: 'All Panels Expanded',      Icon: Grid },
];

const PANEL_TOGGLES: Array<{
  id: PanelId;
  label: string;
  Icon: React.ComponentType<{ style?: React.CSSProperties }>;
}> = [
  { id: 'drone-camera',     label: 'Drone Camera',     Icon: Video },
  { id: 'active-target',    label: 'Target Telemetry', Icon: LocateFixed },
  { id: 'ai-briefing',      label: 'AI Briefing',      Icon: Bot },
  { id: 'rescue-team',      label: 'Rescue Team',      Icon: UserRound },
  { id: 'audio-analysis',   label: 'Audio Analysis',   Icon: Mic },
  { id: 'hydrodynamics',    label: 'Hydrodynamics',    Icon: Waves },
  { id: 'incident-timeline',label: 'Incident Timeline',Icon: Clock3 },
];

const sectionLabel: React.CSSProperties = {
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '9px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#4B5563',
  marginBottom: '6px',
  paddingLeft: '2px',
};

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  activeWorkspace,
  onSelectWorkspace,
  visiblePanels,
  onTogglePanelVisibility,
  emergencyFocus,
  onToggleEmergencyFocus,
  onClearAlerts,
  onResetWorkspace,
}) => {
  const W = collapsed ? 52 : 224;

  return (
    <aside
      style={{
        width: `${W}px`,
        minWidth: `${W}px`,
        maxWidth: `${W}px`,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #070C16 0%, #050912 100%)',
        borderRight: '1px solid #1F293D',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1), min-width 0.25s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 20,
        flexShrink: 0,
        userSelect: 'none',
        overflowX: 'hidden',
      }}
    >
      {/* Scrollable Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: collapsed ? '10px 6px' : '10px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* ── WORKSPACE VIEWS ───────────────────────────────────────── */}
        <div>
          {!collapsed && <div style={sectionLabel}>Workspace Views</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {WORKSPACE_OPTIONS.map((item) => {
              const isActive = activeWorkspace === item.id;
              const Icon = item.Icon;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectWorkspace(item.id)}
                  title={`${item.title} — ${item.subtitle}`}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: collapsed ? 0 : '10px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    padding: collapsed ? '10px 0' : '8px 10px',
                    borderRadius: '8px',
                    border: isActive ? '1px solid rgba(6,182,212,0.5)' : '1px solid #1F293D',
                    background: isActive
                      ? 'rgba(6,182,212,0.1)'
                      : 'rgba(12,20,34,0.6)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isActive ? '0 0 12px rgba(6,182,212,0.15)' : 'none',
                  }}
                >
                  <Icon
                    style={{
                      width: '15px',
                      height: '15px',
                      color: isActive ? '#06B6D4' : '#6B7280',
                      flexShrink: 0,
                    }}
                  />
                  {!collapsed && (
                    <div style={{ overflow: 'hidden' }}>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '10px',
                          fontWeight: 700,
                          color: isActive ? '#06B6D4' : '#E5E7EB',
                          letterSpacing: '0.04em',
                          lineHeight: 1.2,
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: '9px',
                          color: '#4B5563',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.subtitle}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── PANEL CONTROL ─────────────────────────────────────────── */}
        {!collapsed && (
          <div style={{ borderTop: '1px solid #1F293D', paddingTop: '12px' }}>
            <div style={sectionLabel}>Panel Control</div>
            <div
              style={{
                background: 'rgba(9,15,27,0.8)',
                borderRadius: '8px',
                border: '1px solid #1F293D',
                overflow: 'hidden',
              }}
            >
              {PANEL_TOGGLES.map((panel, i) => {
                const isChecked = visiblePanels[panel.id] !== false;
                const Icon = panel.Icon;
                return (
                  <button
                    key={panel.id}
                    onClick={() => onTogglePanelVisibility(panel.id)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderBottom: i < PANEL_TOGGLES.length - 1 ? '1px solid rgba(31,41,61,0.5)' : 'none',
                      cursor: 'pointer',
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: '10px',
                      color: isChecked ? '#D1D5DB' : '#4B5563',
                      transition: 'all 0.12s ease',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(17,27,44,0.8)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Icon style={{ width: '12px', height: '12px', color: isChecked ? '#06B6D4' : '#374151' }} />
                      <span>{panel.label}</span>
                    </div>
                    {isChecked
                      ? <CheckSquare style={{ width: '12px', height: '12px', color: '#06B6D4' }} />
                      : <Square style={{ width: '12px', height: '12px', color: '#374151' }} />
                    }
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── QUICK TOGGLES ─────────────────────────────────────────── */}
        {!collapsed && (
          <div style={{ borderTop: '1px solid #1F293D', paddingTop: '12px' }}>
            <div style={sectionLabel}>Quick Toggle</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={onToggleEmergencyFocus}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: emergencyFocus ? '1px solid rgba(239,68,68,0.6)' : '1px solid #1F293D',
                  background: emergencyFocus ? 'rgba(239,68,68,0.12)' : 'rgba(12,20,34,0.6)',
                  color: emergencyFocus ? '#EF4444' : '#9CA3AF',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 700,
                  transition: 'all 0.15s ease',
                  boxShadow: emergencyFocus ? '0 0 10px rgba(239,68,68,0.2)' : 'none',
                }}
              >
                <Flame style={{ width: '13px', height: '13px', color: '#EF4444' }} />
                Emergency Focus
              </button>

              <button
                onClick={onClearAlerts}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: '1px solid #1F293D',
                  background: 'rgba(12,20,34,0.6)',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(245,158,11,0.5)';
                  (e.currentTarget as HTMLElement).style.color = '#F59E0B';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1F293D';
                  (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
                }}
              >
                <AlertCircle style={{ width: '13px', height: '13px', color: '#F59E0B' }} />
                Clear All Alerts
              </button>

              <button
                onClick={onResetWorkspace}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 10px',
                  borderRadius: '7px',
                  border: '1px solid #1F293D',
                  background: 'rgba(12,20,34,0.6)',
                  color: '#9CA3AF',
                  cursor: 'pointer',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '10px',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(6,182,212,0.4)';
                  (e.currentTarget as HTMLElement).style.color = '#06B6D4';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#1F293D';
                  (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
                }}
              >
                <RotateCcw style={{ width: '13px', height: '13px', color: '#06B6D4' }} />
                Reset Workspace
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── COLLAPSE BUTTON ───────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          padding: '8px',
          borderTop: '1px solid #1F293D',
          background: 'rgba(5,9,18,0.9)',
        }}
      >
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '7px',
            borderRadius: '7px',
            border: '1px solid #1F293D',
            background: 'rgba(12,20,34,0.6)',
            color: '#4B5563',
            cursor: 'pointer',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            transition: 'all 0.15s ease',
            textTransform: 'uppercase',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(6,182,212,0.4)';
            (e.currentTarget as HTMLElement).style.color = '#06B6D4';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.borderColor = '#1F293D';
            (e.currentTarget as HTMLElement).style.color = '#4B5563';
          }}
        >
          {collapsed
            ? <ChevronRight style={{ width: '15px', height: '15px', color: '#06B6D4' }} />
            : (
              <>
                <ChevronLeft style={{ width: '15px', height: '15px', color: '#06B6D4' }} />
                <span>Collapse</span>
              </>
            )
          }
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
