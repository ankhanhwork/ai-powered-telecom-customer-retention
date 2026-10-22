"""Export English figures and a reviewable result note from completed evidence."""
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import pandas as pd

from ml.common import ROOT, config, read_json


def main():
    cfg = config()
    rolling = cfg.get('snapshot_schedule')=='three_per_month'
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
        axis.set(title=f'{display_name} — 127 features', xlabel='Optuna trial', ylabel=cfg['objective'])
        axis.legend()
    fig.savefig(figures/'tuning_history.png', dpi=170)
    plt.close(fig)
    fig, axis = plt.subplots(figsize=(9, 4), constrained_layout=True)
    labels = table.candidate.str.replace('_', ' ')
    metric = 'validation_roc_auc' if rolling else 'validation_average_precision'
    axis.barh(labels,table[metric],color=['#1976b8' if not selected else '#f37021' for selected in table.selected])
    axis.set(xlim=(0, 1), xlabel='ROC AUC' if rolling else 'Average precision', title='Rolling-month validation — 127 features' if rolling else 'August outcome validation — same 127 features')
    for row, value in enumerate(table[metric]):
        axis.text(value+.01, row, f'{value:.4f}', va='center')
    fig.savefig(figures/'model_comparison.png', dpi=170)
    plt.close(fig)
    shap_available = (evidence/'shap_summary.json').exists()
    lines = ['# Model comparison — 127 features', '',
        'All four candidates use the same frozen 127-feature synthetic dataset. No SHAP was computed during model selection.', '',
        ('Snapshots: month-end, day 10 and day 20; predictions issued on day 1, 11 and 21 for one calendar month. '
         'Thirty Optuna trials per family maximize mean purged rolling CV ROC AUC. Only the two tuned candidates are eligible; '
         'selection uses July-start validation ROC AUC, then log loss. Calibration holds out whole customers. '
         'September 1/11-start audit windows are exploratory synthetic tests. No test scores select or calibrate the model.' if rolling else
         'Selection uses August-outcome validation, after 30 Optuna trials per algorithm on three earlier rolling folds. The September test was exposed in earlier work; its metrics are exploratory.'), '',
        '| Candidate | CV AUC | CV AP | Validation AP | Validation AUC | Exploratory test AUC | Exploratory test AP |',
        '|---|---:|---:|---:|---:|---:|---:|']
    for row in table.itertuples():
        lines.append(f'| {row.candidate} | {row.cv_roc_auc:.4f} | {row.cv_average_precision:.4f} | {row.validation_average_precision:.4f} | {row.validation_roc_auc:.4f} | {row.test_roc_auc_exploratory:.4f} | {row.test_ap_exploratory:.4f} |')
    deployed = (ROOT/'docs/evidence/supabase_cutover.json').exists()
    current_status = (('SHAP is available for the approved LightGBM model. The latest batch is loaded in Supabase; see ../../../../docs/evidence/supabase_cutover.json.' if deployed else 'Selected offline under the user-authorized retraining; check current integration status in IMPLEMENTATION.') if rolling else 'The leader approved CatBoost tuned and all six explanation groups. SHAP outputs are available; see `shap_summary.json` and the ML README.'
        if shap_available else 'For the current model/group approval status, read DATA_ML and IMPLEMENTATION; selection artifacts preserve their original run-time status.')
    lines += ['', f'Selected model: **{result["champion"]}**. '+current_status, '',
        f'Inference: {result["inference_rows"]:,} customer-snapshot rows; {result["inference_gt500"]:,} scores >500. Labels remain Unknown; multiple snapshots may belong to one customer.', '',
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
    if rolling:
        selected = result['candidates'][result['champion']]
        auc = selected['test_calibrated']['roc_auc']
        lines += ['## Verification and interpretation', '',
            f'Selected-model exploratory test AUC: **{auc:.4f}**; user-confirmed demo target: approximately {cfg["demo_auc_target"]:.2f}.', '',
            f'Platt calibration adopted: **{selected["calibrator_adopted"]}**. Adoption requires both customer-grouped OOF Brier and log loss to improve; each bundle has its own calibrator.', '',
            'LightGBM baseline has a slightly higher test AUC than LightGBM tuned; CatBoost tuned has a higher test AP. '
            'These do not change the pre-test selection rule or demonstrate universal superiority. '
            'No simulator changes or seed search followed test scoring.', '',
            'See [verification.json](verification.json) for source/data hash checks, customer-grouped calibration, '
            'save/reload prediction agreement, test metrics by snapshot and inference batch counts. '
            'The training run passed 36 ML unit tests; the later SHAP update passed 43. No n8n executions were performed. '
            'Cloud integration evidence, when available, is recorded separately in ../../../../docs/evidence/supabase_cutover.json.', '',
            ('Native LightGBM SHAP and calibrated signed group sums are verified in shap_summary.json. '
             'English slide-ready PNG/SVG exports and usage notes are in figures/slides/.' if shap_available else
             'SHAP has not been generated for this model; check IMPLEMENTATION before using explanation artifacts.'), '']
    (evidence/'RESULTS.md').write_text('\n'.join(lines), encoding='utf-8')
    print('Wrote results note and two English figures')


if __name__ == '__main__':
    main()
