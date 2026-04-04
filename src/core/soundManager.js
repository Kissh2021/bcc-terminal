import { storage } from '../utils/storage.js';

let audioCtx = null;

function getCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone({ frequency = 900, duration = 0.025, volume = 0.15, type = 'square', detune = 0 }) {
  if (!soundManager.isEnabled()) return;
  try {
    const ctx = getCtx();
    const masterVolume = soundManager.getVolume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    osc.detune.setValueAtTime(detune, ctx.currentTime);

    // Envelope : attack très court, decay rapide
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(volume * masterVolume, ctx.currentTime + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration + 0.01);
  } catch {
    // Silently fail if AudioContext unavailable
  }
}

export const soundManager = {
  /**
   * Son émis pour chaque caractère de la séquence typewriter (boot).
   * Cliquetis rapide, haute fréquence, très court.
   */
  playTypewriterChar() {
    // Légère variation aléatoire pour un rendu organique
    const freq = 880 + Math.random() * 160;
    playTone({ frequency: freq, duration: 0.022, volume: 0.12, type: 'square' });
  },

  /**
   * Son émis quand le joueur tape une touche dans le terminal.
   * Légèrement plus grave et plus long que le typewriter.
   */
  playKeypress() {
    const freq = 660 + Math.random() * 80;
    playTone({ frequency: freq, duration: 0.035, volume: 0.18, type: 'square', detune: -20 });
  },

  /**
   * Son de validation (Enter).
   */
  playConfirm() {
    playTone({ frequency: 1200, duration: 0.06, volume: 0.14, type: 'square' });
    setTimeout(() => {
      playTone({ frequency: 1600, duration: 0.05, volume: 0.10, type: 'square' });
    }, 50);
  },

  /**
   * Son d'erreur.
   */
  playError() {
    playTone({ frequency: 220, duration: 0.12, volume: 0.20, type: 'sawtooth' });
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

  // Initialise le contexte audio dès la première interaction utilisateur
  init() {
    const resume = () => {
      getCtx();
      document.removeEventListener('keydown', resume);
      document.removeEventListener('click', resume);
    };
    document.addEventListener('keydown', resume, { once: true });
    document.addEventListener('click', resume, { once: true });
  },
};
