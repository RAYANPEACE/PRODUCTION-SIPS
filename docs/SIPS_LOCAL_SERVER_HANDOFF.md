# SIPS — Relais developpement serveur local (vue courante)

Derniere mise a jour : 2026-06-30

Point d'entree pour reprendre le projet. **Court par design** : seulement l'etat courant, les prochaines taches et les decisions actives. L'historique complet (journal date de tous les lots) est dans **`docs/SIPS_HANDOFF_ARCHIVE.md`** ; le detail commit par commit est dans `git log` ; les decisions durables sont en memoire (`MEMORY.md`).

> Regle d'ecriture : garder ce fichier court. Une entree = 1-2 lignes. Archiver le journal dans `SIPS_HANDOFF_ARCHIVE.md` quand il gonfle. Ne pas recopier les messages de commit (git le fait).

## Objectif global

Remplacer les echanges de fichiers WhatsApp par une base centrale locale (serveur local SIPS sur PC/mini-PC via Wi-Fi), sans toucher au serveur industriel de l'usine. Le mode offline/local de la PWA doit rester disponible ; le serveur devient la source officielle apres validation.

## Etat courant (2026-06-24)

Branche de travail : **`inventaire-serveur`** (33+ commits devant `main`, **non mergee**). Contient le durcissement securite Phases 0-5 + le verrou strict hors-ligne + les 3 lots ci-dessous.

