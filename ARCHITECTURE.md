# BCC Terminal — architecture

Version : 0.1.1. Dernière modification : 13 octobre 2026.

`src/main.js` initialise l'interface et le routeur. `src/core/` gère les sessions, le terminal et le système de fichiers virtuel ; `src/commands/` expose les commandes ; `src/ui/` contient les vues ; `src/styles/` les styles et palettes. `src-tauri/` héberge le backend Rust et le packaging natif.

## Logos

La source visuelle unique est `public/logo.png`. `src/boot/bootSequence.js` la charge pour l'écran titre et le splash et l'affiche dans la séquence BIOS à la place de l'ancien bloc ASCII. `src/ui/Header.js` l'affiche dans l'en-tête ; `index.html` la déclare comme favicon. `public/logo.svg` référence le même fichier pour compatibilité.

Les tailles et effets sont définis dans `src/styles/boot.css` et `src/styles/header.css`. `src-tauri/icons/` contient les déclinaisons générées pour les plateformes natives ; la configuration de packaging sélectionne les fichiers Windows PNG et ICO.
