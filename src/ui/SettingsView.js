import { storage } from '../utils/storage.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';
import { soundManager } from '../core/soundManager.js';

const PALETTES = [
  { name: 'green', label: 'Phosphore vert' },
  { name: 'amber', label: 'Ambre'          },
  { name: 'blue',  label: 'Bleu clair'     },
  { name: 'red',   label: 'Rouge sang'     },
];

// Sections navigables au clavier
const SECTIONS = ['palette', 'crt', 'sound'];

export function mountSettingsView(container) {
  const el = document.createElement('div');
  el.className = 'menu-view';

  let focusedSection = 'palette';
  let focusedPalette = PALETTES.findIndex(
    p => p.name === (document.documentElement.getAttribute('data-theme') || 'green')
  );

  function render() {
    const crtOff = document.documentElement.classList.contains('crt-off');
    const soundOn = soundManager.isEnabled();
    const volume  = soundManager.getVolume();
    const volPct  = Math.round(volume * 100);

    el.innerHTML = `
      <div class="menu-title">PARAM\u00c8TRES</div>

      <div class="settings-section-label">PALETTE COULEUR</div>
      ${PALETTES.map((p, i) => `
        <div class="menu-item${focusedSection === 'palette' && i === focusedPalette ? ' focused' : ''}"
             data-type="palette" data-name="${p.name}" data-idx="${i}">
          <span class="menu-item-key">[${i + 1}]</span>
          <span class="menu-item-label">${p.label}</span>
          ${document.documentElement.getAttribute('data-theme') === p.name
            ? '<span class="menu-item-desc" style="color:var(--color-accent)">\u25c0 ACTIF</span>'
            : ''}
        </div>
      `).join('')}

      <div class="settings-section-label" style="margin-top:12px">AFFICHAGE</div>
      <div class="menu-item${focusedSection === 'crt' ? ' focused' : ''}" data-type="crt">
        <span class="menu-item-key">[C]</span>
        <span class="menu-item-label">EFFETS CRT</span>
        <span class="menu-item-desc" style="color:${crtOff ? 'var(--color-text-dim)' : 'var(--color-accent)'}">
          ${crtOff ? 'D\u00c9SACTIV\u00c9S' : 'ACTIV\u00c9S'}
        </span>
      </div>

      <div class="settings-section-label" style="margin-top:12px">SON</div>
      <div class="menu-item${focusedSection === 'sound' ? ' focused' : ''}" data-type="sound-toggle">
        <span class="menu-item-key">[S]</span>
        <span class="menu-item-label">SONS SYST\u00c8ME</span>
        <span class="menu-item-desc" style="color:${soundOn ? 'var(--color-accent)' : 'var(--color-text-dim)'}">
          ${soundOn ? 'ACTIV\u00c9S' : 'D\u00c9SACTIV\u00c9S'}
        </span>
      </div>
      ${soundOn ? `
      <div class="menu-item" data-type="volume" style="gap:12px">
        <span class="menu-item-key">VOL</span>
        <input
          type="range" id="volume-slider"
          min="0" max="1" step="0.05"
          value="${volume}"
          style="flex:1;accent-color:var(--color-text);cursor:pointer;max-width:200px"
        />
        <span class="menu-item-desc" style="min-width:36px;text-align:right">${volPct}%</span>
      </div>` : ''}

      <div class="menu-hint">\u2191\u2193 NAVIGUER &nbsp;\u00b7&nbsp; ENTR\u00c9E S\u00c9LECTIONNER &nbsp;\u00b7&nbsp; ESC RETOUR</div>
    `;

    // Click handlers
    el.querySelectorAll('[data-type="palette"]').forEach(item => {
      item.addEventListener('click', () => setPalette(item.dataset.name));
    });
    el.querySelector('[data-type="crt"]')?.addEventListener('click', toggleCrt);
    el.querySelector('[data-type="sound-toggle"]')?.addEventListener('click', toggleSound);

    // Volume slider
    const slider = el.querySelector('#volume-slider');
    if (slider) {
      slider.addEventListener('input', (e) => {
        soundManager.setVolume(parseFloat(e.target.value));
        soundManager.playKeypress(); // preview
        // Update display without full re-render
        const pctEl = slider.closest('[data-type="volume"]')?.querySelector('.menu-item-desc');
        if (pctEl) pctEl.textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
      });
      slider.addEventListener('change', () => render());
    }
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

  function toggleSound() {
    soundManager.setEnabled(!soundManager.isEnabled());
    if (soundManager.isEnabled()) soundManager.playKeypress();
    render();
  }

  const component = {
    id: 'settings',
    handleKeydown(e) {
      // Ne pas interférer si le slider a le focus
      if (document.activeElement?.id === 'volume-slider') return false;

      if (e.key === 'Escape') { e.preventDefault(); router.pop(); return true; }
      if (e.key === 'c' || e.key === 'C') { toggleCrt(); return true; }
      if (e.key === 's' || e.key === 'S') { toggleSound(); return true; }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = SECTIONS.indexOf(focusedSection);
        if (focusedSection === 'palette' && focusedPalette > 0) {
          focusedPalette--;
        } else if (focusedSection === 'palette') {
          // déjà en haut
        } else {
          focusedSection = SECTIONS[Math.max(0, idx - 1)];
          if (focusedSection === 'palette') focusedPalette = PALETTES.length - 1;
        }
        render();
        return true;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (focusedSection === 'palette' && focusedPalette < PALETTES.length - 1) {
          focusedPalette++;
        } else {
          const idx = SECTIONS.indexOf(focusedSection);
          focusedSection = SECTIONS[Math.min(SECTIONS.length - 1, idx + 1)];
        }
        render();
        return true;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedSection === 'palette') setPalette(PALETTES[focusedPalette].name);
        else if (focusedSection === 'crt') toggleCrt();
        else if (focusedSection === 'sound') toggleSound();
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
