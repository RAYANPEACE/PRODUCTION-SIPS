# CLAUDE.md — SIPS (Production LEP / Hunter's Food)

## Projet

PWA mono-fichier `index.html` (~4200 lignes), JavaScript vanilla, IndexedDB + localStorage, 100% hors-ligne, sans backend.
Application de suivi de production, inventaire physique et qualite pour une usine de poudre de lait (gamme DIAMO).
Mobile-first (Android en priorite), aussi sur PC.
Tout le texte UI est en francais.

## Relais de reprise entre agents

Avant toute intervention, lire aussi :

- `docs/SIPS_LOCAL_SERVER_HANDOFF.md` : etat courant, serveur local, prochaines taches, decisions prises avec l'utilisateur.
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
   node -e "const fs=require('fs'),vm=require('vm');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/);vm.createScript(m[1]);console.log('JS OK')"
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

## Structure du code (ordre dans index.html)

1. CSS (`<style>...</style>`)
2. HTML header (tabbar, usrBar, comptageTools, boutons)
3. HTML dialogs (warn, dlg, histDlg, fragDlg, lightbox)
4. `<script>` bloc principal :
   - Helpers ($, num, fmt, round2)
   - REFS (catalogue articles)
   - GROUPS, CATS, STRIPE
   - State (ST, CFG, RO)
   - Conversion functions (total, blankEntry, etc.)
   - Render (buildCard, buildBody, render, refresh)
   - Sauvegarde (saveCfg, idb*, saveCounts)
   - Historique (exportAll, importAll, openHistory)
   - Rendu des onglets (renderAccueil, renderProduction, renderMov, renderRef, renderBilan, etc.)
   - Analyse (renderAnalyse)
   - Fragment (fragIngestFile, fragMergeFiles, etc.)
   - Module Qualite (QS, freshQS, renderQualite, qSave, qExportJSON, qExportPDF, etc.)
   - Profil utilisateur (USR, usrUpdateBar, usrAskProfile)
   - Init IIFE (async function init(){...})()
5. Service Worker registration script
