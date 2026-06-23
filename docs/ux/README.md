# SIPS — Référence UX / refonte interface

Ce dossier sert de référence visuelle pour la refonte progressive de l'interface SIPS.
Objectif : moderniser l'UI (mobile-first Android/iOS) **sans casser la logique métier** des 12 onglets.

## Maquettes de référence (Stitch)

Rayan a généré des maquettes avec **Stitch** (Google) comme direction visuelle cible.
Déposer les PNG ici :

- `docs/ux/mockup-accueil.png` — écran Accueil (pastille compte, carte « Sauvegarde locale », carte « Inventaire en cours » avec barre de progression, grille « Accès Rapide », barre d'onglets bas).
- `docs/ux/mockup-production.png` — écran Saisie Production (header logo + compte + Déconnexion, date + Opérateur, carte « Production 1 » : Produit fini, panneau DÉCHETS Carton/Film/Mélange, boutons Photo/Galerie, « Ajouter une production »).

(Les images sont dans l'historique de conversation ; à recopier physiquement ici par l'utilisateur — l'agent ne peut pas écrire le binaire.)

## Langage visuel cible (déduit des maquettes)

- **Cartes** arrondies (~16px), ombre douce, fond blanc sur fond gris clair.
- **Accents couleur par module** : bleu = inventaire/comptage, vert = mouvements (sorties/entrées/production).
- **Pastille compte** en haut à droite (avatar + nom + Déconnexion).
- **Carte de progression** d'inventaire (barre + « X/Y articles comptés »).
- **Grille Accès Rapide** : tuiles icône + libellé, 2 colonnes.
- **Barre d'onglets** basse fixe.
- **Cibles tactiles ≥ 44px**, gros contrastes, typo grasse pour les titres.

## Méthode de refonte (incrémentale, pas de big-bang)

1. Brainstorming court pour figer les **design tokens** (couleurs hex, espacements, rayons, tailles typo) → fichier de variables CSS dans `css/styles.css`.
2. Restyler **1-2 écrans pilotes** d'abord (Accueil + Production), valider sur mobile.
3. Étendre écran par écran. Le CSS est centralisé (`css/styles.css`) → on restyle sans toucher au JS/logique.
4. Les maquettes sont une **inspiration visuelle**, pas une spec littérale (elles simplifient : 4 onglets affichés vs 12 réels). Ne pas perdre de fonctions.

## Workflow Stitch/Figma → SIPS (pour l'IA)

Stitch/Figma sont excellents pour le **visuel** mais leur **code exporté est jetable** (à ne jamais committer tel quel). On les utilise pour les **décisions visuelles et les valeurs exactes** ; l'implémentation propre dans `css/styles.css` reste faite par l'agent.

**Ce qui aide le plus l'agent, par ordre d'utilité :**
1. **Capture d'écran** de la maquette (l'agent la lit).
2. **+ le code/CSS exporté** par Stitch (HTML/CSS/Tailwind) OU les valeurs du mode « Inspect/Dev » de Figma → l'agent en extrait les **hex, px, rayons, polices** exacts (sans réutiliser la structure du code).
3. **+ une phrase** sur ce que tu as aimé (ex. « j'aime la carte de progression », « les accents par module ») → priorise l'intention.

→ Donc : **screenshot + tokens/code exporté + 1 phrase d'intention** = idéal.

**Prompt Stitch réutilisable** (à coller avec un screenshot de l'écran ACTUEL à refondre) :

> Redesign this screen for a mobile-first French factory data-entry PWA (milk-powder plant, "SIPS"). Keep ALL existing fields and actions — do not remove functionality. Style: clean iOS-like cards, 16px radius, soft shadows, high contrast, large touch targets (≥44px), bold titles. Color accents: blue for inventory/counting, green for movements (in/out/production). Output: (1) the redesigned screen, and (2) a design-token list — colors as hex, spacing in px, border radii, font sizes/weights, font family.

**Écrans à capturer en priorité** (depuis l'app ACTUELLE, pour que Stitch refonde le vrai) :
Accueil · Compter (saisie inventaire) · Production · Bilan · onglet Serveur (vue de revue inventaire) · Qualité.
