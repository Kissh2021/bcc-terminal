export default {
  name: 'cd',
  description: 'Changer de répertoire',
  usage: 'cd <chemin>',
  secret: false,
  handler(args, { outputRenderer, vfs }) {
    const err = vfs.cd(args[0] || '~');
    if (err) {
      outputRenderer.printLine(err, 'error');
    } else {
      outputRenderer.printLine(`Répertoire courant : ${vfs.cwd()}`, 'dim');
    }
  },
};
