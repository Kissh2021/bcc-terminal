import { session } from '../core/session.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';
import { delay } from '../utils/typewriter.js';

export function mountLoginView(container) {
  const el = document.createElement('div');
  el.className = 'menu-view';
  el.style.alignItems = 'stretch';
  el.style.maxWidth = '480px';
  el.style.margin = '0 auto';
  el.style.width = '100%';

  const accounts = session.getSavedAccounts();

  if (accounts.length > 0) {
    renderAccountList(el, accounts);
  } else {
    renderLoginForm(el);
  }

  const component = {
    id: 'login',
    handleKeydown(e) {
      if (e.key === 'Escape') { e.preventDefault(); router.pop(); return true; }
      return false;
    },
    focus() {},
  };

  container.appendChild(el);
  focusManager.claim(component);
}

function renderAccountList(el, accounts) {
  el.innerHTML = `
    <div class="menu-title">CONNEXION — COMPTES ENREGISTRÉS</div>
    ${accounts.map((acc, i) => `
      <div class="menu-item" data-idx="${i}">
        <span class="menu-item-key">[${i + 1}]</span>
        <span class="menu-item-label">${acc.username.toUpperCase()}</span>
        <span class="menu-item-desc">${acc.group.toUpperCase()}</span>
      </div>
    `).join('')}
    <div class="menu-item" data-new>
      <span class="menu-item-key">[N]</span>
      <span class="menu-item-label">NOUVEAU COMPTE</span>
    </div>
    <div class="menu-hint">CLIQUER OU TAPER "login" DANS LE TERMINAL</div>
  `;

  accounts.forEach((acc, i) => {
    el.querySelector(`[data-idx="${i}"]`)?.addEventListener('click', () => {
      replaceWithPasswordForm(el, acc.username);
    });
  });
  el.querySelector('[data-new]')?.addEventListener('click', () => renderLoginForm(el));
}

function renderLoginForm(el) {
  el.innerHTML = `
    <div class="menu-title">CONNEXION</div>
    <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:480px">
      <label style="font-size:11px;letter-spacing:0.2em;color:var(--color-text-dim)">IDENTIFIANT</label>
      <input id="login-username" type="text" autocomplete="off" spellcheck="false"
        style="background:transparent;border:1px solid var(--color-border);color:var(--color-text);
               font-family:var(--font-mono);font-size:13px;padding:8px 12px;outline:none;
               transition:border-color 0.15s;width:100%"
        placeholder="nom d'utilisateur"
      />
      <label style="font-size:11px;letter-spacing:0.2em;color:var(--color-text-dim);margin-top:4px">MOT DE PASSE</label>
      <input id="login-password" type="password" autocomplete="off"
        style="background:transparent;border:1px solid var(--color-border);color:var(--color-text);
               font-family:var(--font-mono);font-size:13px;padding:8px 12px;outline:none;
               transition:border-color 0.15s;width:100%"
        placeholder="••••••••"
      />
      <div id="login-error" style="color:var(--color-error);font-size:11px;letter-spacing:0.1em;min-height:1.2em"></div>
      <button id="login-submit" style="margin-top:4px">CONNEXION</button>
    </div>
    <div class="menu-hint" style="margin-top:16px">ENTRÉE VALIDER &nbsp;·&nbsp; ESC ANNULER</div>
  `;

  const usernameEl = el.querySelector('#login-username');
  const passwordEl = el.querySelector('#login-password');
  const errorEl    = el.querySelector('#login-error');
  const submitBtn  = el.querySelector('#login-submit');

  usernameEl?.focus();

  const submit = async () => {
    const username = usernameEl.value.trim();
    const password = passwordEl.value;
    if (!username || !password) {
      errorEl.textContent = 'Champs requis';
      return;
    }
    errorEl.textContent = 'AUTHENTIFICATION EN COURS...';
    submitBtn.disabled = true;

    await delay(500);
    const result = await session.login(username, password);
    if (result.success) {
      document.dispatchEvent(new CustomEvent('bcc:session-changed'));
      router.replace('main-menu');
    } else {
      errorEl.textContent = `ACCÈS REFUSÉ — ${result.error}`;
      passwordEl.value = '';
      submitBtn.disabled = false;
    }
  };

  submitBtn?.addEventListener('click', submit);
  [usernameEl, passwordEl].forEach(input => {
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    input?.addEventListener('focus', () => {
      input.style.borderColor = 'var(--color-text-dim)';
    });
    input?.addEventListener('blur', () => {
      input.style.borderColor = 'var(--color-border)';
    });
  });
}

async function replaceWithPasswordForm(el, username) {
  el.innerHTML = `
    <div class="menu-title">CONNEXION — ${username.toUpperCase()}</div>
    <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:480px">
      <label style="font-size:11px;letter-spacing:0.2em;color:var(--color-text-dim)">MOT DE PASSE</label>
      <input id="login-password" type="password" autocomplete="off"
        style="background:transparent;border:1px solid var(--color-border);color:var(--color-text);
               font-family:var(--font-mono);font-size:13px;padding:8px 12px;outline:none;
               transition:border-color 0.15s;width:100%"
        placeholder="••••••••"
        autofocus
      />
      <div id="login-error" style="color:var(--color-error);font-size:11px;min-height:1.2em"></div>
      <button id="login-submit">CONNEXION</button>
    </div>
    <div class="menu-hint">ENTRÉE VALIDER &nbsp;·&nbsp; ESC ANNULER</div>
  `;

  const passwordEl = el.querySelector('#login-password');
  const errorEl    = el.querySelector('#login-error');
  const submitBtn  = el.querySelector('#login-submit');

  passwordEl?.focus();

  const submit = async () => {
    const password = passwordEl.value;
    if (!password) { errorEl.textContent = 'Mot de passe requis'; return; }
    errorEl.textContent = 'AUTHENTIFICATION EN COURS...';
    submitBtn.disabled = true;

    await delay(500);
    const result = await session.login(username, password);
    if (result.success) {
      document.dispatchEvent(new CustomEvent('bcc:session-changed'));
      router.replace('main-menu');
    } else {
      errorEl.textContent = `ACCÈS REFUSÉ — ${result.error}`;
      passwordEl.value = '';
      submitBtn.disabled = false;
    }
  };

  submitBtn?.addEventListener('click', submit);
  passwordEl?.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
}
