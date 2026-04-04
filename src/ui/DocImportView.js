import { focusManager }             from '../core/focusManager.js';
import { router }                   from '../core/router.js';
import { soundManager }             from '../core/soundManager.js';
import { session }                  from '../core/session.js';
import { getEditDoc, clearEditDoc } from '../utils/docImportState.js';
import {
  fetchIndex,
  fetchDocContent,
  createGithubDoc,
  deleteGithubDoc,
  injectSingleGithubDoc,
  ejectSingleGithubDoc,
  getAdminToken,
  setAdminToken,
  clearAdminToken,
} from '../utils/githubDocs.js';
import { ACCESS_OPTIONS } from '../utils/customDocs.js';

// ── Dossiers cibles ────────────────────────────────────────────────────────

const FOLDERS = [
  { value: 'home',     label: '/home' },
  { value: 'archives', label: '/archives' },
];

// ── Vérification accès ─────────────────────────────────────────────────────

function canAccess() {
  const user = session.currentUser();
  return user && (user.group === 'admin' || user.group === 'directeur');
}

// ── Mount ──────────────────────────────────────────────────────────────────

export function mountDocImportView(container) {
  const view = document.createElement('div');
  view.className = 'doc-import-view';
  container.appendChild(view);

  // État édition — peut être pré-rempli depuis DocumentList
  let editingDoc  = getEditDoc() ?? null;
  let editContent = '';
  clearEditDoc();

  // ── Accès refusé ─────────────────────────────────────────────────────────

  if (!canAccess()) {
    view.innerHTML = `
      <div class="di-title">IMPORTER UN <span>DOCUMENT</span></div>
      <div class="di-feedback error" style="margin-top:24px">
        ACCÈS REFUSÉ — NIVEAU DE CLEARANCE INSUFFISANT
      </div>
      <div class="di-hint">ÉCHAP — RETOUR</div>
    `;
    mountFocusManager();
    return;
  }

  // ── Token setup ───────────────────────────────────────────────────────────

  function renderTokenSetup() {
    view.innerHTML = `
      <div class="di-title">CONFIGURER L'ACCÈS <span>ADMIN</span></div>
      <div class="di-form" id="di-form">
        <div class="di-field">
          <label class="di-label">Token GitHub Admin</label>
          <input
            class="di-input"
            id="di-token-input"
            type="password"
            placeholder="github_pat_..."
            spellcheck="false"
            autocomplete="off"
          />
        </div>
        <div class="di-feedback" id="di-feedback"></div>
        <button class="di-submit" id="di-token-submit">VALIDER</button>
      </div>
      <div class="di-hint">Ce token est stocké localement dans ton navigateur uniquement.</div>
    `;

    view.querySelector('#di-token-submit').addEventListener('click', async () => {
      const token = view.querySelector('#di-token-input').value.trim();
      if (!token) return;
      const fb = view.querySelector('#di-feedback');
      fb.textContent = 'Vérification…';
      fb.className = 'di-feedback';
      try {
        const res = await fetch(`https://api.github.com/repos/kissh2021/bcc-docs`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error('Token invalide ou accès refusé.');
        setAdminToken(token);
        soundManager.playLogin?.();
        renderMain();
      } catch (err) {
        fb.textContent = err.message;
        fb.className = 'di-feedback error';
      }
    });
  }

  // ── Vue principale ────────────────────────────────────────────────────────

  async function renderMain(feedback = null) {
    const adminToken = getAdminToken();
    const index      = await fetchIndex().catch(() => []);

    // Pré-remplir le contenu si on édite
    let prefillContent = '';
    if (editingDoc) {
      try {
        prefillContent = editContent || await fetchDocContent(editingDoc.githubPath);
        editContent = prefillContent;
      } catch { prefillContent = ''; }
    }

    view.innerHTML = `
      <div class="di-title">${editingDoc ? 'MODIFIER UN' : 'IMPORTER UN'} <span>DOCUMENT</span></div>

      <div class="di-form" id="di-form">

        <div class="di-field">
          <label class="di-label">Nom du fichier</label>
          <input
            class="di-input"
            id="di-filename"
            type="text"
            placeholder="ex : rapport-alpha.md"
            value="${editingDoc?.filename ?? ''}"
            spellcheck="false"
            autocomplete="off"
          />
        </div>

        <div class="di-row">
          <div class="di-field">
            <label class="di-label">Dossier cible</label>
            <select class="di-select" id="di-folder">
              ${FOLDERS.map(f => `
                <option value="${f.value}" ${editingDoc?.folder === f.value ? 'selected' : ''}>${f.label}</option>
              `).join('')}
            </select>
          </div>
          <div class="di-field">
            <label class="di-label">Niveau d'accès</label>
            <select class="di-select" id="di-access">
              ${ACCESS_OPTIONS.map(a => `
                <option value="${a.value}" ${editingDoc?.accessKey === a.value ? 'selected' : ''}>${a.label}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <div class="di-field">
          <label class="di-label">Format</label>
          <select class="di-select" id="di-format">
            <option value="md"  ${editingDoc?.isMarkdown !== false ? 'selected' : ''}>Markdown</option>
            <option value="txt" ${editingDoc?.isMarkdown === false  ? 'selected' : ''}>Texte brut</option>
          </select>
        </div>

        <div class="di-field">
          <label class="di-label">Contenu</label>
          <textarea
            class="di-textarea"
            id="di-content"
            placeholder="Écris le contenu ici…"
            spellcheck="false"
          >${prefillContent}</textarea>
        </div>

        <div class="di-feedback ${feedback?.type ?? ''}" id="di-feedback">
          ${feedback?.message ?? ''}
        </div>

        <div style="display:flex;gap:10px;align-items:center">
          <button class="di-submit" id="di-submit">
            ${editingDoc ? '✎ ENREGISTRER' : '+ AJOUTER'}
          </button>
          ${editingDoc ? `<button class="di-submit" id="di-cancel" style="border-color:var(--color-border)">ANNULER</button>` : ''}
          <button class="di-submit" id="di-token-clear"
            style="margin-left:auto;font-size:9px;opacity:0.5;border-color:var(--color-border)">
            ⎋ DÉCONNECTER TOKEN
          </button>
        </div>
      </div>

      <div class="di-list-section">
        <div class="di-list-title">Documents GitHub (${index.length})</div>
        ${index.length === 0
          ? `<div class="di-empty">Aucun document importé.</div>`
          : index.map(doc => `
              <div class="di-doc-item" data-id="${doc.id}">
                <span class="di-doc-name">${doc.filename}</span>
                <span class="di-doc-meta">/${doc.folder}</span>
                <span class="di-doc-access">${ACCESS_OPTIONS.find(a => a.value === doc.accessKey)?.label ?? doc.accessKey}</span>
                <button class="di-doc-edit" data-id="${doc.id}" title="Modifier">✎</button>
                <button class="di-doc-del"  data-id="${doc.id}" title="Supprimer">✕</button>
              </div>
            `).join('')
        }
      </div>

      <div class="di-hint">ÉCHAP — RETOUR &nbsp;·&nbsp; Le document est disponible immédiatement dans les archives.</div>
    `;

    // ── Soumission ───────────────────────────────────────────────────────────

    view.querySelector('#di-submit').addEventListener('click', async () => {
      const rawName    = view.querySelector('#di-filename').value.trim();
      const folder     = view.querySelector('#di-folder').value;
      const accessKey  = view.querySelector('#di-access').value;
      const format     = view.querySelector('#di-format').value;
      const content    = view.querySelector('#di-content').value;
      const isMarkdown = format === 'md';

      if (!rawName) { setFeedback('error', 'Nom de fichier requis.'); return; }

      // Auto-extension si absente
      const ext       = isMarkdown ? '.md' : '.txt';
      const finalName = rawName.includes('.') ? rawName : rawName + ext;

      setFeedback('', 'Envoi en cours…');

      // Si on édite et que le nom ou le dossier a changé → supprimer l'ancien
      const isRename = editingDoc && (finalName !== editingDoc.filename || folder !== editingDoc.folder);
      if (isRename) {
        const delResult = await deleteGithubDoc(editingDoc, adminToken);
        if (!delResult.ok) {
          setFeedback('error', `Suppression ancienne version : ${delResult.error}`);
          return;
        }
        ejectSingleGithubDoc(editingDoc);
      }

      const result = await createGithubDoc(
        { filename: finalName, folder, accessKey, isMarkdown, content },
        adminToken
      );

      if (!result.ok) {
        soundManager.playError?.();
        renderMain({ type: 'error', message: result.error });
        return;
      }

      soundManager.playConfirm?.();
      ejectSingleGithubDoc(result.doc);
      injectSingleGithubDoc(result.doc);
      const wasEditing = editingDoc;
      editingDoc  = null;
      editContent = '';
      renderMain({ type: 'ok', message: `"${finalName}" ${wasEditing ? 'mis à jour' : 'ajouté'} dans /${folder}.` });
    });

    // ── Annuler édition ──────────────────────────────────────────────────────

    view.querySelector('#di-cancel')?.addEventListener('click', () => {
      editingDoc  = null;
      editContent = '';
      renderMain();
    });

    // ── Déconnecter token ────────────────────────────────────────────────────

    view.querySelector('#di-token-clear').addEventListener('click', () => {
      clearAdminToken();
      renderTokenSetup();
    });

    // ── Édition depuis la liste ──────────────────────────────────────────────

    view.querySelectorAll('.di-doc-edit').forEach(btn => {
      btn.addEventListener('click', async () => {
        const doc = index.find(d => d.id === btn.dataset.id);
        if (!doc) return;
        editingDoc  = doc;
        editContent = '';
        renderMain();
      });
    });

    // ── Suppression depuis la liste ──────────────────────────────────────────

    view.querySelectorAll('.di-doc-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        const doc = index.find(d => d.id === btn.dataset.id);
        if (!doc) return;
        soundManager.playBack?.();
        setFeedback('', 'Suppression…');
        const result = await deleteGithubDoc(doc, adminToken);
        if (!result.ok) {
          renderMain({ type: 'error', message: result.error });
          return;
        }
        ejectSingleGithubDoc(doc);
        if (editingDoc?.id === doc.id) { editingDoc = null; editContent = ''; }
        renderMain({ type: 'ok', message: `"${doc.filename}" supprimé.` });
      });
    });
  }

  function setFeedback(type, message) {
    const fb = view.querySelector('#di-feedback');
    if (fb) { fb.className = `di-feedback ${type}`; fb.textContent = message; }
  }

  // ── Focus manager ────────────────────────────────────────────────────────

  function mountFocusManager() {
    const component = {
      id: 'doc-import',
      handleKeydown(e) {
        if (e.key === 'Escape') {
          const active = document.activeElement;
          if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
            active.blur();
            return true;
          }
          e.preventDefault();
          soundManager.playBack();
          router.pop();
          return true;
        }
        return false;
      },
      focus() {},
    };
    focusManager.claim(component);
  }

  mountFocusManager();

  // ── Rendu initial ─────────────────────────────────────────────────────────

  if (getAdminToken()) {
    renderMain();
  } else {
    renderTokenSetup();
  }
}
