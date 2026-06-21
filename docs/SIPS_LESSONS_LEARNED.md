# SIPS - Pieges rencontres et regles pour les prochaines apps

Derniere mise a jour : 2026-06-21

Ce fichier sert de memoire projet. A relire avant de creer une nouvelle application terrain/PWA, ou avant une grosse phase sur SIPS.

## 1. Offline ne doit jamais dependre du serveur

Probleme rencontre :

- si le serveur local etait ferme brutalement, l'app pouvait rester bloquee au demarrage sur une verification auth serveur ;
- resultat terrain : onglet `Comptage` vide ou app inutilisable alors que les donnees locales etaient encore disponibles.

Regle :

- le serveur peut etre la source officielle, mais le rendu de base doit toujours finir ;
- si le serveur ne repond pas, proposer `Continuer local` ;
- mettre un timeout court sur les verifications de demarrage ;
- ne jamais attendre indefiniment une IP serveur morte.

Pattern applique :

- `sipsFetch(..., { timeoutMs: 2500 })` pour auth/setup/me au demarrage ;
- dialogue offline resolutif, pas bloquant ;
- mode local garde comptage, historique local, secours fichier et pre-comptage.

## 2. Un bouton manquant ne doit pas casser les suivants

Probleme rencontre :

- les handlers etaient attaches en chaine avec `$('#id').onclick = ...` ;
- si un element HTML disparaissait ou changeait, une erreur JS pouvait arreter le reste des attaches ;
- symptome : un bouton marche, les boutons suivants semblent morts.
- autre piege rencontre : `inventory-core.js` etait charge avant `fragments.js`, donc `bindClick('#fragBtn', openFragDlg)` reference immediatement une fonction pas encore definie. `Historique` marchait car attache avant, puis tout ce qui suivait etait bloque.

Regle :

- utiliser des helpers defensifs pour les boutons optionnels ou les dialogues qui evoluent.
- quand une fonction vient d'un script charge plus tard, ne pas la passer directement au moment de l'attache ; utiliser une fonction wrapper.

Pattern :

```js
function bindClick(sel, fn) {
  const el = $(sel);
  if (el) el.onclick = fn;
}
function bindChange(sel, fn) {
  const el = $(sel);
  if (el) el.onchange = fn;
}

// Fonction definie dans un script charge plus tard :
bindClick('#fragBtn', () => openFragDlg());
```

## 3. Ne jamais fusionner un snapshot complet comme fragment

Probleme evite :

- un telephone peut contenir les valeurs du dernier inventaire charge ;
- ces valeurs ne sont pas forcement recomptees ;
- les fusionner comme comptage frais fausse le stock officiel.

Regle :

- un fragment officiel contient uniquement les articles recomptees/modifies ;
- utiliser `freshCodes + counts`, jamais tout `ST.c`.

Pattern :

```json
{
  "baseInventoryId": "rec_...",
  "agent": "Ahmed",
  "freshCodes": ["190001"],
  "counts": {
    "190001": {}
  }
}
```

## 4. La base commune doit etre explicite

Probleme :

- si plusieurs telephones ne partent pas de la meme base, les ecarts deviennent difficiles a interpreter.

Regle :

- une session serveur porte `baseInventoryId` et `baseSnapshot` ;
- chaque telephone charge cette base avant de compter ;
- le serveur refuse une contribution dont `baseInventoryId` ne correspond pas a la session.

## 5. Pre-comptage hors serveur

Cas terrain :

- les ouvriers peuvent commencer avant que le serveur soit demarre.

Regle :

- autoriser un mode local clair : `Demarrer part hors serveur` ;
- conserver les chiffres visibles comme base locale ;
- remettre `sessionStart` a maintenant ;
- effacer les timestamps herites ;
- plus tard, n'envoyer que les articles modifies depuis ce demarrage.

Important :

- a la fusion, les articles non envoyes restent pris depuis la base serveur officielle.

## 6. Les conflits doivent etre visibles et explicites

Probleme evite :

- si deux personnes recomptent le meme article, choisir automatiquement le plus recent est dangereux.

Regle :

- conflit visible admin ;
- choix explicite de la valeur a garder ;
- aucune fusion si tous les conflits ne sont pas resolus ;
- conserver les choix dans `payload.frag.resolutions`.

## 7. Actions critiques avec compte personnel

Regle :

- valider, rejeter, annuler, finaliser une fusion : reconfirmation mot de passe quand une session serveur existe ;
- ne pas se contenter d'un PIN partage pour les actions officielles.

## 8. Garder JSON tant que le metier bouge

Decision :

- SQLite viendra quand les workflows seront stabilises ;
- tant que l'on ajuste les flux metier, le JSON serveur est plus rapide a faire evoluer ;
- conserver sauvegardes serveur JSON lisibles.

## 9. Toujours mettre a jour le handoff

Regle :

- apres chaque changement important, documenter dans `docs/SIPS_LOCAL_SERVER_HANDOFF.md` :
  - ce qui a ete fait ;
  - les tests lances ;
  - les decisions prises ;
  - ce qui reste a tester sur mobile/terrain.

## 10. Tests minimum apres changement

Toujours lancer :

```powershell
npm run check:js
node --check server/app.mjs
git diff --check
```

Pour les PWA :

- incrementer le cache `sw.js` apres changement frontend ;
- se mefier du cache service worker ;
- les routes `/api/` ne doivent pas etre servies depuis le cache.
