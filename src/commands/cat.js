export default {
  name: 'cat',
  description: 'Afficher le contenu d\'un fichier',
  usage: 'cat <fichier>',
  secret: false,
  handler(args, { outputRenderer, vfs, router }) {
    if (!args[0]) {
      outputRenderer.printLine('Usage: cat <fichier>', 'error');
      return;
    }

    const result = vfs.cat(args[0]);
    if (result.error) {
      outputRenderer.printLine(result.error, 'error');
      return;
    }

    if (result.isMarkdown) {
      // Open document viewer overlay
      document.dispatchEvent(new CustomEvent('bcc:open-viewer', {
        detail: { content: result.content, name: result.name },
      }));
    } else {
      // Print inline in terminal output
      outputRenderer.printLine('─'.repeat(48), 'separator');
      const lines = result.content.split('\n');
      for (const line of lines) {
        outputRenderer.printLine(line, '');
      }
      outputRenderer.printLine('─'.repeat(48), 'separator');
    }
  },
};
