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
- 2026-06-20 : **fix liste serveur figee apres validation/rejet/annulation.** Si le serveur repondait "deja traitee" (409), l'ancien code affichait seulement une erreur et laissait l'element dans la liste (re-clic possible indefiniment). Desormais `sipsLoadServeur()` est rappele dans tous les cas (succes ou deja traite) dans `sipsDecide` et `sipsCancelRecord` : l'element traite disparait. Cache SW v85. Tests : `npm run check:js` OK.
- 2026-06-20 : **fix statut serveur accueil + envoi des attentes a la reouverture.** La carte "Serveur local" restait figee sur "Connecte" meme serveur eteint (re-teste une seule fois au rendu). `updSrvDash` devient globale et re-teste a chaque appel ; rafraichissement auto a la reouverture de l'app (`visibilitychange`) et toutes les 15 s quand l'accueil est visible. A la reouverture, si le serveur est joignable, les soumissions en attente partent automatiquement (file locale, pas de sync en arriere-plan). Valide sur appareil : HTTPS + installation PWA + mode hors-ligne (portable ferme) OK. Cache SW v84. Tests : `npm run check:js` OK.
- 2026-06-20 : **support HTTPS optionnel ajoute au serveur (pour le mode hors-ligne PWA).** Le serveur demarre toujours en HTTP (port 3000, secours/compatibilite) et ajoute HTTPS (port 3443) UNIQUEMENT si `server/certs/cert.pem` + `key.pem` existent. Sans certificat : comportement identique a avant, rien ne casse. Variables : `SIPS_TLS_PORT`, `SIPS_TLS_CERT`, `SIPS_TLS_KEY`. `server/certs/` ajoute au `.gitignore`. Guide complet d'installation du certificat (mkcert) et d'approbation sur Android ET iPhone dans `SERVER_HTTPS.md`. Rappel important documente : PAS de sync auto en arriere-plan (file locale qui part a la reouverture ou via bouton Synchroniser), et donnees liees a l'origine (ne pas melanger HTTP `:3000` et HTTPS `:3443` sur un meme telephone). Tests : `node --check` OK, 5 tests isoles OK (HTTP seul sans cert, HTTPS actif avec cert, HTTP toujours present, routes auth via HTTPS), `sips-data.json` non touche.
- 2026-06-20 : **login client + session par role (Phase 2 du plan auth).** Couche de compatibilite `SESSION` <-> ancien `USR`/`ADMIN`/PIN, non bloquante pour le mode 100% local. `applySession()` alimente `USR.nom`/`USR.poste`/`ADMIN` depuis la session serveur. `sipsFetch` envoie le JWT (`Authorization: Bearer`). `authBootstrap()` au demarrage : serveur joignable + comptes -> login (avec echappatoire "mode local") ; premiere config -> creation admin ; serveur injoignable ou non configure -> ancien profil + PIN preserves. Onglets filtres par `hasTab()` (SESSION.tabs si connecte, sinon fallback adminOnly+PIN). Bouton verrou -> bouton compte/deconnexion quand connecte. Fragmente non touche, qualite inchangee. Commit `f32ac47`, cache SW v83. Tests : `npm run check:js` OK. **A TESTER SUR MOBILE** (login, filtrage onglets, deconnexion, mode local sans serveur).
- 2026-06-20 : **authentification serveur ajoutee (Phases 0-1 du plan auth, serveur uniquement, aucun impact client).** Primitives crypto sans dependance (pbkdf2 SHA-512 pour les mots de passe, JWT maison HMAC-SHA256, secret dans `server/data/.jwt-secret` ajoute au `.gitignore`). Roles serveur definis : `admin`, `magasinier`, `operateur`, `preparateur`, `responsableQualite`, chacun avec ses onglets autorises (`tabs`) et ses visas signables (`canSign`). Routes : `GET/POST /api/auth/setup`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/verify-password`, `GET/POST /api/auth/users`, `POST /api/auth/users/:id`. Middleware `requireAuth` + `requireAdmin` compatible a la fois avec l'ancien PIN (`x-sips-admin-pin`) ET le nouveau JWT (`Authorization: Bearer`). Gardes : compte desactive rejete a chaque requete, dernier admin protege (pas de desactivation ni retrait de role), pas d'auto-desactivation, tokens emis avant un changement de mot de passe invalides. Tests : `node --check` OK, 26 tests API isoles OK (serveur temporaire, `sips-data.json` non touche). Commit `d0fed5d`. **Le PIN `1951`/`1234` continue de fonctionner — rien n'est casse.**
- 2026-06-20 : **modularisation frontend sans changement metier.** L'ancien gros `index.html` a ete decoupe : CSS dans `css/styles.css`, JS en scripts classiques ordonnes dans `js/core/` et `js/features/`, enregistrement SW dans `js/sw-register.js`. `index.html` ne garde que la structure HTML et l'ordre des scripts. `npm run check:js` lit maintenant les scripts references par `index.html` + `sw.js`. Cache SW v87. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK, `git diff --check` OK, smoke HTTP local sur port 3999 OK pour `index.html`, `css/styles.css`, `js/core/inventory-core.js`, `js/features/quality.js`.
- 2026-06-20 : **robustesse onglet Serveur apres validation/rejet.** Ajout du bouton `Actualiser liste`, desactivation immediate des boutons `Valider`/`Rejeter`/`Annuler` pendant l'appel serveur, retrait visuel d'une ligne deja traitee/annulee, et message plus clair si l'acces admin manque. Diagnostic : les nouvelles soumissions arrivaient bien en base serveur, mais l'ecran pouvait rester trompeur cote telephone. Cache SW v88. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK, API locale : 2 soumissions `submitted` visibles.
- 2026-06-20 : **Phase 4 auth - gestion comptes dans l'app.** L'onglet `Serveur` affiche maintenant une section `Utilisateurs` : liste comptes, creation d'utilisateur, modification nom/role/statut actif, reset mot de passe optionnel. Les protections restent cote serveur (dernier admin, auto-desactivation, roles valides). Cache SW v89. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK, API `/api/auth/users` OK.
- 2026-06-20 : **fix cache API service worker.** Cause du probleme d'actualisation identifiee : le service worker cachait aussi les GET `/api/...`, donc les listes utilisateurs/soumissions/records pouvaient rester anciennes meme apres `Actualiser`. Les routes `/api/` bypassent maintenant totalement le cache, `sipsFetch` utilise `cache:'no-store'`, et la liste utilisateurs a un bouton direct `Desactiver`/`Reactiver` (pas de suppression physique pour conserver la tracabilite). Cache SW v90. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : **durcissement auth - mots de passe personnels et actions critiques.** Les comptes crees ou reset par l'admin recoivent un mot de passe temporaire (`mustChangePassword`) que l'utilisateur doit changer a la premiere connexion. Le login devient obligatoire quand le serveur est configure ; sans session deja connectee, le mode local n'est plus propose. `Valider`, `Rejeter` et `Annuler` demandent une reconfirmation par mot de passe personnel. Cache SW v91. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : **Phase 6 partielle - visas qualite lies au compte.** Dans `Qualite`, les visas signables viennent maintenant de `SESSION.canSign`. Le nom du visa est force depuis le compte connecte et passe en lecture seule ; l'utilisateur ne peut plus changer le nom affiche sur sa signature. Legacy local conserve le comportement ancien seulement hors session. Cache SW v92. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : **Phase 6 workflow qualite serveur.** Les fiches qualite soumises avec signature operateur apparaissent maintenant dans `Qualite` comme `A signer / en validation serveur` pour les comptes autorises. Un responsable qualite peut ouvrir la fiche serveur en attente, les donnees sont verrouillees, seule sa signature est ajoutable, puis `POST /api/submissions/:id/quality-sign` enregistre le visa avec nom force cote serveur. L'admin valide ensuite quand les 2 signatures obligatoires sont presentes. Les comptes qualite peuvent lire les records `quality` valides sans acces aux autres donnees serveur. Cache SW v93. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : **verrou qualite par numero de lot.** Le serveur refuse maintenant une nouvelle fiche `quality` si une soumission `submitted` ou un record actif non annule existe deja avec le meme `informations.numeroLot`. Une correction reste possible apres rejet de l'ancienne soumission ou annulation du record valide. Cote client, les erreurs API ne sont plus mises en attente comme si le serveur etait hors ligne, et la file offline dedoublonne aussi les fiches qualite par lot. Cache SW v94. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : **motif de rejet serveur.** `Rejeter` demande maintenant un motif/correction demandee dans l'onglet `Serveur`, l'envoie comme `decisionNote`, et l'audit serveur conserve aussi cette note. Cache SW v95. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : **Phase 7 partielle - inventaire fragmente serveur.** Ajout des sessions serveur `inventorySessions` avec base commune (`baseInventoryId`, `baseSnapshot`) issue du dernier inventaire serveur valide. Routes : liste/creation/detail/contribution/finalisation. Le client ajoute dans `Comptage fragmente` un bloc serveur : creer session, actualiser, envoyer sa part, analyser/fusionner. Regle metier appliquee : une contribution officielle ne stocke que `freshCodes + counts` (pas le snapshot complet du telephone) ; si plusieurs compteurs recompent le meme article, conflit visible et fusion bloquee ; la fusion cree une soumission `inventory` en attente de validation admin, pas un record valide direct. Les exports/imports fichiers restent en secours local. Cache SW v96. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK. A tester sur mobile.
- 2026-06-20 : **Phase 7 - resolution explicite des conflits fragmentes serveur.** L'analyse/fusion d'une session serveur ouvre maintenant un dialogue admin si plusieurs compteurs ont recompte le meme article. L'admin voit chaque article en conflit, les compteurs candidats et la valeur calculee, puis choisit explicitement la valeur a garder. Sans choix complet, aucune fusion. Les choix sont conserves dans `payload.frag.resolutions` de la soumission inventaire fusionnee. Cache SW v97. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : **Phase 7 - chargement guide de base session.** Le dialogue `Comptage fragmente` a maintenant `Charger base session` : le telephone archive le comptage courant, charge `baseSnapshot` de la session serveur, remet `sessionStart` a maintenant et efface les timestamps herites pour que seuls les articles modifies ensuite deviennent `freshCodes`. La part envoyee porte `sessionId/baseInventoryId`; le client avertit si la session selectionnee ne correspond pas, et le serveur refuse une contribution dont `baseInventoryId` ne correspond pas a la session. Cache SW v98. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.
- 2026-06-20 : **Phase 7 - pre-comptage local hors serveur.** Ajout du bouton `Demarrer part hors serveur` dans `Comptage fragmente`. Il conserve les chiffres visibles comme base locale, efface les timestamps herites, remet `sessionStart` a maintenant, et marque la part `offlineFragmentStartedAt`. Quand le serveur revient, `Envoyer ma part` n'envoie que les articles modifies depuis ce demarrage (`freshCodes + counts`) ; les autres articles restent pris depuis la base de la session serveur lors de la fusion. Cache SW v99. Tests : `npm run check:js` OK, `node --check server/app.mjs` OK.

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
- `POST /api/submissions/:id/quality-sign` (compte connecte autorise a signer qualite)
- `POST /api/submissions/:id/validate`
- `POST /api/submissions/:id/reject`
- `GET /api/records`
- `GET /api/records?type=sortie&status=validated`
- `POST /api/records/:id/cancel`
- `POST /api/backup`
- `GET /api/backups`
- `GET /api/backups/:file`
- `GET /api/audit`

Routes auth (Phases 0-1) :

- `GET /api/auth/setup` -> `{needsSetup}`
- `POST /api/auth/setup` -> cree le premier admin (bloque si users non vide)
- `POST /api/auth/login` -> `{token, user:{id,nom,role,tabs,canSign}}`
- `GET /api/auth/me` -> user courant (verifie compte actif)
- `POST /api/auth/verify-password` -> `{ok}` (re-confirmation actions critiques)
- `GET /api/auth/users` (admin) -> liste comptes + roles
- `POST /api/auth/users` (admin) -> creer un compte
- `POST /api/auth/users/:id` (admin) -> modifier role / mot de passe / actif

Routes inventaire fragmente serveur :

- `GET /api/inventory-sessions` -> sessions ouvertes, avec resume des contributions
- `POST /api/inventory-sessions` (admin) -> creer une session avec base = dernier inventaire serveur valide
- `GET /api/inventory-sessions/:id` -> detail complet, base et contributions
- `POST /api/inventory-sessions/:id/contributions` -> envoyer sa part officielle (`freshCodes + counts`)
- `POST /api/inventory-sessions/:id/finalize` (admin) -> creer une soumission `inventory` fusionnee si aucun conflit

Routes admin : deux modes acceptes pendant la transition :

```text
x-sips-admin-pin: 1234         (ancien, encore valable)
Authorization: Bearer <jwt>    (nouveau, role admin)
```

Anti-doublon :

- `server/app.mjs` calcule un hash stable de `{ type, payload }`.
- Les champs volatils `id` et `submittedAt` sont ignores.
- Si une soumission identique est deja `submitted` ou correspond a un record actif non annule, le serveur renvoie `duplicate: true`.
- Si le record valide a ete annule, la meme charge utile peut etre resoumise puis revalidee.
- Pour `quality`, un deuxieme contenu avec le meme `informations.numeroLot` est refuse tant que l'ancienne fiche est `submitted` ou qu'un record valide non annule existe. Rejeter l'ancienne soumission ou annuler le record libere le lot pour une correction.

## Chantier authentification + roles (plan valide avec l'utilisateur)

Plan complet valide. Objectif : remplacer le PIN partage par des comptes individuels serveur, droits par role, session JWT persistante.

Etat des phases :

- **Phase 0 (crypto serveur)** : FAIT — commit `d0fed5d`
- **Phase 1 (routes auth serveur)** : FAIT — commit `d0fed5d`
- **Phase 2 (login client + session + filtrage onglets + adaptateur SESSION->USR)** : FAIT (commit `f32ac47`, cache SW v83). A TESTER SUR MOBILE. Login client, session persistante, onglets filtres par role, couche de compatibilite non bloquante (si serveur injoignable/non configure -> ancien profil + PIN preserves; echappatoire "mode local" sur le login). Fragmente non touche, qualite inchangee.
- **Phase 3 (onglets par role + re-confirmation actions critiques)** : FAIT pour `Valider` / `Rejeter` / `Annuler` (cache SW v91). A TESTER SUR MOBILE.
- **Phase 4 (gestion comptes admin dans onglet Serveur)** : FAIT (cache SW v89). A TESTER SUR MOBILE : creer/modifier/desactiver un compte depuis `Serveur`.
- **Phase 5 (mode offline avec session cachee)** : A FAIRE
- **Phase 6 (visas qualite lies au compte)** : FAIT fonctionnellement (cache SW v93) : nom/role verrouilles, soumission operateur, signature responsable qualite sur fiche serveur en attente, validation finale admin apres 2 signatures. A TESTER SUR MOBILE.
- **Phase 7 (inventaire fragmente via serveur, base commune + freshCodes)** : PARTIELLEMENT FAIT (cache SW v99). Sessions serveur, pre-comptage hors serveur, chargement de base commune, contributions strictes, detection de conflits et resolution explicite admin sont codees. A tester sur mobile et a raffiner UX si besoin.

Regles importantes decidees avec l'utilisateur pour la suite :

- **Ne pas supprimer brutalement `USR`, `lep_usr`, `ADMIN`, `ADMIN_PIN`.** Creer d'abord un adaptateur (`currentUserName()`, `currentUserRole()`, `sessionActor()`, `usrVisaKey()` bases sur SESSION avec fallback ancien USR), alimenter `USR`/`ADMIN` depuis SESSION, puis nettoyer seulement apres stabilisation.
- **Droits separes en 3 niveaux** : acces onglet / droit de signer / droit serveur (valider-rejeter-annuler reste admin).
- **Qualite** : validation finale = signature operateur + responsable qualite obligatoires, responsable production OPTIONNEL. Ne pas revenir a 3 signatures obligatoires.
- **Fragmente serveur (a coder PLUS TARD, pas en Phase 2)** : regle de fusion stricte.
  - Base de depart : dernier inventaire valide serveur, ou inventaire de reference choisi par l'admin (`baseInventoryId` + `baseSnapshot`).
  - Chaque fragment officiel ne contient QUE les articles reellement recomptes pendant la session, identifies explicitement :
    ```json
    {
      "baseInventoryId": "inv_...",
      "baseDate": "2026-06-20",
      "agent": "ahmed",
      "freshCodes": ["190001", "190004"],
      "counts": { "190001": {}, "190004": {} }
    }
    ```
  - Fusion, pour chaque article :
    - recompte par un seul compteur -> utiliser sa nouvelle valeur ;
    - recompte par personne -> garder la valeur du dernier inventaire valide serveur (base) ;
    - recompte par PLUSIEURS compteurs -> **CONFLIT visible a l'admin, ne jamais choisir silencieusement**.
  - **Ne jamais fusionner tout le snapshot du telephone.** Une valeur presente dans le telephone peut juste venir de l'ancien inventaire charge : ce n'est PAS un recomptage. Seuls `freshCodes`/`changedCodes` comptent comme recomptage.
  - Resultat : l'inventaire fusionne devient une soumission serveur `inventory` ; apres validation admin, elle devient le nouveau dernier inventaire officiel.

ATTENTION COORDINATION : Phases 0-1 etaient serveur-only (frontiere de deploiement sure). Les Phases 2+ modifient lourdement `index.html`, fichier co-developpe par Codex. Avant d'attaquer la Phase 2, s'assurer qu'aucun autre agent n'edite `index.html` en parallele pour eviter les conflits. Toujours relire les helpers concernes (lignes ~1870-1902 admin/tabs, ~4549-4590 USR/init) car ils ont pu bouger.

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