Fait et verifie en local (sur branche, **pas encore teste mobile ni passe au gate Codex**) :
- **2026-07-02 - Serveur : Voir la fiche + tri + UX** (sur `main`, SW v201) : bouton "Voir la fiche" (production/entree/sortie en attente) -> vue plein ecran lecture seule avec details en grand + PHOTOS + Valider/Rejeter/Retour (sipsOpenSubmissionView, n altere pas le brouillon ; sipsDecide renvoie bool ; sipsLoadServeur null-safe) ; "Donnees validees" triees validatedAt desc ; dialogue mot de passe : Entree=Confirmer + focus auto ; libelle detail production "Dechet melange (kg)". `check:js` OK.
- **2026-07-02 - Qualite : filtres + recap tonnage** (sur `main`, SW v200) : historique Qualite recoit les memes filtres temporels que Entree/Sortie + un filtre produit fini uniquement (HIST_FILTERS.qualite, composants histFilter* reutilises, histMatchArticle gere refProduit) ; recap sous les filtres = tonnage global + par produit fini, calcule sur tout le filtre, fiches validees serveur seulement. `check:js` OK.
- **2026-07-02 - gestion suggestions + date peremption ciblee** (sur `main`, SW v199) : panneau "Gerer les suggestions" (retrait manuel par champ, masquage lep_sughide couvrant aussi le serveur, jamais de suppression auto) ; date de peremption affichee seulement pour MP perissable (g=vrac/tare), masquee pour emballages, reagit au changement d article (mpNeedsExp partage avec garde-fou FEFO). `check:js` OK.
- **2026-07-02 - fixes revue adversariale Codex (base 5335214)** (sur `main`, SW v198) : (1) cycles encre tries par `payload.submittedAt` (ordre fabrication) au lieu de `validatedAt` ; (2) `movRefCombined` repli sur `mf.ref` -> ref legacy preservee au resave d un vieux mouvement ; (3) `stockDispo` ne retombe plus sur le brouillon d inventaire en cours ; echec serveur partiel -> etat manuel + note d erreur visible sur Capacite/Plan ; (4) doc convention inventaire=debut de journee (justifie `includeStartDate:true`). Finding same-day inventaire = non-probleme (compte en debut de journee). `check:js` OK.
- **2026-07-02 - suivi cartouches encre + LAITY surligne + suggestions partagees + fix bobine** (sur `main`) : (1) LAITY surligne (fond bleu) au lieu du texte ; (2) suggestions matricule/chauffeur/dest desormais PARTAGEES (derivees des mouvements valides serveur, fusion + local offline) ; (3) machine flag `encre` (m20) + bouton 'changement de cartouches' + champ 'cartons avant changement' en production -> onglet Capacite affiche rendement moyen/jeu, max cartons par produit, restant du cycle en cours (cycles comptes en sachets, dechets film au prorata, 'en apprentissage' sans cycle complet) ; (4) fix bouton '+ bobine' qui faisait remonter l'ecran mobile (maj en place). SW v194. Tests : `check:js`, `test:stock` 46/46, `test:lot` 11/11 + trace logique cycles OK.
- **2026-07-02 - capacite/plan + LAITY bleu + champs evolutifs** (sur `main`) : Capacite/Plan reutilisent `computeStockData()` (source officielle onglet Stock, avec `includeStartDate`) -> corrige l ecart 1800 vs 1300 (sortie du jour ignoree) ; produit LAITY colore en bleu partout dans l UI (helpers `isLaity`/`hlLaity`, classe `.laity`) ; Entree/Sortie : champ `ref` unique remplace par matricule/chauffeur/destinataire(sortie)/provenance(entree) en datalist a suggestions memorisees (localStorage `lep_sug_*`), `ref` combine conserve pour compat. SW v192. Tests : `check:js`, `test:stock` 46/46, `test:lot` 11/11.
- **2026-06-30 - identite produit par code** : recettes, production, qualite, plan, bilan et stock utilisent le code produit comme cle ; les anciens enregistrements par libelle restent resolus vers le PF courant. SW v173. Tests : `check:js`, `test:server` 80/80, `test:stock` 45/45, `test:lot` 11/11.
- **2026-06-30 - Stock deduit les dechets production** : en plus de la recette normale, Stock deduit les dechets carton/sac, film, et repartit le melange perdu proportionnellement sur les MP de la recette ; recette retrouvee meme si l ancien libelle pointe vers le PF actuel. SW v172. Tests : `check:js`, `test:stock` 42/42.
- **2026-06-30 - Stock serveur fiable** : l onglet Stock lit les records serveur en mode compact sans photos/base64, timeout augmente, et refuse un calcul serveur partiel au lieu de remplacer une lecture echouee par zero mouvement. SW v171. Tests : `check:js`, `test:server`.
- **2026-06-30 - listes produits finis dynamiques** : Production/Qualite/Recettes/Machines/Plan ne proposent plus que les produits finis existants ; un renommage article deplace automatiquement recette, plan et cadences machine vers le nouveau libelle. SW v170. Tests : `check:js`.
- **2026-06-30 - rattachement recettes/stock Laity** : Stock rattache une recette au produit fini meme si son libelle differe (`CARTON LAITY 20G` -> 390007) sans crediter le carton 190021 comme PF ; l interface recettes suit le meme rattachement. SW v169. Tests : `check:js`, `test:stock` 35/35.
- **2026-06-30 - reprise stock/qualite/historiques** : Qualite recharge aussi les fiches serveur en attente, Stock inclut les mouvements valides du jour de la base, historiques Production/Entree/Sortie affichent les lignes article+quantite sans ouvrir. SW v168. Tests : `check:js`, `test:stock` 32/32.
- **2026-06-30 - garde-fous soumission/historiques qualite** : Production/Entree/Sortie refusent les lignes sans article/produit fini cote UI + serveur, production validee reapparait dans l historique serveur, Qualite recharge les derniers lots MP tous produits confondus avec rappel de verification. SW v167. Tests : `check:js`, `test:server` 79/79, `test:stock` 29/29, `test:lot` 11/11.
- **2026-06-30 - correctifs mobile/historiques/referentiels** : menu `Plus` mobile en panneau fixe, Bilan laisse le pourcentage revenir a la ligne, Accueil separe serveur/local ; referentiels/recettes/machines/plan synchronises serveur, articles/methodes/produits tries par code. SW v157. Tests : `check:js`, `test:server` 74/74, `test:stock` 29/29, `test:lot` 11/11. Verification navigateur non faite : aucun browser expose dans la session.
- **2026-06-30 - retours terrain mobile/qualite** : menu `Plus` mobile repositionne sous le bouton, boutons de synchro referentiels, workflow Qualite clarifie (ouvrir/signature depuis onglet Qualite, bouton serveur `Ouvrir fiche`, validation bloquee si 1/2 signatures, temps moyen + duree par batch visibles), collage secours masque. SW v159.
- **2026-06-30 - synchro referentiels admin** : le bouton `Envoyer serveur` affiche maintenant la vraie erreur serveur/reconnexion au lieu d un refus admin generique ; push auto referentiels ignore proprement les sessions expirees. SW v160.
- **2026-06-30 - correctifs ouverture qualite/ref serveur** : `Envoyer serveur` indique explicitement de redemarrer si `/api/referentials` manque ; `Ouvrir fiche` serveur bascule vraiment sur l onglet Qualite avant de charger la fiche. SW v161.
- **2026-06-30 - ouverture fiche qualite durcie** : `qOpenSubmittedQuality` pilote lui-meme le basculement onglet Qualite, l ecran de chargement et attend le rendu complet. SW v162.
- **2026-06-30 - flux ouverture qualite simplifie** : admin voit aussi les fiches serveur dans l onglet Qualite ; bouton `Ouvrir fiche` retire de Serveur, qui indique d ouvrir/sign(er) depuis Qualite. SW v163.
- **2026-06-30 - clic historique qualite fiabilise** : boutons historique Qualite relies par `addEventListener` au lieu de `onclick` inline ; erreurs d ouverture affichees en toast. SW v164.
- **2026-06-30 - ouverture qualite visas incomplets** : normalisation des visas au chargement/rendu d une fiche qualite serveur pour eviter l erreur `setting nom` quand un role manque dans la soumission. SW v165.
- **2026-06-30 - navigation accueil/onglets** : barre compacte ordre Accueil/Stock/Comptage/Production/Entrees/Sorties/Qualite + menu `Plus`; accueil allege (sans jauge inventaire ni sauvegarde locale) avec alertes lots detaillees MP/productions. SW v154. Tests : `check:js`, `test:server` 71/71, `test:stock` 29/29, `test:lot` 11/11. Verification navigateur non faite : aucun browser expose dans la session.
- **2026-06-29 - structure serveur inventaire** : extraction `server/inventory-session-service.mjs` pour normaliser/upsert les contributions d'inventaire ; les routes gardent auth, choix session, erreurs et audit. Tests : `test:server` 71/71, `node --check` serveur OK.
- **2026-06-29 - structure stock/lots** : extraction pure `domain/stock.js` (lots FIFO/FEFO + flux mouvements) reutilisee par Stock, Bilan et Plan ; `stock-sheet.js` ne porte plus la mecanique dupliquee. Tests : `check:js`, `test:server` 71/71, `test:stock` 29/29, `test:lot` 11/11.
- **2026-06-29 - droits magasinier + estimation Plan** : `magasinier` voit Comptage/Production/Stock/Sorties/Entrees ; l'estimation de charge compte demarrage au lancement, reprise reduite le lendemain, fin seulement si debord jour suivant, transitions produit/machine separees. Tests : `check:js`, `test:server` 71/71, `test:stock` 29/29.
- **Spec B — inventaire comparer-avant-valider** : soumettre -> Comparer au stock (Bilan de revue, onglet Serveur) AVANT validation -> Valider OU Demander recomptage non destructif (pre-rempli, jamais zero, lie par `recountOf`). `buildBilanFrom`, `findBilanPair` serveur+repli. Retrait du Valider local + export/import fichier d'UN inventaire.
- **Lot nettoyage referentiel + Journal** : « Quitter mode admin » masque en session ; etat de stock = import Excel `.xlsx` seul (collage retire) ; « Dernier valide » lit le serveur ; bouton donnees de test retire ; **vue Journal (audit)** onglet Serveur (lecture + suppression CIBLEE par entree/periode, jamais de purge globale).
- **Spec C — inventaire fragmente (multi-compteurs, hors-ligne d'abord)** : chaque compteur compte sa zone hors-ligne -> file -> manche serveur unique ; assemblage autoritaire serveur (non compte = `counted:false`, estampille `by`/`byUser`, conflits explicites) ; recompte cible article->compteur (`forMe`) ; « compte par X » ; retrait du secours fichier fragmente.
- **Retrait « Secours WhatsApp »** sur Production/Sortie/Entree (file hors-ligne + Sauvegarde complete suffisent).
- **Spec D — feuille « Stock » (etat de stock theorique)** : nouvel onglet lecture seule visible par tous ; stock = dernier inventaire valide + production + entrees − sorties − conso(RECF), source records VALIDES serveur + repli local ; **fleches** d'evolution ; produits finis **detailles par lot** (date de prod) avec **FIFO** (le plus ancien sort en premier), MP agregees. Module autonome `js/features/stock-sheet.js` (ne touche pas `refreshLiveStock`). Tests purs FIFO `npm run test:stock` = **11/11**.

- **Spec E1 — garde-fou bloquant « date de production » par lot (produit fini)** : decoupage du chantier « modele par lot » en E1/E2/E3 (spec `docs/superpowers/specs/2026-06-24-saisie-lot-gardefou-design.md`). Constat cle : la saisie capture **deja** les lots dates (`ST.c.blocks[].date`) ; le reel manque = `blk.date` optionnel + `stock-sheet` agrege les dates. **E1 fait** : empeche soumettre/valider un inventaire si un produit fini compte a un lot saisi **sans date de prod** (3 accroches : submit serveur B, valider local, part fragmentee C) ; modal `#lotWarn` cliquable -> carte ; champ date rouge + bouton « aujourd'hui » ; aucun champ nouveau. Tests purs `npm run test:lot` = **9/9**. **Reste E2** (stock-sheet lit les lots REELS au lieu d'agreger + FIFO sur vrais lots) et **E3** (MP par lot + peremption).

