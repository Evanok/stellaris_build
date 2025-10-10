# Stellaris Data Extractor

Un outil Python pour extraire les données du jeu Stellaris depuis les fichiers de métadonnées du jeu et les convertir en JSON.

## Fonctionnalités

- **Parser Paradox Script** : Parser générique pour les fichiers `.txt` au format Paradox Interactive
- **Extraction de Traits** : Extrait tous les traits d'espèces avec leurs coûts, effets, prérequis, etc. (432 traits)
- **Extraction de Civics & Origins** : Extrait tous les civics et origins avec leurs modificateurs, conditions, etc. (254 civics + 55 origins)
- **Extraction d'Ethics** : Extrait toutes les éthiques avec leurs effets et variantes (17 ethics)
- **Extraction de Traditions** : Extrait tous les arbres de traditions et traditions individuelles (234 traditions, 62 arbres)
- **Extraction d'Ascension Perks** : Extrait tous les perks d'ascension (46 perks)
- **Export JSON** : Données exportées en format JSON pour une utilisation facile dans d'autres applications

## Prérequis

- Python 3.6 ou supérieur
- Stellaris installé (testé avec la version Steam)

## Installation

1. Aucune dépendance externe nécessaire - utilise uniquement la bibliothèèque standard Python

```bash
# Optionnel : créer un environnement virtuel
python3 -m venv venv
source venv/bin/activate  # Sur Windows: venv\Scripts\activate

# Installer les dépendances (aucune requise pour l'instant)
pip install -r requirements.txt
```

## Utilisation

### Extraction Complète (Recommandé)

```bash
python3 extract_all.py [chemin_vers_stellaris]
```

Extrait toutes les données : ethics, traits, civics, origins, traditions et ascension perks.

**Exemple avec WSL:**
```bash
python3 extract_all.py "/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris"
```

**Exemple Windows:**
```bash
python extract_all.py "C:\Program Files (x86)\Steam\steamapps\common\Stellaris"
```

**Sorties:**
- `output/ethics.json` - 17 ethics
- `output/traits.json` - 432 traits
- `output/civics.json` - Tous civics + origins
- `output/civics_civics_only.json` - 254 civics seulement
- `output/civics_origins_only.json` - 55 origins seulement
- `output/traditions.json` - 234 traditions
- `output/traditions_by_tree.json` - Traditions organisées par arbre
- `output/ascension_perks.json` - 46 ascension perks

### Extraction Individuelle

Vous pouvez aussi extraire chaque type de données séparément :

```bash
python3 extract_ethics.py [chemin]          # Ethics
python3 extract_traits.py [chemin]          # Traits
python3 extract_civics.py [chemin]          # Civics & Origins
python3 extract_traditions.py [chemin]      # Traditions
python3 extract_ascension_perks.py [chemin] # Ascension Perks
```

### Chemin par défaut

Si aucun chemin n'est spécifié, le script utilise le chemin par défaut WSL :
```
/mnt/c/Program Files (x86)/Steam/steamapps/common/Stellaris
```

## Structure des Données

### Traits (traits.json)

Chaque trait contient :
```json
{
  "id": "trait_intelligent",
  "name": "trait_intelligent",
  "cost": 2,
  "category": "normal",
  "initial": true,
  "randomized": true,
  "opposites": ["trait_erudite", "trait_nerve_stapled"],
  "prerequisites": [],
  "allowed_archetypes": ["BIOLOGICAL", "LITHOID"],
  "tags": ["positive", "organic"],
  "effects": "engineering_research_add: +10%; physics_research_add: +10%; society_research_add: +10%",
  "modifier": {
    "engineering_research_add": 0.1,
    "physics_research_add": 0.1,
    "society_research_add": 0.1
  },
  "custom_tooltip": "",
  "slave_cost": {}
}
```

### Civics (civics.json)

Chaque civic/origin contient :
```json
{
  "id": "civic_technocracy",
  "name": "civic_technocracy",
  "is_origin": false,
  "playable": true,
  "pickable_at_start": true,
  "description": "civic_tooltip_technocracy_effects",
  "potential": [],
  "possible": ["NOT auth_corporate"],
  "can_modify": true,
  "effects": "country_scientist_cap_add: +1",
  "modifier": {
    "country_scientist_cap_add": 1
  },
  "enforced_traits": [],
  "ai_weight": 10,
  "random_weight": 10,
  "alternate_version": "",
  "can_build_ruler_ship": false,
  "custom_tooltip": ""
}
```

## Architecture

### Fichiers Principaux

- `paradox_parser.py` - Parser générique pour le format Paradox Script
- `extract_all.py` - Script principal pour extraire toutes les données
- `extract_ethics.py` - Extracteur d'ethics
- `extract_traits.py` - Extracteur de traits d'espèces
- `extract_civics.py` - Extracteur de civics et origins
- `extract_traditions.py` - Extracteur de traditions
- `extract_ascension_perks.py` - Extracteur d'ascension perks

### Parser Paradox Script

Le parser `ParadoxParser` gère :
- Commentaires (`#`)
- Objets imbriqués (`{ }`)
- Opérateurs (`=`, `<`, `>`, `<=`, `>=`)
- Types de données : booléens (`yes`/`no`), entiers, flottants, chaînes
- Chaînes entre guillemets
- Clés multiples (converties en listes)

### Fichiers Sources Stellaris

**Traits:**
- `common/traits/01_species_traits_habitability.txt`
- `common/traits/02_species_traits_basic_characteristics.txt`
- `common/traits/04_species_traits.txt`
- `common/traits/05_species_traits_robotic.txt`
- Et les DLCs (distant_stars, megacorp, etc.)

**Civics:**
- `common/governments/civics/00_civics.txt`
- `common/governments/civics/00_origins.txt`
- `common/governments/civics/02_gestalt_civics.txt`
- `common/governments/civics/03_corporate_civics.txt`

**Ethics:**
- `common/ethics/00_ethics.txt`

**Traditions:**
- `common/traditions/*.txt` (tous les fichiers de traditions)

**Ascension Perks:**
- `common/ascension_perks/00_ascension_paths.txt`
- `common/ascension_perks/00_ascension_perks.txt`

## Extension

Pour ajouter l'extraction d'autres types de données (technologies, buildings, etc.) :

1. Créer un nouveau fichier `extract_xxx.py`
2. Utiliser `paradox_parser.parse_stellaris_file(filepath)` pour parser
3. Extraire et formater les données pertinentes
4. Exporter en JSON

## Limitations

- Les noms sont des clés techniques (ex: `trait_intelligent`), pas les noms localisés
- Pour avoir les noms traduits, il faudrait parser les fichiers de localisation dans `localisation/`
- Certaines conditions complexes peuvent être simplifiées
- Les modificateurs dynamiques ou scriptés peuvent ne pas être complètement capturés

## Données Extraites

✅ **Implémenté:**
- Ethics (17)
- Traits d'espèces (432)
- Civics (254)
- Origins (55)
- Traditions (234 dans 62 arbres)
- Ascension Perks (46)

## Prochaines Étapes

- [ ] Extraction des noms localisés (français/anglais)
- [ ] Extraction des technologies
- [ ] Extraction des authorities (gouvernements)
- [ ] Extraction des DLCs requis
- [ ] Extraction des buildings et districts
- [ ] Interface en ligne de commande améliorée
- [ ] Export vers d'autres formats (CSV, SQL)

## Contribution

Pour signaler un bug ou proposer une amélioration, créez une issue ou un pull request.

## Licence

Ce projet est un outil d'extraction de données pour un usage personnel. Stellaris et ses données appartiennent à Paradox Interactive.
