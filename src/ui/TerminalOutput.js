import { outputRenderer } from '../core/outputRenderer.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';

export function mountTerminalOutput(container) {
  const el = document.createElement('div');
  el.id = 'terminal-output-view';
  container.appendChild(el);

  outputRenderer.init(el);

  const component = {
    id: 'terminal-output',
    handleKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        router.pop();
        return true;
      }
      return false;
    },
    focus() {
      el.focus();
    },
  };

  focusManager.claim(component);
}
