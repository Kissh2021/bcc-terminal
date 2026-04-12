/**
 * NotesLoader — Fenêtre de chargement pour export/import de notes.
 * Animation distincte du GithubLoader : barre à segments + checklist.
 */

import { soundManager } from '../core/soundManager.js';

let loaderEl     = null;
let tickInterval = null;
let segmentIdx   = 0;

const TOTAL_SEGMENTS = 12;

// ── DOM ────────────────────────────────────────────────────────────────────

export function showNotesLoader(message = 'TRAITEMENT…') {
  if (loaderEl) return;
  segmentIdx = 0;

  loaderEl = document.createElement('div');
  loaderEl.className = 'notes-loader';
  loaderEl.innerHTML = `
    <div class="notes-loader-box">
      <div class="notes-loader-title">BCC &nbsp;///&nbsp; NOTES</div>
      <div class="notes-loader-segments" id="nl-segments">
        ${Array.from({ length: TOTAL_SEGMENTS }, () => '<span class="nl-seg"></span>').join('')}
      </div>
      <div class="notes-loader-spinner">
        <span class="nl-spin-char" id="nl-spin">▰</span>
      </div>
      <div class="notes-loader-status" id="nl-status">${message}</div>
    </div>
  `;

  document.getElementById('app')?.appendChild(loaderEl);

  // Animate segments progressively + tick sounds
  const segs = loaderEl.querySelectorAll('.nl-seg');
  const spinChars = ['▰', '▱', '▰', '▱', '◼', '◻', '◼', '◻'];
  let spinIdx = 0;

  tickInterval = setInterval(() => {
    if (segmentIdx < TOTAL_SEGMENTS) {
      segs[segmentIdx].classList.add('active');
      segmentIdx++;
      soundManager.playNoteTick();
    }
    // Spin animation
    const spinEl = loaderEl?.querySelector('#nl-spin');
    if (spinEl) {
      spinIdx = (spinIdx + 1) % spinChars.length;
      spinEl.textContent = spinChars[spinIdx];
    }
  }, 80);
}

export function updateNotesLoader(message) {
  const el = loaderEl?.querySelector('#nl-status');
  if (el) el.textContent = message;
}

export function hideNotesLoader() {
  if (!loaderEl) return;

  clearInterval(tickInterval);
  tickInterval = null;

  // Fill remaining segments
  const segs = loaderEl.querySelectorAll('.nl-seg');
  segs.forEach(s => s.classList.add('active'));

  // Status: done
  const status = loaderEl.querySelector('#nl-status');
  if (status) { status.textContent = 'TERMINÉ'; status.classList.add('done'); }

  soundManager.playNoteDone();

  // Hold briefly then fade out
  setTimeout(() => {
    if (!loaderEl) return;
    loaderEl.classList.add('closing');
    setTimeout(() => {
      loaderEl?.remove();
      loaderEl   = null;
      segmentIdx = 0;
    }, 300);
  }, 350);
}
