# BCC Terminal — documentation

Version : 0.3.1. Dernière modification : 13 octobre 2026.

Application desktop Tauri 2 avec interface Vite et JavaScript. Les commandes de développement et les conventions sont décrites dans `AGENTS.md` ; les commandes du terminal dans `README.md`.

## Notes sur le style

- Fond presque noir `#080808`, surfaces `#0d0d0d`, traits verts discrets.
- Texte phosphore `#33ff33`, texte lumineux `#66ff66`, accent `#00ff88`.
- Police Share Tech Mono, capitales espacées, messages BIOS et séparateurs fins.
- Effets CRT : scanlines, halo diffus, scintillement et transitions au noir.
- Composition sobre, beaucoup d'espace vide et hiérarchie de luminosité.

## Identité visuelle

`public/logo.png` est l'emblème officiel adapté au terminal : vert phosphore sur fond transparent, sablier, horloge, engrenages, lauriers, étoile, globe et devise « ORDO TEMPORIS ». Il est utilisé sur l'écran titre, le splash accessible depuis le menu, la séquence BIOS, l'en-tête et le favicon. Le logo reste vert dans les palettes alternatives ; le halo suit la palette.

`public/logo.svg` est une enveloppe de compatibilité qui référence ce même PNG, sans ancien dessin. Les icônes natives sont dérivées avec `npx tauri icon public/logo.png` et nécessitent une recompilation de l'application pour apparaître dans Windows.

### Génération

Outil intégré imagegen, à partir de l'emblème fourni. Prompt : adapter le sceau circulaire BCC en édition CRT monochrome vert `#33ff33`, préserver ses symboles et les textes « BUREAU DE CONTROLE DES CHRONOLOGIES », « ORDO TEMPORIS », « BCC », utiliser des contours lumineux sur fond transparent, simplifier les détails pour un affichage à 200 px, halo modéré et texture CRT subtile.
