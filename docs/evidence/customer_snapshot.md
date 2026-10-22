# Example Customer Snapshot Record

Synthetic demo record retrieved from live Supabase on 21 October 2026. This is not an actual FPT customer record.

Contract: **DEMO-0196-VULGZ**. Customer: **0196-VULGZ**. Snapshot: **10 October 2026**.

## Slide-ready selection

Rounded display values only; the full export below retains source precision.

| Field | Value |
|---|---|
| Customer reference | 0196-VULGZ |
| Contract reference | DEMO-0196-VULGZ |
| Snapshot date | 10 October 2026 |
| Dataset version | synthetic_rolling_month_v5 |
| Tenure | 15 months |
| Internet plan / speed | Demo Internet 500 Mbps |
| Monthly charge | VND 300,000 |
| Billing mode | Postpaid |
| Usage (30 days) | 284.004 GB |
| Fee change (30 days) | 0% |
| Support contacts (30 days) | 0 |
| Plan change requests (30 days) | 0 |
| Disconnections (30 days) | 1 |
| Connection downtime (30 days) | 15.26 minutes |
| Longest overdue delay | 30 days |
| Overdue amount (overdue_amount_vnd) | VND 600,000 |
| Calibrated churn probability | 60.67% |
| Churn score | 606.74 / 1,000 |
| Prediction period | 11 October–10 November 2026 (inclusive) |
| Observed churn label | Unknown |

Caption: **Synthetic demo customer · Snapshot: 10 October 2026 · 127 input features**

## Scope and completeness

All **53 database columns** from customers (14), customer_snapshots (7), churn_predictions (14), prediction_runs (11), prediction_contexts (7) are included. The JSONB features column contains all **127 input features**, individually listed below. The complete nested SHAP context is also included. This export concerns the customer snapshot; operational messages, tickets, staff and Auth records are outside its scope.

`null` is preserved and must not be interpreted as zero. Prepaid fields are not applicable to this postpaid record. Other null fields are left uninterpreted. Percent-change features use percentage values; ratio/rate features use fractions. Do not replace similarly named payment features with one another: the database stores overdue_amount_vnd = 600000 and unpaid_overdue_amount_vnd_90d = 300000 as distinct fields. SHAP describes model attribution, not a confirmed cause; missing prepaid evidence does not establish a renewal problem.

## customers — all 14 columns

| Column | Database type | Value |
|---|---|---|
| id | uuid | "84d52524-1231-4032-965e-77c2a9530ed5" |
| customer_ref | text | "0196-VULGZ" |
| source_dataset | text | "synthetic_rolling_month_v5" |
| is_synthetic | boolean | true |
| created_at | timestamp with time zone | "2026-10-19T03:49:19.436656+00:00" |
| display_name | text | "Demo Customer 0196-VULGZ" |
| contract_ref | text | "DEMO-0196-VULGZ" |
| plan_name | text | "Demo Internet 500 Mbps" |
| monthly_fee | numeric | 300000 |
| currency | text | "VND" |
| billing_mode | text | "Postpaid" |
| tenure_months | integer | 15 |
| region | text | "Binh Duong" |
| profile_source | text | "synthetic_demo" |

## customer_snapshots — all 7 columns

| Column | Database type | Value |
|---|---|---|
| id | uuid | "4de38968-1460-49ee-98a3-138ef1cae085" |
| customer_id | uuid | "84d52524-1231-4032-965e-77c2a9530ed5" |
| snapshot_date | date | "2026-10-10" |
| dataset_version | text | "synthetic_rolling_month_v5" |
| snapshot_basis | text | "synthetic_rolling_month" |
| features | jsonb | See all 127 fields below |
| created_at | timestamp with time zone | "2026-10-19T03:49:19.436656+00:00" |

### features — all 127 fields

