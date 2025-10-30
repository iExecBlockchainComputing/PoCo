#!/usr/bin/env python3
"""
Gas Comparison Chart Generator

Generates comparison charts from individual branch gas report JSON files.
"""

import json
import matplotlib.pyplot as plt
import pandas as pd
from pathlib import Path
import os

# Color scheme for branches
COLORS = {
    'main': '#2E86AB',
    'chore-solidity-v8': '#A23B72', 
    'feature-make-migration-non-breaking': '#F18F01'
}

# Branch display names
BRANCH_LABELS = {
    'main': 'main',
    'chore-solidity-v8': 'chore/solidity-v8',
    'feature-make-migration-non-breaking': 'feature/make-migration-non-breaking'
}

def load_branch_data(reports_dir):
    """Load gas data from individual branch JSON files."""
    reports_path = Path(reports_dir)
    branch_data = {}
    
    # Map of filenames to branch keys
    file_mapping = {
        'main.json': 'main',
        'chore-solidity-v8.json': 'chore-solidity-v8',
        'feature-make-migration-non-breaking.json': 'feature-make-migration-non-breaking'
    }
    
    for filename, branch_key in file_mapping.items():
        filepath = reports_path / filename
        if filepath.exists():
            print(f"📁 Loading {filename}...")
            with open(filepath, 'r') as f:
                data = json.load(f)
                branch_data[branch_key] = data
        else:
            print(f"⚠️  Warning: {filename} not found, skipping...")
    
    return branch_data

def prepare_comparison_dataframe(branch_data):
    """Prepare a DataFrame suitable for comparison charts."""
    all_methods = set()
    
    # Collect all unique (contract, method) pairs
    for branch, methods in branch_data.items():
        for entry in methods:
            all_methods.add((entry['contract'], entry['method']))
    
    # Create DataFrame
    rows = []
    for contract, method in sorted(all_methods):
        row = {
            'contract': contract,
            'method': method,
            'label': f"{contract}.{method}"
        }
        
        # Add data for each branch
        for branch in branch_data.keys():
            # Find matching entry
            matching = [e for e in branch_data[branch] 
                       if e['contract'] == contract and e['method'] == method]
            if matching:
                entry = matching[0]
                row[f'{branch}_avg'] = entry['avg']
                row[f'{branch}_min'] = entry['min']
                row[f'{branch}_max'] = entry['max']
                row[f'{branch}_calls'] = entry['calls']
            else:
                row[f'{branch}_avg'] = None
                row[f'{branch}_min'] = None
                row[f'{branch}_max'] = None
                row[f'{branch}_calls'] = 0
        
        rows.append(row)
    
    df = pd.DataFrame(rows)
    return df

def create_comparison_chart(df, output_path, title="Gas Consumption Comparison"):
    """Create a bar chart comparing gas consumption across branches."""
    branches = ['main', 'chore-solidity-v8', 'feature-make-migration-non-breaking']
    
    # Filter out methods with no data
    df_filtered = df[df[[f'{b}_avg' for b in branches]].notna().any(axis=1)].copy()
    
    if df_filtered.empty:
        print("⚠️  No data to plot!")
        return
    
    # Create figure
    fig, ax = plt.subplots(figsize=(16, 10))
    
    # Prepare data for plotting
    x = range(len(df_filtered))
    width = 0.25
    
    for i, branch in enumerate(branches):
        if f'{branch}_avg' in df_filtered.columns:
            values = df_filtered[f'{branch}_avg'].values
            offset = (i - 1) * width
            bars = ax.bar(
                [pos + offset for pos in x],
                values,
                width,
                label=BRANCH_LABELS.get(branch, branch),
                color=COLORS.get(branch, '#999999')
            )
    
    # Customize chart
    ax.set_xlabel('Contract.Method', fontsize=12, fontweight='bold')
    ax.set_ylabel('Gas Consumption (avg)', fontsize=12, fontweight='bold')
    ax.set_title(title, fontsize=14, fontweight='bold', pad=20)
    ax.set_xticks(x)
    ax.set_xticklabels(df_filtered['label'], rotation=45, ha='right')
    ax.legend(loc='upper left', framealpha=0.9)
    ax.grid(axis='y', alpha=0.3, linestyle='--')
    
    # Add value labels on bars (optional - remove if too crowded)
    # for container in ax.containers:
    #     ax.bar_label(container, fmt='%.0f', padding=3, fontsize=7)
    
    plt.tight_layout()
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    print(f"✅ Generated: {output_path}")
    plt.close()

def create_charts_by_contract(df, output_dir):
    """Create separate charts for each contract."""
    contracts = df['contract'].unique()
    
    for contract in contracts:
        df_contract = df[df['contract'] == contract].copy()
        
        if df_contract.empty:
            continue
        
        # Create safe filename
        safe_contract_name = contract.replace('/', '-').replace(':', '-')
        output_path = Path(output_dir) / f'gas-comparison-{safe_contract_name}.png'
        
        create_comparison_chart(
            df_contract,
            output_path,
            title=f"Gas Consumption: {contract}"
        )

