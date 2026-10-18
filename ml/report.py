"""Export English figures and a reviewable result note from completed evidence."""
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd

from common import ROOT, config, read_json


def main():
    cfg = config()
    evidence = ROOT/cfg['evidence_dir']
    result = read_json(evidence/'comparison.json')
    table = pd.read_csv(evidence/'comparison.csv')
    figures = evidence/'figures'
    figures.mkdir(exist_ok=True)
    plt.rcParams.update({'font.size': 10, 'axes.spines.top': False, 'axes.spines.right': False})
    fig, axes = plt.subplots(1, 2, figsize=(11, 4), sharey=True, constrained_layout=True)
    for axis, algorithm in zip(axes, ['lightgbm', 'catboost']):
        trials = pd.read_csv(evidence/f'{algorithm}_trials.csv')
        axis.plot(trials['number']+1, trials['value'], 'o', alpha=.55, label='Trial')
        axis.plot(trials['number']+1, trials['value'].cummax(), label='Best so far')
        display_name = 'LightGBM' if algorithm=='lightgbm' else 'CatBoost'
        axis.set(title=f'{display_name} — 127 features', xlabel='Optuna trial', ylabel='Mean rolling CV average precision')
        axis.legend()
    fig.savefig(figures/'tuning_history.png', dpi=170)
    plt.close(fig)
    fig, axis = plt.subplots(figsize=(9, 4), constrained_layout=True)
    labels = table.candidate.str.replace('_', ' ')
    axis.barh(labels, table.validation_average_precision, color=['#1976b8' if not selected else '#f37021' for selected in table.selected])
    axis.set(xlim=(0, 1), xlabel='Average precision', title='August outcome validation — same 127 features')
    for row, value in enumerate(table.validation_average_precision):
        axis.text(value+.01, row, f'{value:.4f}', va='center')
    fig.savefig(figures/'model_comparison.png', dpi=170)
    plt.close(fig)
    shap_available = (evidence/'shap_summary.json').exists()
    lines = ['# Model comparison — 127 features', '',
        'All four candidates use the same frozen 127-feature synthetic dataset. No SHAP was computed during model selection.', '',
        'Selection uses August-outcome validation, after 30 Optuna trials per algorithm on three earlier rolling folds. '
        'The September test was exposed in earlier work; its metrics are exploratory.', '',
        '| Candidate | CV AP | Validation AP | Validation AUC | Exploratory test AUC | Exploratory test AP |',
        '|---|---:|---:|---:|---:|---:|']
    for row in table.itertuples():
        lines.append(f'| {row.candidate} | {row.cv_average_precision:.4f} | {row.validation_average_precision:.4f} | {row.validation_roc_auc:.4f} | {row.test_roc_auc_exploratory:.4f} | {row.test_ap_exploratory:.4f} |')
    current_status = ('The leader approved CatBoost tuned and all six explanation groups. SHAP outputs are available; see `shap_summary.json` and the ML README.'
        if shap_available else 'For the current model/group approval status, read DATA_ML and IMPLEMENTATION; selection artifacts preserve their original run-time status.')
    lines += ['', f'Selected model: **{result["champion"]}**. '+current_status, '',
        f'October inference: {result["inference_rows"]:,} customers; {result["inference_gt500"]:,} scores >500. Labels remain Unknown.', '',
        'Native categorical inputs avoid a manual one-hot preprocessing pipeline; this is not a guarantee that either learner is universally superior. '
        'These results measure a deliberately strong-signal simulation, not FPT Telecom production performance.', '',
        '## Selected parameters', '', '```json',
        __import__('json').dumps(result['candidates'][result['champion']]['cv']['parameters'], indent=2), '```', '',
        f"Fixed boosting iterations: {result['candidates'][result['champion']]['iterations']}", '',
        '## Evidence', '',
        '- `comparison.json` contains raw/calibrated metrics, checks and package versions.',
        '- `selection.json` was frozen before test scoring.',
        '- `*_trials.csv`, `*_best.json` and the local Optuna SQLite study preserve tuning results.',
        '- `data_manifest.json` contains the frozen feature/config/split hashes.',
        '- `split_summary.csv` records snapshot, partition, rows and churn counts.',
        '- Calibrator decisions use separate-customer calibration-only OOF Brier and log loss.',
        '- Figures: `figures/tuning_history.png`, `figures/model_comparison.png`.', '']
    (evidence/'RESULTS.md').write_text('\n'.join(lines), encoding='utf-8')
    print('Wrote results note and two English figures')


if __name__ == '__main__':
    main()
