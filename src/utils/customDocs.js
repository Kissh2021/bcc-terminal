/**
 * customDocs.js — Gestion des documents importés dynamiquement.
 *
 * Les docs sont persistés en localStorage et injectés dans le filesystem
 * VFS au démarrage (injectCustomDocs) ainsi qu'en temps réel après ajout
 * (injectSingleDoc) ou suppression (ejectSingleDoc).
 */

import { storage } from './storage.js';

const STORAGE_KEY = 'custom-docs';

// ── Hiérarchie d'accès ─────────────────────────────────────────────────────

const ACCESS_LEVELS = {
  public:     null,
  agent:      ['agent', 'directeur', 'admin'],
  directeur:  ['directeur', 'admin'],
  admin:      ['admin'],
};

export const ACCESS_OPTIONS = [
  { value: 'public',    label: 'Public' },
  { value: 'agent',     label: 'Agent+' },
  { value: 'directeur', label: 'Directeur+' },
  { value: 'admin',     label: 'Admin uniquement' },
];

export function allowedGroupsFor(accessKey) {
  return ACCESS_LEVELS[accessKey] ?? null;
}

// ── Persistence ────────────────────────────────────────────────────────────

export function loadCustomDocs() {
  return storage.get(STORAGE_KEY, []);
}

function persist(docs) {
  storage.set(STORAGE_KEY, docs);
}

/**
 * Sauvegarde un nouveau doc custom.
 * Retourne { ok: true } ou { ok: false, error: string }.
 */
export function saveCustomDoc({ filename, folder, accessKey, isMarkdown, content }, filesystem) {
  if (!filename.trim()) return { ok: false, error: 'Nom de fichier requis.' };
  if (!content.trim())  return { ok: false, error: 'Le contenu ne peut pas être vide.' };

  const name = filename.trim();
  const dir  = filesystem.children?.[folder];
  if (!dir) return { ok: false, error: `Dossier inconnu : ${folder}` };
  if (dir.children?.[name]) return { ok: false, error: `"${name}" existe déjà dans /${folder}.` };

  const doc = {
    id:         crypto.randomUUID(),
    filename:   name,
    folder,
    accessKey,
    allowedGroups: allowedGroupsFor(accessKey),
    isMarkdown,
    content,
    createdAt:  new Date().toISOString(),
  };

  const docs = loadCustomDocs();
  docs.push(doc);
  persist(docs);
  return { ok: true, doc };
}

/**
 * Supprime un doc custom par son id.
 */
export function deleteCustomDoc(id) {
  persist(loadCustomDocs().filter(d => d.id !== id));
}

// ── Injection / éjection dans le filesystem VFS ────────────────────────────

function makeNode(doc) {
  return {
    type:          'file',
    name:          doc.filename,
    allowedGroups: doc.allowedGroups,
    allowedUsers:  null,
    content:       doc.content,
    isMarkdown:    doc.isMarkdown,
    _customId:     doc.id, // marqueur pour éjection
  };
}

/** Injecte tous les docs custom au démarrage de l'application. */
export function injectCustomDocs(filesystem) {
  loadCustomDocs().forEach(doc => injectSingleDoc(doc, filesystem));
}

/** Injecte un seul doc dans le filesystem runtime (après ajout). */
export function injectSingleDoc(doc, filesystem) {
  const dir = filesystem.children?.[doc.folder];
  if (!dir) return;
  dir.children[doc.filename] = makeNode(doc);
}

/** Retire un doc du filesystem runtime (après suppression). */
export function ejectSingleDoc(doc, filesystem) {
  const dir = filesystem.children?.[doc.folder];
  if (!dir) return;
  delete dir.children[doc.filename];
}
