/**
 * githubUsers.js — CRUD des utilisateurs dans bcc-docs/_users.json
 *
 * Toutes les opérations d'écriture nécessitent le token admin (readwrite).
 * La lecture pour le login/restore est gérée côté Rust (token readonly embarqué).
 *
 * Structure _users.json :
 * [
 *   { "id": "usr-000", "username": "admin", "passwordHash": "...", "group": "admin" },
 *   ...
 * ]
 */

import { getAdminToken, setAdminToken, clearAdminToken } from './githubDocs.js';

export { getAdminToken, setAdminToken, clearAdminToken };

const REPO_OWNER  = 'kissh2021';
const REPO_NAME   = 'bcc-docs';
const BASE_URL    = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;
const USERS_PATH  = '_users.json';

// ── Helpers encodage (identiques à githubDocs.js) ─────────────────────────

function b64Decode(str) {
  return decodeURIComponent(
    Array.from(atob(str.replace(/\s/g, '')))
      .map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('')
  );
}

function b64Encode(str) {
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16))
    )
  );
}

// ── API GitHub ─────────────────────────────────────────────────────────────

async function apiRequest(method, path, body, token) {
  const headers = {
    'Accept':               'application/vnd.github+json',
    'Authorization':        `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `GitHub API ${res.status}`);
  }
  return res.json();
}

async function getFileSha(token) {
  try {
    const data = await apiRequest('GET', USERS_PATH, null, token);
    return data.sha ?? null;
  } catch {
    return null;
  }
}

// ── API publique ───────────────────────────────────────────────────────────

/**
 * Récupère la liste complète des utilisateurs (nécessite token admin).
 */
export async function fetchUsersIndex(adminToken) {
  const data = await apiRequest('GET', USERS_PATH, null, adminToken);
  return JSON.parse(b64Decode(data.content));
}

/**
 * Écrase _users.json avec le nouveau tableau.
 */
export async function pushUsersIndex(users, adminToken) {
  const sha     = await getFileSha(adminToken);
  const content = b64Encode(JSON.stringify(users, null, 2));
  const body    = { message: 'chore: update users', content };
  if (sha) body.sha = sha;
  return apiRequest('PUT', USERS_PATH, body, adminToken);
}

/**
 * Crée un nouvel utilisateur.
 * { username, passwordHash, group }
 */
export async function createGithubUser({ username, passwordHash, group }, adminToken) {
  const users = await fetchUsersIndex(adminToken);

  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    throw new Error(`L'utilisateur "${username}" existe déjà.`);
  }

  const newUser = {
    id:           `usr-${Date.now()}`,
    username:     username.trim(),
    passwordHash,
    group,
  };

  await pushUsersIndex([...users, newUser], adminToken);
  return newUser;
}

/**
 * Modifie un utilisateur existant.
 * changes : { group?, passwordHash? }
 */
export async function updateGithubUser(id, changes, adminToken) {
  const users   = await fetchUsersIndex(adminToken);
  const idx     = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error(`Utilisateur "${id}" introuvable.`);

  const updated = [...users];
  updated[idx]  = { ...updated[idx], ...changes };
  await pushUsersIndex(updated, adminToken);
}

/**
 * Supprime un utilisateur par id.
 */
export async function deleteGithubUser(id, adminToken) {
  const users    = await fetchUsersIndex(adminToken);
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) throw new Error(`Utilisateur "${id}" introuvable.`);
  await pushUsersIndex(filtered, adminToken);
}
