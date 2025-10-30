# Gas Comparison Tool

Outil de visualisation et comparaison des consommations de gas entre différentes branches.

## 📋 Prérequis

- Python 3.7+
- pip (gestionnaire de paquets Python)

## 🚀 Installation

Installez les dépendances Python nécessaires :

```bash
pip install matplotlib pandas
```

## 📁 Structure des Données

Les données de gas sont stockées dans le répertoire `gas-reports/` sous forme de fichiers JSON :

```
gas-reports/
├── main.json
├── chore-solidity-v8.json
└── feature-make-migration-non-breaking.json
```

Chaque fichier JSON contient un tableau d'objets avec la structure suivante :

```json
[
  {
    "contract": "IexecERC20Core",
    "method": "_burn",
    "min": 39630,
    "max": 39630,
    "avg": 39630,
    "calls": 5
  }
]
```

## 📊 Génération des Graphiques

Pour générer les graphiques de comparaison :

```bash
# Option 1: Script wrapper (recommandé)
./scripts/generate-gas-charts.sh

# Option 2: Python directement
/usr/bin/python3 scripts/generate-gas-charts.py

# Option 3: Si python3 est dans votre PATH
python3 scripts/generate-gas-charts.py
```

Cette commande génère :
- **`gas-reports/gas-comparison.png`** : Graphique comparatif de toutes les méthodes
- **`gas-reports/gas-comparison-by-contract.png`** : Un graphique par contrat

## 🎨 Graphiques Générés

### Graphique Global

Le graphique principal compare la consommation de gas moyenne (AVG) pour toutes les méthodes à travers les trois branches.

- **Axe X** : Méthodes des contrats
- **Axe Y** : Consommation de gas
- **Couleurs** : 
  - 🔵 Bleu : branch `main` (baseline)
  - 🟠 Orange : branch `chore/solidity-v8`
  - 🟢 Vert : branch `feature/make-migration-non-breaking`

### Graphiques par Contrat

Pour une meilleure lisibilité, un graphique séparé est généré pour chaque contrat, regroupant toutes ses méthodes.

## 📈 Interprétation des Résultats

### Augmentation de Gas (⬆️)

Une augmentation de la consommation de gas peut indiquer :
- Logique supplémentaire ajoutée
- Checks de sécurité renforcés
- Changements dans les types de données (Solidity v0.8+)

### Diminution de Gas (⬇️)

Une diminution est généralement positive et peut résulter de :
- Optimisations du code
- Amélioration de l'utilisation du storage
- Meilleure efficacité des algorithmes

### Pas de Changement (=)

Indique que la modification n'a pas impacté cette fonction.

## 🔍 Analyse Détaillée

### Méthodes Clés à Surveiller

#### Fonctions Core ERC20
- `_transferUnchecked` : Fonction interne de transfert
- `_burn` : Destruction de tokens
- `transfer` : Transfert standard ERC20
- `approveAndCall` : Approbation avec callback

#### Fonctions PoCo (Proof of Contribution)
- `matchOrders` : Matching d'ordres (⚠️ fonction coûteuse)
- `contribute` : Contribution d'un worker
- `initialize` : Initialisation d'une tâche
- `claim` : Réclamation des rewards

#### Fonctions Boost
- `matchOrdersBoost` : Version boost du matching
- `claimBoost` : Réclamation boost

## 📝 Notes Importantes

### Overhead du Diamond Proxy Pattern

Le projet utilise le pattern Diamond (EIP-2535) qui ajoute un léger overhead :
- Délégation via `delegatecall`
- Résolution des facets
- Storage indirection

Cet overhead est constant et apparaît dans toutes les branches.

### Différences Entre Branches

#### `main` → `chore/solidity-v8`
Migration de Solidity 0.6.x vers 0.8.x :
- Checks arithmétiques automatiques (SafeMath intégré)
- Meilleure gestion des erreurs
- Optimisations du compilateur

#### `main` → `feature/make-migration-non-breaking`
Modifications pour assurer la compatibilité :
- Maintien de l'interface existante
- Préservation des comportements legacy

## 🛠️ Personnalisation

### Ajouter une Nouvelle Branche

1. Créez un nouveau fichier JSON dans `gas-reports/` :
```bash
cp gas-reports/main.json gas-reports/ma-nouvelle-branche.json
```

2. Mettez à jour les données dans le fichier JSON

3. Le script Python détectera automatiquement le nouveau fichier

### Modifier les Couleurs

Éditez le dictionnaire `colors` dans `generate-gas-charts.py` :

```python
colors = {
    'main': '#2E86AB',
    'chore-solidity-v8': '#A23B72',
    'ma-nouvelle-branche': '#F18F01'  # Ajout personnalisé
}
```

## 🐛 Dépannage

### Erreur "No module named 'matplotlib'"

```bash
pip install matplotlib pandas
```

### Graphiques vides

Vérifiez que les fichiers JSON sont bien formatés et contiennent des données.

### Noms de méthodes tronqués

Le script ajuste automatiquement la taille des labels. Pour une personnalisation plus fine, modifiez la valeur de `rotation` dans le code :

```python
plt.xticks(rotation=45, ha='right')  # Changez 45 en 90 pour une rotation verticale
```

## 📚 Ressources

- [EIP-2535: Diamond Standard](https://eips.ethereum.org/EIPS/eip-2535)
- [Solidity Gas Optimization](https://docs.soliditylang.org/en/latest/internals/optimizer.html)
- [Hardhat Gas Reporter](https://github.com/cgewecke/hardhat-gas-reporter)

## 🤝 Contribution

Pour ajouter de nouvelles fonctionnalités d'analyse :

1. Modifiez `generate-gas-charts.py`
2. Testez avec `python scripts/generate-gas-charts.py`
3. Documentez les changements dans ce README

## 📧 Support

Pour toute question ou problème, ouvrez une issue sur le repository du projet.
