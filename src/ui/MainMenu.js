import { session } from '../core/session.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';
import { soundManager } from '../core/soundManager.js';

const ALL_ITEMS = [
  { key: '1', id: 'documents',  label: 'DOCUMENTS',  desc: 'Archives & rapports',   minGroup: null },
  { key: '2', id: 'notes',      label: 'NOTES',       desc: 'Post-its personnels',   minGroup: null },
  { key: '3', id: 'profile',    label: 'MON PROFIL',  desc: 'Compte & accès',        minGroup: null },
  { key: '4', id: 'settings',   label: 'PARAMÈTRES',  desc: 'Thème & affichage',     minGroup: null },
  { key: '5', id: 'doc-import', label: 'IMPORTER',    desc: 'Ajouter un document',   minGroup: 'directeur' },
  { key: '6', id: 'accounts',  label: 'COMPTES',     desc: 'Gestion des utilisateurs', minGroup: 'admin' },
];

export function mountMainMenu(container) {
  let focusedIdx = 0;
  const el = document.createElement('div');
  el.className = 'menu-view';

  function getVisibleItems() {
    return ALL_ITEMS.filter(item =>
      !item.minGroup || session.hasGroup(item.minGroup)
    ).map((item, i) => ({ ...item, key: String(i + 1) }));
  }

  function render() {
    const user  = session.currentUser();
    const items = getVisibleItems();
    // Clamp focus index after filtering
    if (focusedIdx >= items.length) focusedIdx = items.length - 1;

    el.innerHTML = `
      <div class="menu-title">
        ${user ? `ACCÈS AUTORISÉ — ${user.username.toUpperCase()}` : 'ACCÈS PUBLIC'}
      </div>
      ${items.map((item, i) => `
        <div class="menu-item${i === focusedIdx ? ' focused' : ''}" data-id="${item.id}" data-idx="${i}">
          <span class="menu-item-key">[${item.key}]</span>
          <span class="menu-item-label">${item.label}</span>
          <span class="menu-item-desc">${item.desc}</span>
        </div>
      `).join('')}
      <div class="menu-hint">↑↓ NAVIGUER &nbsp;·&nbsp; ENTRÉE SÉLECTIONNER &nbsp;·&nbsp; / TERMINAL</div>
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
      const items = getVisibleItems();
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIdx = (focusedIdx - 1 + items.length) % items.length;
        render();
        return true;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedIdx = (focusedIdx + 1) % items.length;
        render();
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        navigate(items[focusedIdx].id);
        return true;
      }
      const num = parseInt(e.key);
      if (num >= 1 && num <= items.length) {
        navigate(items[num - 1].id);
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
