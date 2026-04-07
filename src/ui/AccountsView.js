import { invoke }       from '@tauri-apps/api/core';
import { focusManager } from '../core/focusManager.js';
import { router }       from '../core/router.js';
import { soundManager } from '../core/soundManager.js';
import { session }      from '../core/session.js';
import { showGithubLoader, updateGithubLoader, hideGithubLoader } from './GithubLoader.js';
import {
  fetchUsersIndex,
  createGithubUser,
  updateGithubUser,
  deleteGithubUser,
  getAdminToken,
  setAdminToken,
  clearAdminToken,
} from '../utils/githubUsers.js';

const GROUPS = ['public', 'agent', 'directeur', 'admin'];

function canAccess() {
  return session.currentUser()?.group === 'admin';
}

// ── Mount ──────────────────────────────────────────────────────────────────

export function mountAccountsView(container) {
  const view = document.createElement('div');
  view.className = 'doc-import-view';
  container.appendChild(view);

  let editingUser = null; // null = création, objet = édition
  let formVisible = false;

  // ── Accès refusé ───────────────────────────────────────────────────────────

  if (!canAccess()) {
    view.innerHTML = `
      <div class="di-title">GESTION DES <span>COMPTES</span></div>
      <div class="di-feedback error" style="margin-top:24px">
        ACCÈS REFUSÉ — NIVEAU ADMIN REQUIS
      </div>
      <div class="di-hint">ÉCHAP — RETOUR</div>
    `;
    mountFocusManager();
    return;
  }

  // ── Token setup ────────────────────────────────────────────────────────────

  function renderTokenSetup() {
    view.innerHTML = `
      <div class="di-title">CONFIGURER L'ACCÈS <span>ADMIN</span></div>
      <div class="di-form">
        <div class="di-field">
          <label class="di-label">Token GitHub Admin (accès écriture sur bcc-docs)</label>
          <input class="di-input" id="av-token" type="password"
            placeholder="github_pat_…" spellcheck="false" autocomplete="off" />
        </div>
        <div class="di-feedback" id="av-token-fb"></div>
        <button class="di-submit" id="av-token-submit">VALIDER LE TOKEN</button>
      </div>
      <div class="di-hint">ÉCHAP — RETOUR</div>
    `;

    view.querySelector('#av-token').focus();

    view.querySelector('#av-token-submit').addEventListener('click', async () => {
      const token = view.querySelector('#av-token').value.trim();
      if (!token) return;
      const fb = view.querySelector('#av-token-fb');
      fb.textContent = 'Vérification…';
      fb.className   = 'di-feedback';
      try {
        const res = await fetch(`https://api.github.com/repos/kissh2021/bcc-docs`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept':        'application/vnd.github+json',
          },
        });
        if (!res.ok) throw new Error('Token invalide ou accès refusé.');
        setAdminToken(token);
        soundManager.playConfirm?.();
        await renderMain();
      } catch (err) {
        fb.textContent = err.message;
        fb.className   = 'di-feedback error';
      }
    });
  }

  // ── Vue principale ─────────────────────────────────────────────────────────

  async function renderMain(feedback = null) {
    const adminToken = getAdminToken();
    let users = [];
    let fetchError = null;

    try {
      users = await fetchUsersIndex(adminToken);
    } catch (err) {
      fetchError = err.message;
    }

    const currentId = session.currentUser()?.id;

    view.innerHTML = `
      <div class="di-title">GESTION DES <span>COMPTES</span></div>

      ${fetchError ? `<div class="di-feedback error">${fetchError}</div>` : ''}

      <div class="di-form" id="av-form" style="display:${formVisible ? 'block' : 'none'}">
        <div class="di-field">
          <label class="di-label">${editingUser ? 'Identifiant' : 'Nouvel identifiant'}</label>
          <input class="di-input" id="av-username" type="text"
            value="${editingUser?.username ?? ''}"
            ${editingUser ? 'readonly style="opacity:0.6"' : ''}
            spellcheck="false" autocomplete="off" placeholder="nom_utilisateur" />
        </div>
        <div class="di-field">
          <label class="di-label">Groupe</label>
          <select class="di-select" id="av-group">
            ${GROUPS.map(g => `
              <option value="${g}" ${(editingUser?.group ?? 'agent') === g ? 'selected' : ''}>
                ${g.toUpperCase()}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="di-field">
          <label class="di-label">
            ${editingUser ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe initial'}
          </label>
          <input class="di-input" id="av-password" type="password"
            placeholder="${editingUser ? '(inchangé)' : 'mot de passe'}"
            autocomplete="new-password" />
        </div>
        <div class="di-feedback ${feedback?.type ?? ''}" id="av-feedback">
          ${feedback?.message ?? ''}
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="di-submit" id="av-submit">
            ${editingUser ? '✎ ENREGISTRER' : '+ CRÉER'}
          </button>
          <button class="di-submit" id="av-cancel"
            style="border-color:var(--color-border)">ANNULER</button>
          <button class="di-submit" id="av-token-clear"
            style="margin-left:auto;font-size:9px;opacity:0.5;border-color:var(--color-border)">
            ⎋ DÉCONNECTER TOKEN
          </button>
        </div>
      </div>

      ${!formVisible ? `
        <div style="margin-bottom:16px">
          <button class="di-submit" id="av-new">+ NOUVEL UTILISATEUR</button>
          <button class="di-submit" id="av-token-clear2"
            style="margin-left:10px;font-size:9px;opacity:0.4;border-color:var(--color-border)">
            ⎋ DÉCONNECTER TOKEN
          </button>
        </div>
      ` : ''}

      <div class="di-list-section">
        <div class="di-list-title">Utilisateurs (${users.length})</div>
        ${users.length === 0 && !fetchError
          ? `<div style="opacity:0.4;font-size:11px;padding:8px">Aucun utilisateur dans _users.json.</div>`
          : users.map(u => `
              <div class="di-doc-item" data-id="${u.id}">
                <span class="di-doc-name">${u.username}</span>
                <span class="di-doc-meta">${u.group.toUpperCase()}</span>
                <button class="di-doc-edit av-edit-btn" data-id="${u.id}">✎</button>
                ${u.id !== currentId
                  ? `<button class="di-doc-del av-del-btn" data-id="${u.id}">✕</button>`
                  : `<span style="opacity:0.3;font-size:10px;padding:0 6px">VOUS</span>`
                }
              </div>
            `).join('')
        }
      </div>

      <div class="di-hint">ÉCHAP — RETOUR &nbsp;·&nbsp; Modifications appliquées sur GitHub.</div>
    `;

    bindEvents(users, adminToken);
  }

  // ── Liaisons événements ────────────────────────────────────────────────────

  function bindEvents(users, adminToken) {
    view.querySelector('#av-new')?.addEventListener('click', () => {
      editingUser = null;
      formVisible = true;
      renderMain();
    });

    const cancelForm = () => {
      editingUser = null;
      formVisible = false;
      renderMain();
    };

    view.querySelector('#av-cancel')?.addEventListener('click', cancelForm);

    const disconnectToken = () => {
      clearAdminToken();
      editingUser = null;
      formVisible = false;
      renderTokenSetup();
    };
    view.querySelector('#av-token-clear')?.addEventListener('click', disconnectToken);
    view.querySelector('#av-token-clear2')?.addEventListener('click', disconnectToken);

    // Soumission création / édition
    view.querySelector('#av-submit')?.addEventListener('click', async () => {
      const username = view.querySelector('#av-username').value.trim();
      const group    = view.querySelector('#av-group').value;
      const password = view.querySelector('#av-password').value;

      const setFeedback = (type, msg) => {
        const fb = view.querySelector('#av-feedback');
        if (fb) { fb.className = `di-feedback ${type}`; fb.textContent = msg; }
      };

      if (!editingUser && !username) { setFeedback('error', 'Identifiant requis.'); return; }
      if (!editingUser && !password) { setFeedback('error', 'Mot de passe requis.'); return; }

      setFeedback('', editingUser ? 'Enregistrement…' : 'Création…');
      showGithubLoader(editingUser ? 'ENREGISTREMENT…' : 'CRÉATION…');

      try {
        if (editingUser) {
          const editedUsername = editingUser.username;
          const changes = { group };
          if (password) {
            changes.passwordHash = await invoke('hash_password', { password });
          }
          await updateGithubUser(editingUser.id, changes, adminToken);
          soundManager.playConfirm?.();
          updateGithubLoader('ENREGISTRÉ');
          await new Promise(r => setTimeout(r, 400));
          hideGithubLoader();
          editingUser = null;
          formVisible = false;
          renderMain({ type: 'ok', message: `"${editedUsername}" mis à jour.` });
        } else {
          const passwordHash = await invoke('hash_password', { password });
          const created = await createGithubUser({ username, passwordHash, group }, adminToken);
          soundManager.playConfirm?.();
          updateGithubLoader('CRÉÉ');
          await new Promise(r => setTimeout(r, 400));
          hideGithubLoader();
          formVisible = false;
          renderMain({ type: 'ok', message: `"${created.username}" créé avec succès.` });
        }
      } catch (err) {
        soundManager.playError?.();
        hideGithubLoader();
        setFeedback('error', err.message);
      }
    });

    // Boutons édition dans la liste
    view.querySelectorAll('.av-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const user = users.find(u => u.id === btn.dataset.id);
        if (!user) return;
        editingUser = user;
        formVisible = true;
        renderMain();
      });
    });

    // Boutons suppression dans la liste
    view.querySelectorAll('.av-del-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const user = users.find(u => u.id === btn.dataset.id);
        if (!user) return;
        showGithubLoader('SUPPRESSION…');
        try {
          await deleteGithubUser(user.id, adminToken);
          soundManager.playConfirm?.();
          if (editingUser?.id === user.id) { editingUser = null; formVisible = false; }
          updateGithubLoader('SUPPRIMÉ');
          await new Promise(r => setTimeout(r, 400));
          hideGithubLoader();
          renderMain({ type: 'ok', message: `"${user.username}" supprimé.` });
        } catch (err) {
          updateGithubLoader(`ERREUR : ${err.message}`);
          await new Promise(r => setTimeout(r, 1200));
          hideGithubLoader();
        }
      });
    });
  }

  // ── FocusManager ──────────────────────────────────────────────────────────

  function mountFocusManager() {
    const component = {
      id: 'accounts',
      handleKeydown(e) {
        if (e.key === 'Escape') {
          const active = document.activeElement;
          if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
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

  // ── Rendu initial ──────────────────────────────────────────────────────────

  if (getAdminToken()) {
    renderMain();
  } else {
    renderTokenSetup();
  }
}
