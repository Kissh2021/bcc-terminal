import { storage } from '../utils/storage.js';
import { users } from '../data/users.js';

let currentUser = null;

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const session = {
  async login(username, password) {
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return { success: false, error: 'UTILISATEUR INCONNU' };

    const hash = await hashPassword(password);
    if (hash !== user.passwordHash) return { success: false, error: 'MOT DE PASSE INCORRECT' };

    currentUser = { id: user.id, username: user.username, group: user.group };
    storage.set('session', currentUser);

    // Add to saved accounts list
    const accounts = storage.get('accounts', []);
    const exists = accounts.find(a => a.username === user.username);
    if (!exists) {
      accounts.push({ username: user.username, group: user.group });
      storage.set('accounts', accounts);
    }

    return { success: true, user: currentUser };
  },

  logout() {
    currentUser = null;
    storage.remove('session');
  },

  restore() {
    const saved = storage.get('session');
    if (saved) {
      // Verify the user still exists
      const exists = users.find(u => u.id === saved.id);
      if (exists) {
        currentUser = saved;
        return currentUser;
      } else {
        storage.remove('session');
      }
    }
    return null;
  },

  currentUser() {
    return currentUser;
  },

  isLoggedIn() {
    return currentUser !== null;
  },

  hasGroup(group) {
    if (!currentUser) return false;
    // Group hierarchy: admin > directeur > agent > public
    const hierarchy = ['public', 'agent', 'directeur', 'admin'];
    const userLevel = hierarchy.indexOf(currentUser.group);
    const requiredLevel = hierarchy.indexOf(group);
    return userLevel >= requiredLevel;
  },

  hasAccessToNode(node) {
    // null means public
    if (!node.allowedGroups && !node.allowedUsers) return true;

    // Check by userId first
    if (node.allowedUsers && currentUser) {
      if (node.allowedUsers.includes(currentUser.id)) return true;
    }

    // Check by group
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
