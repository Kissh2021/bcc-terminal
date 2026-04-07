/**
 * updater.js — Vérification des mises à jour via tauri-plugin-updater.
 *
 * Deux modes d'utilisation :
 *  1. Boot screen (logo) : checkUpdate() → performUpdate() — UI gérée par bootSequence.js
 *  2. Terminal (après boot) : checkForUpdates(printLine) — affiche dans le terminal
 */

import { check }  from '@tauri-apps/plugin-updater';
import { invoke } from '@tauri-apps/api/core';

/**
 * Vérifie silencieusement si une mise à jour est disponible.
 * Retourne l'objet update (avec .version, .body, .downloadAndInstall) ou null.
 * N'affiche rien — laisse l'appelant gérer l'UI.
 *
 * @returns {Promise<import('@tauri-apps/plugin-updater').Update | null>}
 */
export async function checkUpdate() {
  try {
    const update = await check();
    console.info('[updater] check →', update?.available ? `v${update.version} disponible` : 'aucune MAJ');
    return update?.available ? update : null;
  } catch (err) {
    console.warn('[updater] erreur check :', err);
    return null;
  }
}

/**
 * Télécharge et installe une mise à jour, puis relance l'app.
 * Appelle onProgress(pct: 0–100) à chaque étape.
 *
 * @param {import('@tauri-apps/plugin-updater').Update} update
 * @param {(pct: number) => void} [onProgress]
 */
export async function performUpdate(update, onProgress) {
  let downloaded = 0;
  let total = 0;

  await update.downloadAndInstall((event) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? 0;
        break;
      case 'Progress':
        downloaded += event.data.chunkLength;
        if (total > 0 && onProgress) {
          onProgress(Math.round((downloaded / total) * 100));
        }
        break;
      case 'Finished':
        if (onProgress) onProgress(100);
        break;
    }
  });

  await new Promise(r => setTimeout(r, 1500));
  await invoke('relaunch');
}

/**
 * Vérifie si une mise à jour est disponible.
 * Si oui, affiche un message dans le terminal, télécharge et installe en arrière-plan.
 * Utilisé après le boot (dans le terminal).
 *
 * @param {Function} printLine — outputRenderer.printLine(text, cssClass)
 */
export async function checkForUpdates(printLine) {
  try {
    const update = await checkUpdate();
    if (!update) return;

    printLine('', '');
    printLine('━'.repeat(48), 'separator');
    printLine(` MISE À JOUR DISPONIBLE — v${update.version}`, 'accent');
    if (update.body) printLine(` ${update.body}`, 'dim');
    printLine(' Téléchargement en cours…', 'dim');
    printLine('━'.repeat(48), 'separator');

    await performUpdate(update, (pct) => {
      if (pct % 20 === 0) {
        printLine(` Téléchargement… ${pct}%`, 'dim');
      }
    });

  } catch (err) {
    // Affiche l'erreur dans le terminal pour faciliter le debug
    printLine(`[UPDATER] ${err?.message ?? err}`, 'dim');
  }
}
