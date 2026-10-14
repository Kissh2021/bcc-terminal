# BCC Terminal — documentation

Version : 0.3.3. Dernière modification : 14 octobre 2026.

Application desktop Tauri 2 avec interface Vite et JavaScript. Les commandes de développement et les conventions sont décrites dans `AGENTS.md` ; les commandes du terminal dans `README.md`.

## Notes sur le style

- Fond presque noir `#080808`, surfaces `#0d0d0d`, traits verts discrets.
- Texte phosphore `#33ff33`, texte lumineux `#66ff66`, accent `#00ff88`.
- Police Share Tech Mono, capitales espacées, messages BIOS et séparateurs fins.
- Effets CRT : scanlines, halo diffus, scintillement et transitions au noir.
- Composition sobre, beaucoup d'espace vide et hiérarchie de luminosité.

## Identité visuelle

`public/logo.png` est l'emblème officiel adapté au terminal : vert phosphore sur fond transparent, sablier, horloge, engrenages, lauriers, étoile, globe et devise « ORDO TEMPORIS ». Il est utilisé sur l'écran titre, le splash accessible depuis le menu. Le logo reste vert dans les palettes alternatives ; le halo suit la palette.

`public/logo.svg` est une enveloppe de compatibilité qui référence ce même PNG, sans ancien dessin.

`public/logo-small.png` est la variante pour les petites tailles : un sablier plein dans un cercle épais, sans inscriptions ni ornements, en vert phosphore sur fond transparent. Elle est utilisée dans l'en-tête (32 px), comme favicon et pour toutes les icônes natives. Régénérer ces dernières avec `npx tauri icon public/logo-small.png`. Une recompilation de l'application est nécessaire pour voir la nouvelle icône dans Windows.

### Génération

Outil intégré imagegen, à partir de l'emblème fourni. Prompt : adapter le sceau circulaire BCC en édition CRT monochrome vert `#33ff33`, préserver ses symboles et les textes « BUREAU DE CONTROLE DES CHRONOLOGIES », « ORDO TEMPORIS », « BCC », utiliser des contours lumineux sur fond transparent, simplifier les détails pour un affichage à 200 px, halo modéré et texture CRT subtile.

Prompt de la variante miniature (outil intégré imagegen) : simplifier radicalement l'emblème de référence en un sablier plein au centre d'un cercle épais, monochrome vert phosphore `#33ff33`, fond transparent, lisible à 16 et 32 px, sans texte, engrenages, lauriers, étoiles, grain, scanlines ou halo ; composition carrée centrée avec marge de sécurité.

La séquence BIOS affiche le logo BCC ASCII historique défini dans `src/boot/bootFrames.js`, animé caractère par caractère par `src/boot/bootSequence.js`. Une touche permet de passer cette animation.
