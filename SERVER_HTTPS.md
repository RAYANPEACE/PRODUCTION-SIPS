# SIPS — Activer le HTTPS (mode hors-ligne sur téléphone)

## Pourquoi

Sur une adresse IP locale en `http://` (ex. `http://192.168.1.50:3000`), les navigateurs **refusent** de mettre l'application en cache. Conséquence : dès que le PC serveur est éteint, le téléphone affiche « site inaccessible ».

Le HTTPS résout ça : une fois le certificat **approuvé sur le téléphone**, l'app est gardée en mémoire et s'ouvre **même serveur éteint**. Le travail se fait hors-ligne, et les soumissions partent au retour du serveur.

## Ce que le HTTPS NE fait PAS (à savoir)

- **Pas de synchronisation automatique en arrière-plan.** Les soumissions faites hors-ligne restent dans une **file locale** sur le téléphone. Elles partent :
  - à la **réouverture de l'app** quand le serveur est de nouveau joignable, ou
  - en appuyant sur le bouton **« Synchroniser »** (carte « Serveur local » de l'accueil).
  - Tant que ce n'est pas fait, rien n'est perdu : tout reste en attente sur le téléphone.
- **Les données sont liées à l'adresse.** `https://192.168.1.50:3443` et `http://192.168.1.50:3000` sont considérés comme **deux sites différents** par le navigateur. Le brouillon local, l'historique local et la session ne sont **pas partagés** entre les deux. Règle simple : **une fois passé en HTTPS sur un téléphone, n'utiliser QUE l'adresse HTTPS sur ce téléphone.** Terminer/soumettre le travail en cours côté HTTP avant de basculer.

## Le HTTP reste en secours

Le serveur démarre **toujours** en HTTP (port 3000). Le HTTPS (port 3443) ne s'ajoute **que si un certificat est présent**. Rien n'est cassé : si aucun certificat n'est installé, le serveur fonctionne exactement comme avant.

---

## Étape 1 — Générer le certificat (sur le PC serveur)

Le plus simple est l'outil **mkcert** (il crée une petite autorité de certification locale, de confiance).

### Installer mkcert (Windows)

Avec Chocolatey :

```powershell
choco install mkcert
```

ou avec Scoop :

```powershell
scoop install mkcert
```

(ou télécharger le binaire depuis https://github.com/FiloSottile/mkcert/releases et le placer dans un dossier du PATH)

### Créer l'autorité locale + le certificat

```powershell
cd C:\Users\halao\PRODUCTION-SIPS

# 1. Installe l'autorite locale dans le magasin du PC
mkcert -install

# 2. Genere le certificat pour l'IP du PC + localhost
#    REMPLACER 192.168.1.50 par l'IP reelle du PC serveur (voir ipconfig)
mkdir server\certs
mkcert -cert-file server\certs\cert.pem -key-file server\certs\key.pem 192.168.1.50 localhost 127.0.0.1
```

> **Trouver l'IP du PC** : `ipconfig` → ligne « Adresse IPv4 » de la carte Wi-Fi.
>
> **Important** : le certificat est lié à cette IP. Si l'IP du PC change, le certificat ne sera plus valide. Réserver une IP fixe pour le PC (réservation DHCP sur la box/routeur) pour éviter ça.

### Localiser le fichier d'autorité à installer sur les téléphones

```powershell
mkcert -CAROOT
```

Cette commande affiche un dossier qui contient **`rootCA.pem`**. C'est **ce fichier** qu'on installe sur chaque téléphone (pas le `cert.pem`).

---

## Étape 2 — Démarrer le serveur

```powershell
cd C:\Users\halao\PRODUCTION-SIPS
npm run server
```

Au démarrage, deux lignes doivent apparaître :

```text
SIPS local server (HTTP)
  Reseau:  http://ADRESSE_IP_DU_PC:3000
SIPS local server (HTTPS)
  Reseau:  https://ADRESSE_IP_DU_PC:3443
```

Si la ligne HTTPS n'apparaît pas, c'est que `server/certs/cert.pem` et `server/certs/key.pem` ne sont pas trouvés.

---

## Étape 3 — Installer l'autorité sur les téléphones

### Android

1. Transférer **`rootCA.pem`** sur le téléphone (WhatsApp, e-mail, câble USB…).
2. Le **renommer** en `rootCA.crt` si Android ne le reconnaît pas en `.pem`.
3. **Réglages** → **Sécurité** (ou **Sécurité et confidentialité**) → **Plus de paramètres** → **Chiffrement et identifiants** → **Installer un certificat** → **Certificat CA**.
4. Sélectionner le fichier, confirmer l'avertissement.
5. Vérifier dans **Identifiants de confiance** → onglet **Utilisateur** : l'autorité « mkcert » doit apparaître.

> Selon la marque (Samsung, Xiaomi…), le chemin exact varie un peu. Chercher « Installer un certificat » dans la recherche des Réglages.

### iPhone / iPad

1. Envoyer **`rootCA.pem`** sur l'iPhone (AirDrop, e-mail, fichiers).
2. L'ouvrir → iOS propose de **télécharger un profil**. Accepter.
3. **Réglages** → **Général** → **VPN et gestion de l'appareil** → sélectionner le profil → **Installer** (saisir le code de l'iPhone).
4. **ÉTAPE OBLIGATOIRE** : **Réglages** → **Général** → **Informations** → **Réglages de confiance des certificats** → **activer** l'interrupteur en face de l'autorité installée.

> Sans cette dernière étape (« réglages de confiance »), le certificat est installé mais **pas approuvé**, et le mode hors-ligne ne marchera pas.

---

## Étape 4 — Configurer l'app sur le téléphone

1. Dans le navigateur, ouvrir **`https://192.168.1.50:3443`** (l'adresse HTTPS, port 3443).
2. La page doit s'ouvrir **sans avertissement de sécurité** (cadenas fermé). Si un avertissement apparaît, c'est que l'autorité n'est pas correctement approuvée — refaire l'étape 3.
3. Se connecter avec son compte.
4. **Ajouter à l'écran d'accueil** (menu du navigateur → « Ajouter à l'écran d'accueil ») pour créer le raccourci.
5. **Supprimer l'ancien raccourci** vers `http://...:3000` pour ne pas mélanger les deux.

---

## Étape 5 — Vérifier que le hors-ligne marche

1. Téléphone : ouvrir l'app via le raccourci HTTPS au moins une fois (serveur allumé).
2. **Éteindre le serveur** (ou couper le Wi-Fi du PC).
3. Rouvrir l'app sur le téléphone : elle doit **s'ouvrir quand même** (depuis le cache).
4. Faire une soumission : elle est mise **en attente**.
5. Rallumer le serveur, rouvrir l'app ou appuyer sur **« Synchroniser »** : l'attente part.

---

## Variables d'environnement (optionnel)

| Variable | Rôle | Défaut |
|----------|------|--------|
| `SIPS_PORT` | Port HTTP | `3000` |
| `SIPS_TLS_PORT` | Port HTTPS | `3443` |
| `SIPS_TLS_CERT` | Chemin du certificat | `server/certs/cert.pem` |
| `SIPS_TLS_KEY` | Chemin de la clé | `server/certs/key.pem` |

Les fichiers de `server/certs/` ne sont **pas** versionnés (ignorés par Git) : ils sont propres à chaque machine.

---

## Dépannage

| Symptôme | Cause probable | Solution |
|----------|----------------|----------|
| Pas de ligne « HTTPS » au démarrage | Certificat absent | Vérifier `server/certs/cert.pem` et `key.pem` |
| Avertissement de sécurité sur le téléphone | Autorité non approuvée | Refaire l'étape 3 (sur iPhone : ne pas oublier « réglages de confiance ») |
| « site inaccessible » serveur éteint | App ouverte en HTTP, ou cache pas encore créé | Utiliser l'adresse HTTPS et l'ouvrir une fois serveur allumé |
| Marche puis casse après quelques jours | IP du PC a changé | Réserver une IP fixe, régénérer le certificat |
| Données « disparues » après passage HTTPS | Données liées à l'ancienne adresse HTTP | Normal : terminer le travail côté HTTP avant de basculer, puis rester en HTTPS |
