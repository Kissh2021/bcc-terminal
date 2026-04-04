import welcomeDoc  from './docs/welcome.js';
import incidentDoc from './docs/incident-0091.js';

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
      children: {
        'bienvenue.md': {
          type: 'file',
          name: 'bienvenue.md',
          allowedGroups: null,
          allowedUsers: null,
          content: welcomeDoc,
          isMarkdown: true,
        },
        'LISEZMOI.txt': {
          type: 'file',
          name: 'LISEZMOI.txt',
          allowedGroups: null,
          allowedUsers: null,
          content: [
            'SYSTÈME BCC TERMINAL v4.2',
            '═══════════════════════════════',
            '',
            'Ce terminal vous connecte aux archives du Bureau',
            'de Contre-Clandestinité.',
            '',
            "Pour obtenir de l'aide : tapez \"help\"",
            'Pour vous connecter  : tapez "login"',
            'Pour lister les docs  : tapez "ls"',
            '',
            '— Administration BCC',
          ].join('\n'),
          isMarkdown: false,
        },
      },
    },
    archives: {
      type: 'dir',
      name: 'archives',
      allowedGroups: ['agent', 'directeur', 'admin'],
      allowedUsers: null,
      children: {
        'IR-0091.md': {
          type: 'file',
          name: 'IR-0091.md',
          allowedGroups: ['agent', 'directeur', 'admin'],
          allowedUsers: null,
          content: incidentDoc,
          isMarkdown: true,
        },
      },
    },
    logs: {
      type: 'dir',
      name: 'logs',
      allowedGroups: null,
      allowedUsers: null,
      children: {
        'acces.log': {
          type: 'file',
          name: 'acces.log',
          allowedGroups: null,
          allowedUsers: null,
          content: [
            '[2024-11-03 02:14:44] CONNEXION ÉCHOUÉE — utilisateur: inconnu',
            '[2024-11-03 02:15:01] ACCÈS REFUSÉ — /archives/IR-0091.md',
            '[2024-11-03 02:17:33] CONNEXION — agent_alpha [AGENT]',
            '[2024-11-03 02:18:05] ACCÈS — /archives/IR-0091.md [AUTORISÉ]',
            '[2024-11-03 02:19:12] DÉCONNEXION — agent_alpha',
            '[2024-11-17 09:01:00] SYSTÈME DÉMARRÉ — BCC TERMINAL v4.2',
          ].join('\n'),
          isMarkdown: false,
        },
      },
    },
  },
};
