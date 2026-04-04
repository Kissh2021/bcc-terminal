let outputEl = null;

export const outputRenderer = {
  init(el) {
    outputEl = el;
  },

  printLine(text = '', cssClass = '') {
    if (!outputEl) return;
    const div = document.createElement('div');
    div.className = 'output-line' + (cssClass ? ' ' + cssClass : '');
    div.textContent = text;
    outputEl.appendChild(div);
    this._scroll();
    return div;
  },

  printLines(lines) {
    lines.forEach(({ text = '', cssClass = '' }) => this.printLine(text, cssClass));
  },

  printRaw(html, cssClass = '') {
    if (!outputEl) return;
    const div = document.createElement('div');
    div.className = 'output-line' + (cssClass ? ' ' + cssClass : '');
    div.innerHTML = html;
    outputEl.appendChild(div);
    this._scroll();
    return div;
  },

  clear() {
    if (outputEl) outputEl.innerHTML = '';
  },

  _scroll() {
    if (outputEl) {
      outputEl.scrollTop = outputEl.scrollHeight;
    }
  },
};
