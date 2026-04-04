import { session } from '../core/session.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';
import { soundManager } from '../core/soundManager.js';

const MENU_ITEMS = [
  { key: '1', id: 'documents', label: 'DOCUMENTS',    desc: 'Archives & rapports' },
  { key: '2', id: 'profile',   label: 'MON PROFIL',   desc: 'Compte & acc\u00e8s'       },
  { key: '3', id: 'settings',  label: 'PARAM\u00c8TRES',   desc: 'Th\u00e8me & affichage'    },
];

export function mountMainMenu(container) {
  let focusedIdx = 0;
  const el = document.createElement('div');
  el.className = 'menu-view';

  function render() {
    const user = session.currentUser();
    el.innerHTML = `
      <div class="menu-title">
        ${user ? `ACC\u00c8S AUTORIS\u00c9 \u2014 ${user.username.toUpperCase()}` : 'ACC\u00c8S PUBLIC'}
      </div>
      ${MENU_ITEMS.map((item, i) => `
        <div class="menu-item${i === focusedIdx ? ' focused' : ''}" data-id="${item.id}" data-idx="${i}">
          <span class="menu-item-key">[${item.key}]</span>
          <span class="menu-item-label">${item.label}</span>
          <span class="menu-item-desc">${item.desc}</span>
        </div>
      `).join('')}
      <div class="menu-hint">\u2191\u2193 NAVIGUER &nbsp;\u00b7&nbsp; ENTR\u00c9E S\u00c9LECTIONNER &nbsp;\u00b7&nbsp; / TERMINAL</div>
    `;

    el.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.id));
    });
  }

  function navigate(id) {
    soundManager.playNavigate();
    router.push(id);
  }

  const component = {
    id: 'main-menu',
    handleKeydown(e) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIdx = (focusedIdx - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
        render();
        return true;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedIdx = (focusedIdx + 1) % MENU_ITEMS.length;
        render();
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        navigate(MENU_ITEMS[focusedIdx].id);
        return true;
      }
      const num = parseInt(e.key);
      if (num >= 1 && num <= MENU_ITEMS.length) {
        navigate(MENU_ITEMS[num - 1].id);
        return true;
      }
      return false;
    },
    focus() { el.focus(); },
  };

  render();
  container.appendChild(el);
  focusManager.claim(component);
}
