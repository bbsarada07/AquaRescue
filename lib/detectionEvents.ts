/**
 * detectionEvents.ts — v2
 *
 * Canonical type definitions and VIDEO SCENARIO TIMELINE for the
 * multi-sensor UAV camera monitor.
 *
 * ─── HOW TO CALIBRATE TIMESTAMPS ────────────────────────────────────────────
 *
 * Open http://localhost:3000, trigger demo mode, and switch to the DRONE
 * workspace. The video panel shows a progress bar. Note the currentTime
 * (seconds) when each scene appears in your surveillance.mp4, then update
 * the `time` field of each event below accordingly.
 *
 * Alternatively: open /public/surveillance.mp4 in VLC, pause at each key
 * moment, and read the timestamp from the bottom toolbar (hh:mm:ss.mmm).
 * Convert to seconds (e.g. 0:00:17.4 → 17.4).
 *
 * ─── CURRENT DEFAULTS ───────────────────────────────────────────────────────
 * These defaults assume a ~60-second surveillance clip with the following
 * approximate scene structure:
 *
 *   00:00 – 00:07  UAV scanning water surface (no objects)
 *   00:07 – 00:14  Tree trunk / debris enters frame
 *   00:14 – 00:18  Debris confirmed non-human, UAV moves on
 *   00:18 – 00:28  UAV continues scanning
 *   00:28 – 00:38  Person in water becomes visible
 *   00:38 – 00:48  Person confirmed as rescue target
 *   00:48 – end    Location locked, rescue workflow begins
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface BoundingBox {
  /** % distance from the left edge of the video container (0–100) */
  left: number;
  /** % distance from the top edge of the video container (0–100) */
  top: number;
  /** % width of the bounding box (0–100) */
  width: number;
  /** % height of the bounding box (0–100) */
  height: number;
}

export type DetectionType = 'HUMAN' | 'DEBRIS' | 'SCAN';

/** Named scenario event types — used for DRI pipeline stage display */
export type ScenarioEventName =
  | 'UAV_SCAN_START'
  | 'OBJECT_DETECTED'
  | 'NON_HUMAN_CLASSIFIED'
  | 'HUMAN_DETECTED'
  | 'TARGET_CONFIRMED'
  | 'LOCATION_LOCKED'
  | 'RESCUE_DISPATCHED'
  | 'INCIDENT_RESOLVED';

export interface DetectionEvent {
  /** Video currentTime (seconds) at which this event triggers — EDIT THESE */
  time: number;
  /** Scenario stage name (used for DRI pipeline display) */
  scenario: ScenarioEventName;
  /** Visual classification shown in the AI panel */
  type: DetectionType;
  /** Human-readable object label */
  label: string;
  /**
   * true  → fire onHumanDetected callback + GREEN bounding box + Priority-1 alert
   * false → RED bounding box only, auto-dismiss, no rescue triggered
   */
  target: boolean;
  /** Confidence 0–100 (only meaningful when target:true) */
  confidence?: number;
  /** GPS coordinates (only when target:true) — fed into map + drift sim */
  lat?: number;
  lng?: number;
  /**
   * Bounding box as % of video container dimensions.
   * Falls back to a centred placeholder if omitted.
   */
  bbox?: BoundingBox;
  /**
   * How long (ms) to show a NON-target overlay before auto-dismiss.
   * Defaults to 3000ms. Human-target overlays persist until video ends.
   */
  dismissAfterMs?: number;
  /**
   * DRI (Detection, Recognition, Identification) stage to highlight.
   * Controls which pill lights up in the AI VISION ANALYSIS panel.
   */
  driStage?: 'DETECTION' | 'RECOGNITION' | 'IDENTIFICATION';
}

export interface HumanDetectedPayload {
  lat: number;
  lng: number;
  confidence: number;
  /** ISO-8601 wall-clock timestamp of first detection crossing */
  timestamp: string;
  label: string;
  scenario: ScenarioEventName;
}

// ── Master Video Scenario Timeline ───────────────────────────────────────────
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  IMPORTANT: Update the `time` values to match your surveillance.mp4     ║
// ║                                                                          ║
// ║  Video file: /public/surveillance.mp4  (2.57 MB)                        ║
// ║                                                                          ║
// ║  To calibrate: play the video in the dashboard, pause at each scene,    ║
// ║  and note the currentTime shown in the progress bar tooltip.             ║
// ╚══════════════════════════════════════════════════════════════════════════╝

export const DEFAULT_DETECTION_EVENTS: DetectionEvent[] = [
  // ── Scene 1: UAV begins scanning ────────────────────────────────────────
  // Adjust `time` to when the UAV first enters the monitoring zone.
  {
    time: 2,
    scenario: 'UAV_SCAN_START',
    type: 'SCAN',
    label: 'Water Surface',
    target: false,
    driStage: 'DETECTION',
    dismissAfterMs: 1500,
    // No bbox — scanning mode, no specific object
  },

  // ── Scene 2: Tree trunk / debris detected ───────────────────────────────
  // Adjust `time` to when the debris first appears clearly in the frame.
  {
    time: 7,
    scenario: 'OBJECT_DETECTED',
    type: 'DEBRIS',
    label: 'Tree Trunk',
    target: false,
    driStage: 'DETECTION',
    dismissAfterMs: 2000,
    bbox: { left: 25, top: 40, width: 22, height: 15 },
  },

  // ── Scene 3: Debris classified as non-human ──────────────────────────────
  // Adjust `time` to when the debris classification is complete.
  {
    time: 12,
    scenario: 'NON_HUMAN_CLASSIFIED',
    type: 'DEBRIS',
    label: 'Floating Debris — Non-Human',
    target: false,
    driStage: 'RECOGNITION',
    dismissAfterMs: 3000,
    bbox: { left: 25, top: 40, width: 22, height: 15 },
  },

  // ── Scene 4: Human detected in water ────────────────────────────────────
  // Adjust `time` to when the person first becomes clearly visible.
  {
    time: 20,
    scenario: 'HUMAN_DETECTED',
    type: 'HUMAN',
    label: 'Person in Water',
    target: true,
    confidence: 96.8,
    lat: 17.385044,
    lng: 78.486671,
    driStage: 'DETECTION',
    bbox: { left: 50, top: 44, width: 13, height: 24 },
  },

  // ── Scene 5: Target confirmed as rescue subject ──────────────────────────
  // Adjust `time` to when the system confirms the person needs rescue.
  {
    time: 30,
    scenario: 'TARGET_CONFIRMED',
    type: 'HUMAN',
    label: 'Stranded Person — Distress Confirmed',
    target: true,
    confidence: 98.4,
    lat: 17.385044,
    lng: 78.486671,
    driStage: 'IDENTIFICATION',
    bbox: { left: 50, top: 44, width: 13, height: 24 },
  },

  // ── Scene 6: GPS location locked ────────────────────────────────────────
  // Adjust `time` to when the UAV has georeferenced the target position.
  {
    time: 38,
    scenario: 'LOCATION_LOCKED',
    type: 'HUMAN',
    label: 'Location Locked — GPS Acquired',
    target: true,
    confidence: 98.4,
    lat: 17.385044,
    lng: 78.486671,
    driStage: 'IDENTIFICATION',
    bbox: { left: 50, top: 44, width: 13, height: 24 },
  },
];
