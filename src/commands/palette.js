import { storage } from '../utils/storage.js';

const PALETTES = {
  green: 'Phosphore vert (d\u00e9faut)',
  amber: 'Ambre',
  blue:  'Bleu clair',
  red:   'Rouge sang',
};

export default {
  name: 'palette',
  description: 'Changer la palette de couleurs',
  usage: 'palette [list | set <nom>]',
  secret: false,
  handler(args, { outputRenderer }) {
    if (!args[0] || args[0] === 'list') {
      outputRenderer.printLine('PALETTES DISPONIBLES', 'bright');
      outputRenderer.printLine('\u2500'.repeat(40), 'separator');
      const current = document.documentElement.getAttribute('data-theme') || 'green';
      for (const [name, label] of Object.entries(PALETTES)) {
        const active = name === current ? ' \u25c0 ACTIF' : '';
        outputRenderer.printLine(`  ${name.padEnd(10)} ${label}${active}`, active ? 'accent' : '');
      }
      outputRenderer.printLine('\u2500'.repeat(40), 'separator');
      outputRenderer.printLine('  Utilisez "palette set <nom>" pour changer', 'dim');
      return;
    }

    if (args[0] === 'set' && args[1]) {
      const name = args[1].toLowerCase();
      if (!PALETTES[name]) {
        outputRenderer.printLine(`Palette inconnue : "${name}"`, 'error');
        outputRenderer.printLine(`Disponibles : ${Object.keys(PALETTES).join(', ')}`, 'dim');
        return;
      }
      document.documentElement.setAttribute('data-theme', name);
      storage.set('palette', name);
      outputRenderer.printLine(`Palette "${name}" activ\u00e9e`, 'accent');
      return;
    }

    outputRenderer.printLine('Usage: palette [list | set <nom>]', 'error');
  },
};
