import { createNoise2D } from './noise.js';

export const SIZE = 320;
export const MIN_ELEV_M = 1100;
export const MAX_ELEV_M = 2763;
export const HEIGHT_SCALE = 50;

const noise = createNoise2D(1044);

function fbm(x, z, octaves, ridged) {
  let amp = 0.5;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    let n = noise(x * freq, z * freq);
    if (ridged) n = 1 - Math.abs(n);
    sum += n * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

function cone(x, z, cx, cz, radius, height, crater) {
  const r = Math.hypot(x - cx, z - cz) / radius;
  if (r >= 1) return 0;
  let h = Math.pow(1 - r, 1.7) * height;
  if (crater > 0 && r < 0.12) h -= (1 - r / 0.12) ** 2 * crater;
  return h;
}

// Normalised 0..1 elevation. A big stratovolcano, a cinder cone, and ridged foothills.
export function heightAt(x, z) {
  const u = x / SIZE;
  const v = z / SIZE;
  const warp = noise(u * 3 + 11, v * 3 - 7) * 0.08;
  const ridges = fbm(u * 3.2 + warp, v * 3.2 - warp, 5, true);
  const rolling = fbm(u * 1.6 + 4, v * 1.6 + 9, 4, false) * 0.5 + 0.5;
  let h = 0.12 + rolling * 0.14 + Math.pow(ridges, 2.4) * 0.22;
  h += cone(x, z, 46, -52, 115, 0.62, 0.05) * (0.9 + 0.1 * ridges);
  h += cone(x, z, -64, 30, 36, 0.14, 0.03);
  // Gentle basin where the town would sit.
  h -= cone(x, z, -90, 100, 90, 0.08, 0);
  return Math.min(1, Math.max(0, h));
}

export function elevationMeters(h) {
  return MIN_ELEV_M + h * (MAX_ELEV_M - MIN_ELEV_M);
}

export function buildHeightGrid(segments) {
  const n = segments + 1;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i / segments - 0.5) * SIZE;
      const z = (j / segments - 0.5) * SIZE;
      heights[j * n + i] = heightAt(x, z);
    }
  }
  return heights;
}
