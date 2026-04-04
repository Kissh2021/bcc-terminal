import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { focusManager } from '../core/focusManager.js';
import { soundManager } from '../core/soundManager.js';

marked.setOptions({ breaks: true });

let overlayEl = null;

export function openDocumentViewer(content, name) {
  if (overlayEl) closeDocumentViewer();

  soundManager.playOpen();

  overlayEl = document.createElement('div');
  overlayEl.id = 'doc-viewer-overlay';
  overlayEl.innerHTML = `
    <div class="doc-viewer-window">
      <div class="doc-viewer-header">
        <span class="doc-viewer-title">${name.toUpperCase()}</span>
        <button class="doc-viewer-close" title="Fermer (\u00c9chap)">\u2715</button>
      </div>
      <div class="doc-viewer-body">
        <div class="doc-content"></div>
      </div>
    </div>
  `;

  const html = DOMPurify.sanitize(marked.parse(content));
  overlayEl.querySelector('.doc-content').innerHTML = html;

  overlayEl.querySelector('.doc-viewer-close').addEventListener('click', closeDocumentViewer);

  // Fermeture au clic sur le backdrop
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closeDocumentViewer();
  });

  // Son de scroll uniquement dans le viewer
  const body = overlayEl.querySelector('.doc-viewer-body');
  body.addEventListener('wheel', () => soundManager.playScroll(), { passive: true });

  document.getElementById('app').appendChild(overlayEl);

  const component = {
    id: 'doc-viewer',
    handleKeydown(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDocumentViewer();
        return true;
      }
      return false;
    },
    focus() {},
  };
  focusManager.claim(component);
}

export function closeDocumentViewer() {
  if (!overlayEl) return;
  soundManager.playClose();
  overlayEl.classList.add('closing');
  setTimeout(() => {
    overlayEl?.remove();
    overlayEl = null;
    focusManager.release();
  }, 200);
}
