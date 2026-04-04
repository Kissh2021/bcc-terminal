import { terminal } from '../core/terminal.js';
import { focusManager } from '../core/focusManager.js';
import { outputRenderer } from '../core/outputRenderer.js';
import { soundManager } from '../core/soundManager.js';

export function mountTerminalBar(el) {
  el.innerHTML = `
    <span class="terminal-prompt-label">BCC &gt;</span>
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

  function claimFocus() {
    focusManager.claim({
      id: 'terminal-bar',
      handleKeydown: () => false, // terminal handles its own keydown
      focus: () => inputEl.focus(),
    });
  }
}
