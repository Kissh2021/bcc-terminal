import { storage } from '../utils/storage.js';
import { delay } from '../utils/typewriter.js';
import { BCC_ASCII, BOOT_TIMING, POST_LINES, READY_LINES, QUICK_BOOT_LINES } from './bootFrames.js';
import { session } from '../core/session.js';
import { soundManager } from '../core/soundManager.js';

export async function runBootSequence(contentEl) {
  const restoredUser = session.currentUser();

  // Create boot view
  const bootEl = document.createElement('div');
  bootEl.id = 'boot-view';
  contentEl.appendChild(bootEl);

  await runFullBoot(bootEl);

  // Brief pause before handing off
  await delay(BOOT_TIMING.finalPause);
}

async function runFullBoot(container) {
  let skipped = false;
  const onKey = () => { skipped = true; };
  document.addEventListener('keydown', onKey, { once: true });

  // Skip hint
  const skipHint = document.createElement('div');
  skipHint.className = 'boot-skip-hint';
  skipHint.textContent = '[ APPUYEZ SUR UNE TOUCHE POUR PASSER ]';
  container.appendChild(skipHint);

  await delay(BOOT_TIMING.blankHold);

  // POST lines
  for (const { text, className, suffix } of POST_LINES) {
    if (skipped) break;
    const el = document.createElement('div');
    el.className = 'boot-line' + (className ? ' ' + className : '');
    container.appendChild(el);
    await typeText(el, text, skipped ? 0 : BOOT_TIMING.postCharDelay, () => skipped);
    if (suffix) {
      const s = document.createElement('span');
      s.className = suffix === 'OK' ? 'ok-text' : 'fail-text';
      s.textContent = ' ' + suffix;
      s.style.color = suffix === 'OK' ? 'var(--color-accent)' : 'var(--color-error)';
      el.appendChild(s);
    }
    if (!skipped) await delay(BOOT_TIMING.postLineDelay);
  }

  if (!skipped) await delay(200);

  // ASCII art
  if (!skipped) {
    const sep = document.createElement('hr');
    sep.className = 'boot-separator';
    container.appendChild(sep);
    await delay(150);
  }

  for (const line of BCC_ASCII) {
    if (skipped) {
      // Dump all remaining ASCII instantly
      const el = document.createElement('div');
      el.className = 'boot-line ascii';
      el.textContent = line;
      container.appendChild(el);
    } else {
      const el = document.createElement('div');
      el.className = 'boot-line ascii';
      container.appendChild(el);
      await typeText(el, line, BOOT_TIMING.asciiCharDelay, () => skipped);
      await delay(BOOT_TIMING.asciiLineDelay);
    }
  }

  // Title + subtitle
  if (!skipped) await delay(100);

  const titleEl = document.createElement('div');
  titleEl.className = 'boot-line title';
  container.appendChild(titleEl);
  await typeText(titleEl, 'T E R M I N A L', skipped ? 0 : BOOT_TIMING.titleCharDelay, () => skipped);

  const subEl = document.createElement('div');
  subEl.className = 'boot-line subtitle';
  container.appendChild(subEl);
  await typeText(subEl, 'BUREAU DE CONTRÔLE DES CHRONOLOGIES', skipped ? 0 : BOOT_TIMING.subtitleDelay, () => skipped);

  if (!skipped) {
    const sep2 = document.createElement('hr');
    sep2.className = 'boot-separator';
    container.appendChild(sep2);
    await delay(250);
  }

  // Ready lines
  for (const { text, className } of READY_LINES) {
    const el = document.createElement('div');
    el.className = 'boot-line' + (className ? ' ' + className : '');
    container.appendChild(el);
    await typeText(el, text, skipped ? 0 : BOOT_TIMING.readyCharDelay, () => skipped);
    if (!skipped) await delay(60);
  }

  document.removeEventListener('keydown', onKey);
  skipHint.remove();
}

async function runQuickBoot(container, restoredUser) {
  const lines = [...QUICK_BOOT_LINES];
  if (restoredUser) {
    lines.splice(1, 0, {
      text: `SESSION RESTAURÉE — ${restoredUser.username.toUpperCase()} [${restoredUser.group.toUpperCase()}]`,
      className: 'bright',
    });
  }

  for (const { text, className } of lines) {
    const el = document.createElement('div');
    el.className = 'boot-line' + (className ? ' ' + className : '');
    el.textContent = text;
    container.appendChild(el);
    await delay(BOOT_TIMING.quickBootDelay);
  }
}

async function typeText(el, text, charDelay, isSkipped) {
  for (let i = 0; i < text.length; i++) {
    if (isSkipped && isSkipped()) {
      el.textContent = text;
      return;
    }
    el.textContent += text[i];
    if (text[i] !== ' ') soundManager.playTypewriterChar();
    if (charDelay > 0) await delay(charDelay);
  }
}
