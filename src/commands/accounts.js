export default {
  name: 'accounts',
  description: 'Gérer les comptes enregistrés',
  usage: 'accounts [remove <utilisateur>]',
  secret: false,
  handler(args, { outputRenderer, session }) {
    if (args[0] === 'remove' && args[1]) {
      session.removeSavedAccount(args[1]);
      outputRenderer.printLine(`Compte "${args[1]}" supprimé de la liste`, 'dim');
      return;
    }

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
    outputRenderer.printLine('  Utilisez "accounts remove <nom>" pour supprimer', 'dim');
  },
};
