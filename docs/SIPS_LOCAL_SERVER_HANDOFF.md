# SIPS - Relais developpement serveur local

Derniere mise a jour : 2026-06-20

Ce document sert de relais entre Codex, Claude Code et tout autre agent. Il decrit l'etat actuel, les choix d'architecture, les commandes, les tests deja faits et les prochaines taches.

## Mode relais entre agents IA

Avant de reprendre le projet, lire dans cet ordre :

1. `CLAUDE.md` pour les regles de travail et les pieges du fichier `index.html`.
2. `docs/SIPS_LOCAL_SERVER_HANDOFF.md` pour l'etat du serveur local et le plan courant.
3. `docs/code-review-2026-06-19.md` pour les 5 bugs identifies par revue high effort.

Apres chaque intervention, l'agent doit mettre a jour ce document :

- indiquer ce qui a ete corrige ;
- indiquer les tests lances ;
- deplacer les taches terminees dans "Fait depuis le relais" ;
- laisser les taches restantes avec leur priorite.

## Prompt de redemarrage

Utiliser ce prompt dans une nouvelle conversation Claude Code ou Codex :

```text
Tu reprends le projet SIPS dans C:\Users\halao\PRODUCTION-SIPS.

Lis d'abord CLAUDE.md, puis docs/SIPS_LOCAL_SERVER_HANDOFF.md, puis docs/code-review-2026-06-19.md.

Ne repars pas de zero : le relais officiel est docs/SIPS_LOCAL_SERVER_HANDOFF.md.
Chaque agent, Claude comme Codex, doit mettre a jour ce fichier apres ses changements :
- ce qui a ete fait ;
- les tests lances ;
- ce qui reste a faire ;
- les decisions prises avec l'utilisateur.

Priorite actuelle :
1. Corriger les 5 bugs de docs/code-review-2026-06-19.md.
2. Garder le serveur local fonctionnel.
3. Ne pas casser le mode offline.
4. Lancer npm run check:js apres toute modification de index.html.
5. Ne pas modifier server/data/sips-data.json.
6. Ne pas toucher aux fichiers non lies comme BLUEPRINT.md ou docs/superpowers/ sans demande explicite.

Avant de coder, verifie git status et lis les fonctions concernees.
Si tu modifies le code, fais un commit propre et mets a jour docs/SIPS_LOCAL_SERVER_HANDOFF.md.
```

## Objectif global

Remplacer progressivement les echanges de fichiers WhatsApp par une base centrale locale, sans toucher au serveur industriel de l'usine.

Architecture visee :

```text
Telephones / PC clients
  -> Wi-Fi local
  -> serveur local SIPS sur PC ou mini-PC
  -> base centrale locale
```

Le mode offline/local de la PWA doit rester disponible. Le serveur devient la source officielle pour les donnees soumises puis validees.

## Etat actuel implemente

Commits importants :

- `d29b1df feat: ajoute serveur local SIPS`
- `f84514e feat: connecte app au serveur local`
- `c4051d2 feat: fiabilise validations serveur`

Fichiers principaux :

- `server/app.mjs` : serveur local Node.js sans dependance.
- `server/data/sips-data.json` : base locale generee au runtime, ignoree par Git.
- `index.html` : PWA existante + connexion serveur.
- `SERVER_LOCAL.md` : guide de demarrage.
- `package.json` : scripts serveur et verification JS.

Commandes :

```powershell
cd C:\Users\halao\PRODUCTION-SIPS
npm run server
npm run check:js
```

Serveur :

```text
http://localhost:3000
http://ADRESSE_IP_DU_PC:3000
```

PIN serveur de test :

```text
1234
```

PIN admin app :

```text
1951
```

## Fonctionnel valide par l'utilisateur

- Le telephone accede au serveur local via Wi-Fi.
- Soumission d'une sortie vers le serveur : OK.
- Passage en admin et onglet `Serveur` : OK apres saisie du PIN serveur `1234`.
- Validation des soumissions : OK.
- Anti-doublon serveur : OK, une meme soumission n'est plus creee plusieurs fois.
- Historique `Sorties` affiche les elements valides serveur : OK.

## Revue high effort — corrigee

Source : `docs/code-review-2026-06-19.md`

Statut actuel : **les 5 bugs ont ete corriges** le 2026-06-20. Validation syntaxe JS OK. Cache SW incremente (v70 -> v71). A tester sur mobile.

### Bugs importants (corriges)

1. `importAll` ecrase le profil utilisateur. **CORRIGE** : les cles `lep_usr`, `lep_changes_since_backup`, `lep_backup_count`, `lep_last_backup_ts` sont protegees pendant l'import.

2. Compteur de sauvegarde remis a zero meme si partage annule. **CORRIGE** : `shareOrDownload` retourne la Promise de `navigator.share()`, les fonctions export font `await` avant reset. Logique reset factorisee dans `_resetBackupCounters()`.

