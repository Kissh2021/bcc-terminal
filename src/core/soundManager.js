import { storage } from '../utils/storage.js';

let audioCtx = null;

const COOLDOWNS = {
  typewriter: 35,
  keypress:   28,
  nav:        70,
  scroll:     100,
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
  return audioCtx.state === 'running' ? audioCtx : null;
}

async function playTone({ frequency = 600, duration = 0.04, volume = 0.14, type = 'square', detune = 0, decay = null }) {
  if (!soundManager.isEnabled()) return;
  try {
    const ctx = await ensureCtx();
    if (!ctx) return;

    const master = soundManager.getVolume();
    const osc    = ctx.createOscillator();
    const gain   = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.detune.setValueAtTime(detune, ctx.currentTime);

    const d = decay ?? duration;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * master, ctx.currentTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + d);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + d + 0.01);
  } catch { /* silent */ }
}

// Joue deux tons simultanément (accord)
async function playChord(tones) {
  for (const t of tones) playTone(t);
}

export const soundManager = {

  // ── Typewriter ────────────────────────────────────────────────────────────
  /** Caractère boot/typewriter — grave, mécanique, pas goofy */
  playTypewriterChar() {
    if (!canPlay('typewriter')) return;
    // Fréquence basse (200–380Hz), triangle = plus doux que square
    const freq = 220 + Math.random() * 160;
    playTone({ frequency: freq, duration: 0.028, volume: 0.11, type: 'triangle' });
  },

  // ── Terminal ──────────────────────────────────────────────────────────────
  /** Frappe clavier dans le terminal */
  playKeypress() {
    if (!canPlay('keypress')) return;
    const freq = 380 + Math.random() * 60;
    playTone({ frequency: freq, duration: 0.025, volume: 0.13, type: 'triangle', detune: -15 });
  },

  /** Validation Enter — double bip satisfaisant */
  playConfirm() {
    playTone({ frequency: 880, duration: 0.05, volume: 0.12, type: 'square' });
    setTimeout(() => playTone({ frequency: 1320, duration: 0.04, volume: 0.09, type: 'square' }), 55);
  },

  /** Erreur */
  playError() {
    playTone({ frequency: 180, duration: 0.14, volume: 0.18, type: 'sawtooth' });
  },

  // ── Navigation ────────────────────────────────────────────────────────────
  /** Déplacement ↑↓ dans un menu */
  playNav() {
    if (!canPlay('nav')) return;
    playTone({ frequency: 520, duration: 0.022, volume: 0.10, type: 'triangle' });
  },

  /** Ouverture d'une vue / changement de page (vers l'avant) */
  playNavigate() {
    playTone({ frequency: 660, duration: 0.04, volume: 0.11, type: 'square' });
    setTimeout(() => playTone({ frequency: 880, duration: 0.03, volume: 0.08, type: 'square' }), 45);
  },

  /** Retour arrière (Esc, bouton retour) */
  playBack() {
    playTone({ frequency: 700, duration: 0.03, volume: 0.10, type: 'square' });
    setTimeout(() => playTone({ frequency: 500, duration: 0.04, volume: 0.08, type: 'square' }), 35);
  },

  // ── Documents ─────────────────────────────────────────────────────────────
  /** Ouverture d'un document */
  playOpen() {
    playChord([
      { frequency: 440, duration: 0.07, volume: 0.09, type: 'square' },
      { frequency: 660, duration: 0.07, volume: 0.07, type: 'square' },
    ]);
    setTimeout(() => playTone({ frequency: 880, duration: 0.05, volume: 0.06, type: 'square' }), 70);
  },

  /** Fermeture d'un document */
  playClose() {
    playTone({ frequency: 600, duration: 0.05, volume: 0.09, type: 'square' });
    setTimeout(() => playTone({ frequency: 400, duration: 0.06, volume: 0.07, type: 'square' }), 45);
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  /** Toggle on/off (CRT, son...) */
  playToggle(isOn) {
    playTone({
      frequency: isOn ? 880 : 440,
      duration: 0.05,
      volume: 0.10,
      type: 'square',
    });
  },

  /** Changement de palette */
  playPalette() {
    playChord([
      { frequency: 523, duration: 0.06, volume: 0.08, type: 'triangle' },
      { frequency: 659, duration: 0.06, volume: 0.07, type: 'triangle' },
      { frequency: 784, duration: 0.06, volume: 0.06, type: 'triangle' },
    ]);
  },

  // ── Scroll (document viewer seulement) ───────────────────────────────────
  playScroll() {
    if (!canPlay('scroll')) return;
    playTone({ frequency: 300 + Math.random() * 80, duration: 0.014, volume: 0.06, type: 'triangle' });
  },

  // ── Auth ──────────────────────────────────────────────────────────────────
  /** Login réussi */
  playLogin() {
    playTone({ frequency: 440, duration: 0.06, volume: 0.10, type: 'square' });
    setTimeout(() => playTone({ frequency: 660, duration: 0.06, volume: 0.09, type: 'square' }), 60);
    setTimeout(() => playTone({ frequency: 880, duration: 0.08, volume: 0.10, type: 'square' }), 120);
  },

  /** Logout */
  playLogout() {
    playTone({ frequency: 880, duration: 0.05, volume: 0.08, type: 'square' });
    setTimeout(() => playTone({ frequency: 440, duration: 0.08, volume: 0.07, type: 'square' }), 50);
  },

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  isEnabled()  { return storage.get('sound', 'on') !== 'off'; },
  setEnabled(b){ storage.set('sound', b ? 'on' : 'off'); },
  getVolume()  { return parseFloat(storage.get('volume', '0.6')); },
  setVolume(v) { storage.set('volume', String(Math.max(0, Math.min(1, parseFloat(v))))); },

  init() {
    // Unlock AudioContext à la première interaction
    const unlock = async () => { await ensureCtx(); };
    document.addEventListener('keydown', unlock, { once: true });
    document.addEventListener('click',   unlock, { once: true });

    // Sons de navigation clavier dans les menus (hors champ de texte)
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        soundManager.playNav();
      }
    });
  },
};
