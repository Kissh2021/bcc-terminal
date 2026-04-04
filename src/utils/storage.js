const PREFIX = 'bcc_';

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // localStorage full or unavailable — silently ignore
    }
  },

  remove(key) {
    localStorage.removeItem(PREFIX + key);
  },

  has(key) {
    return localStorage.getItem(PREFIX + key) !== null;
  },
};
