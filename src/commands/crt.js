import { storage } from '../utils/storage.js';

export default {
  name: 'crt',
  description: 'Activer/d\u00e9sactiver les effets \u00e9cran cathodique',
  usage: 'crt [on | off]',
  secret: false,
  handler(args, { outputRenderer }) {
    const current = document.documentElement.classList.contains('crt-off');

    if (!args[0]) {
      outputRenderer.printLine(`Effets CRT : ${current ? 'D\u00c9SACTIV\u00c9S' : 'ACTIV\u00c9S'}`, current ? 'dim' : 'accent');
      outputRenderer.printLine('Utilisez "crt on" ou "crt off"', 'dim');
      return;
    }

    if (args[0] === 'off') {
      document.documentElement.classList.add('crt-off');
      storage.set('crt', 'off');
      outputRenderer.printLine('Effets CRT d\u00e9sactiv\u00e9s', 'dim');
    } else if (args[0] === 'on') {
      document.documentElement.classList.remove('crt-off');
      storage.set('crt', 'on');
      outputRenderer.printLine('Effets CRT activ\u00e9s', 'accent');
    } else {
      outputRenderer.printLine('Usage: crt [on | off]', 'error');
    }
  },
};