- **Revue adversariale cross-model (Codex, 2026-06-27)** : 3 revues (securite serveur, inventaire B/C, modele par lot E1-E3). 9 findings reels, **8 corriges** (commit d68b38c) — R1-1 actor depuis token, R1-2 date visa serveur, R1-3 auth GET /api/submissions, R1-4 detail session role-split, R2-5 rejet part offline base differente, R2-7 fusion parts same-user, R3-9 garde-fou entree MP perissable, R3-8 lot synthetique negatif. **R2-6 FAIT** (commit 680a2ea, spec `...2026-06-27-recompte-cible-enforcement-design.md`) : enforcement serveur du recompte cible — un article assigne (recountArticles.byUser) ne peut plus etre soumis par un autre (403) ; cycle de vie explicite (`activeRecountAssignments` + `resolvePendingRecounts` sur finalize ET validate inventaire = pas de blocage collant). Aussi : `finalizedBy` derive du token (meme classe que R1-1). **Les 9 findings de la revue adversariale sont corriges.**

Etat technique : **SW v173**, `npm run test:server` = **80/80**, `npm run test:stock` = **45/45**, `npm run test:lot` = **11/11**, `npm run check:js` OK.

## A faire avant de merger `main` (dans l'ordre)

1. **Test mobile** complet (charger SW v128) : flux B (soumettre -> comparer -> recompter -> valider) et flux C (2 telephones, zones differentes hors-ligne -> assemblage/conflit -> recompte cible -> « compte par X »).
2. **Gate cross-model Codex** (surface sensible : auth, donnees inventaire multi-utilisateurs, reconstruction serveur, isolation recompte). Commande type :
   `/codex:adversarial-review --base <sha-avant-feature> --background <focus>`
   La branche porte AUSSI le security-hardening Phases 0-5 jamais relu cross-model -> le gate doit le couvrir. Voir memoire `project_sips-pending-reviews`.
