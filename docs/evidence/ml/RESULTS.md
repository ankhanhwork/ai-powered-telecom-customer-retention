# Model comparison — 127 features

> Historical v4 results. The current rolling-month v5 run is documented in [rolling_month_v5/RESULTS.md](rolling_month_v5/RESULTS.md). Model selection and test comparisons below belong to the previous month-end task.

All four candidates use the same frozen 127-feature synthetic dataset. No SHAP was computed during model selection.

Selection uses August-outcome validation, after 30 Optuna trials per algorithm on three earlier rolling folds. The September test was exposed in earlier work; its metrics are exploratory.

| Candidate | CV AP | Validation AP | Validation AUC | Exploratory test AUC | Exploratory test AP |
|---|---:|---:|---:|---:|---:|
| lightgbm_baseline | 0.7090 | 0.6526 | 0.9659 | 0.9844 | 0.7215 |
| lightgbm_tuned | 0.7238 | 0.6425 | 0.9653 | 0.9853 | 0.7237 |
| catboost_baseline | 0.7091 | 0.6597 | 0.9665 | 0.9837 | 0.7134 |
| catboost_tuned | 0.7308 | 0.6640 | 0.9650 | 0.9843 | 0.7020 |

Selected model: **catboost_tuned**. The leader approved CatBoost tuned and all six explanation groups. SHAP outputs are available; see `shap_summary.json` and the ML README.

October inference: 3,202 customers; 260 scores >500. Labels remain Unknown.

Native categorical inputs avoid a manual one-hot preprocessing pipeline; this is not a guarantee that either learner is universally superior. These results measure a deliberately strong-signal simulation, not FPT Telecom production performance.

## Selected parameters

```json
{
  "learning_rate": 0.1497220583976959,
  "depth": 7,
  "l2_leaf_reg": 4.370047900717917,
  "random_strength": 1.7388921349441315,
  "bagging_temperature": 0.5214430350869839
}
```

Fixed boosting iterations: 92

## Evidence

- `comparison.json` contains raw/calibrated metrics, checks and package versions.
- `selection.json` was frozen before test scoring.
- `*_trials.csv`, `*_best.json` and the local Optuna SQLite study preserve tuning results.
- `data_manifest.json` contains the frozen feature/config/split hashes.
- `split_summary.csv` records snapshot, partition, rows and churn counts.
- Calibrator decisions use separate-customer calibration-only OOF Brier and log loss.
- Figures: `figures/tuning_history.png`, `figures/model_comparison.png`.
