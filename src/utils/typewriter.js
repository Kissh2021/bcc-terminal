/**
 * Typewriter utility.
 * Returns an object that can type text char-by-char and be skipped.
 */
export function createTypewriter() {
  let skipFlag = false;

  function skip() {
    skipFlag = true;
  }

  function reset() {
    skipFlag = false;
  }

  /**
   * Type text into a container element, char by char.
   * @param {HTMLElement} el - Element whose textContent will be updated
   * @param {string} text - Text to type
   * @param {number} charDelay - ms per character
   * @returns {Promise<void>}
   */
  async function type(el, text, charDelay = 20) {
    skipFlag = false;
    el.textContent = '';
    for (let i = 0; i < text.length; i++) {
      if (skipFlag) {
        el.textContent = text;
        return;
      }
      el.textContent += text[i];
      if (charDelay > 0) {
        await delay(charDelay);
      }
    }
  }

  /**
   * Type multiple lines, appending each as a new element to a container.
   * @param {HTMLElement} container
   * @param {Array<{text: string, className?: string}>} lines
   * @param {number} charDelay
   * @param {number} lineDelay - extra delay between lines (ms)
   */
  async function typeLines(container, lines, charDelay = 16, lineDelay = 0) {
    skipFlag = false;
    for (const { text, className } of lines) {
      if (skipFlag) {
        // Dump remaining lines instantly
        for (const remaining of lines.slice(lines.indexOf({ text, className }))) {
          const el = makeLine(remaining.text, remaining.className);
          container.appendChild(el);
        }
        return;
      }
      const el = makeLine('', className);
      container.appendChild(el);
      await type(el, text, skipFlag ? 0 : charDelay);
      if (lineDelay > 0 && !skipFlag) await delay(lineDelay);
    }
  }

  return { type, typeLines, skip, reset };
}

function makeLine(text, className) {
  const el = document.createElement('div');
  el.className = 'boot-line' + (className ? ' ' + className : '');
  el.textContent = text;
  return el;
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