3. `ST.agent` vide apres `Nouvel inventaire`. **CORRIGE** : `ST.agent` est re-rempli depuis `USR.nom` apres reset.

### Bugs mineurs

4. L'import gonfle artificiellement le compteur de modifications. **CORRIGE** : le compteur est remis a zero apres la boucle d'import.

5. `qNew()` ne demande pas confirmation si une fiche qualite non enregistree contient deja des donnees. **CORRIGE** : le guard verifie `refProduit`, `quantiteProduite`, `matieresPremieres.length` et `heureDebut` en plus de `QS.id`.

### Qualite de code non bloquante

- Factoriser la rotation A/B + reset compteurs : **partiellement fait** — reset factorise dans `_resetBackupCounters()`, rotation A/B encore dupliquee.
- Optimiser `qNextLotNum`, qui scanne tout IndexedDB a chaque ouverture qualite : **a faire**.

## Fait depuis le relais

- 2026-06-20 : serveur local Node.js ajoute.
- 2026-06-20 : app connectee au serveur local.
- 2026-06-20 : validations serveur fiabilisees.
- 2026-06-20 : soumissions et historiques serveur valides par test utilisateur.
- 2026-06-20 : 5 bugs de revue high effort corriges (import profil, compteur partage, ST.agent, compteur import, qNew confirmation). Cache SW v71.
- 2026-06-20 : annulation admin des records valides ajoutee. Backend `POST /api/records/:id/cancel`, filtres `GET /api/records?type=...&status=...`, audit `record.cancelled`, bouton `Annuler` dans l'onglet `Serveur`, historiques `Sorties` / `Entrees` limites aux records `validated`. Cache SW v72. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK hors sandbox.
- 2026-06-20 : vue detail des soumissions avant validation ajoutee dans l'onglet `Serveur` (sorties/entrees : date, operateur, reference, lignes produits finis, lignes MP, photos, note ; qualite : produit, lot, dates/heures, quantite, taille batch, MP, batches, visas/signatures). Cache SW v73. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : lecture des fiches qualite validees serveur ajoutee dans l'historique `Qualite`. Les fiches officielles s'ouvrent en consultation lecture seule, avec PDF disponible mais sans sauvegarde/resoumission/import accidentels. Cache SW v74. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : validation finale qualite durcie cote serveur. `POST /api/submissions/:id/validate` refuse une soumission `quality` tant que les signatures operateur, responsable production et responsable qualite ne sont pas toutes presentes. Le resume admin affiche maintenant `x/3 signatures`. Cache SW v75. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK, test API temporaire OK sans toucher `server/data/sips-data.json`.
- 2026-06-20 : sauvegardes serveur ajoutees. `server/data/backups/` recoit une sauvegarde quotidienne automatique apres la premiere ecriture du jour, avec retention 7 jours + 4 semaines, et `POST /api/backup` cree une sauvegarde manuelle. Bouton `Sauvegarde serveur` ajoute dans l'onglet `Serveur`. Cache SW v76. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK, test API backup temporaire OK sans toucher `server/data/sips-data.json`.
- 2026-06-20 : export telechargeable des sauvegardes serveur ajoute. Routes admin `GET /api/backups` et `GET /api/backups/:file`, et le bouton `Sauvegarde serveur` telecharge le JSON cree. Cache SW v77. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK, test API backup download temporaire OK.
- 2026-06-20 : decision workflow qualite appliquee partiellement. La validation finale serveur exige maintenant seulement les signatures `operateur` et `responsableQualite`; `responsableProd` reste visible mais optionnel. Le compteur de sauvegarde locale n'est plus incremente par les autosauvegardes `current` / fragment. Cache SW v78. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK, test API temporaire 2 signatures OK.
- 2026-06-20 : refonte UX legere serveur/offline et anti-doublons locaux. Les actions serveur sont mises en avant, les exports WhatsApp/fichier sont renommes en secours/local. Les sauvegardes locales n'acceptent plus les doublons pour sorties, entrees, productions, fiches qualite et inventaires archives/fusionnes. Cache SW v79. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : soumissions serveur ajoutees pour `inventory` et `production`. Le bouton principal comptage devient `Soumettre inventaire`, le dialogue resume propose `Soumettre au serveur`, Production a un bouton `Soumettre au serveur`, et l'onglet `Serveur` affiche les details admin de ces deux types avant validation. Cache SW v80. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : anti-doublon renforce cote file d'attente serveur offline. Une meme soumission en attente n'est plus ajoutee deux fois, et les anciennes files avec doublons sont dedupliquees au moment de l'envoi. Cache SW v81. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : historiques serveur ajoutes pour `production` et `inventory`. Les productions validees serveur apparaissent en haut de l'historique Production, et les inventaires valides serveur apparaissent dans l'Historique inventaire en lecture seule, separes de l'historique local. Cache SW v82. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.

## Comportement actuel important

