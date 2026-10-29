# Altera.ai · Trajectoire protéique

Démonstration d'un simulateur de trajectoire protéique pour un distributeur coopératif, présentée par Altera.

**Toutes les données de ce dépôt sont fictives.** Les volumes, les prix, le CO2, les leviers et leurs hypothèses servent à illustrer la démarche ; ils sont réalistes mais mis à l'échelle et perturbés, sans aucune donnée réelle de distributeur. Une version client, avec de vraies données, peut être construite à partir de ce même code par un dépôt privé distinct (voir « Deux versions »).

En ligne : https://ambrealison.github.io/altera-trajectory/ (non indexé par les moteurs de recherche). `?lang=en` ouvre la version anglaise.

## Ce que montre la démo

À chaque arrivée, une page d'accueil présente la démo, avec un aperçu calculé du scénario d'ouverture et un bouton « Let's go ». Une visite d'accueil démarre à la première visite ; ensuite, le bouton « Visite guidée » lance la visite détaillée de l'écran affiché (chaque écran, la fiche d'un levier et le dossier du levier 12 ont la leur).

1. **Point de départ** : la répartition protéique de référence (32,0 % en 2025), décomposée par catégorie végétale (groupes Protein Tracker et WWF), la part végétale des produits composites et le reste du végétal, chaque bloc détaillé catégorie par catégorie. Un sélecteur discret passe en WWF FG1.
2. **Les leviers** : les 20 leviers, en tableau ou en matrice impact / effort. Le tableau se trie par effet sur la répartition, CO2 ou marge, et se filtre par statut, type, catégorie ou recherche.
3. **Trajectoire** : trois cartes d'indicateurs cliquables (répartition protéique, CO2 face à l'objectif scope 3, chiffre d'affaires) qui font basculer les graphiques ; lecture par levier (cascade) ou dans le temps (courbe avec fourchette, catégories empilées, rythme observé aux Pays-Bas à tous les horizons) ; quatre scénarios suggérés par Altera et vos propres scénarios (enregistrer, nommer, renommer, supprimer, partager par lien) ; part des magasins qui suivent, avec la part de l'effet décidée par la centrale, celle des magasins qui suivent et le potentiel restant ; horizon 2028, 2030 ou 2035 (par défaut).
4. **Avec vos données** : les modules que des données réelles permettraient de construire.

La fiche latérale d'un levier est résumée (ce qu'il fait, qui le porte, son type, ses catégories, l'interrupteur) et ouvre une **fiche plein écran** : synthèse, hypothèses liées (une hypothèse qui dépend d'une autre est placée dessous et grisée tant que la première est à 0), effets à l'horizon, preuves. Le levier 12, « Implantation intégrée en rayon », porte le **dossier complet d'Altera** : modèle trimestriel en direct, deux versions (gamme actuelle, gamme élargie), marge, carbone, effort, Monte Carlo de 10 000 tirages, tornado, registre des 38 hypothèses avec curseurs, constats, explorateur des sources filtrable, contre-preuves, risques, distributeurs par pays et lacunes. Les 19 autres leviers suivent le même gabarit, marqués « dossier en préparation ».

L'état complet (leviers, hypothèses, adoption, horizon, indicateurs, fiche ouverte, nom du scénario, langue) est encodé dans l'URL : un lien copié rouvre exactement la même vue.

## Lancer en local

Node 22 ou plus récent.

```bash
npm install
npm run dev
```

L'application s'ouvre sur http://localhost:5173/altera-trajectory/.

Autres commandes :

```bash
npm test             # tests Vitest du moteur, du modèle I2, des données et des textes
npm run report       # effet isolé de chaque levier et résultats des 4 scénarios
npm run build        # version statique dans dist/
npm run screenshots  # captures de chaque écran et des fiches en FR et EN (serveur de dev lancé, Google Chrome installé)
```

## Deux versions

- **Démo publique** (ce dépôt) : jeu de données fictif `src/data/public/`, assemblé par `src/data/publicDataset.ts`.
- **Version client** (dépôt privé distinct) : le même code construit avec `vite build --mode client`. L'alias `@dataset` (voir `vite.config.ts`) pointe alors vers `src/data/client/dataset.ts`, un dossier ignoré par git que le workflow du dépôt privé remplit avant le build. Les vraies données n'entrent jamais dans ce dépôt, et la version publique ne nomme jamais le client : son nom, le pied de page, les textes et les libellés de leviers qui lui sont propres viennent du jeu de données (`client`, `footer`, `texts`, `leverTexts`).

Un jeu de données (`Dataset` dans `src/data/types.ts`) fournit les catégories, leurs groupes d'affichage, les noms des catégories cités dans les textes des leviers (`{meatAlt}`, `{veganMeals}`, `{wholePlant}`, `{dairyAlt}`), les textes d'interface propres à la version, le tableau par rayon, l'objectif scope 3, les scénarios suggérés et le registre du modèle I2.

## Modifier les données

