import { storage } from '../utils/storage.js';
import { delay } from '../utils/typewriter.js';
import { BCC_ASCII, BOOT_TIMING, POST_LINES, READY_LINES, QUICK_BOOT_LINES } from './bootFrames.js';
import { session } from '../core/session.js';
import { soundManager } from '../core/soundManager.js';
import { checkUpdate, performUpdate } from '../utils/updater.js';

export async function runBootSequence(contentEl) {
  const appEl = document.getElementById('app');
  appEl?.classList.add('boot-active');

  const bootEl = document.createElement('div');
  bootEl.id = 'boot-view';
  contentEl.appendChild(bootEl);

  await waitForClick(bootEl);

  bootEl.innerHTML = '';
  await runFullBoot(bootEl);

  await delay(BOOT_TIMING.finalPause);

  appEl?.classList.remove('boot-active');
}

/**
 * Affiche l'écran titre (logo + clic pour fermer) par-dessus l'UI courante.
 * Appelable depuis le menu principal via la touche [0].
 */
export async function showSplashScreen() {
  const overlay = document.createElement('div');
  overlay.id = 'splash-overlay';
  document.body.appendChild(overlay);

  const logoSrc = await tryLoadLogo();

  if (logoSrc) {
    overlay.innerHTML = `
      <div class="boot-logo-wrapper">
        <img class="boot-logo-img" src="${logoSrc}" alt="BCC Logo" draggable="false" />
      </div>
      <div class="boot-logo-hint">CLIQUER POUR FERMER</div>
    `;
    const blinkInterval = setInterval(() => soundManager.playLogoBlink(), 1600);
    setTimeout(() => soundManager.playLogoBlink(), 96);
    overlay.addEventListener('click', () => clearInterval(blinkInterval), { once: true });
  } else {
    overlay.innerHTML = `<div class="boot-start-symbol">\u25c8</div>`;
  }

  await new Promise(resolve => {
    overlay.addEventListener('click', () => {
      overlay.style.opacity = '0';
      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 220);
    }, { once: true });
  });
}

async function tryLoadLogo() {
  for (const src of ['/logo.svg', '/logo.png', '/logo.webp']) {
    const found = await new Promise(resolve => {
      const img = new Image();
      img.onload  = () => resolve(src);
      img.onerror = () => resolve(null);
      img.src = src;
    });
    if (found) return found;
  }
  return null;
}

async function waitForClick(bootEl) {
  bootEl.classList.add('boot-start');

  // Lance la vérification des MAJ en arrière-plan (non bloquant)
  const updatePromise = checkUpdate();

  const logoSrc = await tryLoadLogo();

  let blinkInterval = null;

  if (logoSrc) {
    bootEl.innerHTML = `
      <div class="boot-logo-wrapper">
        <img class="boot-logo-img" src="${logoSrc}" alt="BCC Logo" draggable="false" />
      </div>
      <div class="boot-logo-hint">CLIQUER POUR DÉMARRER</div>
    `;

    // Son synchronisé avec le clignotement — période 1.6s, logo visible à 6% (≈ 96ms)
    blinkInterval = setInterval(() => soundManager.playLogoBlink(), 1600);
    setTimeout(() => soundManager.playLogoBlink(), 96); // premier blink
  } else {
    bootEl.innerHTML = `<div class="boot-start-symbol">\u25c8</div>`;
  }

  let resolved = false;

  const doResolve = (resolveFn) => {
    if (resolved) return;
    resolved = true;
    if (blinkInterval) clearInterval(blinkInterval);
    bootEl.classList.add('boot-start-out');
    setTimeout(() => {
      bootEl.classList.remove('boot-start', 'boot-start-out');
      resolveFn();
    }, 220);
  };

  return new Promise(resolve => {
    // Clic normal → démarrage du boot
    bootEl.addEventListener('click', () => doResolve(resolve), { once: true });

    // Quand la vérif MAJ aboutit, afficher le badge si dispo
    updatePromise.then(update => {
      if (!update || resolved) return;

      const badge = document.createElement('div');
      badge.className = 'boot-update-badge';
      badge.textContent = `⬆ MISE À JOUR v${update.version} DISPONIBLE`;
      bootEl.appendChild(badge);

      badge.addEventListener('click', async (e) => {
        e.stopPropagation(); // ne pas déclencher le clic normal
        if (resolved) return;
        resolved = true;
        if (blinkInterval) clearInterval(blinkInterval);

        badge.classList.add('boot-update-installing');
        badge.textContent = 'TÉLÉCHARGEMENT EN COURS…';

        try {
          await performUpdate(update, (pct) => {
            badge.textContent = `INSTALLATION… ${pct}%`;
          });
        } catch (err) {
          // En cas d'erreur, on laisse l'utilisateur continuer
          badge.textContent = `ERREUR MAJ — ${err?.message ?? err}`;
          badge.classList.remove('boot-update-installing');
          resolved = false; // permet de cliquer pour continuer quand même
        }
      });
    });
  });
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
