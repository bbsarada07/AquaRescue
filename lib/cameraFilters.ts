/**
 * cameraFilters.ts — v2
 *
 * Isolated pixel-filter utilities for the multi-sensor UAV camera monitor.
 *
 * Modules:
 *   buildIronbowLUT()   — precompute 256-entry Ironbow thermal LUT (once at module load)
 *   applyThermalFilter  — per-frame Ironbow remap (FLIR-style heat visualization)
 *   applyNightFilter    — per-frame green-phosphor IR simulation with grain/vignette
 *
 * Performance contract:
 *   - LUT is built ONCE at module level, never inside the rAF loop.
 *   - No Math.random() inside pixel loops — noise table is pregenerated.
 *   - All functions mutate `dest` in-place; caller supplies a fresh ImageData.
 */

// ─────────────────────────────────────────────────────────────────────────────
// IRONBOW LUT
// ─────────────────────────────────────────────────────────────────────────────
// Maps luminance (0–255) → [R, G, B] using the classic Ironbow palette:
//
//   Luma 0   → black          (coldest — deep water)
//   Luma 50  → deep indigo    (cool surfaces)
//   Luma 100 → purple-red     (neutral background)
//   Luma 150 → red-orange     (warm objects)
//   Luma 200 → orange-yellow  (hot surfaces)
//   Luma 230 → yellow-white   (warm living tissue)
//   Luma 255 → pure white     (hottest — human heat core)

export function buildIronbowLUT(): Uint8Array {
  const lut = new Uint8Array(256 * 3);

  // Control points: [luminance_index, R, G, B]
  const stops: Array<[number, number, number, number]> = [
    [0,    0,   0,   0  ],   // black  — deepest cold
    [50,   20,  0,   80 ],   // indigo — cold water
    [100,  130, 0,   60 ],   // purple-red — neutral
    [150,  220, 40,  0  ],   // red-orange — warm
    [200,  255, 160, 0  ],   // orange-yellow — hot
    [230,  255, 240, 80 ],   // yellow-white — very hot
    [255,  255, 255, 255],   // white — hottest
  ];

  for (let s = 0; s < stops.length - 1; s++) {
    const [i0, r0, g0, b0] = stops[s];
    const [i1, r1, g1, b1] = stops[s + 1];
    const span = i1 - i0;

    for (let i = i0; i <= i1; i++) {
      const t   = span === 0 ? 0 : (i - i0) / span;
      const idx = i * 3;
      lut[idx]     = Math.round(r0 + (r1 - r0) * t);
      lut[idx + 1] = Math.round(g0 + (g1 - g0) * t);
      lut[idx + 2] = Math.round(b0 + (b1 - b0) * t);
    }
  }

  return lut;
}

// ─────────────────────────────────────────────────────────────────────────────
// THERMAL FILTER  (Ironbow LUT remap)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Converts each pixel through the Ironbow LUT for a FLIR-style thermal look.
 *
 * Algorithm:
 *   1. Compute perceptual luminance  (rec601: 0.299R + 0.587G + 0.114B)
 *   2. Look up [R,G,B] in the precomputed Ironbow LUT
 *   3. Write to dest
 *
 * @param src  Source frame ImageData (not mutated)
 * @param dest Destination ImageData (mutated in-place)
 * @param lut  Precomputed 768-byte Ironbow table from buildIronbowLUT()
 */
export function applyThermalFilter(
  src:  ImageData,
  dest: ImageData,
  lut:  Uint8Array,
): void {
  const s = src.data;
  const d = dest.data;
  const len = s.length;

  for (let i = 0; i < len; i += 4) {
    // Perceptual luminance (0–255)
    const luma = (s[i] * 77 + s[i + 1] * 150 + s[i + 2] * 29) >> 8; // integer fast-path
    const li   = luma * 3;
    d[i]     = lut[li];
    d[i + 1] = lut[li + 1];
    d[i + 2] = lut[li + 2];
    d[i + 3] = 255;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NIGHT IR FILTER  (green-phosphor NV simulation)
// ─────────────────────────────────────────────────────────────────────────────

// Pregenerated noise table — avoids Math.random() inside the pixel loop.
const NOISE_TABLE_SIZE = 4096;
const _noiseTable = new Uint8Array(NOISE_TABLE_SIZE);
for (let i = 0; i < NOISE_TABLE_SIZE; i++) {
  _noiseTable[i] = Math.floor(Math.random() * 256);
}

/**
 * Simulates a UAV low-light / night-vision IR camera.
 *
 * Algorithm:
 *   1. Grayscale luma
 *   2. Sigmoid-style contrast boost (emphasizes midtones, crushes blacks)
 *   3. Brightness lift
 *   4. Map to green-phosphor channel (R=0, G=luma*coeff, B=small tint)
 *   5. Animated noise grain (offset changes each frame via `time`)
 *   6. Radial vignette (darker at corners, brighter at centre)
 *
 * @param src    Source frame ImageData
 * @param dest   Destination ImageData (mutated in-place)
 * @param time   performance.now() — drives grain animation
 * @param width  Frame width in px (for vignette calc)
 * @param height Frame height in px (for vignette calc)
 */
export function applyNightFilter(
  src:    ImageData,
  dest:   ImageData,
  time:   number,
  width:  number,
  height: number,
): void {
  const s   = src.data;
  const d   = dest.data;
  const len = s.length;

  // Grain animation: shift table offset each frame
  const grainOffset = Math.floor((time * 0.31) % NOISE_TABLE_SIZE) & (NOISE_TABLE_SIZE - 1);

  const GRAIN_SCALE  = 0.12;   // grain magnitude (0 = none, 1 = full noise)
  const BRIGHTNESS   = 25;     // additive lift after contrast
  const CONTRAST     = 1.45;   // contrast multiplier

  const cx = width  * 0.5;
  const cy = height * 0.5;
  const maxR = Math.sqrt(cx * cx + cy * cy);

  let pixelIdx = 0; // pixel counter for 2D position

  for (let i = 0; i < len; i += 4, pixelIdx++) {
    // 1. Luminance (integer fast-path)
    let luma = (s[i] * 77 + s[i + 1] * 150 + s[i + 2] * 29) >> 8;

    // 2. Contrast + brightness
    luma = (luma - 128) * CONTRAST + 128 + BRIGHTNESS;
    if (luma > 255) luma = 255;
    if (luma < 0)   luma = 0;

    // 3. Green-phosphor: R=0, G=dominant, B=faint cyan bleed
    const g = Math.round(luma * 0.92);
    const b = Math.round(luma * 0.14);

    // 4. Grain (animated via time offset)
    const noise = _noiseTable[(pixelIdx + grainOffset) & (NOISE_TABLE_SIZE - 1)];
    const grain = (noise - 128) * GRAIN_SCALE;

    // 5. Vignette (radial darkening toward edges)
    const px  = (pixelIdx % width) - cx;
    const py  = Math.floor(pixelIdx / width) - cy;
    const r   = Math.sqrt(px * px + py * py);
    const vig = 1 - (r / maxR) * 0.45; // 0.55 at corner → 1.0 at centre

    d[i]     = 0;
    d[i + 1] = Math.min(255, Math.max(0, Math.round((g + grain) * vig)));
    d[i + 2] = Math.min(255, Math.max(0, Math.round((b + grain * 0.4) * vig)));
    d[i + 3] = 255;
  }
}
