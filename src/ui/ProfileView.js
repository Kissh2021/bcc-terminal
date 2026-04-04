import { session } from '../core/session.js';
import { focusManager } from '../core/focusManager.js';
import { router } from '../core/router.js';

export function mountProfileView(container) {
  const el = document.createElement('div');
  el.className = 'menu-view';

  const user = session.currentUser();

  if (!user) {
    el.innerHTML = `
      <div class="menu-title">MON PROFIL</div>
      <div class="menu-item">
        <span class="menu-item-label" style="opacity:0.5">Non authentifié</span>
      </div>
      <div class="menu-item focused" data-action="login">
        <span class="menu-item-key">[1]</span>
        <span class="menu-item-label">SE CONNECTER</span>
      </div>
      <div class="menu-hint">ESC RETOUR</div>
    `;
  } else {
    const accounts = session.getSavedAccounts();
    el.innerHTML = `
      <div class="menu-title">MON PROFIL</div>
      <div class="menu-item">
        <span class="menu-item-key">ID</span>
        <span class="menu-item-label">${user.id}</span>
      </div>
      <div class="menu-item">
        <span class="menu-item-key">NOM</span>
        <span class="menu-item-label">${user.username.toUpperCase()}</span>
      </div>
      <div class="menu-item">
        <span class="menu-item-key">GROUPE</span>
        <span class="menu-item-label accent" style="color:var(--color-accent)">${user.group.toUpperCase()}</span>
      </div>
      <div class="menu-item" style="margin-top:16px">
        <span class="menu-item-key">COMPTES</span>
        <span class="menu-item-label">${accounts.length} enregistré(s)</span>
      </div>
      <div class="menu-item focused" data-action="logout" style="margin-top:12px">
        <span class="menu-item-key">[D]</span>
        <span class="menu-item-label">SE DÉCONNECTER</span>
      </div>
      <div class="menu-hint">ESC RETOUR &nbsp;·&nbsp; D DÉCONNECTER</div>
    `;
  }

  el.querySelector('[data-action="logout"]')?.addEventListener('click', doLogout);
  el.querySelector('[data-action="login"]')?.addEventListener('click', () => router.push('login'));

  function doLogout() {
    if (!session.isLoggedIn()) return;
    session.logout();
    document.dispatchEvent(new CustomEvent('bcc:session-changed'));
    router.replace('main-menu');
  }

  const component = {
    id: 'profile',
    handleKeydown(e) {
      if (e.key === 'Escape') { e.preventDefault(); router.pop(); return true; }
      if ((e.key === 'd' || e.key === 'D') && user) { doLogout(); return true; }
      return false;
    },
    focus() {},
  };

  container.appendChild(el);
  focusManager.claim(component);
}
