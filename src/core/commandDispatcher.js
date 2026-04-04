import { commandRegistry } from './commandRegistry.js';

/**
 * Tokenize a command string, respecting quoted strings.
 */
function tokenize(input) {
  const tokens = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const char of input.trim()) {
    if (inQuote) {
      if (char === quoteChar) {
        inQuote = false;
        if (current) { tokens.push(current); current = ''; }
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = true;
      quoteChar = char;
    } else if (char === ' ') {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

export const commandDispatcher = {
  /**
   * Dispatch a raw input string.
   * @param {string} input
   * @param {object} context - { terminal, session, vfs, router }
   * @returns {Promise<void>}
   */
  async dispatch(input, context) {
    const tokens = tokenize(input);
    if (!tokens.length) return;

    const name = tokens[0].toLowerCase();
    const args = tokens.slice(1);

    const cmd = commandRegistry.resolve(name);
    if (!cmd) {
      context.outputRenderer.printLine(
        `Commande introuvable : "${name}" — tapez "help" pour la liste des commandes`,
        'error'
      );
      return;
    }

    try {
      await cmd.handler(args, context);
    } catch (err) {
      context.outputRenderer.printLine(`ERREUR SYSTÈME : ${err.message}`, 'error');
      console.error(err);
    }
  },
};
