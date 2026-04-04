let currentOwner = null;
const stack = [];

export const focusManager = {
  /**
   * A component claims keyboard focus.
   * @param {{ id: string, handleKeydown: Function, focus?: Function }} component
   */
  claim(component) {
    if (currentOwner && currentOwner.id !== component.id) {
      stack.push(currentOwner);
    }
    currentOwner = component;
    if (component.focus) component.focus();
  },

  release() {
    currentOwner = stack.pop() ?? null;
    if (currentOwner?.focus) currentOwner.focus();
  },

  current() {
    return currentOwner;
  },

  /**
   * Dispatch a keydown event to the current owner.
   * Returns true if consumed.
   */
  dispatch(e) {
    // Global shortcuts
    if ((e.key === ':' || e.key === '`') && !isInputFocused()) {
      e.preventDefault();
      // Signal terminal bar to claim focus
      document.dispatchEvent(new CustomEvent('bcc:focus-terminal'));
      return true;
    }

    if (currentOwner?.handleKeydown) {
      return currentOwner.handleKeydown(e) ?? false;
    }
    return false;
  },
};

function isInputFocused() {
  const el = document.activeElement;
  return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
}

// Global keydown listener
document.addEventListener('keydown', (e) => {
  focusManager.dispatch(e);
});