| Feature | Value |
|---|---|
| usage_gb_7d | 66.668 |
| billing_mode | "Postpaid" |
| overdue_days | 30 |
| usage_gb_14d | 129.0399999999995 |
| usage_gb_30d | 284.004 |
| usage_gb_60d | 552.7199999999989 |
| usage_gb_90d | 843.762999999999 |
| tenure_months | 15 |
| monthly_fee_vnd | 300000 |
| plan_speed_mbps | 500 |
| inactive_days_7d | 0 |
| inactive_days_14d | 0 |
| inactive_days_30d | 0 |
| inactive_days_60d | 1 |
| inactive_days_90d | 1 |
| opened_tickets_7d | 0 |
| outage_minutes_7d | 0 |
| payment_count_30d | 1 |
| payment_count_60d | 1 |
| payment_count_90d | 1 |
| fee_change_pct_30d | 0 |
| fee_change_pct_60d | 0 |
| fee_change_pct_90d | 0 |
| opened_tickets_14d | 0 |
| opened_tickets_30d | 0 |
| opened_tickets_60d | 0 |
| opened_tickets_90d | 0 |
| outage_minutes_14d | 0 |
| outage_minutes_30d | 15.26 |
| outage_minutes_60d | 15.259999999999993 |
| outage_minutes_90d | 79.05999999999997 |
| overdue_amount_vnd | 600000 |
| repeat_contacts_7d | 0 |
| disconnect_count_7d | 0 |
| paid_amount_vnd_30d | 300000 |
| paid_amount_vnd_60d | 300000 |
| paid_amount_vnd_90d | 300000 |
| repeat_contacts_14d | 0 |
| repeat_contacts_30d | 0 |
| repeat_contacts_60d | 0 |
| repeat_contacts_90d | 0 |
| support_contacts_7d | 0 |
| usage_change_pct_7d | 6.887706021932649 |
| disconnect_count_14d | 0 |
| disconnect_count_30d | 1 |
| disconnect_count_60d | 1 |
| disconnect_count_90d | 3 |
| promo_days_remaining | null |
| support_contacts_14d | 0 |
| support_contacts_30d | 0 |
| support_contacts_60d | 0 |
| support_contacts_90d | 0 |
| usage_change_pct_14d | -3.336479542152504 |
| usage_change_pct_30d | 5.689277899343548 |
| usage_change_pct_60d | -2.1096926847930964 |
| usage_change_pct_90d | -0.4185013967751061 |
| due_invoice_count_30d | 1 |
| due_invoice_count_60d | 2 |
| due_invoice_count_90d | 3 |
| late_invoice_rate_30d | 0 |
| late_invoice_rate_60d | 0.5 |
| late_invoice_rate_90d | 0.6666666666666666 |
| service_issue_days_7d | 0 |
| unresolved_tickets_7d | 0 |
| evening_speed_ratio_7d | 0.9252571428571384 |
| late_invoice_count_30d | 0 |
| late_invoice_count_60d | 1 |
| late_invoice_count_90d | 2 |
| prepaid_days_remaining | null |
| service_issue_days_14d | 0 |
| service_issue_days_30d | 1 |
| service_issue_days_60d | 1 |
| service_issue_days_90d | 3 |
| unresolved_tickets_14d | 0 |
| unresolved_tickets_30d | 0 |
| unresolved_tickets_60d | 0 |
| unresolved_tickets_90d | 0 |
| avg_resolution_hours_7d | null |
| days_since_last_payment | 18 |
| evening_speed_ratio_14d | 0.9503999999999938 |
| evening_speed_ratio_30d | 0.9568633333333332 |
| evening_speed_ratio_60d | 0.9544883333333316 |
| evening_speed_ratio_90d | 0.95166111111111 |
| last_payment_delay_days | 43 |
| oldest_open_ticket_days | 0 |
| plan_change_requests_7d | 0 |
| avg_resolution_hours_14d | null |
| avg_resolution_hours_30d | null |
| avg_resolution_hours_60d | null |
| avg_resolution_hours_90d | null |
| consecutive_issue_months | 0 |
| plan_change_requests_14d | 0 |
| plan_change_requests_30d | 0 |
| plan_change_requests_60d | 0 |
| plan_change_requests_90d | 0 |
| current_overdue_days_mean | 30 |
| due_cohort_paid_ratio_30d | 0 |
| due_cohort_paid_ratio_60d | 0 |
| due_cohort_paid_ratio_90d | 0.3333333333333333 |
| current_overdue_count_ge_7d | 1 |
| late_paid_invoice_count_30d | 0 |
| late_paid_invoice_count_60d | 0 |
| late_paid_invoice_count_90d | 1 |
| observed_delay_max_days_30d | 0 |
| observed_delay_max_days_60d | 30 |
| observed_delay_max_days_90d | 43 |
| current_overdue_count_ge_30d | 1 |
| current_overdue_count_ge_60d | 0 |
| observed_delay_mean_days_30d | 0 |
| observed_delay_mean_days_60d | 15 |
| observed_delay_mean_days_90d | 24.33333333333333 |
| current_overdue_amount_to_fee | 1 |
| current_overdue_invoice_count | 1 |
| on_time_paid_invoice_rate_30d | 0 |
| on_time_paid_invoice_rate_60d | 0 |
| on_time_paid_invoice_rate_90d | 0 |
| unpaid_overdue_amount_vnd_30d | 0 |
| unpaid_overdue_amount_vnd_60d | 300000 |
| unpaid_overdue_amount_vnd_90d | 300000 |
| consecutive_late_invoice_count | 0 |
| unpaid_overdue_invoice_count_30d | 0 |
| unpaid_overdue_invoice_count_60d | 1 |
| unpaid_overdue_invoice_count_90d | 1 |
| current_overdue_amount_ge_30d_vnd | 300000 |
| current_overdue_amount_ge_60d_vnd | 0 |
| late_rate_change_recent3_vs_previous3 | 0 |
| delay_change_recent3_vs_previous3_days | 23.666666666666664 |

