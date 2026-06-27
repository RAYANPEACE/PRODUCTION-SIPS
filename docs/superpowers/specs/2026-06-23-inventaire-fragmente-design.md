# Spec C — Inventaire fragmenté (multi-compteurs, hors-ligne d'abord)

Date : 2026-06-23
Statut : design validé avec l'utilisateur (Rayan). Implémentation **différée** sur la branche `inventaire-serveur`, **après** la spec B (dont C dépend) et la revue cross-model Codex de `security-hardening`.

S'appuie sur **B** (`2026-06-23-inventaire-comparer-avant-valider-design.md`) : C produit le **même** objet final (un inventaire `submitted`) qui passe par le **même** flux *comparer → valider / recompter*. C ajoute le **multi-compteurs** et l'**attribution par article**.

## 1. Contrainte fondamentale (réalité terrain)

Le serveur tourne sur le **PC de l'admin**. Dans la plupart des cas, les compteurs **commencent quand l'admin n'est pas là → serveur éteint → pas de serveur**. Donc **pas de session partagée en direct** pendant le comptage : chaque compteur est **hors-ligne et isolé**.

Conséquence : on **inverse** le modèle Phase 7 (« l'admin ouvre une session, les autres la rejoignent en direct »). À la place : **parts indépendantes comptées hors-ligne, assemblées par le serveur au retour de l'admin.**

## 2. Décisions validées avec l'utilisateur

1. **Hors-ligne d'abord** : chaque compteur fait **sa part** dans Comptage, hors-ligne, sans coordination live ; ça part dans sa **file d'attente locale**.
2. **Une seule manche d'inventaire ouverte à la fois.** Les parts qui arrivent s'y **rattachent automatiquement** côté serveur (créée à la première part si aucune ouverte ; l'admin peut aussi l'ouvrir).
3. **Assemblage côté serveur** au retour de l'admin (serveur rallumé). Les parts en file partent et sont regroupées.
4. **Attribution par article** (« compté par X ») : chaque article compté est estampillé du compteur (`by`). Affiché à la consultation.
5. **Règle « non compté = écart nul »** (= décision 9 de B) : un code que **personne** n'a compté est marqué **« non compté »** (PAS la valeur du dernier inventaire, PAS zéro) → écart nul, aligné au théorique ERP.
6. **Conflit** (même code compté par **plusieurs**) → **l'admin tranche** (résolution explicite, jamais de choix silencieux — comportement Phase 7 conservé).
7. **Comparer-avant-valider** : l'inventaire assemblé est un `submitted` → flux B (Bilan-revue vs ERP admin → Valider / recompter).
8. **Recompte ciblé** : un article anormal repart **uniquement vers la personne qui l'a compté** (grâce à `by`) ; elle recompte juste ça, re-soumet (file si hors-ligne), ré-assemblage.
9. **Vue de couverture** à l'assemblage : *comptés (par qui)* vs *non comptés ce tour*, pour repérer les trous et décider (accepter ou demander à compter).
10. **Plus de fichiers** : on retire le secours fichier fragmenté (export/import/fusion de parts par `.txt`).

## 3. Flux complet

```
PHASE COMPTAGE (hors-ligne, parallele, sans coordination)
  Chaque compteur (Comptage > "Ma part d'inventaire"):
    compte sa zone -> marque les codes comptes (freshCodes) + valeurs
    Soumettre -> FILE d'attente locale (offline)
    [la part porte: identite du compteur + freshCodes + counts]

PHASE ASSEMBLAGE (serveur rallume, admin present)
  Les parts en file partent au serveur:
    -> rattachees a LA manche ouverte (creee si aucune)
  Admin: vue d'assemblage de la manche
    pour chaque code:
      - compte par 1   -> sa valeur, estampille by=compteur
      - compte par >1  -> CONFLIT -> admin tranche
      - compte par 0   -> "non compte" (ecart nul / theorique)
    vue de couverture: comptes (par qui) vs non comptes
  Admin: [Finaliser] -> cree l'inventaire "submitted" (avec by par article)

PHASE COMPARER/VALIDER (flux B)
  Admin: [Comparer au stock (Bilan)] -> ecarts vs ERP (non comptes = ecart nul)
    -> [Valider] = base officielle (avec attribution conservee)
    -> [Recompte cible] article anormal -> repart vers son compteur (by)
         -> il recompte cet article, re-soumet (file si offline)
         -> ré-assemblage / re-comparaison

CONSULTATION
  Inventaire valide -> affiche "compte par X" sur chaque article
```

## 4. Changements vs Phase 7 (existant)

Phase 7 actuel (`server/app.mjs` routes `inventory-sessions`, `js/features/fragments.js`) :
- l'admin crée la session, base = dernier inventaire validé ;
- contributions `POST /api/inventory-sessions/:id/contributions` (une par user) ;
- finalize : uncounted → **valeur de base**, conflits → résolutions admin.

À **réviser** pour C :
- **Démarrage** : une part peut être créée **sans sessionId connu** (offline). Nouveau point d'entrée « contribution à la manche ouverte » sans id : le serveur rattache à la manche ouverte (la crée si aucune). Les parts hors-ligne sont **mises en file** puis envoyées (réutilise la file `lep_server_pending`).
- **Uncounted → « non compté »** (règle 5), **plus** la valeur de base. Change la fusion `finalize`.
- **Attribution** : `finalize` estampille chaque code retenu avec `by` (le compteur de la contribution d'origine).
- **Recompte ciblé** : nouveau — demander le recomptage d'**articles précis** vers **leur** compteur (pas toute la session).
- **Vue de couverture** côté admin (comptés/par-qui vs non comptés).
- **Retrait** du secours fichier fragmenté (bloc « Secours local fichiers » de `fragments.js` : export/import/fusion `.txt`).

## 5. Architecture & composants

### 5.1 La « manche » d'inventaire (round)
- **Une seule ouverte à la fois.** Identité stable côté serveur. Créée par la première part qui arrive (ou par l'admin). Fermée par la finalisation (`finalize`).
- Champs : `id`, `status` (`open`|`finalized`), `baseInventoryId` (dernier inventaire validé, pour info), `contributions[]`, timestamps.

### 5.2 Part / contribution (offline-first)
- Produite dans Comptage : « Ma part d'inventaire » → l'utilisateur compte sa zone, `freshCodes` = codes qu'il a comptés, `counts` = valeurs.
- **Soumettre** → file d'attente locale si hors-ligne ; sinon envoi direct.
- À l'envoi : point d'entrée **sans sessionId** → le serveur rattache à la manche ouverte (création si besoin). Une contribution **par compteur** (re-soumettre remplace la sienne, comme Phase 7).
- La contribution porte `userId`/`username`/`agent` + `freshCodes` + `counts` (le serveur en dérive `by` par code).

### 5.3 Assemblage / finalize (serveur autoritaire)
- L'admin déclenche l'assemblage de la manche ouverte. Le serveur **reconstruit** l'inventaire depuis `baseSnapshot + contributions` (jamais le payload client — sécurité G/H déjà en place) :
  - code compté par **1** → sa valeur + `by`,
  - code compté par **>1** → **conflit**, requiert une **résolution** explicite (`resolutions`),
  - code compté par **0** → **`counted:false` (« non compté »)**, sans valeur physique.
- Produit une soumission `inventory` (`submitted`) avec `st.c[code] = { counted, val?, by? }`.
- Vue de couverture = dérivée des contributions (qui a compté quoi) + liste des non-comptés.

### 5.4 Recompte ciblé (par article → compteur)
- Depuis le Bilan-revue (flux B), l'admin sélectionne un/des article(s) anormaux et **demande recomptage** → cible le `by` de chaque article.
- Côté compteur (Comptage, section « À recompter ») : il voit **les articles précis** à recompter, les recompte, re-soumet (file si offline). Ré-assemblage côté admin.
- Lien de traçabilité : la demande référence la manche + les codes + le compteur cible.

### 5.5 Attribution affichée
- À la consultation d'un inventaire (soumis/validé), chaque ligne article affiche **« compté par X »** (depuis `st.c[code].by`). Champ `by` déjà **réservé** par la spec B.

## 6. Côté serveur (résumé)
- Point d'entrée contribution **sans sessionId** → rattache à la manche ouverte (création si aucune). Conserve : une contribution par user, `requireAuth`, anti-écrasement.
- `finalize` révisé : uncounted → `counted:false` (plus la base) ; estampille `by` ; conflits → résolutions (conservé).
- Recompte ciblé : marquer des articles « à recompter » avec leur compteur cible (réutilise/étend le mécanisme `recountRequested` de B, au niveau **article**).
- Sécurité : réutilise les gardes existantes (G/H : reconstruction serveur ; B : `sipsRequiresLogin` hors-ligne strict).

## 7. Côté client (résumé)
- `js/features/fragments.js` : remplacer le modèle « rejoindre une session live » par « ma part hors-ligne → file → rattachement manche ». **Retirer** le bloc secours fichier fragmenté.
- Comptage : « Ma part d'inventaire » (compter une zone) + section « À recompter » (articles ciblés).
- Onglet Serveur : vue d'assemblage (couverture comptés/non comptés/conflits) + Finaliser ; puis Comparer (B).
- Affichage « compté par X » à la consultation.
- `sw.js` : bump version.

## 8. Cas limites & garde-fous
- **Aucun serveur configuré** : mode 100 % local d'origine préservé (cohérent verrou strict `sipsRequiresLogin`).
- **Manche déjà finalisée** : une part qui arrive après finalisation **ouvre la manche suivante** (nouveau round), elle ne rejoint pas la manche close. Cohérent avec « une seule manche ouverte à la fois » : la finalisation ferme la manche courante, la part suivante en ouvre une neuve.
- **Conflit non résolu** : pas de finalisation (comportement Phase 7 conservé).
- **Trous** : visibles via la couverture ; non-comptés = écart nul (règle 5).
- **Double recompte ciblé** : la chaîne reste traçable par article + compteur.
- **Le compteur n'a pas la base** (offline) : pas grave — il compte des valeurs réelles ; la base ne sert qu'à la fusion côté serveur (admin).

## 9. Tests
- **Serveur (`tests/server-security.test.js`)** : (a) contribution sans sessionId rattachée à la manche ouverte ; (b) uncounted → `counted:false` (jamais valeur de base) ; (c) `by` correctement estampillé par compteur ; (d) conflit (même code, 2 compteurs) → finalize refusé sans résolution ; (e) recompte ciblé ne ré-ouvre que l'article visé ; (f) reconstruction serveur ignore tout payload client forgé (régression G/H).
- **Manuel mobile** : 2 téléphones comptent des zones différentes hors-ligne → admin rallume → assemblage (couverture + conflit) → comparer → recompte ciblé d'un article → le bon compteur le reçoit → re-comparer → valider → consultation montre « compté par X ».

## 10. Hors périmètre
- **D** — feuille état de stock théorique temps réel + FIFO par lot + garde-fou date de production (mémoire `project_sips-roadmap-stock-fifo`).
- Zones **pré-assignées** par l'admin (écartées : l'admin est souvent absent au début ; la vue de couverture suffit).