3. **Merge** `main` seulement apres 1 + 2.

## Prochaines taches (apres les gates)

- **Item 5 — Refonte UX/UI** inspiree des maquettes Stitch (`docs/ux/README.md`), incrementale : design tokens -> ecrans pilotes (Accueil + Production) -> extension. CSS centralise, ne pas toucher la logique.
- **Chantier « modele par lot » (suite de D) : COMPLET (E1+E2+E3)**, non merge.
  - **E1** : garde-fou bloquant date de prod (produits finis comptes sans date).
  - **E2** : `stock-sheet.js` lit les lots REELS finis (un lot par bloc, date=`blk.date`) + FIFO + fusion par date.
  - **E3** : matieres perissables (g vrac/tare) par lot + peremption — (A) champ peremption a la saisie des **entrees MP** (`mp[].exp`) ; (B) garde-fou bloquant etendu aux matieres (emballages exclus, choix Rayan) ; (C) feuille Stock MP par lot reel + **FEFO** (perime le plus tot d'abord, lots sans date en dernier) + alertes peremption « perime le <date> ». `buildMpLots`, `mergeLotsByDate(undatedLast)`.
  - Specs : `...saisie-lot-gardefou-design.md` (E1), `...stock-lots-reels-design.md` (E2), `...mp-lots-peremption-design.md` (E3).
- Plus tard : Qualite serveur multi-etapes ; passage SQLite (submissions/records/audit/users) quand les workflows sont stabilises.

## Decisions / regles actives

- **Inventaire 100 % serveur** : plus de fichiers en entree pour un inventaire (Sauvegarde complete = disaster-recovery seulement). Comparer-avant-valider ; recompte non destructif.
- **Codex = revues adversariales uniquement** ; tout le code = Claude (memoire `feedback_codex-reserve-for-reviews`).
- Ne pas casser le **mode 100 % local** (aucun serveur jamais configure) ni le verrou strict hors-ligne (`sipsRequiresLogin`).
- Reconstruction inventaire fragmente **autoritaire serveur** : ne jamais fusionner tout le snapshot du telephone ; seuls les articles recomptes (`freshCodes`/`counts`) comptent.
- Qualite : validation finale = visa operateur + responsable qualite obligatoires, responsable production optionnel.
- **JAMAIS Python** pour ecrire un fichier (Edit / Node `fs`). `npm run check:js` apres chaque modif client. **Bump `sw.js`** (ligne 1) pour tout changement client. Pas de guillemets typographiques U+2019 dans une chaine JS `'...'`.
- Ne pas commiter `server/data/sips-data.json`. Ne pas embarquer de fichiers non lies.

## Commandes & acces

```powershell
cd C:\Users\halao\PRODUCTION-SIPS
npm run server        # http://localhost:3000 et http://IP_DU_PC:3000 (HTTPS 3443 si certs presents)
npm run check:js
npm run test:server   # 47/47
# port occupe : $env:SIPS_PORT="3001"; npm run server
```

PIN serveur de test : `1234` · PIN admin app (legacy) : `1951`. Reseau : memoire `project_sips-network-setup` (IP statique, certs HTTPS).

## Reference

- **Historique complet** : `docs/SIPS_HANDOFF_ARCHIVE.md` (+ `git log`).
- **Specs/plans** : `docs/superpowers/specs/` et `docs/superpowers/plans/` (B, C ; D a venir).
- **Pieges & regles** : `docs/SIPS_LESSONS_LEARNED.md`. **UX** : `docs/ux/README.md`.
- **API serveur** : routes `/api/...` dans `server/app.mjs` ; liste detaillee dans l'archive.
- **Memoire** : `MEMORY.md` (decisions durables, roadmap D, reviews en attente).
