import { session } from '../core/session.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';

const MENU_ITEMS = [
  { key: '1', id: 'documents', label: 'DOCUMENTS',    desc: 'Archives & rapports' },
  { key: '2', id: 'profile',   label: 'MON PROFIL',   desc: 'Compte & accès'       },
  { key: '3', id: 'settings',  label: 'PARAMÈTRES',   desc: 'Thème & affichage'    },
];

export function mountMainMenu(container) {
  let focusedIdx = 0;
  const el = document.createElement('div');
  el.className = 'menu-view';

  function render() {
    const user = session.currentUser();
    el.innerHTML = `
      <div class="menu-title">
        ${user ? `ACCÈS AUTORISÉ — ${user.username.toUpperCase()}` : 'ACCÈS PUBLIC'}
      </div>
      ${MENU_ITEMS.map((item, i) => `
        <div class="menu-item${i === focusedIdx ? ' focused' : ''}" data-id="${item.id}" data-idx="${i}">
          <span class="menu-item-key">[${item.key}]</span>
          <span class="menu-item-label">${item.label}</span>
          <span class="menu-item-desc">${item.desc}</span>
        </div>
      `).join('')}
      <div class="menu-hint">↑↓ NAVIGUER &nbsp;·&nbsp; ENTRÉE SÉLECTIONNER &nbsp;·&nbsp; / TERMINAL</div>
    `;

    // Click handlers
    el.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => navigate(item.dataset.id));
    });
  }

  function navigate(id) {
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
      // Number shortcuts
      const num = parseInt(e.key);
      if (num >= 1 && num <= MENU_ITEMS.length) {
        navigate(MENU_ITEMS[num - 1].id);
        return true;
      }
      return false;
    },
    focus() {
      el.focus();
    },
  };

  render();
  container.appendChild(el);
  focusManager.claim(component);
}
