export type WorkspacePreset = 'COMMAND' | 'RESCUE' | 'DRONE' | 'FULL_TACTICAL';

export type PanelId =
  | 'active-target'
  | 'kalman-gps'
  | 'raw-gps'
  | 'drone-camera'
  | 'drone-sensors'
  | 'rescue-team'
  | 'audio-analysis'
  | 'hydrodynamics'
  | 'ai-briefing'
  | 'incident-timeline'
  | 'mission-controls';

export type DockTarget = 'left' | 'right' | 'top' | 'bottom';

export interface PanelLayout {
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed: boolean;
  visible: boolean;
  z: number;
}

export type PanelLayoutMap = Record<PanelId, PanelLayout>;

export const PANEL_ORDER: PanelId[] = [
  'active-target',
  'kalman-gps',
  'raw-gps',
  'drone-camera',
  'drone-sensors',
  'rescue-team',
  'audio-analysis',
  'hydrodynamics',
  'ai-briefing',
  'incident-timeline',
  'mission-controls',
];

const basePanel = (x: number, y: number, w: number, h: number, z: number): PanelLayout => ({
  x,
  y,
  w,
  h,
  collapsed: false,
  visible: true,
  z,
});

export const DEFAULT_PANEL_LAYOUTS: PanelLayoutMap = {
  'active-target': basePanel(0.02, 0.02, 0.24, 0.22, 20),
  'kalman-gps': basePanel(0.02, 0.26, 0.24, 0.18, 21),
  'raw-gps': basePanel(0.02, 0.46, 0.24, 0.16, 22),
  'drone-camera': basePanel(0.28, 0.02, 0.46, 0.45, 30),
  'drone-sensors': basePanel(0.28, 0.49, 0.23, 0.24, 31),
  'rescue-team': basePanel(0.53, 0.49, 0.21, 0.24, 32),
  'audio-analysis': basePanel(0.76, 0.02, 0.22, 0.19, 40),
  'hydrodynamics': basePanel(0.76, 0.23, 0.22, 0.22, 41),
  'ai-briefing': basePanel(0.76, 0.47, 0.22, 0.26, 42),
  'incident-timeline': basePanel(0.28, 0.75, 0.5, 0.21, 33),
  'mission-controls': basePanel(0.8, 0.75, 0.18, 0.21, 43),
};

const withVisibility = (
  base: PanelLayoutMap,
  visibleIds: PanelId[],
  collapsedIds: PanelId[] = []
): PanelLayoutMap => {
  const visibleSet = new Set<PanelId>(visibleIds);
  const collapsedSet = new Set<PanelId>(collapsedIds);
  const next = { ...base } as PanelLayoutMap;
  for (const id of PANEL_ORDER) {
    next[id] = {
      ...next[id],
      visible: visibleSet.has(id),
      collapsed: collapsedSet.has(id),
    };
  }
  return next;
};

export const CRITICAL_PANEL_IDS: PanelId[] = [
  'active-target',
  'drone-camera',
  'rescue-team',
  'mission-controls',
  'incident-timeline',
  'kalman-gps',
];

export const PRESET_LAYOUTS: Record<WorkspacePreset, PanelLayoutMap> = {
  COMMAND: withVisibility(DEFAULT_PANEL_LAYOUTS, [
    'active-target',
    'kalman-gps',
    'rescue-team',
    'mission-controls',
    'incident-timeline',
    'drone-camera',
    'ai-briefing',
  ], ['ai-briefing']),
  RESCUE: withVisibility(DEFAULT_PANEL_LAYOUTS, [
    'active-target',
    'kalman-gps',
    'rescue-team',
    'hydrodynamics',
    'incident-timeline',
    'mission-controls',
  ]),
  DRONE: withVisibility(DEFAULT_PANEL_LAYOUTS, [
    'drone-camera',
    'drone-sensors',
    'active-target',
    'rescue-team',
    'mission-controls',
    'ai-briefing',
    'audio-analysis',
  ]),
  FULL_TACTICAL: withVisibility(DEFAULT_PANEL_LAYOUTS, PANEL_ORDER),
};

export const getDockLayout = (target: DockTarget): Pick<PanelLayout, 'x' | 'y' | 'w' | 'h'> => {
  if (target === 'left') return { x: 0.01, y: 0.06, w: 0.36, h: 0.88 };
  if (target === 'right') return { x: 0.63, y: 0.06, w: 0.36, h: 0.88 };
  if (target === 'top') return { x: 0.01, y: 0.06, w: 0.98, h: 0.44 };
  return { x: 0.01, y: 0.5, w: 0.98, h: 0.44 };
};

export const cloneLayoutMap = (map: PanelLayoutMap): PanelLayoutMap => {
  const next = {} as PanelLayoutMap;
  for (const id of PANEL_ORDER) {
    next[id] = { ...map[id] };
  }
  return next;
};
