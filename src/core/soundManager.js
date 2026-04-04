import { storage } from '../utils/storage.js';

let audioCtx = null;
let ctxReady = false;

// Cooldowns (ms) par type de son
const COOLDOWNS = {
  typewriter: 40,
  keypress:   30,
  nav:        80,
  scroll:     120,
  click:      60,
};
const lastPlayed = {};

function canPlay(key) {
  const now = Date.now();
  const cd = COOLDOWNS[key] ?? 0;
  if (now - (lastPlayed[key] ?? 0) < cd) return false;
  lastPlayed[key] = now;
  return true;
}

async function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  ctxReady = audioCtx.state === 'running';
  return ctxReady ? audioCtx : null;
}

async function playTone({ frequency = 900, duration = 0.025, volume = 0.15, type = 'square', detune = 0 }) {
  if (!soundManager.isEnabled()) return;
  try {
    const ctx = await ensureCtx();
    if (!ctx) return;

    const masterVolume = soundManager.getVolume();

    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.detune.setValueAtTime(detune, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * masterVolume, ctx.currentTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  } catch {
    // Silently fail
  }
}

export const soundManager = {
  /** Caractère typewriter (boot) — avec cooldown pour éviter la saturation */
  playTypewriterChar() {
    if (!canPlay('typewriter')) return;
    const freq = 880 + Math.random() * 160;
    playTone({ frequency: freq, duration: 0.020, volume: 0.10, type: 'square' });
  },

  /** Frappe dans le terminal */
  playKeypress() {
    if (!canPlay('keypress')) return;
    const freq = 660 + Math.random() * 80;
    playTone({ frequency: freq, duration: 0.030, volume: 0.16, type: 'square', detune: -20 });
  },

  /** Navigation dans les menus (↑↓) */
  playNav() {
    if (!canPlay('nav')) return;
    playTone({ frequency: 750, duration: 0.025, volume: 0.12, type: 'square' });
  },

  /** Clic souris */
  playClick() {
    if (!canPlay('click')) return;
    playTone({ frequency: 1000, duration: 0.018, volume: 0.10, type: 'square' });
  },

  /** Scroll */
  playScroll() {
    if (!canPlay('scroll')) return;
    playTone({ frequency: 600 + Math.random() * 100, duration: 0.015, volume: 0.07, type: 'square' });
  },

  /** Validation Enter — satisfaisant, double bip montant */
  playConfirm() {
    playTone({ frequency: 1100, duration: 0.055, volume: 0.13, type: 'square' });
    setTimeout(() => playTone({ frequency: 1500, duration: 0.045, volume: 0.09, type: 'square' }), 55);
  },

  /** Erreur */
  playError() {
    playTone({ frequency: 220, duration: 0.12, volume: 0.18, type: 'sawtooth' });
  },

  isEnabled() {
    return storage.get('sound', 'on') !== 'off';
  },

  setEnabled(bool) {
    storage.set('sound', bool ? 'on' : 'off');
  },

  getVolume() {
    return parseFloat(storage.get('volume', '0.6'));
  },

  setVolume(val) {
    const clamped = Math.max(0, Math.min(1, parseFloat(val)));
    storage.set('volume', String(clamped));
  },

  /**
   * Prépare l'AudioContext dès la première interaction utilisateur.
   * Aussi écoute les clics et scrolls globaux pour les sons d'interface.
   */
  init() {
    // Unlock AudioContext à la première interaction
    const unlock = async () => {
      await ensureCtx();
    };
    document.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('click',   unlock, { once: true });

    // Son au clic global (hors input)
    document.addEventListener('click', (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      soundManager.playClick();
    });

    // Son au scroll global
    document.addEventListener('wheel', () => {
      soundManager.playScroll();
    }, { passive: true });

    // Son de navigation clavier dans les menus (touches fléchées hors input)
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        soundManager.playNav();
      }
    });
  },
};
