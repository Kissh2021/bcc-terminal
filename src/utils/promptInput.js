/**
 * Wait for user input in the terminal input field.
 * Uses capture phase to intercept Enter before the terminal's own handler.
 * @param {boolean} mask - If true, switches input to type="password"
 * @returns {Promise<string>} Resolves with trimmed value on Enter
 */
export function promptInput(mask = false) {
  return new Promise(resolve => {
    const inputEl = document.getElementById('terminal-input');
    if (!inputEl) { resolve(''); return; }

    if (mask) inputEl.type = 'password';

    const onEnter = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopImmediatePropagation();
        const val = inputEl.value.trim();
        inputEl.value = '';
        if (mask) inputEl.type = 'text';
        inputEl.removeEventListener('keydown', onEnter, true);
        resolve(val);
      }
    };
    inputEl.addEventListener('keydown', onEnter, true); // capture phase: fires before terminal's handler
    inputEl.focus();
  });
}
