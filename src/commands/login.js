import { delay } from '../utils/typewriter.js';

export default {
  name: 'login',
  description: 'Se connecter au système',
  usage: 'login [utilisateur]',
  secret: false,
  async handler(args, { outputRenderer, session, terminal, router }) {
    if (session.isLoggedIn()) {
      const user = session.currentUser();
      outputRenderer.printLine(`Déjà connecté en tant que ${user.username.toUpperCase()} [${user.group.toUpperCase()}]`, 'dim');
      outputRenderer.printLine('Utilisez "logout" pour changer de compte', 'dim');
      return;
    }

    const accounts = session.getSavedAccounts();

    if (accounts.length > 0 && !args[0]) {
      outputRenderer.printLine('COMPTES ENREGISTRÉS', 'bright');
      outputRenderer.printLine('─'.repeat(40), 'separator');
      accounts.forEach((acc, i) => {
        outputRenderer.printLine(
          `  [${i + 1}] ${acc.username.padEnd(20)} ${acc.group.toUpperCase()}`, ''
        );
      });
      outputRenderer.printLine(`  [N] Nouveau compte`, 'dim');
      outputRenderer.printLine('─'.repeat(40), 'separator');
      outputRenderer.printLine('Entrez un numéro ou "N" pour un nouveau compte :', 'dim');

      const choice = await promptInput(terminal);
      if (!choice) return;

      if (choice.toLowerCase() === 'n') {
        await doLogin(null, outputRenderer, session, terminal, router);
      } else {
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < accounts.length) {
          await doLogin(accounts[idx].username, outputRenderer, session, terminal, router);
        } else {
          outputRenderer.printLine('Choix invalide', 'error');
        }
      }
    } else {
      await doLogin(args[0] || null, outputRenderer, session, terminal, router);
    }
  },
};

async function doLogin(prefilledUsername, outputRenderer, session, terminal, router) {
  let username = prefilledUsername;

  if (!username) {
    outputRenderer.printLine('Identifiant :', 'dim');
    username = await promptInput(terminal);
    if (!username) return;
  }

  outputRenderer.printLine(`Mot de passe pour ${username.toUpperCase()} :`, 'dim');
  const password = await promptInput(terminal, true);
  if (!password) return;

  outputRenderer.printLine('AUTHENTIFICATION EN COURS...', 'dim');
  await delay(600);

  const result = await session.login(username, password);
  if (result.success) {
    outputRenderer.printLine('─'.repeat(40), 'separator');
    outputRenderer.printLine(`ACCÈS AUTORISÉ`, 'accent');
    outputRenderer.printLine(`BIENVENUE, ${result.user.username.toUpperCase()}`, 'bright');
    outputRenderer.printLine(`GROUPE : ${result.user.group.toUpperCase()}`, '');
    outputRenderer.printLine('─'.repeat(40), 'separator');

    // Update header
    document.dispatchEvent(new CustomEvent('bcc:session-changed'));
    // Go back to main menu
    await delay(800);
    router.replace('main-menu');
  } else {
    outputRenderer.printLine(`ACCÈS REFUSÉ — ${result.error}`, 'error');
  }
}

function promptInput(terminal, mask = false) {
  return new Promise(resolve => {
    const inputEl = document.getElementById('terminal-input');
    if (!inputEl) { resolve(''); return; }

    // Temporarily switch to password type if masking
    if (mask) inputEl.type = 'password';

    const onEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const val = inputEl.value.trim();
        inputEl.value = '';
        if (mask) inputEl.type = 'text';
        inputEl.removeEventListener('keydown', onEnter, true);
        resolve(val);
      }
    };
    inputEl.addEventListener('keydown', onEnter, true); // capture phase: fires before terminal's handler
    inputEl.focus();
  });
}
