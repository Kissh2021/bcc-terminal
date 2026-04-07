import { invoke } from '@tauri-apps/api/core';
import { storage } from '../utils/storage.js';

let currentUser = null;

// ── Session ────────────────────────────────────────────────────────────────

export const session = {
  async login(username, password) {
    try {
      // invoke() appelle la commande Rust login()
      // Retourne { id, username, group } ou rejette avec une string d'erreur
      const user = await invoke('login', { username, password });
      currentUser = user;
      storage.set('session', { id: user.id, username: user.username, group: user.group });

      // Mémorisation du compte (sans mot de passe)
      const accounts = storage.get('accounts', []);
      if (!accounts.find(a => a.username === user.username)) {
        accounts.push({ username: user.username, group: user.group });
        storage.set('accounts', accounts);
      }

      return { success: true, user: currentUser };
    } catch (err) {
      // Rust retourne Err(String) → invoke() rejette avec la string directement
      return { success: false, error: typeof err === 'string' ? err : (err.message ?? 'ERREUR INCONNUE') };
    }
  },

  logout() {
    currentUser = null;
    storage.remove('session');
  },

  async restore() {
    const saved = storage.get('session');
    if (!saved?.id) return null;

    try {
      // Re-vérifie que l'utilisateur existe toujours dans _users.json
      const user = await invoke('restore_session', { userId: saved.id });
      currentUser = user;
      return currentUser;
    } catch {
      // Utilisateur supprimé ou réseau indisponible — on efface la session
      storage.remove('session');
      return null;
    }
  },

  currentUser() {
    return currentUser;
  },

  isLoggedIn() {
    return currentUser !== null;
  },

  hasGroup(group) {
    if (!currentUser) return false;
    const hierarchy = ['public', 'agent', 'directeur', 'admin'];
    const userLevel     = hierarchy.indexOf(currentUser.group);
    const requiredLevel = hierarchy.indexOf(group);
    return userLevel >= requiredLevel;
  },

  hasAccessToNode(node) {
    if (!node.allowedGroups && !node.allowedUsers) return true;

    if (node.allowedUsers && currentUser) {
      if (node.allowedUsers.includes(currentUser.id)) return true;
    }

    if (node.allowedGroups) {
      if (!currentUser) return false;
      return node.allowedGroups.some(g => this.hasGroup(g));
    }

    return false;
  },

  getSavedAccounts() {
    return storage.get('accounts', []);
  },

  removeSavedAccount(username) {
    const accounts = storage.get('accounts', []).filter(a => a.username !== username);
    storage.set('accounts', accounts);
  },
};
