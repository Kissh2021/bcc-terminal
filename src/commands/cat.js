import { resolveContent } from '../utils/githubDocs.js';
import { showGithubLoader, hideGithubLoader } from '../ui/GithubLoader.js';

export default {
  name: 'cat',
  description: 'Afficher le contenu d\'un fichier',
  usage: 'cat <fichier>',
  secret: false,
  async handler(args, { outputRenderer, vfs, router }) {
    if (!args[0]) {
      outputRenderer.printLine('Usage: cat <fichier>', 'error');
      return;
    }

    const result = vfs.cat(args[0]);
    if (result.error) {
      outputRenderer.printLine(result.error, 'error');
      return;
    }

    const isRemote = typeof result.content === 'string' && result.content.startsWith('__GITHUB__:');

    let content;
    if (isRemote) {
      showGithubLoader('RÉCUPÉRATION DU DOCUMENT…');
      const [resolved] = await Promise.allSettled([
        resolveContent(result.content),
        new Promise(r => setTimeout(r, 400)), // minimum 400ms
      ]);
      hideGithubLoader();
      if (resolved.status === 'rejected') {
        outputRenderer.printLine(`ERREUR CHARGEMENT : ${resolved.reason?.message}`, 'error');
        return;
      }
      content = resolved.value;
    } else {
      try {
        content = await resolveContent(result.content);
      } catch (err) {
        outputRenderer.printLine(`ERREUR CHARGEMENT : ${err.message}`, 'error');
        return;
      }
    }

    if (result.isMarkdown) {
      document.dispatchEvent(new CustomEvent('bcc:open-viewer', {
        detail: { content, name: result.name },
      }));
    } else {
      outputRenderer.printLine('─'.repeat(48), 'separator');
      const lines = content.split('\n');
      for (const line of lines) {
        outputRenderer.printLine(line, '');
      }
      outputRenderer.printLine('─'.repeat(48), 'separator');
    }
  },
};
