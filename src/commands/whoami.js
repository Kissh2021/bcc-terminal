export default {
  name: 'whoami',
  description: 'Afficher l\'utilisateur courant',
  usage: 'whoami',
  secret: false,
  handler(_args, { outputRenderer, session }) {
    const user = session.currentUser();
    if (!user) {
      outputRenderer.printLine('NON AUTHENTIFIÉ — ACCÈS INVITÉ', 'dim');
      outputRenderer.printLine('Utilisez "login" pour vous connecter', 'dim');
    } else {
      outputRenderer.printLine('─'.repeat(40), 'separator');
      outputRenderer.printLine(`  UTILISATEUR : ${user.username.toUpperCase()}`, 'bright');
      outputRenderer.printLine(`  GROUPE      : ${user.group.toUpperCase()}`, 'accent');
      outputRenderer.printLine(`  ID          : ${user.id}`, 'dim');
      outputRenderer.printLine('─'.repeat(40), 'separator');
    }
  },
};
