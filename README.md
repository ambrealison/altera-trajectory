# Altera.ai · Trajectoire protéique

Démonstration d'un simulateur de trajectoire protéique pour un distributeur coopératif, présentée par Altera et InterVeg.

**Toutes les données sont fictives.** Les volumes, les prix, le CO2, les leviers et leurs hypothèses servent à illustrer la démarche. Ce n'est pas un outil de production, et aucune donnée réelle de distributeur ne doit entrer dans ce dépôt.

En ligne : https://ambrealison.github.io/altera-trajectory/ (non indexé par les moteurs de recherche). `?lang=en` ouvre la version anglaise.

## Ce que montre la démo

1. **Point de départ** : le ratio Protein Tracker de référence (32,0 % en 2025), décomposé sur les 4 plots, la part végétale des produits mixtes et les autres protéines végétales, chaque bloc détaillé catégorie par catégorie. Un sélecteur discret passe en WWF FG1.
2. **Les leviers** : les 20 leviers du dossier, en liste ou en matrice impact / effort, filtrables par plot et par type, avec l'effet isolé de chacun à l'horizon.
3. **Trajectoire** : leviers à cocher, quatre scénarios, part des magasins qui suivent, horizon 2028, 2030, 2035 ou 2040 ; lecture par levier (cascade) ou dans le temps (courbe avec fourchette, aire empilée des plots, rythme observé aux Pays-Bas jusqu'en 2030) ; épinglage d'un scénario pour comparer. Le garde-fou de réalisme n'est plus affiché : il se présente à l'oral (il reste calculé et testé dans `src/engine/guardrail.ts`).
4. **Avec vos données** : les modules que des données réelles permettraient de construire.

La démo s'ouvre sur le scénario « Volontaire ». La fiche levier (panneau de droite) montre la description, les hypothèses en curseurs, l'effet à l'horizon et le pilote proposé. Toute modification met la trajectoire à jour aussitôt. L'état complet (leviers, hypothèses, adoption, horizon, indicateur, langue) est encodé dans l'URL : un lien copié rouvre exactement le même scénario.

## Lancer en local

Node 22 ou plus récent.

```bash
npm install
npm run dev
```

L'application s'ouvre sur http://localhost:5173/altera-trajectory/.

Autres commandes :

```bash
npm test             # tests Vitest du moteur, des données et des textes
npm run report       # effet isolé de chaque levier et résultats des 4 scénarios
npm run build        # version statique dans dist/
npm run screenshots  # captures de chaque écran en FR et EN (serveur de dev lancé, Google Chrome installé)
```

## Modifier les données

Tout est dans `src/data/`, en JSON :

- `config.json` : nom du client, co-marquage, année de référence, horizons, prolongation au-delà de 2030 (`extension`), **libellés des 4 plots** (`plots` et `plotDetails`), rayons, groupes animaux, repère néerlandais et sa source. Les textes des leviers et de l'interface citent les plots par `{plot1}` à `{plot4}` : un nouveau libellé se propage partout.
- `categories.json` : les 24 catégories fictives (tonnes, protéines pour 100 g, part végétale des protéines, prix, CO2). Chaque gramme de protéine est rangé dans une catégorie nommée, sans fourre-tout ; l'écran 1 détaille chaque bloc (les 4 plots, les produits mixtes, les autres protéines végétales) catégorie par catégorie. Les fruits à coque sont rangés dans « Protéines végétales brutes ». « Fruits, légumes et pommes de terre » sert au calage : si vous changez des volumes, ajustez son tonnage pour garder une référence à 32,0 % (le test le vérifie).
- `levers.json` : les 20 leviers. Chaque levier a ses textes en `{ fr, en }`, ses hypothèses (`value`, `min`, `max`, `step`, `unit`) et ses effets.
- `scenarios.json` : les 4 scénarios (leviers actifs, adoption, valeurs d'hypothèses qui diffèrent des valeurs par défaut).

### Les effets d'un levier

Chaque effet est une opération sur les catégories. Les valeurs sont de petites expressions sur les identifiants des hypothèses du levier, par exemple `"priceCut * elasticity * (1 - fromDairy)"`. Une hypothèse en `%` ou en `pts` y entre en fraction (30 devient 0,30).

- `scale` : le volume des catégories visées change de `x`. Une hausse peut être prise en partie sur d'autres catégories (`substitution`, en tonnes de produit ou de protéines).
- `transfer` : une part `x` du volume des catégories sources passe vers une catégorie receveuse ; `receiverPlantShare` donne la part végétale de la nouvelle recette.
- `composition` : la part végétale des protéines d'une catégorie bouge de `x`.
- `price` : le prix au kilo change de `x` ; cela ne touche que le chiffre d'affaires.

Après une modification, `npm test` vérifie la cohérence des données (catégories et hypothèses existantes, plages respectées, textes bilingues, typographie) et le calage des scénarios ; `npm run report` affiche les nouveaux résultats.

### Les textes d'interface

`src/i18n/fr.json` et `src/i18n/en.json`, avec exactement les mêmes clés. Règles de rédaction : voir `CLAUDE.md`.

## Règles de calcul

- Le ratio est toujours recalculé à partir des volumes et des parts de protéines, jamais en additionnant des points.
- Les leviers actifs s'appliquent l'un après l'autre, par numéro croissant, sur l'état courant de l'année.
- Les hausses sont exprimées en part des ventes 2025 et partagent un même potentiel : deux hausses de 20 % sur la même catégorie donnent 36 %, pas 44 %.
- Montée en charge : courbe en S (fonction « smoothstep ») entre l'année de lancement et la pleine charge, atteinte au plus tard en 2030. 2025 est la référence, sans aucun effet.
- Au-delà de 2030 : hypothèse de diffusion, les effets des leviers progressent de 4 % par an (`extension` dans `config.json`). Les horizons 2035 et 2040 en dépendent.
- Adoption des magasins : effet réel = effet × (1 - dépendance + dépendance × adoption).
- Fourchette : deux simulations de plus avec les multiplicateurs bas et haut de chaque levier. Le levier 3 (meilleures données) ne bouge pas le ratio et resserre ces fourchettes.
- Cascade : effet isolé de chaque levier, réparti proportionnellement pour que la somme égale l'effet combiné. L'écart s'affiche comme « recouvrement entre leviers ».
- Garde-fou (calculé, non affiché) : gain annuel moyen comparé au rythme néerlandais (0,85 point par an). Au-delà de 1,5 fois ce rythme : « nettement au-dessus ».
- Chiffre d'affaires : volumes × prix au kilo, à périmètre constant. Pour la démonstration, les produits végétaux et hybrides sont valorisés plus cher au kilo, et les leviers 4, 6 et 20 portent une hypothèse de valorisation explicite : le chiffre d'affaires progresse dans les quatre scénarios (un test le vérifie).
- WWF FG1 : part végétale des aliments riches en protéines, en tonnes de produit ; les produits mixtes (hybrides, plats cuisinés) sont mis à part.

## Déployer

Chaque push sur `main` lance `.github/workflows/deploy.yml` : tests, build, puis publication sur GitHub Pages (source « GitHub Actions » dans les réglages Pages du dépôt). Le chemin de base `/altera-trajectory/` est fixé dans `vite.config.ts`. Pages garde les fichiers en cache une dizaine de minutes : forcez le rechargement si une modification n'apparaît pas.

L'application est entièrement statique : aucune requête réseau à l'exécution, polices embarquées. `localStorage` garde seulement la langue, la visite guidée déjà vue et le dernier scénario.
