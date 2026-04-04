export default {
  name: 'logout',
  description: 'Se déconnecter',
  usage: 'logout',
  secret: false,
  handler(_args, { outputRenderer, session, router }) {
    if (!session.isLoggedIn()) {
      outputRenderer.printLine('Aucune session active', 'dim');
      return;
    }
    const user = session.currentUser();
    session.logout();
    outputRenderer.printLine(`Session fermée — Au revoir, ${user.username.toUpperCase()}`, 'dim');
    document.dispatchEvent(new CustomEvent('bcc:session-changed'));
    setTimeout(() => router.replace('main-menu'), 600);
  },
};
