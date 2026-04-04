### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### 7. CLAUDE.md — Mise à jour systématique
- **Après chaque session de travail : mettre à jour CLAUDE.md.**
- Toute nouvelle convention, pattern architectural, règle UI ou leçon apprise doit être documentée ici.
- Ne jamais terminer une session sans vérifier si CLAUDE.md est à jour.

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.

## Architecture — Points clés

### Saisie interactive dans le terminal
Toute commande qui doit attendre une saisie utilisateur (ex : login, accounts) doit utiliser
`src/utils/promptInput.js` au lieu d'attacher directement un listener sur `#terminal-input`.
Cette fonction utilise la phase capture + `stopImmediatePropagation` pour intercepter l'Entrée
avant le handler du terminal, évitant ainsi le double-dispatch ("commande inconnue").

### FocusManager — règles critiques
- `focusManager.claim(component)` empile le propriétaire précédent → `release()` le restaure.
- **Ne jamais appeler `inputEl.focus()` de manière programmatique si un overlay est ouvert.**
  Dans `terminal.js`, le refocus post-commande est conditionné à l'absence de `#doc-viewer-overlay`.
- `claimFocus()` dans `TerminalBar` est déclenché uniquement sur interaction utilisateur
  (raccourci `:` / Tab), jamais sur focus programmatique, pour éviter d'écraser un overlay actif.

### Router — navigation
- `router.push(view)` empile la vue courante → `router.pop()` y revient.
- `router.replace(view)` remplace sans empiler (utilisé pour l'accueil, pas de retour arrière).
- Le router émet `bcc:route-changed` après chaque navigation → le Header écoute pour mettre à jour ses boutons contextuels.

### Header — boutons de navigation contextuels
- **← ACCUEIL** : `router.replace('main-menu')` — visible sur toutes les vues sauf main-menu.
- **↩ RETOUR** : `router.pop()` — visible sur toutes les vues sauf main-menu.
- Le Header se re-rend sur `bcc:session-changed` ET `bcc:route-changed`.

### Notes — canvas infini (NotesView)
- **Modèle de données** : `notes-data` → `{ activePageId, pages: [{ id, name, notes, panX, panY }] }`
  - Migration automatique depuis l'ancien format `notes` (tableau plat) → PAGE 1.
- **Canvas world** : un élément `.canvas-world` (`pointer-events: none`) est enfant de `.notes-canvas`.
  Les notes ont `pointer-events: auto` (restauré explicitement). Cela permet :
  - clics fond vide → passent au canvas (rubber-band / panning)
  - clics notes → reçus par les notes
- **Panning** : clic droit (button 2) OU clic molette (button 1) + drag sur `.notes-canvas`.
  Implémenté avec **Pointer Events** (`pointerdown` / `pointermove` / `pointerup`) + `canvas.setPointerCapture(e.pointerId)`
  pour neutraliser les gestures navigateur (Vivaldi, Opera) et bloquer l'auto-scroll molette.
  Ne pas revenir à `mousedown` / document events.
  Position sauvegardée par page au `pointerup`.
- **Nouvelle note** : position calculée en world-coords = `(-panX + marge, -panY + marge)` pour apparaître
  dans le coin haut-gauche visible, peu importe le pan courant.
- **Repère centre** : div `.canvas-center-marker` ajouté une seule fois dans `.notes-canvas` (PAS dans `.canvas-world`),
  positionné à `left:50%; top:50%` → toujours au centre du viewport, non affecté par le pan.
  Crosshair CSS (`::before` horizontal, `::after` vertical), opacité 0.3.
- **Reset vue** : bouton `⌖ VUE` dans la toolbar → remet `page.panX = 0, page.panY = 0` + `applyPan()`.
- **Rubber-band** : coordonnées converties en world-space en soustrayant le pan
  (`e.clientX - canvasRect.left - page.panX`).
- **Drag des notes** : formule `noteData.x = e.clientX - startX` — intègre naturellement le pan
  car `startX` capture l'offset viewport au départ du drag.
- **Pages** : onglets dans la toolbar, add/delete, chaque page a son pan indépendant.

### Ajouter une commande
1. Créer `src/commands/<nom>.js` avec `{ name, description, usage, secret, handler }`
2. L'importer et l'enregistrer dans `src/commands/index.js`
3. Mettre à jour `README.md` (tableau des commandes)
4. Mettre à jour `CLAUDE.md` si la commande introduit un nouveau pattern

## Git Rules — IMPÉRATIF

- **JAMAIS de commit sans accord explicite du propriétaire du projet.** Avant tout `git commit`, demander confirmation directe. Pas d'implicite, pas de "je suppose que c'est ok".
- **JAMAIS de push.** Le push ne vient QUE du propriétaire. Ne jamais exécuter `git push` sous aucun prétexte, même si demandé dans un contexte ambigu. Si la demande est explicite et directe, confirmer une dernière fois avant d'agir.
