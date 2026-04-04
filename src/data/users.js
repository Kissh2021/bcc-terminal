/**
 * Utilisateurs du système BCC Terminal.
 *
 * Les mots de passe sont hashés en SHA-256 côté client.
 * Pour générer un hash, exécuter dans la console du navigateur :
 *
 *   async function sha256(str) {
 *     const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
 *     return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
 *   }
 *   await sha256('votre_mot_de_passe');
 *
 * Groupes disponibles (hiérarchie croissante) : public < agent < directeur < admin
 */

export const users = [
  {
    id: 'usr-001',
    username: 'admin',
    // mot de passe: admin123
    passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    group: 'admin',
  },
  {
    id: 'usr-002',
    username: 'boss',
    // mot de passe: bcc2024
    passwordHash: 'b872b7016c6d170acc466204d0ab7e9bfa0256f1e32181d409bc7668d122cbe8',
    group: 'agent',
  },
  {
    id: 'usr-003',
    username: 'visiteur',
    // mot de passe: visiteur
    passwordHash: '359d6d57e0a84624a1ff4dae25b68bbc207c58ac0a98c1e648c7e6c97c333a42',
    group: 'public',
  },
];
