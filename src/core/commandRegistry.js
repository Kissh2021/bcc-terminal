const commands = new Map();

export const commandRegistry = {
  /**
   * Register a command.
   * @param {{ name: string, description: string, usage: string, secret?: boolean, handler: Function }} cmd
   */
  register(cmd) {
    commands.set(cmd.name, cmd);
  },

  /**
   * Resolve a command by name.
   * @returns {{ name, description, usage, secret, handler } | null}
   */
  resolve(name) {
    return commands.get(name) ?? null;
  },

  /**
   * List all public (non-secret) commands.
   */
  listPublic() {
    return [...commands.values()].filter(c => !c.secret);
  },

  /**
   * List all commands (including secret).
   */
  listAll() {
    return [...commands.values()];
  },
};
