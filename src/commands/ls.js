export default {
  name: 'ls',
  description: 'Lister le contenu d\'un répertoire',
  usage: 'ls [chemin]',
  secret: false,
  handler(args, { outputRenderer, vfs }) {
    const result = vfs.ls(args[0]);
    if (result.error) {
      outputRenderer.printLine(result.error, 'error');
      return;
    }

    if (result.entries.length === 0) {
      outputRenderer.printLine('(répertoire vide)', 'dim');
      return;
    }

    const dirs  = result.entries.filter(e => e.type === 'dir');
    const files = result.entries.filter(e => e.type === 'file');

    outputRenderer.printLine(`Répertoire : ${vfs.cwd()}`, 'dim');
    outputRenderer.printLine('─'.repeat(40), 'separator');

    for (const d of dirs) {
      const label = d.restricted ? ` [${d.name}/]  [RESTRICTED]` : ` ${d.name}/`;
      outputRenderer.printLine(label, d.restricted ? 'error' : 'accent');
    }
    for (const f of files) {
      const label = f.restricted ? ` ${f.name}  [RESTRICTED]` : ` ${f.name}`;
      outputRenderer.printLine(label, f.restricted ? 'error' : '');
    }

    outputRenderer.printLine('─'.repeat(40), 'separator');
    outputRenderer.printLine(`  ${dirs.length} répertoire(s), ${files.length} fichier(s)`, 'dim');
  },
};
