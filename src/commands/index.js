import { commandRegistry } from '../core/commandRegistry.js';
import help     from './help.js';
import ls       from './ls.js';
import cd       from './cd.js';
import cat      from './cat.js';
import clear    from './clear.js';
import whoami   from './whoami.js';
import login    from './login.js';
import logout   from './logout.js';
import accounts from './accounts.js';
import palette  from './palette.js';
import crt      from './crt.js';

const allCommands = [
  help, ls, cd, cat, clear, whoami, login, logout, accounts, palette, crt,
];

export function registerCommands() {
  for (const cmd of allCommands) {
    commandRegistry.register(cmd);
  }
}
