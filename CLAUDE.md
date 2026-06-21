# CLAUDE.md — SIPS (Production LEP / Hunter's Food)

## Projet

PWA JavaScript vanilla, IndexedDB + localStorage, 100% hors-ligne, avec serveur local optionnel.
Application de suivi de production, inventaire physique et qualite pour une usine de poudre de lait (gamme DIAMO).
Mobile-first (Android en priorite), aussi sur PC.
Tout le texte UI est en francais.

## Relais de reprise entre agents

Avant toute intervention, lire aussi :

- `docs/SIPS_LOCAL_SERVER_HANDOFF.md` : etat courant, serveur local, prochaines taches, decisions prises avec l'utilisateur.
- `docs/SIPS_LESSONS_LEARNED.md` : pieges rencontres et regles a reutiliser pour SIPS et les prochaines apps terrain.
- `docs/code-review-2026-06-19.md` : 5 bugs de revue high effort a corriger.

Apres chaque correction, mettre a jour `docs/SIPS_LOCAL_SERVER_HANDOFF.md` avec ce qui a ete fait, les tests lances et les taches restantes.

## Architecture technique

- **IndexedDB** : base `inv_db`, store `inv`, keyPath `id`
  - Prefixes d'ID : `inv_*` (inventaires), `prod_*` (productions), `sortie_*` (sorties), `entree_*` (entrees), `batch_*` (fiches qualite), `fragsess_*` (sessions fragmentees), `current` (inventaire en cours)
- **localStorage** : cles `lep_*` + `inv_cfg`
  - `lep_usr` : profil utilisateur `{nom, poste}`
  - `lep_recf` : recettes (RECF)
  - `lep_changes_since_backup` : compteur modifications depuis derniere sauvegarde
  - `lep_last_backup_ts` : timestamp derniere sauvegarde
  - `lep_backup_count` : compteur pour rotation A/B des fichiers de sauvegarde
- **Frontend decoupe** : `index.html` charge `css/styles.css`, `domain/inventory.js`, puis les fichiers `js/core/*.js` et `js/features/*.js` en scripts classiques ordonnes.
- **Service Worker** : `sw.js` avec cache versionne `inv-lep-vXX` — TOUJOURS incrementer la version apres chaque modification
- **Helpers existants a reutiliser** : `$`, `esc`, `num`, `fmt`, `fmtq`, `toast`, `clone`, `todayStr`, `frDate`, `compress`, `photoArrayUI`, `shareOrDownload`, `scrollCardIntoView`, `lsGet`/`lsSet`, `idbPut`/`idbGet`/`idbAll`/`idbDel`
- **TABS** : format `[id, label, ready, adminOnly]` (tableau de tableaux)
- **RECF** : `{[produit]: [{code, des, qte}...]}` — `des` = designation
- **REFS** : `{code, des, u, g, m, cat, p}` — `cat` = 'fini' ou 'mp'

## Onglets (12)

accueil, comptage, prod, ref, bilan, feuillet, capacite, plan, sorties, entree, analyse, qualite

## Regles CRITIQUES

### Securite des fichiers
1. **JAMAIS utiliser Python** pour ecrire index.html ou tout fichier critique. Python `open('w')` tronque le fichier a 0 octets AVANT d'ecrire — si le script plante, le fichier est perdu. INCIDENT REEL le 2026-06-18 : 700 lignes de travail non-commite perdues.
2. Utiliser UNIQUEMENT le **Edit tool** (remplacements cibles) ou **Node.js** `fs.readFileSync/writeFileSync` (edits programmatiques)
3. **Toujours valider la syntaxe JS** apres CHAQUE modification :
   ```
   npm run check:js
   ```
4. **Toujours creer un tag de securite** avant une serie de modifications : `git tag backup-before-XXX`
5. **Commiter apres chaque fonctionnalite qui marche** — ne jamais accumuler de travail non-commite

### Encodage
6. Le fichier melange des caracteres UTF-8 litteraux (accents, emojis) et des echappements `\uXXXX` — preserver les deux tels quels
7. **JAMAIS** mettre de guillemets typographiques (`'` U+2019) dans les chaines JS delimitees par `'...'` — utiliser uniquement des apostrophes droites ou reformuler
8. Pour les messages `alert()`/`confirm()` : utiliser `\n` pour les sauts de ligne, JAMAIS de vrais retours a la ligne dans la chaine

### Workflow
9. Toujours **lire le code avant de le modifier** — verifier le contenu exact des lignes
10. **Incrementer la version du cache SW** (`sw.js` ligne 1) apres chaque push : `inv-lep-vXX` → `inv-lep-v(XX+1)`
11. Pousser sur GitHub (`git push origin main`) apres chaque batch de commits
12. L'utilisateur teste sur **mobile Android** — toujours penser responsive/touch
13. Sur Android, `navigator.share({files:[...]})` ouvre le menu de partage. Pour les fichiers `.txt`, utiliser MIME `text/plain` (pas `application/json` — WhatsApp ne le supporte pas bien)
14. Les fichiers recus via WhatsApp sont dans `Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Documents/` — pas dans Telechargements. Prevoir un bouton "Coller" comme alternative au selecteur de fichiers.

## Methode de travail recommandee

1. Creer un tag de securite : `git tag backup-before-XXX`
2. Faire les modifications avec Edit tool
3. Valider la syntaxe JS
4. Commiter avec message descriptif
5. Incrementer le cache SW
6. Pousser sur GitHub
7. Demander a l'utilisateur de tester (fermer+rouvrir l'app pour charger la nouvelle version)

## Structure frontend actuelle

1. `index.html` : structure HTML, dialogues, ordre des scripts.
2. `css/styles.css` : styles extraits de l'ancien bloc `<style>`.
3. `domain/inventory.js` : helpers domaine deja separes.
4. `js/core/inventory-core.js` : helpers, catalogue, coeur inventaire/comptage/historique.
5. `js/core/server-session-tabs.js` : serveur local, session auth, onglets, referentiels.
6. `js/features/production-movements-server.js` : production, sorties/entrees, onglet serveur.
7. `js/features/analysis-bilan-feuillet.js` : analyses, tableau de bord, bilan, feuillet PDF.
8. `js/features/capacity-plan.js` : capacite, plan, stock vivant.
9. `js/features/fragments.js` : comptage fragmente local/fichiers.
10. `js/features/quality.js` : module Qualite.
11. `js/core/auth-init.js` : profil legacy, login/setup client, init.
12. `js/sw-register.js` : enregistrement du service worker.

Les scripts restent des scripts classiques (pas `type="module"`) pour garder les fonctions globales et eviter une migration comportementale. Preserver l'ordre des scripts dans `index.html`.
