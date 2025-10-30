# 🚀 Gas Comparison - Quick Start Guide

Comparez les coûts en gaz entre différentes branches en quelques commandes !

## ⚡ Utilisation rapide

```bash
# Option 1 : Tout en une commande (recommandé)
npm run gas:compare

# Option 2 : Étape par étape
npm run gas:collect    # Collecte des données
npm run gas:charts     # Génération des graphiques
```

## 📊 Ce qui sera généré

Le système va créer automatiquement :

### 1. Diagrammes en barres comparatifs

Chaque méthode aura **3 barres colorées** :
- 🔵 **Bleu** : `main` (référence actuelle)
- 🔴 **Rouge** : `chore/solidity-v8` (breaking changes)
- 🟢 **Vert** : `feature/make-migration-non-breaking` (non-breaking)

**Exemple :**
```
IexecERC20Core._transferUnchecked
  ████████████████████████████████ 43,700 gas (main)
  █████████████████████████████████ 45,597 gas (v8 breaking)
  ████████████████████████████████▌ 43,800 gas (v8 non-breaking)

IexecERC20Core._burn
  ████████████████████████████ 39,630 gas (main)
  ████████████████████████████▌ 41,047 gas (v8 breaking)
  ████████████████████████████ 39,750 gas (v8 non-breaking)
```

### 2. Heatmap des différences (%)

Visualisation rapide des variations :
- 🟢 **Vert** = Moins de gaz (amélioration)
- 🔴 **Rouge** = Plus de gaz (régression)

### 3. Rapport détaillé (Markdown)

Tableau complet avec :
- Valeurs exactes pour chaque branche
- Différences en gas et pourcentage
- Statistiques globales

## 📁 Où trouver les résultats ?

Après exécution :

```
gas-reports/
└── charts/
    ├── gas-comparison-all.png              ← Vue d'ensemble
    ├── gas-comparison-IexecERC20Core.png   ← Par contrat
    ├── gas-comparison-IexecERC20Facet.png
    ├── gas-difference-heatmap.png          ← Heatmap
    └── gas-comparison-report.md            ← Rapport détaillé
```

## 🔍 Exemple de rapport

```markdown
# Gas Cost Comparison Report

## Summary

### Solidity v8 (breaking)
- Total methods compared: 5
- Methods with increased gas: 4
- Methods with decreased gas: 1
- Average gas increase: 1,657 gas

### Solidity v8 (non-breaking)
- Total methods compared: 5
- Methods with increased gas: 2
- Methods with decreased gas: 0
- Average gas increase: 110 gas

## Detailed Comparison

| Method | Main | v8 (breaking) | v8 (non-breaking) | Diff (breaking) | Diff (non-breaking) |
|--------|------|---------------|-------------------|-----------------|---------------------|
| IexecERC20Core._transferUnchecked | 43,700 | 45,597 | 43,800 | +1,897 (+4.3%) | +100 (+0.2%) |
| IexecERC20Core._burn | 39,630 | 41,047 | 39,750 | +1,417 (+3.6%) | +120 (+0.3%) |
| IexecERC20Facet.transfer | 44,006 | 46,217 | 44,100 | +2,211 (+5.0%) | +94 (+0.2%) |
```

## ⏱️ Temps d'exécution

- **Collecte des données** : ~10-15 minutes (tests sur 3 branches)
- **Génération des charts** : ~5 secondes

## 📋 Prérequis

### 1. Python 3 et dépendances

```bash
# Installer matplotlib et numpy
pip3 install matplotlib numpy
```

### 2. Branches disponibles localement

```bash
# Vérifier que les branches existent
git branch -a | grep -E "(main|chore/solidity-v8|feature/make-migration-non-breaking)"
```

### 3. Working directory propre

```bash
# Vérifier l'état
git status

# Commiter ou stasher vos modifications
git stash  # ou git commit
```

## 🎯 Cas d'usage

### Analyser l'impact de la migration Solidity v8

```bash
npm run gas:compare
```

Regardez ensuite :
1. 📊 `gas-comparison-all.png` pour une vue globale
2. 🔥 `gas-difference-heatmap.png` pour identifier les régressions
3. 📝 `gas-comparison-report.md` pour les détails chiffrés

### Comparer uniquement certaines méthodes

Modifiez `scripts/gas-comparison.ts` pour cibler des tests spécifiques :

```typescript
const testOutput = execSync(
    'npm test -- test/byContract/IexecERC20/IexecERC20Core-gas.test.ts',
    { encoding: 'utf-8' }
);
```

### Ajouter d'autres branches

Éditez `scripts/gas-comparison.ts` :

```typescript
const branches = [
    'main',
    'chore/solidity-v8',
    'feature/make-migration-non-breaking',
    'your-feature-branch',  // ← Ajoutez ici
];
```

## 🐛 Problèmes courants

### ❌ "Python dependencies not found"

```bash
pip3 install matplotlib numpy
```

### ❌ "Cannot checkout branch"

```bash
git fetch origin
git checkout chore/solidity-v8
git checkout feature/make-migration-non-breaking
git checkout main
```

### ❌ "Tests failed"

Vérifiez que les tests passent sur chaque branche :

```bash
git checkout main && npm test
git checkout chore/solidity-v8 && npm test
git checkout feature/make-migration-non-breaking && npm test
```

## 📚 Documentation complète

Pour plus de détails, consultez : [`scripts/gas-comparison-README.md`](scripts/gas-comparison-README.md)

## 🎨 Personnalisation

### Changer les couleurs

Éditez `scripts/generate-gas-charts.py` :

```python
COLORS = {
    'main': '#your-color',
    'chore/solidity-v8': '#your-color',
    'feature/make-migration-non-breaking': '#your-color'
}
```

### Ajuster la taille des graphiques

Dans `generate-gas-charts.py` :

```python
fig, ax = plt.subplots(figsize=(16, 10))  # Largeur x Hauteur
```

## 💡 Tips

1. **Première exécution lente ?** C'est normal, chaque branche nécessite `npm ci` et la compilation
2. **Sauvegardez les résultats** : Les charts sont écrasés à chaque exécution
3. **CI/CD** : Vous pouvez automatiser ce process dans votre pipeline

## 🤝 Contribution

Améliorations bienvenues ! Quelques idées :
- Ajouter des graphiques d'évolution temporelle
- Comparer avec des benchmarks externes
- Ajouter des alertes si régression > X%

---

**Questions ?** Consultez la [documentation complète](scripts/gas-comparison-README.md)

