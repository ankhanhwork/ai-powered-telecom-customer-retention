# Model comparison — 127 features

All four candidates use the same frozen 127-feature synthetic dataset. No SHAP was computed during model selection.

Snapshots: month-end, day 10 and day 20; predictions issued on day 1, 11 and 21 for one calendar month. Thirty Optuna trials per family maximize mean purged rolling CV ROC AUC. Only the two tuned candidates are eligible; selection uses July-start validation ROC AUC, then log loss. Calibration holds out whole customers. September 1/11-start audit windows are exploratory synthetic tests. No test scores select or calibrate the model.

| Candidate | CV AUC | CV AP | Validation AP | Validation AUC | Exploratory test AUC | Exploratory test AP |
|---|---:|---:|---:|---:|---:|---:|
| lightgbm_baseline | 0.9080 | 0.6424 | 0.7617 | 0.9469 | 0.9473 | 0.7166 |
| lightgbm_tuned | 0.9107 | 0.6411 | 0.7581 | 0.9483 | 0.9467 | 0.7138 |
| catboost_baseline | 0.9048 | 0.6396 | 0.7490 | 0.9365 | 0.9374 | 0.7183 |
| catboost_tuned | 0.9088 | 0.6408 | 0.7445 | 0.9356 | 0.9348 | 0.7253 |

Selected model: **lightgbm_tuned**. SHAP is available for the approved LightGBM model. The latest batch is loaded in Supabase; see ../../../../docs/evidence/supabase_cutover.json.

Inference: 5,533 customer-snapshot rows; 409 scores >500. Labels remain Unknown; multiple snapshots may belong to one customer.

Native categorical inputs avoid a manual one-hot preprocessing pipeline; this is not a guarantee that either learner is universally superior. These results measure a deliberately strong-signal simulation, not FPT Telecom production performance.

## Selected parameters

```json
{
  "max_depth": 7,
  "learning_rate": 0.03694755509074355,
  "num_leaves": 12,
  "min_child_samples": 75,
  "colsample_bytree": 0.8320457481218804,
  "subsample": 0.7366114704534336,
  "reg_lambda": 0.09565499215943825
}
```

Fixed boosting iterations: 114

## Evidence

- `comparison.json` contains raw/calibrated metrics, checks and package versions.
- `selection.json` was frozen before test scoring.
- `*_trials.csv`, `*_best.json` and the local Optuna SQLite study preserve tuning results.
- `data_manifest.json` contains the frozen feature/config/split hashes.
- `split_summary.csv` records snapshot, partition, rows and churn counts.
- Calibrator decisions use separate-customer calibration-only OOF Brier and log loss.
- Figures: `figures/tuning_history.png`, `figures/model_comparison.png`.

## Verification and interpretation

Selected-model exploratory test AUC: **0.9467**; user-confirmed demo target: approximately 0.89.

Platt calibration adopted: **True**. Adoption requires both customer-grouped OOF Brier and log loss to improve; each bundle has its own calibrator.

LightGBM baseline has a slightly higher test AUC than LightGBM tuned; CatBoost tuned has a higher test AP. These do not change the pre-test selection rule or demonstrate universal superiority. No simulator changes or seed search followed test scoring.

See [verification.json](verification.json) for source/data hash checks, customer-grouped calibration, save/reload prediction agreement, test metrics by snapshot and inference batch counts. The training run passed 36 ML unit tests; the later SHAP update passed 43. No n8n executions were performed. Cloud integration evidence, when available, is recorded separately in ../../../../docs/evidence/supabase_cutover.json.

Native LightGBM SHAP and calibrated signed group sums are verified in shap_summary.json. English slide-ready PNG/SVG exports and usage notes are in figures/slides/.
