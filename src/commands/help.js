import { commandRegistry } from '../core/commandRegistry.js';

export default {
  name: 'help',
  description: 'Afficher la liste des commandes disponibles',
  usage: 'help [commande]',
  secret: false,
  handler(args, { outputRenderer }) {
    if (args[0]) {
      const cmd = commandRegistry.resolve(args[0]);
      if (!cmd || cmd.secret) {
        outputRenderer.printLine(`Commande inconnue : "${args[0]}"`, 'error');
      } else {
        outputRenderer.printLine(`  ${cmd.name.padEnd(12)} ${cmd.description}`, '');
        outputRenderer.printLine(`  Usage: ${cmd.usage}`, 'dim');
      }
      return;
    }

    outputRenderer.printLine('COMMANDES DISPONIBLES', 'bright');
    outputRenderer.printLine('\u2500'.repeat(48), 'separator');
    for (const cmd of commandRegistry.listPublic()) {
      outputRenderer.printLine(`  ${cmd.name.padEnd(12)} ${cmd.description}`, '');
    }
    outputRenderer.printLine('\u2500'.repeat(48), 'separator');
    outputRenderer.printLine("  Appuyez sur \"/\" pour activer le terminal depuis n'importe o\u00f9", 'dim');
  },
};