## churn_predictions — all 14 columns

| Column | Database type | Value |
|---|---|---|
| id | uuid | "7677320d-58ba-45ea-9268-76259764be1b" |
| customer_id | uuid | "84d52524-1231-4032-965e-77c2a9530ed5" |
| snapshot_id | uuid | "4de38968-1460-49ee-98a3-138ef1cae085" |
| run_id | uuid | "591f01c0-b9b1-4a59-9209-50edee1f540d" |
| snapshot_date | date | "2026-10-10" |
| target_period_start | date | "2026-10-11" |
| raw_probability | numeric | 0.5172148416730651 |
| churn_probability | numeric | 0.6067440600066523 |
| churn_score | numeric | 606.7440600066523 |
| company_gt_500 | boolean | true |
| explanations_status | text | "SHAP available; care drafts require staff review" |
| explanation_version | text | "lightgbm_tuned_127_groups_v5" |
| created_at | timestamp with time zone | "2026-10-19T03:49:19.436656+00:00" |
| target_period_end_exclusive | date | "2026-11-11" |

## prediction_runs — all 11 columns

| Column | Database type | Value |
|---|---|---|
| id | uuid | "591f01c0-b9b1-4a59-9209-50edee1f540d" |
| run_key | text | "rolling-2026-10-10-b8239b25dbd6ad514b0c" |
| dataset_version | text | "synthetic_rolling_month_v5" |
| model_version | text | "lightgbm_tuned" |
| calibration_version | text | "rolling_month_v5_127_optuna_v1_lightgbm_tuned_platt" |
| snapshot_date | date | "2026-10-10" |
| target_period_start | date | "2026-10-11" |
| source_sha256 | text | "b8239b25dbd6ad514b0c151e98da9e5f56b5d21fd92872b5f7de6bd9712d3691" |
| is_synthetic | boolean | true |
| created_at | timestamp with time zone | "2026-10-19T03:49:19.436656+00:00" |
| target_period_end_exclusive | date | "2026-11-11" |

## prediction_contexts — all 7 columns

| Column | Database type | Value |
|---|---|---|
| id | uuid | "71733a03-a4bb-4a78-bed2-739f9cf0e4cc" |
| prediction_id | uuid | "7677320d-58ba-45ea-9268-76259764be1b" |
| explanation_version | text | "lightgbm_tuned_127_groups_v5" |
| context | jsonb | See complete JSON context below |
| requires_staff_review | boolean | true |
| customer_outbound_allowed | boolean | false |
| created_at | timestamp with time zone | "2026-10-19T03:49:19.436656+00:00" |

### context — complete JSON

