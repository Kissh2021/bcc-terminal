import { promptInput } from '../utils/promptInput.js';

export default {
  name: 'accounts',
  description: 'Gérer les comptes enregistrés',
  usage: 'accounts [remove <utilisateur>]',
  secret: false,
  async handler(args, { outputRenderer, session }) {
    // Direct remove: accounts remove <username>
    if (args[0] === 'remove' && args[1]) {
      const accounts = session.getSavedAccounts();
      const exists = accounts.find(a => a.username.toLowerCase() === args[1].toLowerCase());
      if (!exists) {
        outputRenderer.printLine(`Compte "${args[1]}" introuvable dans la liste`, 'error');
        return;
      }
      session.removeSavedAccount(exists.username);
      outputRenderer.printLine(`Compte "${exists.username}" supprimé de la liste`, 'dim');
      return;
    }

    // Interactive listing + optional delete by number
    const accounts = session.getSavedAccounts();
    if (accounts.length === 0) {
      outputRenderer.printLine('Aucun compte enregistré', 'dim');
      return;
    }

    outputRenderer.printLine('COMPTES ENREGISTRÉS', 'bright');
    outputRenderer.printLine('─'.repeat(40), 'separator');
    accounts.forEach((acc, i) => {
      const active = session.currentUser()?.username === acc.username ? ' ◀ ACTIF' : '';
      outputRenderer.printLine(
        `  [${i + 1}] ${acc.username.padEnd(20)} ${acc.group.toUpperCase()}${active}`,
        active ? 'accent' : ''
      );
    });
    outputRenderer.printLine('─'.repeat(40), 'separator');
    outputRenderer.printLine('  Numéro à supprimer (ou Entrée pour annuler) :', 'dim');

    const choice = await promptInput();
    if (!choice) return;

    const idx = parseInt(choice) - 1;
    if (isNaN(idx) || idx < 0 || idx >= accounts.length) {
      outputRenderer.printLine('Numéro invalide', 'error');
      return;
    }

    const target = accounts[idx];
    session.removeSavedAccount(target.username);
    outputRenderer.printLine(`Compte "${target.username}" supprimé de la liste`, 'dim');
  },
};