### Historique local vs serveur

Dans `Sorties` et `Entrees`, l'historique est maintenant separe :

- `Validees serveur` : donnees officielles, non supprimables depuis l'ecran mouvement.
- `Historique local` : donnees IndexedDB locales, supprimables localement.

Une sortie/entree validee serveur ne peut pas etre supprimee depuis `Sorties` / `Entrees`. L'annulation se fait en admin depuis l'onglet `Serveur`, avec audit serveur.

### Suppression / annulation serveur implementee

Besoin utilisateur signale :

> Une sortie validee serveur est visible, mais on ne peut que l'ouvrir. Il n'y a pas encore d'action de suppression/annulation.

Decision appliquee :

- Ne pas supprimer physiquement les records valides.
- Ajouter une action admin `Annuler`, avec audit.
- Les historiques operationnels ignorent les records `cancelled`.
- Les bilans/analyses devront aussi ignorer les records `cancelled` quand ils consommeront la base serveur.

Modele cible :

```text
submitted -> validated -> cancelled
submitted -> rejected
```

Avec champs :

```json
{
  "cancelledAt": "...",
  "cancelledBy": "...",
  "cancelReason": "..."
}
```

## API actuelle

Routes principales :

- `GET /api/health`
- `POST /api/submissions`
- `GET /api/submissions`
- `GET /api/submissions?status=submitted&include=payload`
- `GET /api/submissions/:id`
- `POST /api/submissions/:id/validate`
- `POST /api/submissions/:id/reject`
- `GET /api/records`
- `GET /api/records?type=sortie&status=validated`
- `POST /api/records/:id/cancel`
- `POST /api/backup`
- `GET /api/backups`
- `GET /api/backups/:file`
- `GET /api/audit`

Routes admin : ajouter header :

```text
x-sips-admin-pin: 1234
```

Anti-doublon :

- `server/app.mjs` calcule un hash stable de `{ type, payload }`.
- Les champs volatils `id` et `submittedAt` sont ignores.
- Si une soumission identique est deja `submitted` ou correspond a un record actif non annule, le serveur renvoie `duplicate: true`.
- Si le record valide a ete annule, la meme charge utile peut etre resoumise puis revalidee.

## Prochaines taches recommandees

### Vue detail des soumissions avant validation - fait

L'admin voit maintenant le detail d'une soumission en attente directement dans l'onglet `Serveur` avant les boutons `Valider` / `Rejeter` :

- lignes produits finis ;
- lignes MP ;
- ref / date / agent ;
- pour qualite : produit, lot, MP, batches, signatures.

### Priorite 1 - Qualite serveur

Workflow cible :

```text
operateur renseigne + signe
-> soumet serveur
-> responsable production signe ou valide
-> responsable qualite signe
-> validation finale
-> archive officielle
```

Aujourd'hui `Qualite` peut soumettre au serveur et relire les fiches validees serveur en consultation. La validation finale serveur exige les signatures operateur et responsable qualite. Le visa responsable production reste optionnel. Il manque encore :

- statuts multi-signatures ;
- workflow serveur multi-etapes entre les responsables avant validation finale.

### Priorite 2 - Fragmentation serveur

Les soumissions `inventory` et `production` peuvent etre validees par l'admin, puis relues dans les historiques metier correspondants.

Il reste a remplacer progressivement le workflow fragmente export/import/fusion par des sessions serveur :

- creer une session d'inventaire serveur ;
- permettre a plusieurs compteurs de soumettre leurs fragments a cette session ;
- fusionner/valider la session cote admin ;
- garder export/import fragment comme secours local uniquement.

### Sauvegardes automatiques - fait

Etat actuel :

- dossier `server/data/backups/` ignore par Git ;
- backup quotidien automatique apres premiere ecriture du jour ;
- retention simple : 7 derniers jours + 4 semaines ;
- route admin `POST /api/backup` ;
- bouton admin `Sauvegarde serveur`.
- export telechargeable depuis l'interface.

### Priorite 3 - SQLite

Le JSON central est volontairement temporaire.

Passer a SQLite quand les workflows sont valides :

- `submissions`
- `records`
- `audit`
- `users`

Garder export JSON complet pour sauvegarde/restauration.

## Regles de travail

- Ne pas toucher au serveur industriel usine.
- Ne pas casser le mode offline local.
- Toujours lancer :

```powershell
npm run check:js
```

- Pour tester serveur :

```powershell
npm run server
```

- Si le port 3000 est deja occupe :

```powershell
$env:SIPS_PORT="3001"
npm run server
```

- Ne pas commiter `server/data/sips-data.json`.
- Ne pas embarquer `BLUEPRINT.md` ou autres fichiers non suivis sans intention claire.

## Dernier etat Git connu

Apres `c4051d2`, seuls ces chemins etaient non suivis :

```text
BLUEPRINT.md
docs/
```

Ce document est cree pour devenir le point de relais officiel.
