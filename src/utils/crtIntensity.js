import { storage } from './storage.js';

/**
 * Applique l'intensité CRT (0.0 → 1.0) sur les custom properties CSS.
 * Les valeurs par défaut correspondent à intensity = 1.0.
 */
export function applyCrtIntensity(intensity) {
  const i = Math.max(0, Math.min(1, intensity));
  const r = document.documentElement;

  r.style.setProperty('--vignette-1',     (i * 0.35).toFixed(3));
  r.style.setProperty('--vignette-2',     (i * 0.80).toFixed(3));
  r.style.setProperty('--vignette-3',     (i * 0.94).toFixed(3));
  r.style.setProperty('--scanline-alpha', (i * 0.09).toFixed(3));
}

export function getCrtIntensity() {
  return parseFloat(storage.get('crt_intensity', '0.7'));
}

export function setCrtIntensity(value) {
  const clamped = Math.max(0, Math.min(1, parseFloat(value)));
  storage.set('crt_intensity', String(clamped));
  applyCrtIntensity(clamped);
  return clamped;
}
