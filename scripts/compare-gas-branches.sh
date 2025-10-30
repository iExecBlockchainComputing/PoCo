#!/bin/bash
# SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
# SPDX-License-Identifier: Apache-2.0

set -e

echo "🚀 Gas Comparison Across Branches"
echo "=================================="
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "   Please install Python 3 and try again."
    exit 1
fi

# Check if required Python packages are installed
echo "📦 Checking Python dependencies..."
if ! python3 -c "import matplotlib" 2>/dev/null; then
    echo "⚠️  matplotlib not found. Installing..."
    pip3 install matplotlib numpy
fi

# Step 1: Compile TypeScript scripts
echo ""
echo "🔨 Compiling TypeScript scripts..."
npx tsc scripts/gas-comparison.ts --outDir scripts --module commonjs --target ES2020 --esModuleInterop --resolveJsonModule

# Step 2: Collect gas data from all branches
echo ""
echo "📊 Collecting gas data from branches..."
echo "   This will take several minutes..."
node scripts/gas-comparison.js

# Step 3: Generate charts
echo ""
echo "📈 Generating comparison charts..."
python3 scripts/generate-gas-charts.py

# Step 4: Display results
echo ""
echo "✅ Gas comparison complete!"
echo ""
echo "📁 Results saved to:"
echo "   - gas-reports/comparison-data.json (raw data)"
echo "   - gas-reports/charts/ (visual charts)"
echo "   - gas-reports/charts/gas-comparison-report.md (summary report)"
echo ""
echo "🖼️  Open the charts to view the comparison:"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "   open gas-reports/charts/"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "   xdg-open gas-reports/charts/"
else
    echo "   Navigate to gas-reports/charts/ to view the charts"
fi

