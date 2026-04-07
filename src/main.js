// ── Styles ──────────────────────────────────────────────────────────────────
import './styles/base.css';
import './styles/themes.css';
import './styles/layout.css';
import './styles/header.css';
import './styles/crt.css';
import './styles/terminal.css';
import './styles/menu.css';
import './styles/boot.css';
import './styles/viewer.css';
import './styles/notes.css';
import './styles/docimport.css';

// ── Core ─────────────────────────────────────────────────────────────────────
import { storage }           from './utils/storage.js';
import { applyCrtIntensity, getCrtIntensity } from './utils/crtIntensity.js';
import { commandRegistry }   from './core/commandRegistry.js';
import { session }           from './core/session.js';
import { router }            from './core/router.js';
import { outputRenderer }    from './core/outputRenderer.js';
import { soundManager }      from './core/soundManager.js';

// ── Commands ──────────────────────────────────────────────────────────────────
import { registerCommands }  from './commands/index.js';

// ── Boot ──────────────────────────────────────────────────────────────────────
import { runBootSequence }   from './boot/bootSequence.js';

// ── UI ────────────────────────────────────────────────────────────────────────
import { mountHeader }       from './ui/Header.js';
import { mountTerminalBar }  from './ui/TerminalBar.js';
import { mountMainMenu }     from './ui/MainMenu.js';
import { mountDocumentList } from './ui/DocumentList.js';
import { mountProfileView }  from './ui/ProfileView.js';
import { mountSettingsView } from './ui/SettingsView.js';
import { mountTerminalOutput } from './ui/TerminalOutput.js';
import { mountLoginView }    from './ui/LoginView.js';
import { mountNotesView }      from './ui/NotesView.js';
import { mountDocImportView }  from './ui/DocImportView.js';
import { mountAccountsView }   from './ui/AccountsView.js';
import { checkForUpdates, checkUpdate } from './utils/updater.js';
import { getVersion }          from '@tauri-apps/api/app';
import { getCurrentWindow }    from '@tauri-apps/api/window';
import { openDocumentViewer, closeDocumentViewer } from './ui/DocumentViewer.js';
import { filesystem }          from './data/filesystem.js';
import { injectCustomDocs }    from './utils/customDocs.js';
import { injectGithubDocs }    from './utils/githubDocs.js';

// ── Expose globals for commands that need them (avoids circular deps) ─────────
window.__bcc__ = { storage, commandRegistry };

async function init() {
  // 0. Lancer la vérification de MAJ immédiatement — en parallèle de tout le reste
  //    pour qu'elle soit (presque certainement) résolue quand l'écran titre s'affiche
  const updatePromise = checkUpdate();

  // 1. Restore palette
  const savedPalette = storage.get('palette', 'green');
  document.documentElement.setAttribute('data-theme', savedPalette);

  // 2. Restore CRT setting + intensity
  const crtSetting = storage.get('crt', 'on');
  if (crtSetting === 'off') {
    document.documentElement.classList.add('crt-off');
  }
  applyCrtIntensity(getCrtIntensity());

  // 3. Init sound (prépare l'AudioContext dès la première interaction)
  soundManager.init();

  // 4. Restore session (vérifie le token auprès du serveur)
  await session.restore();

  // 4b. Inject custom docs (localStorage legacy) + GitHub docs into the VFS
  injectCustomDocs(filesystem);
  await injectGithubDocs();

  // 4. Mount persistent UI elements
  mountHeader(document.getElementById('header'));
  mountTerminalBar(document.getElementById('terminal-bar'));

  // 5. Register commands
  registerCommands();

  // 6. Register router views
  const contentEl = document.getElementById('content');
  router.init(contentEl);

  router.register('main-menu',       (el) => mountMainMenu(el));
  router.register('documents',       (el) => mountDocumentList(el));
  router.register('profile',         (el) => mountProfileView(el));
  router.register('settings',        (el) => mountSettingsView(el));
  router.register('terminal-output', (el) => mountTerminalOutput(el));
  router.register('login',           (el) => mountLoginView(el));
  router.register('notes',           (el) => mountNotesView(el));
  router.register('doc-import',     (el) => mountDocImportView(el));
  router.register('accounts',       (el) => mountAccountsView(el));

  // 7. Global event listeners
  document.addEventListener('bcc:open-viewer', (e) => {
    openDocumentViewer(e.detail.content, e.detail.name);
  });

  document.addEventListener('bcc:terminal-message', (e) => {
    outputRenderer.printLine(e.detail.text, e.detail.cssClass);
  });

  // 8. Boot sequence → then main menu
  await runBootSequence(contentEl, updatePromise);
  await router.replace('main-menu');

  // 9. Afficher la version dans le titre de la fenêtre
  try {
    const version = await getVersion();
    await getCurrentWindow().setTitle(`BCC Terminal v${version}`);
  } catch { /* hors contexte Tauri (dev web) — ignoré */ }

  // 10. Vérifier les mises à jour en arrière-plan
  checkForUpdates((text, cssClass) => outputRenderer.printLine(text, cssClass));
}

init();
