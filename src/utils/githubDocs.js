/**
 * githubDocs.js — Intégration GitHub API pour les documents BCC.
 *
 * Repo : kissh2021/bcc-docs (privé)
 * Structure :
 *   _index.json          ← registre des métadonnées
 *   home/doc.md
 *   archives/rapport.md
 *
 * Lecture  → READONLY_TOKEN (hardcodé, accès lecture seule)
 * Écriture → admin token stocké en localStorage (saisi par l'admin dans l'UI)
 */

import { storage } from './storage.js';
import { filesystem } from '../data/filesystem.js';
import { ACCESS_OPTIONS, allowedGroupsFor } from './customDocs.js';

// ── Config ─────────────────────────────────────────────────────────────────

const REPO_OWNER   = 'kissh2021';
const REPO_NAME    = 'bcc-docs';
const BASE_URL     = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents`;

// Token lecture seule — safe à exposer (scope: contents:read sur bcc-docs uniquement)
// Remplacer par le nouveau token readonly après révocation de l'ancien.
let READONLY_TOKEN = import.meta.env.VITE_GITHUB_READONLY_TOKEN ?? '';

// ── Token admin (localStorage) ─────────────────────────────────────────────

const ADMIN_TOKEN_KEY = 'github-admin-token';

export function getAdminToken()        { return storage.get(ADMIN_TOKEN_KEY, null); }
export function setAdminToken(token)   { storage.set(ADMIN_TOKEN_KEY, token); }
export function clearAdminToken()      { storage.remove(ADMIN_TOKEN_KEY); }

// ── Helpers encodage ───────────────────────────────────────────────────────

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
    'Accept':        'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
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
  return method === 'DELETE' ? null : res.json();
}

async function getFileMeta(path, token) {
  try {
    return await apiRequest('GET', path, null, token || READONLY_TOKEN);
  } catch {
    return null;
  }
}

// ── Index ──────────────────────────────────────────────────────────────────

let cachedIndex = [];

export function getCachedIndex() { return cachedIndex; }

export async function fetchIndex() {
  try {
    const data = await apiRequest('GET', '_index.json', null, READONLY_TOKEN);
    cachedIndex = JSON.parse(b64Decode(data.content));
    return cachedIndex;
  } catch {
    cachedIndex = [];
    return [];
  }
}

async function pushIndex(index, adminToken) {
  const meta    = await getFileMeta('_index.json', adminToken);
  const content = b64Encode(JSON.stringify(index, null, 2));
  const body    = { message: 'chore: update index', content };
  if (meta?.sha) body.sha = meta.sha;
  return apiRequest('PUT', '_index.json', body, adminToken);
}

// ── Opérations documents ───────────────────────────────────────────────────

/**
 * Crée ou remplace un document sur GitHub et met à jour l'index.
 * Retourne { ok: true, doc } ou { ok: false, error }.
 */
export async function createGithubDoc({ filename, folder, accessKey, isMarkdown, content }, adminToken) {
  if (!filename.trim()) return { ok: false, error: 'Nom de fichier requis.' };
  if (!content.trim())  return { ok: false, error: 'Le contenu ne peut pas être vide.' };

  const name       = filename.trim();
  const githubPath = `${folder}/${name}`;

  // Vérifier collision avec un doc système (non-GitHub)
  const dir = filesystem.children?.[folder];
  if (dir?.children?.[name] && !dir.children[name]._githubDoc) {
    return { ok: false, error: `"${name}" est un document système et ne peut pas être remplacé.` };
  }

  // Vérifier collision dans l'index GitHub
  const index = await fetchIndex();
  const existing = index.find(d => d.githubPath === githubPath);

  try {
    // Push du fichier
    const meta = await getFileMeta(githubPath, adminToken);
    const body = { message: `docs: add ${name}`, content: b64Encode(content) };
    if (meta?.sha) body.sha = meta.sha;
    await apiRequest('PUT', githubPath, body, adminToken);

    // Mise à jour index
    const doc = {
      id:           existing?.id ?? crypto.randomUUID(),
      filename:     name,
      folder,
      githubPath,
      accessKey,
      allowedGroups: allowedGroupsFor(accessKey),
      isMarkdown,
      createdAt:    existing?.createdAt ?? new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    };

    const newIndex = existing
      ? index.map(d => d.githubPath === githubPath ? doc : d)
      : [...index, doc];

    await pushIndex(newIndex, adminToken);
    return { ok: true, doc };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Supprime un document GitHub et le retire de l'index.
 */
export async function deleteGithubDoc(doc, adminToken) {
  try {
    const meta = await getFileMeta(doc.githubPath, adminToken);
    if (meta?.sha) {
      await apiRequest('DELETE', doc.githubPath, {
        message: `docs: remove ${doc.filename}`,
        sha: meta.sha,
      }, adminToken);
    }
    const index    = await fetchIndex();
    const newIndex = index.filter(d => d.id !== doc.id);
    await pushIndex(newIndex, adminToken);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Récupère le contenu brut d'un fichier GitHub.
 */
export async function fetchDocContent(githubPath) {
  const data = await apiRequest('GET', githubPath, null, READONLY_TOKEN);
  return b64Decode(data.content);
}

// ── Injection VFS ──────────────────────────────────────────────────────────

/**
 * Injecte tous les docs GitHub dans le filesystem VFS au démarrage.
 * Le contenu est chargé à la demande (lazy) via un sentinel.
 * Affiche un loader animé pendant la synchronisation.
 */
export async function injectGithubDocs() {
  try {
    const index = await fetchIndex();
    index.forEach(doc => injectSingleGithubDoc(doc));
  } catch {
    // Silencieux au démarrage — les docs GitHub seront absents mais l'app fonctionne
  }
}

export function injectSingleGithubDoc(doc) {
  const dir = filesystem.children?.[doc.folder];
  if (!dir) return;
  dir.children[doc.filename] = {
    type:          'file',
    name:          doc.filename,
    allowedGroups: doc.allowedGroups,
    allowedUsers:  null,
    // Sentinel : le contenu sera fetchés à l'ouverture
    content:       `__GITHUB__:${doc.githubPath}`,
    isMarkdown:    doc.isMarkdown,
    _githubDoc:    true,
    _githubPath:   doc.githubPath,
  };
}

export function ejectSingleGithubDoc(doc) {
  const dir = filesystem.children?.[doc.folder];
  if (!dir) return;
  delete dir.children[doc.filename];
}

/**
 * Résout le contenu d'un nœud VFS — fetch GitHub si nécessaire.
 * Retourne le contenu string, ou lance une erreur.
 */
export async function resolveContent(content) {
  if (typeof content === 'string' && content.startsWith('__GITHUB__:')) {
    const githubPath = content.slice('__GITHUB__:'.length);
    return fetchDocContent(githubPath);
  }
  return content;
}

/** Permet de mettre à jour le token readonly depuis l'UI sans rechargement. */
export function setReadonlyToken(token) {
  READONLY_TOKEN = token;
}
