# bcc-terminal

Terminal rétro interactif avec effets CRT, système de fichiers virtuel et gestion de sessions.

## Commandes disponibles

| Commande   | Usage                          | Description                                      |
|------------|--------------------------------|--------------------------------------------------|
| `help`     | `help [commande]`              | Lister les commandes ou détailler une commande   |
| `login`    | `login [utilisateur]`          | Se connecter (liste les comptes enregistrés)     |
| `logout`   | `logout`                       | Fermer la session courante                       |
| `accounts` | `accounts [remove <nom>]`      | Lister / supprimer les comptes enregistrés       |
| `whoami`   | `whoami`                       | Afficher l'utilisateur et le groupe courant      |
| `ls`       | `ls [chemin]`                  | Lister le contenu d'un répertoire                |
| `cd`       | `cd <chemin>`                  | Changer de répertoire courant                    |
| `cat`      | `cat <fichier>`                | Afficher le contenu d'un fichier                 |
| `clear`    | `clear`                        | Effacer l'écran terminal                         |
| `palette`  | `palette [list \| set <nom>]`  | Changer la palette de couleurs                   |
| `crt`      | `crt [on \| off]`              | Activer/désactiver les effets écran cathodique   |

### accounts — détail

```
accounts               → liste les comptes enregistrés, puis demande un numéro à supprimer
accounts remove <nom>  → supprime directement le compte <nom> de la liste
```

## Utilitaires partagés

- `src/utils/promptInput.js` — attend une saisie clavier dans le terminal (phase capture, bloque le dispatcher)
- `src/utils/typewriter.js` — effets d'écriture et délais
- `src/utils/storage.js`    — abstraction localStorage