def create_detailed_table(df, output_path):
    """Create a detailed comparison table in text format."""
    branches = ['main', 'chore-solidity-v8', 'feature-make-migration-non-breaking']
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("=" * 150 + "\n")
        f.write("GAS CONSUMPTION COMPARISON TABLE\n")
        f.write("=" * 150 + "\n\n")
        
        for _, row in df.iterrows():
            f.write(f"📝 {row['contract']}.{row['method']}\n")
            f.write("-" * 150 + "\n")
            
            # Header
            f.write(f"{'Branch':<45} | {'AVG Gas':>12} | {'MIN Gas':>12} | {'MAX Gas':>12} | {'# Calls':>10} | {'Diff vs main':>15}\n")
            f.write("-" * 150 + "\n")
            
            # Reference value from main
            main_avg = row.get('main_avg')
            
            # Data rows
            for branch in branches:
                branch_label = BRANCH_LABELS.get(branch, branch)
                avg = row.get(f'{branch}_avg')
                min_gas = row.get(f'{branch}_min')
                max_gas = row.get(f'{branch}_max')
                calls = row.get(f'{branch}_calls', 0)
                
                if avg is not None:
                    # Calculate difference
                    if main_avg and branch != 'main':
                        diff = avg - main_avg
                        diff_pct = (diff / main_avg) * 100
                        diff_str = f"{diff:+.0f} ({diff_pct:+.1f}%)"
                    else:
                        diff_str = "-"
                    
                    f.write(f"{branch_label:<45} | {avg:>12.0f} | {min_gas:>12.0f} | {max_gas:>12.0f} | {calls:>10} | {diff_str:>15}\n")
                else:
                    f.write(f"{branch_label:<45} | {'N/A':>12} | {'N/A':>12} | {'N/A':>12} | {calls:>10} | {'-':>15}\n")
            
            f.write("\n")
        
        f.write("=" * 150 + "\n")
    
    print(f"✅ Generated: {output_path}")

def print_summary_statistics(df):
    """Print summary statistics to console."""
    branches = ['main', 'chore-solidity-v8', 'feature-make-migration-non-breaking']
    
    print("\n" + "=" * 80)
    print("📊 SUMMARY STATISTICS")
    print("=" * 80 + "\n")
    
    for branch in branches:
        avg_col = f'{branch}_avg'
        if avg_col in df.columns:
            values = df[avg_col].dropna()
            if not values.empty:
                print(f"🔹 {BRANCH_LABELS.get(branch, branch)}:")
                print(f"   Methods tracked: {len(values)}")
                print(f"   Mean gas: {values.mean():.0f}")
                print(f"   Median gas: {values.median():.0f}")
                print(f"   Min gas: {values.min():.0f}")
                print(f"   Max gas: {values.max():.0f}")
                print()
    
    # Comparison with main
    if 'main_avg' in df.columns:
        print("🔸 Differences vs main branch:\n")
        
        for branch in ['chore-solidity-v8', 'feature-make-migration-non-breaking']:
            avg_col = f'{branch}_avg'
            if avg_col in df.columns:
                # Calculate differences
                valid_rows = df[['main_avg', avg_col]].dropna()
                if not valid_rows.empty:
                    diffs = valid_rows[avg_col] - valid_rows['main_avg']
                    pct_diffs = (diffs / valid_rows['main_avg']) * 100
                    
                    print(f"   {BRANCH_LABELS.get(branch, branch)}:")
                    print(f"   Average difference: {diffs.mean():+.0f} gas ({pct_diffs.mean():+.2f}%)")
                    print(f"   Increased methods: {(diffs > 0).sum()} / {len(diffs)}")
                    print(f"   Decreased methods: {(diffs < 0).sum()} / {len(diffs)}")
                    print(f"   Unchanged methods: {(diffs == 0).sum()} / {len(diffs)}")
                    print()
    
    print("=" * 80 + "\n")

def main():
    """Main execution function."""
    print("=" * 80)
    print("🚀 Gas Comparison Chart Generator")
    print("=" * 80 + "\n")
    
    # Paths
    project_root = Path(__file__).parent.parent
    reports_dir = project_root / 'gas-reports'
    
    # Load data
    print("📊 Loading gas data from branch files...\n")
    branch_data = load_branch_data(reports_dir)
    
    if not branch_data:
        print("❌ No data files found! Please ensure JSON files exist in gas-reports/")
        return
    
    print(f"\n✅ Loaded data for {len(branch_data)} branches\n")
    
    # Prepare DataFrame
    print("🔄 Preparing comparison data...\n")
    df = prepare_comparison_dataframe(branch_data)
    
    # Print summary statistics
    print_summary_statistics(df)
    
    # Generate charts
    print("📈 Generating charts...\n")
    
    # Global comparison chart
    global_chart_path = reports_dir / 'gas-comparison.png'
    create_comparison_chart(df, global_chart_path)
    
    # Charts by contract
    create_charts_by_contract(df, reports_dir)
    
    # Detailed table
    table_path = reports_dir / 'gas-comparison-table.txt'
    create_detailed_table(df, table_path)
    
    print("\n" + "=" * 80)
    print("✨ All charts and reports generated successfully!")
    print("=" * 80)
    print(f"\n📁 Output directory: {reports_dir}")
    print(f"   - gas-comparison.png (global comparison)")
    print(f"   - gas-comparison-*.png (per-contract charts)")
    print(f"   - gas-comparison-table.txt (detailed table)")
    print()

if __name__ == '__main__':
    main()
