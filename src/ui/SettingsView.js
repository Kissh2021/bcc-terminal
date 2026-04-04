import { storage } from '../utils/storage.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';

const PALETTES = [
  { name: 'green', label: 'Phosphore vert' },
  { name: 'amber', label: 'Ambre'          },
  { name: 'blue',  label: 'Bleu clair'     },
  { name: 'red',   label: 'Rouge sang'     },
];

export function mountSettingsView(container) {
  const el = document.createElement('div');
  el.className = 'menu-view';

  let focusedSection = 'palette'; // 'palette' | 'crt'
  let focusedPalette = PALETTES.findIndex(
    p => p.name === (document.documentElement.getAttribute('data-theme') || 'green')
  );

  function render() {
    const crtOff = document.documentElement.classList.contains('crt-off');
    el.innerHTML = `
      <div class="menu-title">PARAMÈTRES</div>
      <div style="font-size:11px;letter-spacing:0.2em;color:var(--color-text-dim);margin-bottom:8px;align-self:flex-start;max-width:480px;width:100%">PALETTE COULEUR</div>
      ${PALETTES.map((p, i) => `
        <div class="menu-item${focusedSection === 'palette' && i === focusedPalette ? ' focused' : ''}"
             data-type="palette" data-name="${p.name}" data-idx="${i}">
          <span class="menu-item-key">[${i + 1}]</span>
          <span class="menu-item-label">${p.label}</span>
          ${document.documentElement.getAttribute('data-theme') === p.name
            ? '<span class="menu-item-desc" style="color:var(--color-accent)">◀ ACTIF</span>'
            : ''}
        </div>
      `).join('')}
      <div style="font-size:11px;letter-spacing:0.2em;color:var(--color-text-dim);margin:16px 0 8px;align-self:flex-start;max-width:480px;width:100%">AFFICHAGE</div>
      <div class="menu-item${focusedSection === 'crt' ? ' focused' : ''}" data-type="crt">
        <span class="menu-item-key">[C]</span>
        <span class="menu-item-label">EFFETS CRT</span>
        <span class="menu-item-desc" style="color:${crtOff ? 'var(--color-text-dim)' : 'var(--color-accent)'}">
          ${crtOff ? 'DÉSACTIVÉS' : 'ACTIVÉS'}
        </span>
      </div>
      <div class="menu-hint">↑↓ NAVIGUER &nbsp;·&nbsp; ENTRÉE SÉLECTIONNER &nbsp;·&nbsp; ESC RETOUR</div>
    `;

    el.querySelectorAll('[data-type="palette"]').forEach(item => {
      item.addEventListener('click', () => setPalette(item.dataset.name));
    });
    el.querySelector('[data-type="crt"]')?.addEventListener('click', toggleCrt);
  }

  function setPalette(name) {
    document.documentElement.setAttribute('data-theme', name);
    storage.set('palette', name);
    focusedPalette = PALETTES.findIndex(p => p.name === name);
    render();
  }

  function toggleCrt() {
    const off = document.documentElement.classList.toggle('crt-off');
    storage.set('crt', off ? 'off' : 'on');
    render();
  }

  const component = {
    id: 'settings',
    handleKeydown(e) {
      if (e.key === 'Escape') { e.preventDefault(); router.pop(); return true; }
      if (e.key === 'c' || e.key === 'C') { toggleCrt(); return true; }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (focusedSection === 'palette') {
          focusedPalette = Math.max(0, focusedPalette - 1);
        } else {
          focusedSection = 'palette';
          focusedPalette = PALETTES.length - 1;
        }
        render();
        return true;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focusedSection === 'palette' && focusedPalette < PALETTES.length - 1) {
          focusedPalette++;
        } else {
          focusedSection = 'crt';
        }
        render();
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedSection === 'palette') {
          setPalette(PALETTES[focusedPalette].name);
        } else {
          toggleCrt();
        }
        return true;
      }
      const num = parseInt(e.key);
      if (num >= 1 && num <= PALETTES.length) {
        setPalette(PALETTES[num - 1].name);
        return true;
      }
      return false;
    },
    focus() {},
  };

  render();
  container.appendChild(el);
  focusManager.claim(component);
}
