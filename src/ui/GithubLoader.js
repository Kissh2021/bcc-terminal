/**
 * GithubLoader — Petite fenêtre de chargement animée affichée lors
 * de la synchronisation des documents GitHub au démarrage.
 */

let loaderEl = null;

const FILE_ICONS = ['◻', '◼', '◻', '◼', '◻'];

export function showGithubLoader(message = 'SYNCHRONISATION…') {
  if (loaderEl) return;

  loaderEl = document.createElement('div');
  loaderEl.className = 'github-loader';
  loaderEl.innerHTML = `
    <div class="github-loader-box">
      <div class="github-loader-title">BCC &nbsp;///&nbsp; ARCHIVES</div>
      <div class="github-loader-files">
        ${FILE_ICONS.map((icon, i) => `
          <div class="github-loader-file" style="animation-delay:${i * 0.15}s">
            <span class="github-loader-file-icon">${icon}</span>
            <span class="github-loader-file-dot"></span>
          </div>
        `).join('')}
      </div>
      <div class="github-loader-status" id="github-loader-status">${message}</div>
    </div>
  `;

  document.getElementById('app')?.appendChild(loaderEl);
}

export function updateGithubLoader(message) {
  const el = loaderEl?.querySelector('#github-loader-status');
  if (el) el.textContent = message;
}

export function hideGithubLoader() {
  if (!loaderEl) return;
  loaderEl.classList.add('closing');
  setTimeout(() => {
    loaderEl?.remove();
    loaderEl = null;
  }, 220);
}
