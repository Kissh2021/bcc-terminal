const VIEWS = {};
let currentView = null;
let contentEl = null;
const viewStack = [];
let transitioning = false;
let transitionEl = null;

export const router = {
  init(contentElement) {
    contentEl = contentElement;

    // Create transition overlay
    transitionEl = document.createElement('div');
    transitionEl.className = 'view-transition';
    contentEl.appendChild(transitionEl);
  },

  register(name, mountFn) {
    VIEWS[name] = mountFn;
  },

  current() {
    return currentView;
  },

  async replace(name, props = {}) {
    await this._navigate(name, props, false);
  },

  async push(name, props = {}) {
    if (currentView && name !== currentView) viewStack.push(currentView);
    await this._navigate(name, props, true);
  },

  async pop() {
    const prev = viewStack.pop();
    if (prev) {
      await this._navigate(prev, {}, false);
    }
  },

  async _navigate(name, props, _pushStack) {
    if (transitioning || name === currentView) return;
    if (!VIEWS[name]) {
      console.warn(`Router: view "${name}" not registered`);
      return;
    }

    transitioning = true;

    // Fade out
    if (transitionEl) {
      transitionEl.classList.add('active');
      await delay(180);
    }

    // Clear content (except transition overlay)
    [...contentEl.children].forEach(child => {
      if (child !== transitionEl) child.remove();
    });

    // Mount new view
    currentView = name;
    VIEWS[name](contentEl, props);

    // Fade in
    if (transitionEl) {
      await delay(20);
      transitionEl.classList.remove('active');
    }

    transitioning = false;
  },
};

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}
