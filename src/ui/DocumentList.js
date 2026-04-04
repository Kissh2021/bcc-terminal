import { vfs } from '../core/vfs.js';
import { session } from '../core/session.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';

export function mountDocumentList(container) {
  // Find all accessible files recursively
  const allFiles = [];
  collectFiles('/', allFiles);

  let focusedIdx = 0;
  const el = document.createElement('div');
  el.className = 'menu-view';

  function collectFiles(path, result) {
    const listing = vfs.ls(path);
    if (listing.error) return;
    for (const entry of listing.entries) {
      const fullPath = (path === '/' ? '' : path) + '/' + entry.name;
      if (entry.type === 'file') {
        result.push({ name: entry.name, path: fullPath, restricted: entry.restricted });
      } else if (entry.type === 'dir' && !entry.restricted) {
        collectFiles(fullPath, result);
      }
    }
  }

  function render() {
    if (allFiles.length === 0) {
      el.innerHTML = `
        <div class="menu-title">ARCHIVES</div>
        <div class="menu-item"><span class="menu-item-label" style="opacity:0.5">Aucun document accessible</span></div>
        <div class="menu-hint">ESC RETOUR</div>
      `;
      container.appendChild(el);
      return;
    }

    el.innerHTML = `
      <div class="menu-title">ARCHIVES — ${allFiles.length} DOCUMENT(S)</div>
      ${allFiles.map((f, i) => `
        <div class="menu-item${i === focusedIdx ? ' focused' : ''}${f.restricted ? ' restricted' : ''}"
             data-idx="${i}">
          <span class="menu-item-key">${f.restricted ? '[■]' : '[ ]'}</span>
          <span class="menu-item-label">${f.name}</span>
          <span class="menu-item-desc">${f.path}</span>
        </div>
      `).join('')}
      <div class="menu-hint">↑↓ NAVIGUER &nbsp;·&nbsp; ENTRÉE OUVRIR &nbsp;·&nbsp; ESC RETOUR</div>
    `;

    el.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => {
        const idx = parseInt(item.dataset.idx);
        openFile(idx);
      });
    });
  }

  function openFile(idx) {
    const file = allFiles[idx];
    if (!file) return;
    if (file.restricted) {
      document.dispatchEvent(new CustomEvent('bcc:terminal-message', {
        detail: { text: 'ACCÈS REFUSÉ — NIVEAU DE CLEARANCE INSUFFISANT', cssClass: 'error' },
      }));
      return;
    }
    const result = vfs.cat(file.path);
    if (result.error) {
      document.dispatchEvent(new CustomEvent('bcc:terminal-message', {
        detail: { text: result.error, cssClass: 'error' },
      }));
      return;
    }
    if (result.isMarkdown) {
      document.dispatchEvent(new CustomEvent('bcc:open-viewer', {
        detail: { content: result.content, name: result.name },
      }));
    } else {
      router.push('terminal-output');
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('bcc:print-lines', {
          detail: {
            lines: [
              { text: '─'.repeat(48), cssClass: 'separator' },
              ...result.content.split('\n').map(t => ({ text: t, cssClass: '' })),
              { text: '─'.repeat(48), cssClass: 'separator' },
            ],
          },
        }));
      }, 250);
    }
  }

  const component = {
    id: 'document-list',
    handleKeydown(e) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusedIdx = Math.max(0, focusedIdx - 1);
        render();
        return true;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusedIdx = Math.min(allFiles.length - 1, focusedIdx + 1);
        render();
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        openFile(focusedIdx);
        return true;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        router.pop();
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
