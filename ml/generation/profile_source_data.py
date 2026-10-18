"""Read-only profile of supplied CSV/dictionary and static feature-group definitions.

Does not import/execute company Python, generate data, or train a model.
Usage: python ml/profile_source_data.py --data ... --dictionary ... --groups ... --output ...
"""
import argparse
import ast
import hashlib
import importlib.util
import json
from collections import Counter
from pathlib import Path

import pandas as pd


def read_csv(path):
    for encoding in ('utf-8-sig', 'cp1252'):
        try:
            return pd.read_csv(path, encoding=encoding), encoding
        except UnicodeDecodeError:
            continue
    raise ValueError('Unsupported source encoding')


def counts(series):
    return {str(k): int(v) for k, v in series.value_counts(dropna=False).items()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('data', 'dictionary', 'groups', 'output'):
        parser.add_argument('--' + name, required=True, type=Path)
    args = parser.parse_args()
    df, data_encoding = read_csv(args.data)
    dictionary, dictionary_encoding = read_csv(args.dictionary)
    source = args.groups.read_text(encoding='utf-8-sig')
    assignments = {}
    for node in ast.parse(source).body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    try:
                        assignments[target.id] = ast.literal_eval(node.value)
                    except (ValueError, TypeError):
                        pass
    groups = assignments.get('main_feature_groups', {})
    labels = assignments.get('GROUP_LABELS', {})
    all_features = [f for features in groups.values() for f in features]
    internet = df.loc[df['Internet Service'].eq('Yes')].copy()
    historical = internet.loc[internet['Customer Status'].isin(['Stayed', 'Churned'])]
    numeric = {}
    for col in df.select_dtypes(include='number').columns:
        s = df[col]
        numeric[col] = {
            'min': float(s.min()), 'median': float(s.median()),
            'max': float(s.max()), 'negative_count': int(s.lt(0).sum()),
        }
    report = {
        'source_files': {
            name: {'path': str(path.resolve()), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
            for name, path in [('data', args.data), ('dictionary', args.dictionary), ('groups', args.groups)]
        },
        'shape': list(df.shape), 'data_encoding': data_encoding,
        'dictionary_encoding': dictionary_encoding,
        'columns': list(df.columns), 'dtypes': {k: str(v) for k, v in df.dtypes.items()},
        'null_counts': {k: int(v) for k, v in df.isna().sum().items()},
        'duplicate_rows': int(df.duplicated().sum()),
        'duplicate_customer_ids': int(df['Customer ID'].duplicated().sum()),
        'missing_customer_ids': int(df['Customer ID'].isna().sum()),
        'status_counts': counts(df['Customer Status']),
        'internet_service_counts': counts(df['Internet Service']),
        'status_by_internet_service': pd.crosstab(df['Internet Service'], df['Customer Status']).to_dict(),
        'internet_only_rows': len(internet), 'internet_only_status': counts(internet['Customer Status']),
        'historical_internet_stayed_churned_rows': len(historical),
        'historical_internet_churn_rate': float(historical['Customer Status'].eq('Churned').mean()),
        'negative_monthly_charge_internet_count': int(internet['Monthly Charge'].lt(0).sum()),
        'categorical_values': {c: counts(df[c]) for c in ['Contract','Offer','Payment Method','Internet Type','Internet Service','Customer Status']},
        'internet_structural_checks': {
            'no_internet_with_type': int((df['Internet Service'].eq('No') & df['Internet Type'].notna()).sum()),
            'no_internet_with_positive_download': int((df['Internet Service'].eq('No') & df['Avg Monthly GB Download'].fillna(0).gt(0)).sum()),
            'internet_yes_missing_type': int((df['Internet Service'].eq('Yes') & df['Internet Type'].isna()).sum()),
            'internet_yes_missing_download': int(internet['Avg Monthly GB Download'].isna().sum()),
        },
        'numeric_summary': numeric,
        'missing_churn_category_by_status': df.groupby('Customer Status')['Churn Category'].apply(lambda s: int(s.isna().sum())).to_dict(),
        'missing_churn_reason_by_status': df.groupby('Customer Status')['Churn Reason'].apply(lambda s: int(s.isna().sum())).to_dict(),
        'dictionary_columns': list(dictionary.columns),
        'dictionary_entries': dictionary.to_dict(orient='records'),
        'company_groups': {
            'count': len(groups), 'feature_entries': len(all_features),
            'unique_features': len(set(all_features)),
            'duplicates': {k:v for k,v in Counter(all_features).items() if v > 1},
            'groups': {k: {'label':labels.get(k,k), 'count':len(v), 'first_examples':v[:5], 'last_examples':v[-3:]} for k,v in groups.items()},
            'literal_assignments': list(assignments),
        },
        'available_packages': {name: bool(importlib.util.find_spec(name)) for name in ['pandas','numpy','sklearn','xgboost','shap']},
        'limits': ['No verified per-customer observation timestamps or behavior history.', 'No Kaggle URL/license supplied yet.', 'No model trained and no synthetic data generated.'],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    preview = {k:report[k] for k in ['shape','status_counts','internet_service_counts','internet_only_rows','internet_only_status','historical_internet_stayed_churned_rows','historical_internet_churn_rate','duplicate_rows','duplicate_customer_ids','internet_structural_checks','company_groups','available_packages']}
    print(json.dumps(preview, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    main()
