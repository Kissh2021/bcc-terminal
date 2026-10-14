# BCC Terminal — architecture

Version : 0.3.3. Dernière modification : 14 octobre 2026.

`src/main.js` initialise l'interface et le routeur. `src/core/` gère les sessions, le terminal et le système de fichiers virtuel ; `src/commands/` expose les commandes ; `src/ui/` contient les vues ; `src/styles/` les styles et palettes. `src-tauri/` héberge le backend Rust et le packaging natif.

## Logos

`public/logo.png` est l'emblème détaillé. `src/boot/bootSequence.js` le charge pour l'écran titre et le splash. `public/logo.svg` référence le même fichier pour compatibilité.

`public/logo-small.png` est la variante simplifiée pour les petites tailles. `src/ui/Header.js` l'affiche dans l'en-tête ; `index.html` la déclare comme favicon. Elle sert de source à `npx tauri icon public/logo-small.png` pour régénérer `src-tauri/icons/`, y compris le fichier ICO multirésolution utilisé par Windows.

Les tailles et effets sont définis dans `src/styles/boot.css` et `src/styles/header.css`. `src-tauri/icons/` contient les déclinaisons générées pour les plateformes natives ; la configuration de packaging sélectionne les fichiers Windows PNG et ICO.

La séquence BIOS affiche le logo BCC ASCII historique défini dans `src/boot/bootFrames.js`, animé caractère par caractère par `src/boot/bootSequence.js`. Une touche permet de passer cette animation.
