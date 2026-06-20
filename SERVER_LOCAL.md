# Serveur local SIPS

Premiere fondation pour remplacer les echanges de fichiers WhatsApp par une base centrale locale, separee du serveur industriel.

## Demarrer

```powershell
npm run server
```

Puis ouvrir sur le PC :

```text
http://localhost:3000
```

Depuis un telephone connecte au meme Wi-Fi/reseau, ouvrir :

```text
http://ADRESSE_IP_DU_PC:3000
```

Pour trouver l'adresse IP du PC :

```powershell
ipconfig
```

Chercher `Adresse IPv4`.

## Donnees

Le serveur cree une base locale JSON ici :

```text
server/data/sips-data.json
```

Ce fichier est ignore par Git.

Le serveur cree aussi des sauvegardes JSON ici :

```text
server/data/backups/
```

Une sauvegarde quotidienne est creee automatiquement apres la premiere ecriture serveur de la journee. Retention actuelle : 7 derniers jours + 4 semaines. Une sauvegarde manuelle peut etre lancee et telechargee depuis l'onglet `Serveur` ou via `POST /api/backup`.

## API minimale

- `GET /api/health` : verifier que le serveur repond.
- `POST /api/submissions` : soumettre une fiche/mouvement/inventaire.
- `GET /api/submissions` : lister les soumissions.
- `POST /api/submissions/:id/validate` : valider une soumission, avec header `x-sips-admin-pin`.
- `POST /api/submissions/:id/reject` : rejeter une soumission, avec header `x-sips-admin-pin`.
- `GET /api/records` : lire les donnees validees, avec header `x-sips-admin-pin`.
- `POST /api/records/:id/cancel` : annuler un record valide sans le supprimer, avec header `x-sips-admin-pin`.
- `POST /api/backup` : creer une sauvegarde manuelle, avec header `x-sips-admin-pin`.
- `GET /api/backups` : lister les sauvegardes disponibles, avec header `x-sips-admin-pin`.
- `GET /api/backups/:file` : telecharger une sauvegarde, avec header `x-sips-admin-pin`.
- `GET /api/audit` : lire le journal, avec header `x-sips-admin-pin`.

## PIN admin

Par defaut en test : `1234`.

Pour le changer :

```powershell
$env:SIPS_ADMIN_PIN="un-pin-solide"
npm run server
```

## Etapes suivantes

1. Tester les annulations et sauvegardes serveur sur telephone.
2. Finaliser le workflow qualite multi-etapes.
3. Remplacer le stockage JSON par SQLite quand le workflow est valide.