```json
{
  "title": "Top risk drivers",
  "drivers": [
    {
      "rank": 1,
      "facts": [
        {
          "unit": "days",
          "label": "Longest delay among currently overdue invoices",
          "value": 30,
          "family": "overdue_days",
          "feature": "overdue_days",
          "missing": false,
          "observation": "Longest delay among currently overdue invoices: 30 days.",
          "window_days": null,
          "model_contribution_log_odds": 3.6513044768979914
        },
        {
          "unit": "VND",
          "label": "Current unpaid overdue amount",
          "value": 600000,
          "family": "overdue_amount_vnd",
          "feature": "overdue_amount_vnd",
          "missing": false,
          "observation": "Current unpaid overdue amount: 600,000 VND.",
          "window_days": null,
          "model_contribution_log_odds": 0.7309533434440649
        },
        {
          "unit": "days",
          "label": "Time since the last observed payment",
          "value": 18,
          "family": "days_since_last_payment",
          "feature": "days_since_last_payment",
          "missing": false,
          "observation": "Time since the last observed payment: 18 days.",
          "window_days": null,
          "model_contribution_log_odds": 0.23892954917658185
        }
      ],
      "group_id": "payment_overdue",
      "group_name": "Payment & Overdue Bills",
      "evidence_status": "Observed synthetic facts",
      "suggested_action": "Verify the invoice and payment situation with the customer and explain approved payment support options.",
      "explanation_draft": "Longest delay among currently overdue invoices: 30 days. Current unpaid overdue amount: 600,000 VND. Time since the last observed payment: 18 days. This group ranks #1 among signals increasing the model's risk assessment. Verify the invoice and payment situation with the customer and explain approved payment support options.",
      "contribution_log_odds": 4.874640008064197,
      "requires_staff_review": true,
      "supports_customer_situation_claim": true
    },
    {
      "rank": 2,
      "facts": [
        {
          "unit": "days",
          "label": "Days until the prepaid period ends",
          "value": null,
          "family": "prepaid_days_remaining",
          "feature": "prepaid_days_remaining",
          "missing": true,
          "observation": "Days until the prepaid period ends is not available at this snapshot; verify before drawing conclusions.",
          "window_days": null,
          "model_contribution_log_odds": 0.06760555489216001
        }
      ],
      "group_id": "renewal_promotion",
      "group_name": "Renewal & Promotion Status",
      "evidence_status": "Missing evidence; verification required",
      "suggested_action": "Verify data availability before proposing an action for this group.",
      "explanation_draft": "Available evidence is insufficient to describe the current customer situation. Verify missing information before contacting the customer. This group ranks #2 among signals increasing the model's risk assessment. Verify data availability before proposing an action for this group.",
      "contribution_log_odds": 0.038993436384923086,
      "requires_staff_review": true,
      "supports_customer_situation_claim": false
    },
    {
      "rank": 3,
      "facts": [
        {
          "unit": "",
          "label": "Disconnections over the past 30 days",
          "value": 1,
          "family": "disconnect_count",
          "feature": "disconnect_count_30d",
          "missing": false,
          "observation": "Disconnections over the past 30 days: 1.",
          "window_days": 30,
          "model_contribution_log_odds": 0.018128198989481526
        },
        {
          "unit": "minutes",
          "label": "Total connection downtime over the past 30 days",
          "value": 15.26,
          "family": "outage_minutes",
          "feature": "outage_minutes_30d",
          "missing": false,
          "observation": "Total connection downtime over the past 30 days: 15.26 minutes.",
          "window_days": 30,
          "model_contribution_log_odds": 0.017225464227259474
        },
        {
          "unit": "fraction",
          "label": "Average evening speed relative to plan speed over the past 90 days",
          "value": 0.95166111111111,
          "family": "evening_speed_ratio",
          "feature": "evening_speed_ratio_90d",
          "missing": false,
          "observation": "Average evening speed relative to plan speed over the past 90 days: 95.17 %.",
          "window_days": 90,
          "model_contribution_log_odds": 0.011008897017077803
        }
      ],
      "group_id": "connection_quality",
      "group_name": "Connection Quality",
      "evidence_status": "Observed synthetic facts",
      "suggested_action": "Confirm whether connection issues persist and submit a technical support request if needed.",
      "explanation_draft": "Disconnections over the past 30 days: 1. Total connection downtime over the past 30 days: 15.26 minutes. Average evening speed relative to plan speed over the past 90 days: 95.17 %. This group ranks #3 among signals increasing the model's risk assessment. Confirm whether connection issues persist and submit a technical support request if needed.",
      "contribution_log_odds": 0.024241491772854864,
      "requires_staff_review": true,
      "supports_customer_situation_claim": true
    }
  ],
  "base_value": -4.236930172594861,
  "customer_id": "0196-VULGZ",
  "shap_method": "lightgbm native TreeSHAP; summed feature groups",
  "is_synthetic": true,
  "label_status": "Unknown",
  "model_sha256": "881dc8ed7252389256e2c2fd20fb3c558c74e0fdbc43165f02946059ee6217a4",
  "model_version": "lightgbm_tuned",
  "snapshot_date": "2026-10-10",
  "calibrator_method": "platt",
  "churn_probability": 0.6067440600066523,
  "shap_output_space": "deployed_log_odds",
  "explanation_source": "Deterministic grounded English draft; no LLM invoked",
  "explanation_version": "lightgbm_tuned_127_groups_v5",
  "target_period_start": "2026-10-11",
  "requires_staff_review": true,
  "customer_outbound_allowed": false,
  "target_period_end_exclusive": "2026-11-11"
}
```

## Source query

```sql
select to_jsonb(c) as customers,to_jsonb(s) as customer_snapshots,to_jsonb(p) as churn_predictions,to_jsonb(r) as prediction_runs,to_jsonb(x) as prediction_contexts from public.customers c join public.customer_snapshots s on s.customer_id=c.id join public.churn_predictions p on p.snapshot_id=s.id join public.prediction_runs r on r.id=p.run_id left join public.prediction_contexts x on x.prediction_id=p.id where c.contract_ref='DEMO-0196-VULGZ' order by s.snapshot_date desc limit 1;
```

Read-only extraction. No database changes, workflow execution, model training or LLM call.

