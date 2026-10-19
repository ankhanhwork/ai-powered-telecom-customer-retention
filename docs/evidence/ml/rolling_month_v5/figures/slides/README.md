# Slide figures — rolling-month v5

English PNG (220 dpi) and editable SVG exports. Use the latest batch once per customer; do not pool overlapping inference snapshots for global SHAP.

1. `01_model_comparison`: validation/test AUC, two tuned families; selection used validation.
2. `02_test_roc_pr`: exploratory test ROC and precision–recall; repeated snapshot rows are disclosed.
3. `03_prediction_distribution`: latest batch, score >500 rule, no observed outcome claims.
4. `04_shap_group_importance`: mean(abs(signed sum of feature SHAP within each approved group)).
5. `05_shap_top_features`: top 15 feature SHAP magnitudes.
6. `06_shap_group_distribution`: signed group contributions; positive increases and negative offsets risk relative to baseline.
7. `07_shap_example_waterfall`: all six signed groups reconstruct one highest-scoring synthetic example. This is purposefully selected, not representative.

Use “Model-identified risk drivers”, not confirmed causes of churn. Contributions are calibrated log-odds, not percentages of churn probability. Group magnitude is not a count of affected customers. Prepaid postpaid-payment nulls are not evidence of debt. All data are synthetic, not measured FPT performance. `chart_data.json` retains aggregate source values and hashes; personal/customer identifiers are omitted.
