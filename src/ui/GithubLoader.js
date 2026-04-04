/**
 * GithubLoader — Fenêtre de chargement avec barre de progression animée.
 * Utilisée à l'ouverture d'un fichier distant GitHub.
 */

import { soundManager } from '../core/soundManager.js';

let loaderEl      = null;
let tickInterval  = null;
let progressTimer = null;
let currentPct    = 0;

// ── DOM ────────────────────────────────────────────────────────────────────

export function showGithubLoader(message = 'CHARGEMENT…') {
  if (loaderEl) return;
  currentPct = 0;

  loaderEl = document.createElement('div');
  loaderEl.className = 'github-loader';
  loaderEl.innerHTML = `
    <div class="github-loader-box">
      <div class="github-loader-title">BCC &nbsp;///&nbsp; ARCHIVES</div>
      <div class="github-loader-files">
        <div class="github-loader-file" style="animation-delay:0s">   <span class="github-loader-file-icon">◻</span><span class="github-loader-file-dot"></span></div>
        <div class="github-loader-file" style="animation-delay:0.15s"><span class="github-loader-file-icon">◼</span><span class="github-loader-file-dot"></span></div>
        <div class="github-loader-file" style="animation-delay:0.30s"><span class="github-loader-file-icon">◻</span><span class="github-loader-file-dot"></span></div>
        <div class="github-loader-file" style="animation-delay:0.45s"><span class="github-loader-file-icon">◼</span><span class="github-loader-file-dot"></span></div>
        <div class="github-loader-file" style="animation-delay:0.60s"><span class="github-loader-file-icon">◻</span><span class="github-loader-file-dot"></span></div>
      </div>
      <div class="github-loader-progress-wrap">
        <div class="github-loader-progress-bar" id="gh-progress-bar"></div>
      </div>
      <div class="github-loader-status" id="github-loader-status">${message}</div>
    </div>
  `;

  document.getElementById('app')?.appendChild(loaderEl);

  // Fausse progression : monte jusqu'à 85% en ~1.2s, puis attend hideGithubLoader
  _animateProgress(85, 1200);

  // Son de scan en boucle
  tickInterval = setInterval(() => soundManager.playLoadTick(), 120);
}

export function updateGithubLoader(message) {
  const el = loaderEl?.querySelector('#github-loader-status');
  if (el) el.textContent = message;
}

export function hideGithubLoader() {
  if (!loaderEl) return;

  // Arrête les sons et la fausse progression
  clearInterval(tickInterval);
  clearTimeout(progressTimer);
  tickInterval  = null;
  progressTimer = null;

  // Complète la barre à 100% puis ferme
  _setProgress(100);
  soundManager.playLoadDone();

  setTimeout(() => {
    if (!loaderEl) return;
    loaderEl.classList.add('closing');
    setTimeout(() => {
      loaderEl?.remove();
      loaderEl   = null;
      currentPct = 0;
    }, 220);
  }, 200);
}

// ── Progression ────────────────────────────────────────────────────────────

function _setProgress(pct) {
  currentPct = pct;
  const bar = loaderEl?.querySelector('#gh-progress-bar');
  if (bar) bar.style.width = pct + '%';
}

function _animateProgress(targetPct, durationMs) {
  const steps    = 30;
  const interval = durationMs / steps;
  const delta    = (targetPct - currentPct) / steps;
  let   step     = 0;

  function tick() {
    step++;
    _setProgress(Math.min(targetPct, currentPct + delta));
    if (step < steps && currentPct < targetPct) {
      progressTimer = setTimeout(tick, interval);
    }
  }
  progressTimer = setTimeout(tick, interval);
}
