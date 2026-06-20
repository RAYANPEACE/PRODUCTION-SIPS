# SIPS - Relais developpement serveur local

Derniere mise a jour : 2026-06-20

Ce document sert de relais entre Codex, Claude Code et tout autre agent. Il decrit l'etat actuel, les choix d'architecture, les commandes, les tests deja faits et les prochaines taches.

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

## Comportement actuel important

### Historique local vs serveur

Dans `Sorties` et `Entrees`, l'historique est maintenant separe :

- `Validees serveur` : donnees officielles, non supprimables depuis l'ecran mouvement.
- `Historique local` : donnees IndexedDB locales, supprimables localement.

Le fait qu'une sortie validee serveur ne puisse pas etre supprimee depuis `Sorties` est volontaire pour l'instant. Les donnees validees doivent etre traitees comme officielles.

### Suppression / annulation serveur non encore implementee

Besoin utilisateur signale :

> Une sortie validee serveur est visible, mais on ne peut que l'ouvrir. Il n'y a pas encore d'action de suppression/annulation.

Decision recommandee :

- Ne pas supprimer physiquement les records valides.
- Ajouter plutot une action admin `Annuler` ou `Invalider`, avec audit.
- Les bilans/analyses devront ignorer les records `voided` / `cancelled`.

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
- `GET /api/audit`

Routes admin : ajouter header :

```text
x-sips-admin-pin: 1234
```

Anti-doublon :

- `server/app.mjs` calcule un hash stable de `{ type, payload }`.
- Les champs volatils `id` et `submittedAt` sont ignores.
- Si une soumission identique est deja `submitted` ou `validated`, le serveur renvoie `duplicate: true`.

## Prochaines taches recommandees

### Priorite 1 - Annulation propre des records valides

Objectif : permettre a l'admin d'annuler une sortie/entree validee par erreur, sans effacer l'audit.

Backend :

- Ajouter `POST /api/records/:id/cancel`.
- Exiger `x-sips-admin-pin`.
- Marquer le record :
  - `status: "cancelled"`
  - `cancelledAt`
  - `cancelledBy`
  - `cancelReason`
- Ajouter entree audit `record.cancelled`.
- Modifier `GET /api/records` pour accepter filtres :
  - `type`
  - `status`
  - par defaut, retourner tout ou au moins exposer le status.

Frontend :

- Dans onglet `Serveur`, afficher records valides avec details.
- Ajouter bouton `Annuler` sur record valide.
- Dans `Sorties` / `Entrees`, ne pas afficher les records `cancelled`.

### Priorite 2 - Vue detail des soumissions avant validation

Actuellement l'admin voit un resume. Il faut une vraie vue detail :

- lignes produits finis ;
- lignes MP ;
- ref / date / agent ;
- pour qualite : produit, lot, MP, batches, signatures.

Puis seulement :

- `Valider`
- `Rejeter`

### Priorite 3 - Qualite serveur

Workflow cible :

```text
operateur renseigne + signe
-> soumet serveur
-> responsable production signe ou valide
-> responsable qualite signe
-> validation finale
-> archive officielle
```

Aujourd'hui `Qualite` peut soumettre au serveur, mais il manque :

- lecture des fiches qualite serveur ;
- vue detail qualite cote admin ;
- statuts multi-signatures ;
- validation finale plus stricte.

### Priorite 4 - Sauvegardes automatiques

Ajouter :

- dossier `server/data/backups/`;
- backup quotidien de `sips-data.json`;
- retention simple : 7 derniers jours + 4 semaines ;
- route admin `POST /api/backup`;
- eventuellement export telechargeable.

### Priorite 5 - SQLite

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
