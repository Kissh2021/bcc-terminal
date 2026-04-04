import { vfs }            from '../core/vfs.js';
import { session }        from '../core/session.js';
import { focusManager }   from '../core/focusManager.js';
import { router }         from '../core/router.js';
import { soundManager }   from '../core/soundManager.js';
import { resolveContent, getCachedIndex, deleteGithubDoc, ejectSingleGithubDoc, injectGithubDocs } from '../utils/githubDocs.js';
import { setEditDoc }     from '../utils/docImportState.js';
import { showGithubLoader, updateGithubLoader, hideGithubLoader } from '../ui/GithubLoader.js';

export async function mountDocumentList(container) {
  showGithubLoader('RÉCUPÉRATION DES DOCUMENTS…');
  await Promise.allSettled([injectGithubDocs(), new Promise(r => setTimeout(r, 700))]);
  hideGithubLoader();

  const allFiles = [];
  collectFiles('/', allFiles);

  const canManage = session.hasGroup('directeur');
  let focusedIdx  = 0;
  const el        = document.createElement('div');
  el.className    = 'menu-view';

  function collectFiles(path, result) {
    const listing = vfs.ls(path);
    if (listing.error) return;
    for (const entry of listing.entries) {
      const fullPath = (path === '/' ? '' : path) + '/' + entry.name;
      if (entry.type === 'file') {
        result.push({
          name:       entry.name,
          path:       fullPath,
          restricted: entry.restricted,
          githubDoc:  entry.githubDoc,
          githubPath: entry.githubPath,
        });
      } else if (entry.type === 'dir' && !entry.restricted) {
        collectFiles(fullPath, result);
      }
    }
  }

  function render() {
    if (allFiles.length === 0) {
      el.innerHTML = `
        <div class="menu-title">ARCHIVES</div>
        <div class="menu-item">
          <span class="menu-item-label" style="opacity:0.5">Aucun document accessible</span>
        </div>
        <div class="menu-hint">ESC RETOUR</div>
      `;
      container.appendChild(el);
      return;
    }

    el.innerHTML = `
      <div class="menu-title">ARCHIVES — ${allFiles.length} DOCUMENT(S)</div>
      ${allFiles.map((f, i) => `
        <div class="menu-item${i === focusedIdx ? ' focused' : ''}${f.restricted ? ' restricted' : ''}"
             data-idx="${i}" style="gap:8px">
          <span class="menu-item-key">${f.restricted ? '[■]' : '[ ]'}</span>
          <span class="menu-item-label" style="flex:1">${f.name}</span>
          <span class="menu-item-desc">${f.path}</span>
          ${canManage && f.githubDoc && !f.restricted ? `
            <button class="doc-action-btn doc-edit-btn" data-idx="${i}" title="Modifier">✎</button>
            <button class="doc-action-btn doc-del-btn"  data-idx="${i}" title="Supprimer">✕</button>
          ` : ''}
        </div>
      `).join('')}
      <div class="menu-hint">↑↓ NAVIGUER &nbsp;·&nbsp; ENTRÉE OUVRIR &nbsp;·&nbsp; ESC RETOUR</div>
    `;

    el.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('doc-action-btn')) return;
        openFile(parseInt(item.dataset.idx));
      });
    });

    el.querySelectorAll('.doc-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const file  = allFiles[parseInt(btn.dataset.idx)];
        const index = getCachedIndex();
        const doc   = index.find(d => d.githubPath === file.githubPath);
        if (!doc) return;
        setEditDoc(doc);
        soundManager.playNavigate();
        router.push('doc-import');
      });
    });

    el.querySelectorAll('.doc-del-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const file  = allFiles[parseInt(btn.dataset.idx)];
        const index = getCachedIndex();
        const doc   = index.find(d => d.githubPath === file.githubPath);
        if (!doc) return;

        const adminToken = (await import('../utils/githubDocs.js')).getAdminToken();
        if (!adminToken) {
          alert('Token admin requis. Ouvre d\'abord la vue IMPORTER pour configurer ton accès.');
          return;
        }

        showGithubLoader('SUPPRESSION…');
        const result = await deleteGithubDoc(doc, adminToken);
        if (result.ok) {
          ejectSingleGithubDoc(doc);
          allFiles.splice(parseInt(btn.dataset.idx), 1);
          if (focusedIdx >= allFiles.length) focusedIdx = Math.max(0, allFiles.length - 1);
          updateGithubLoader('SUPPRIMÉ');
          await new Promise(r => setTimeout(r, 500));
        } else {
          updateGithubLoader(`ERREUR : ${result.error}`);
          await new Promise(r => setTimeout(r, 1200));
        }
        hideGithubLoader();
        render();
      });
    });
  }

  async function openFile(idx) {
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

    // Loader si contenu distant
    const isRemote = typeof result.content === 'string' && result.content.startsWith('__GITHUB__:');
    let content;
    if (isRemote) {
      showGithubLoader('CHARGEMENT…');
      const [resolved] = await Promise.allSettled([
        resolveContent(result.content),
        new Promise(r => setTimeout(r, 400)), // minimum 400ms
      ]);
      if (resolved.status === 'rejected') {
        hideGithubLoader();
        document.dispatchEvent(new CustomEvent('bcc:terminal-message', {
          detail: { text: `ERREUR CHARGEMENT : ${resolved.reason?.message}`, cssClass: 'error' },
        }));
        return;
      }
      content = resolved.value;
      hideGithubLoader();
    } else {
      try {
        content = await resolveContent(result.content);
      } catch (err) {
        document.dispatchEvent(new CustomEvent('bcc:terminal-message', {
          detail: { text: `ERREUR CHARGEMENT : ${err.message}`, cssClass: 'error' },
        }));
        return;
      }
    }

    if (result.isMarkdown) {
      document.dispatchEvent(new CustomEvent('bcc:open-viewer', {
        detail: { content, name: result.name },
      }));
    } else {
      soundManager.playOpen();
      soundManager.playNavigate();
      router.push('terminal-output');
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent('bcc:print-lines', {
          detail: {
            lines: [
              { text: '─'.repeat(48), cssClass: 'separator' },
              ...content.split('\n').map(t => ({ text: t, cssClass: '' })),
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
        soundManager.playBack();
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
