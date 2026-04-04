/**
 * Arbre du système de fichiers virtuel BCC.
 *
 * Structure d'un nœud :
 * {
 *   type: 'dir' | 'file',
 *   name: string,
 *   allowedGroups: string[] | null,   // null = public
 *   allowedUsers:  string[] | null,   // null = pas de restriction par user
 *   content?: string,                 // fichiers uniquement
 *   isMarkdown?: boolean,             // true = ouvre le viewer
 *   children?: { [name]: Node }       // répertoires uniquement
 * }
 *
 * Les documents sont chargés dynamiquement depuis GitHub (githubDocs.js).
 */
export const filesystem = {
  type: 'dir',
  name: '/',
  allowedGroups: null,
  allowedUsers: null,
  children: {
    home: {
      type: 'dir',
      name: 'home',
      allowedGroups: null,
      allowedUsers: null,
      children: {},
    },
    archives: {
      type: 'dir',
      name: 'archives',
      allowedGroups: ['agent', 'directeur', 'admin'],
      allowedUsers: null,
      children: {},
    },
    logs: {
      type: 'dir',
      name: 'logs',
      allowedGroups: null,
      allowedUsers: null,
      children: {},
    },
  },
};
