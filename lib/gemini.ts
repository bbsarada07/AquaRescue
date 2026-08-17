/**
 * AquaRescue Gemini Tactical AI Agent
 * 
 * Integrates @google/genai for real-time tactical incident briefings
 * and browser Speech Synthesis API for audio voice dispatch warnings.
 */

import { GoogleGenAI } from '@google/genai';

export interface TelemetryPayload {
  puck_id: string;
  location: { lat: number; lng: number };
  sensor_data: {
    audio_screech_confidence: number;
    thermal_delta_c: number;
    water_velocity_ms: number;
    drift_heading_deg: number;
  };
  timestamp?: number;
}

export interface BriefingResponse {
  summary: string;
  actionItems: string[];
  threatLevel: 'CRITICAL' | 'HIGH' | 'MODERATE';
  timestamp: string;
}

/**
 * Generates a 2-sentence tactical briefing using Gemini model or intelligent fallback
 */
export async function generateTacticalBriefing(telemetry: TelemetryPayload): Promise<BriefingResponse> {
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

  const promptText = `
You are the Tactical AI Agent for AquaRescue Water Rescue Operations.
Analyze this high-frequency telemetry JSON alert from victim detection unit ${telemetry.puck_id}:
Location: Lat ${telemetry.location.lat}, Lng ${telemetry.location.lng}
Screech Audio Confidence: ${(telemetry.sensor_data.audio_screech_confidence * 100).toFixed(1)}%
Thermal Delta: ${telemetry.sensor_data.thermal_delta_c}°C above water temp
Water Velocity: ${telemetry.sensor_data.water_velocity_ms} m/s towards ${telemetry.sensor_data.drift_heading_deg}°

Provide a concise, high-priority 2-sentence tactical incident briefing for the rescue command team. 
First sentence: Direct tactical assessment of victim distress severity and location.
Second sentence: Explicit dispatch directive for UAV aerial float drop and autonomous buoy drift-compensated intercept vector.
Do NOT use markdown, lists, or extra commentary. Just the 2 tactical sentences.
`;

  if (apiKey && apiKey.length > 5) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: promptText,
      });

      const text = response.text ? response.text.trim() : '';
      if (text.length > 10) {
        return {
          summary: text,
          actionItems: [
            `Dispatch UAV Drone to lock gimbal on Lat ${telemetry.location.lat.toFixed(6)}, Lng ${telemetry.location.lng.toFixed(6)}`,
            `Engage Autonomous Buoy with drift vector ${telemetry.sensor_data.drift_heading_deg}° compensation`
          ],
          threatLevel: telemetry.sensor_data.audio_screech_confidence > 0.9 ? 'CRITICAL' : 'HIGH',
          timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, switching to local tactical synthesis engine:', err);
    }
  }

  // --- Local Fallback Synthesis Engine ---
  const confPct = Math.round(telemetry.sensor_data.audio_screech_confidence * 100);
  const tempDelta = telemetry.sensor_data.thermal_delta_c;
  const vel = telemetry.sensor_data.water_velocity_ms;
  const drift = telemetry.sensor_data.drift_heading_deg;

  const summary = `CRITICAL DISTRESS DETECTED at Lat ${telemetry.location.lat.toFixed(6)}, Lng ${telemetry.location.lng.toFixed(6)} with ${confPct}% acoustic screech confidence and +${tempDelta}°C thermal delta. Deploy UAV for immediate payload air-drop and direct Autonomous Buoy along compensated ${drift}° hydrodynamic drift vector.`;

  return {
    summary,
    actionItems: [
      `Deploy UAV Drone payload drop at coordinates (${telemetry.location.lat.toFixed(6)}, ${telemetry.location.lng.toFixed(6)})`,
      `Set Autonomous Buoy hydrodynamic drift heading to ${drift}° at ${vel} m/s current`
    ],
    threatLevel: confPct > 90 ? 'CRITICAL' : 'HIGH',
    timestamp: new Date().toLocaleTimeString('en-US', { hour12: false })
  };
}

/**
 * Triggers Browser Text-to-Speech API to read tactical brief aloud
 */
export function speakBriefing(text: string, onEnd?: () => void): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }

  window.speechSynthesis.cancel(); // Stop any active speech

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 0.95; // Slightly deeper military/tactical voice pitch
  utterance.volume = 1.0;

  // Try to select an English voice if available
  const voices = window.speechSynthesis.getVoices();
  const tacticalVoice = voices.find(
    (v) => v.lang.includes('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('David') || v.name.includes('Daniel'))
  ) || voices.find((v) => v.lang.includes('en'));

  if (tacticalVoice) {
    utterance.voice = tacticalVoice;
  }

  if (onEnd) {
    utterance.onend = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}
