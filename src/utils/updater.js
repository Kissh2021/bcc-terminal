/**
 * updater.js — Vérification des mises à jour via tauri-plugin-updater.
 *
 * Appelé après le boot. Affiche un message dans le terminal si une mise à jour
 * est disponible, puis la télécharge et l'installe silencieusement.
 * L'app redémarre après installation (mode "passive" — sans fenêtre intrusive).
 */

import { check }  from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';

/**
 * Vérifie si une mise à jour est disponible.
 * Si oui, affiche un message dans le terminal, télécharge et installe en arrière-plan.
 *
 * @param {Function} printLine — outputRenderer.printLine(text, cssClass)
 */
export async function checkForUpdates(printLine) {
  try {
    const update = await check();
    if (!update?.available) return;

    printLine('', '');
    printLine('━'.repeat(48), 'separator');
    printLine(` MISE À JOUR DISPONIBLE — v${update.version}`, 'accent');
    if (update.body) printLine(` ${update.body}`, 'dim');
    printLine(' Téléchargement en cours…', 'dim');
    printLine('━'.repeat(48), 'separator');

    // Téléchargement avec progression
    let downloaded = 0;
    let total = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength ?? 0;
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          if (total > 0) {
            const pct = Math.round((downloaded / total) * 100);
            // Mise à jour discrète dans le terminal toutes les 20%
            if (pct % 20 === 0) {
              printLine(` Téléchargement… ${pct}%`, 'dim');
            }
          }
          break;
        case 'Finished':
          printLine(' Installation terminée. Redémarrage dans 3 secondes…', 'accent');
          break;
      }
    });

    // Redémarre l'application pour appliquer la mise à jour
    await new Promise(r => setTimeout(r, 3000));
    await invoke('relaunch');

  } catch {
    // Silencieux — pas de mise à jour ou réseau indisponible, on continue normalement
  }
}
