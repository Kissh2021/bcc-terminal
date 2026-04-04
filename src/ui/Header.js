import { session } from '../core/session.js';
import { router } from '../core/router.js';
import { soundManager } from '../core/soundManager.js';

let clockInterval = null;

export function mountHeader(el) {
  render(el);

  document.addEventListener('bcc:session-changed', () => render(el));
  document.addEventListener('bcc:route-changed',   () => render(el));

  // Clock
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(() => updateClock(el), 1000);
}

function buildNavButtons(view) {
  if (!view || view === 'main-menu') return '';
  return `
    <button class="header-nav-btn" id="header-btn-home">← ACCUEIL</button>
    <button class="header-nav-btn" id="header-btn-back">↩ RETOUR</button>
  `;
}

function render(el) {
  const user = session.currentUser();
  const view = router.current();

  el.innerHTML = `
    ${buildNavButtons(view)}
    <span class="header-logo">BCC <span>///</span> TERMINAL</span>
    <div class="header-sep"></div>
    ${user
      ? `<div class="header-user">
           <span class="username">${user.username.toUpperCase()}</span>
           <span class="group-badge">${user.group.toUpperCase()}</span>
         </div>`
      : `<div class="header-user"><span style="opacity:0.4;font-size:10px;letter-spacing:0.2em">NON AUTHENTIFIÉ</span></div>`
    }
    <div class="header-clock" id="header-clock">${getTimeString()}</div>
  `;

  el.querySelector('#header-btn-home')?.addEventListener('click', () => {
    soundManager.playBack();
    router.replace('main-menu');
  });

  el.querySelector('#header-btn-back')?.addEventListener('click', () => {
    soundManager.playBack();
    router.pop();
  });
}

function updateClock(el) {
  const clockEl = el.querySelector('#header-clock');
  if (clockEl) clockEl.textContent = getTimeString();
}

function getTimeString() {
  const now = new Date();
  return now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
