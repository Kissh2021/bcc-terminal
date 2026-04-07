import { terminal } from '../core/terminal.js';
import { focusManager } from '../core/focusManager.js';
import { outputRenderer } from '../core/outputRenderer.js';
import { soundManager } from '../core/soundManager.js';
import { showSplashScreen } from '../boot/bootSequence.js';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { checkUpdate, performUpdate } from '../utils/updater.js';

export function mountTerminalBar(el) {
  el.innerHTML = `
    <button id="start-btn" title="Menu système">◈ BCC</button>
    <input
      id="terminal-input"
      type="text"
      autocomplete="off"
      autocorrect="off"
      autocapitalize="off"
      spellcheck="false"
      placeholder="entrer une commande..."
    />
  `;

  const inputEl = el.querySelector('#terminal-input');
  terminal.init(inputEl);

  // Focus terminal on global event
  document.addEventListener('bcc:focus-terminal', () => {
    inputEl.focus();
    claimFocus();
  });

  // Tab key: toggle focus
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (document.activeElement === inputEl) {
        inputEl.blur();
        focusManager.release();
      } else {
        inputEl.focus();
        claimFocus();
      }
    }
  });

  inputEl.addEventListener('focus', claimFocus);

  // Son à chaque frappe de caractère (pas sur les touches de contrôle)
  inputEl.addEventListener('keydown', (e) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      soundManager.playKeypress();
    }
  });

  // Listen for print events (from DocumentList)
  document.addEventListener('bcc:print-lines', (e) => {
    for (const { text, cssClass } of e.detail.lines) {
      outputRenderer.printLine(text, cssClass);
    }
  });

  // ── Start menu ────────────────────────────────────────────────────────────
  const startBtn = el.querySelector('#start-btn');
  let menuEl = null;

  function openStartMenu() {
    if (menuEl) { closeStartMenu(); return; }

    soundManager.playNavigate();

    menuEl = document.createElement('div');
    menuEl.id = 'start-menu';
    menuEl.innerHTML = `
      <div class="start-menu-item" data-action="veille">
        <span class="start-menu-icon">◌</span> VEILLE
      </div>
      <div class="start-menu-item" data-action="updates">
        <span class="start-menu-icon">⬆</span> MISES À JOUR
      </div>
      <div class="start-menu-sep"></div>
      <div class="start-menu-item start-menu-item--danger" data-action="eteindre">
        <span class="start-menu-icon">⏻</span> ÉTEINDRE
      </div>
    `;

    // Position above the start button
    const rect = startBtn.getBoundingClientRect();
    menuEl.style.left = `${rect.left}px`;
    document.body.appendChild(menuEl);

    menuEl.querySelectorAll('.start-menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const action = item.dataset.action;
        closeStartMenu();
        if (action === 'veille') {
          showSplashScreen();
        } else if (action === 'updates') {
          runUpdateCheck(startBtn);
        } else if (action === 'eteindre') {
          getCurrentWindow().close();
        }
      });
    });

    // Close on outside click (next tick to avoid self-trigger)
    setTimeout(() => {
      document.addEventListener('click', closeOnOutside, { once: true });
    }, 0);
  }

  function closeStartMenu() {
    if (!menuEl) return;
    menuEl.classList.add('start-menu--out');
    setTimeout(() => { menuEl?.remove(); menuEl = null; }, 150);
    document.removeEventListener('click', closeOnOutside);
  }

  function closeOnOutside(e) {
    if (menuEl && !menuEl.contains(e.target) && e.target !== startBtn) {
      closeStartMenu();
    } else if (menuEl) {
      // Re-arm if the click was inside the menu (but not on an item)
      setTimeout(() => {
        document.addEventListener('click', closeOnOutside, { once: true });
      }, 0);
    }
  }

  startBtn.addEventListener('click', openStartMenu);

  // Escape key closes the menu
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuEl) { e.preventDefault(); closeStartMenu(); }
  });

  // ── Toast système (au-dessus du bouton démarrer) ─────────────────────────
  let toastEl = null;

  function showToast(html) {
    if (toastEl) toastEl.remove();
    toastEl = document.createElement('div');
    toastEl.className = 'start-toast';
    toastEl.innerHTML = html;
    const rect = startBtn.getBoundingClientRect();
    toastEl.style.left = `${rect.left}px`;
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function hideToast(delay = 0) {
    if (!toastEl) return;
    const t = toastEl;
    setTimeout(() => {
      t.classList.add('start-toast--out');
      setTimeout(() => t.remove(), 300);
    }, delay);
    toastEl = null;
  }

  async function runUpdateCheck() {
    showToast('<span class="start-toast-icon">⟳</span> VÉRIFICATION…');

    const update = await checkUpdate();

    if (!update) {
      showToast('<span class="start-toast-icon">✓</span> APPLICATION À JOUR');
      hideToast(2000);
      return;
    }

    // Mise à jour disponible — proposer l'installation
    const t = showToast(`
      <div class="start-toast-update">
        <span class="start-toast-icon">⬆</span>
        <span>v${update.version} DISPONIBLE</span>
        <button class="start-toast-btn" id="toast-install-btn">INSTALLER</button>
      </div>
    `);

    t.querySelector('#toast-install-btn').addEventListener('click', async () => {
      t.querySelector('#toast-install-btn').remove();
      const statusEl = t.querySelector('span:last-of-type');
      statusEl.textContent = 'TÉLÉCHARGEMENT…';
      try {
        await performUpdate(update, (pct) => {
          statusEl.textContent = `INSTALLATION… ${pct}%`;
        });
      } catch (err) {
        statusEl.textContent = `ERREUR — ${err?.message ?? err}`;
        hideToast(3000);
      }
    });
  }

  function claimFocus() {
    focusManager.claim({
      id: 'terminal-bar',
      handleKeydown: () => false, // terminal handles its own keydown
      focus: () => inputEl.focus(),
    });
  }
}
