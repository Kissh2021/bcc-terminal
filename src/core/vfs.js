import { session } from './session.js';
import { filesystem } from '../data/filesystem.js';

let cwd = '/';

function splitPath(path) {
  return path.split('/').filter(Boolean);
}

function getNode(path) {
  const parts = splitPath(path);
  let node = filesystem;
  for (const part of parts) {
    if (!node.children || !node.children[part]) return null;
    node = node.children[part];
  }
  return node;
}

function resolvePath(path) {
  if (path.startsWith('/')) return path;
  if (path === '..') {
    const parts = splitPath(cwd);
    parts.pop();
    return '/' + parts.join('/');
  }
  if (path === '.') return cwd;
  return (cwd === '/' ? '' : cwd) + '/' + path;
}

export const vfs = {
  cwd() {
    return cwd;
  },

  cd(path) {
    if (!path || path === '~') {
      cwd = '/';
      return null;
    }
    const resolved = resolvePath(path);
    const node = getNode(resolved);
    if (!node) return `cd: ${path}: Répertoire introuvable`;
    if (node.type !== 'dir') return `cd: ${path}: N'est pas un répertoire`;
    if (!session.hasAccessToNode(node)) return `ACCÈS REFUSÉ — NIVEAU DE CLEARANCE INSUFFISANT`;
    cwd = resolved || '/';
    return null;
  },

  ls(path) {
    const resolved = path ? resolvePath(path) : cwd;
    const node = getNode(resolved);
    if (!node) return { error: `ls: ${path || cwd}: Introuvable` };
    if (node.type !== 'dir') return { error: `ls: N'est pas un répertoire` };

    const entries = Object.values(node.children || {}).map(child => ({
      name: child.name,
      type: child.type,
      restricted: !session.hasAccessToNode(child),
    }));

    return { entries };
  },

  cat(path) {
    const resolved = resolvePath(path);
    const node = getNode(resolved);
    if (!node) return { error: `cat: ${path}: Fichier introuvable` };
    if (node.type !== 'file') return { error: `cat: ${path}: Est un répertoire` };
    if (!session.hasAccessToNode(node)) {
      return { error: `ACCÈS REFUSÉ — NIVEAU DE CLEARANCE INSUFFISANT\n[FICHIER CLASSIFIÉ]` };
    }
    return {
      content: node.content,
      isMarkdown: node.isMarkdown ?? false,
      name: node.name,
    };
  },

  getNode,
  resolvePath,
};
