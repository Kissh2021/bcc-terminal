import { commandDispatcher } from './commandDispatcher.js';
import { outputRenderer } from './outputRenderer.js';
import { session } from './session.js';
import { vfs } from './vfs.js';
import { focusManager } from './focusManager.js';
import { router } from './router.js';
import { soundManager } from './soundManager.js';

const HISTORY_MAX = 100;

let inputEl = null;
let historyIndex = -1;
const history = [];
let locked = false;

function addToHistory(cmd) {
  if (!cmd.trim()) return;
  if (history[0] === cmd) return; // no duplicate consecutive
  history.unshift(cmd);
  if (history.length > HISTORY_MAX) history.pop();
  historyIndex = -1;
}

export const terminal = {
  init(inputElement) {
    inputEl = inputElement;

    inputEl.addEventListener('keydown', async (e) => {
      if (locked) { e.preventDefault(); return; }

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        const input = inputEl.value.trim();
        inputEl.value = '';
        historyIndex = -1;
        if (!input) return;

        soundManager.playConfirm();
        addToHistory(input);

        // Switch to terminal output view FIRST (await so outputEl is ready)
        if (router.current() !== 'terminal-output') {
          await router.push('terminal-output');
        }

        // Echo the input (après navigation, outputEl est le bon)
        outputRenderer.printLine(`> ${input}`, 'prompt');

        await commandDispatcher.dispatch(input, {
          outputRenderer,
          session,
          vfs,
          router,
          terminal: this,
        });

        // Refocus input after async command completes,
        // but not if an overlay (doc-viewer) grabbed focusManager in the meantime
        if (inputEl && !locked && !document.getElementById('doc-viewer-overlay')) {
          inputEl.focus();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (history.length === 0) return;
        historyIndex = Math.min(historyIndex + 1, history.length - 1);
        inputEl.value = history[historyIndex];
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex <= 0) {
          historyIndex = -1;
          inputEl.value = '';
        } else {
          historyIndex--;
          inputEl.value = history[historyIndex];
        }
      }
    });
  },

  lock() {
    locked = true;
    if (inputEl) inputEl.disabled = true;
  },

  unlock() {
    locked = false;
    if (inputEl) {
      inputEl.disabled = false;
    }
  },

  focus() {
    if (inputEl && !locked) inputEl.focus();
  },
};
