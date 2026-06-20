# Code Review — SIPS — 19/06/2026

Scope : 12 commits (0b8ab8c..c61e3f2), +939 lignes, 3 fichiers

## Bugs a corriger

### Bug 1 — importAll ecrase le profil utilisateur (Important)
- **Fichier** : index.html, ligne ~1512
- **Probleme** : importAll ecrit tous les cles localStorage du backup (y compris lep_usr, lep_recf, inv_cfg) meme si les records IDB sont ignores
- **Impact** : Apres import d'une sauvegarde d'un collegue, votre nom/poste/recettes sont remplaces par les siens
- **Fix** : Ne pas ecraser lep_usr lors d'un import. Proteger aussi lep_changes_since_backup et lep_backup_count.

### Bug 2 — Compteur sauvegarde remis a 0 meme si partage annule (Important)
- **Fichier** : index.html, ligne ~1465
- **Probleme** : exportAll reset le compteur immediatement apres shareOrDownload(), mais navigator.share() est async et peut etre annule
- **Impact** : Le bandeau "X modifications non sauvegardees" disparait sans que le fichier ait ete envoye
- **Fix** : Deplacer le reset dans le .then() de navigator.share, ou apres confirmation

### Bug 3 — ST.agent vide apres Nouvel Inventaire (Important)
- **Fichier** : index.html, ligne ~1652
- **Probleme** : newInv vide ST.agent sans le re-remplir depuis USR.nom
- **Impact** : Le nom du compteur disparait des exports/bilans jusqu'au rechargement
- **Fix** : Ajouter ST.agent=USR.nom apres le reset

### Bug 4 — Import gonfle le compteur de modifications (Mineur)
- **Fichier** : index.html, ligne ~1308
- **Probleme** : Chaque idbPut lors d'un import incremente lep_changes_since_backup
- **Impact** : Apres import de 50 fiches, le bandeau montre "50 modifications" alors que rien n'a change
- **Fix** : Reset le compteur apres un import reussi (deja fait dans importAll mais AVANT les idbPut)

### Bug 5 — qNew() pas de confirmation si fiche non enregistree (Mineur)
- **Fichier** : index.html, ligne ~4027
- **Probleme** : Le guard est `if(QS.id && !confirm(...))` — QS.id est vide pour les fiches non enregistrees
- **Impact** : Perte silencieuse des donnees saisies non enregistrees
- **Fix** : Verifier si des champs sont remplis, pas seulement QS.id

## Ameliorations qualite de code (non-bloquant)

- Factoriser la logique rotation A/B + reset compteurs (3 copies identiques)
- qNextLotNum fait un scan complet IDB a chaque ouverture — utiliser un compteur localStorage
- exportAllDownload duplique exportAll — reutiliser shareOrDownload