- `src/data/config.json` : nom du client, année de référence, horizons, prolongation au-delà de 2030 (`extension`), groupes animaux, repère néerlandais et sa source.
- `src/data/public/` : catégories fictives, groupes, tableau par rayon, registre I2, scénarios, textes et objectif scope 3. Ces fichiers sont générés par `scripts/build_datasets.py` du dépôt privé ; corrigez le script plutôt que les fichiers.
- `src/data/levers.json` : les 20 leviers, avec leurs textes en `{ fr, en }`, leurs hypothèses (`value`, `min`, `max`, `step`, `unit`, `dependsOn` pour une hypothèse liée) et leurs effets.
- `src/data/dossiers/i2.json` : le contenu du dossier du levier 12 (constats, sources, contre-preuves, distributeurs, lacunes, libellés du registre).

### Les effets d'un levier

Chaque effet est une opération sur les catégories. Les valeurs sont de petites expressions sur les identifiants des hypothèses du levier, par exemple `"priceCut * elasticity * (1 - fromDairy)"`. Une hypothèse en `%` ou en `pts` y entre en fraction (30 devient 0,30).

- `scale` : le volume des catégories visées change de `x`. Une hausse peut être prise en partie sur d'autres catégories (`substitution`, en tonnes de produit ou de protéines).
- `transfer` : une part `x` du volume des catégories sources passe vers une catégorie receveuse ; `receiverPlantShare` donne la part végétale de la nouvelle recette.
- `composition` : la part végétale des protéines d'une catégorie bouge de `x`.
- `price` : le prix au kilo change de `x` ; cela ne touche que le chiffre d'affaires.

Après une modification, `npm test` vérifie la cohérence des données (catégories et hypothèses existantes, plages respectées, hypothèses liées sans boucle, textes bilingues, vocabulaire, typographie) et le calage des scénarios ; `npm run report` affiche les nouveaux résultats.

### Les textes d'interface

`src/i18n/fr.json` et `src/i18n/en.json`, avec exactement les mêmes clés. Règles de rédaction : voir `CLAUDE.md` (jamais « ratio » ni « plot » : « répartition protéique » et « catégories » ; « composites » et non « mixtes »).

## Règles de calcul

- La répartition protéique est toujours recalculée à partir des volumes et des parts de protéines, jamais en additionnant des points.
- Les leviers actifs s'appliquent l'un après l'autre, par numéro croissant, sur l'état courant de l'année.
- Les hausses sont exprimées en part des ventes 2025 et partagent un même potentiel : deux hausses de 20 % sur la même catégorie donnent 36 %, pas 44 %.
- Montée en charge : courbe en S entre l'année de lancement et la pleine charge, atteinte au plus tard en 2030. 2025 est la référence, sans aucun effet.
- Au-delà de 2030 : hypothèse de diffusion, les effets des leviers progressent de 4 % par an (`extension` dans `config.json`).
- Adoption des magasins : effet réel = effet × (1 - dépendance + dépendance × adoption). Les leviers de la centrale ne dépendent pas du curseur.
- Fourchette : deux simulations de plus avec les multiplicateurs bas et haut de chaque levier. Le levier 3 (meilleures données) ne bouge pas la répartition et resserre ces fourchettes.
- Cascade (répartition, CO2 ou chiffre d'affaires) : effet isolé de chaque levier, réparti proportionnellement pour que la somme égale l'effet combiné. L'écart s'affiche comme « recouvrement entre leviers ».
- Objectif scope 3 : la baisse de CO2 de la trajectoire rapportée à la réduction visée (part × base scope 3). Le CO2 du simulateur ne couvre que les produits du périmètre : c'est un ordre de grandeur.
- Garde-fou (calculé, non affiché) : gain annuel moyen comparé au rythme néerlandais (0,85 point par an).
- Chiffre d'affaires : volumes × prix au kilo, à périmètre constant ; il progresse dans les quatre scénarios suggérés (un test le vérifie).
- Modèle I2 (levier 12) : reproduction formule par formule du classeur d'Altera (trimestres, déploiement en S, cohortes, élargissement de gamme, deux canaux côté viande, marge, carbone, effort), Monte Carlo triangulaire à graine fixe et tornado. C'est le seul endroit où la marge est chiffrée en euros.

## Déployer

Chaque push sur `main` lance `.github/workflows/deploy.yml` : tests, build, puis publication sur GitHub Pages (source « GitHub Actions » dans les réglages Pages du dépôt). Le chemin de base `/altera-trajectory/` est fixé dans `vite.config.ts`. Après un push, relancez aussi le workflow du dépôt privé pour mettre à jour la version client. Pages garde les fichiers en cache une dizaine de minutes : forcez le rechargement si une modification n'apparaît pas.

L'application est entièrement statique : aucune requête réseau à l'exécution, polices embarquées. `localStorage` garde seulement la langue, la visite guidée déjà vue, le dernier scénario et vos scénarios enregistrés.
