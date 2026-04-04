import { session } from '../core/session.js';

let clockInterval = null;

export function mountHeader(el) {
  render(el);

  document.addEventListener('bcc:session-changed', () => render(el));

  // Clock
  if (clockInterval) clearInterval(clockInterval);
  clockInterval = setInterval(() => updateClock(el), 1000);
}

function render(el) {
  const user = session.currentUser();
  el.innerHTML = `
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
}

function updateClock(el) {
  const clockEl = el.querySelector('#header-clock');
  if (clockEl) clockEl.textContent = getTimeString();
}

function getTimeString() {
  const now = new Date();
  return now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
