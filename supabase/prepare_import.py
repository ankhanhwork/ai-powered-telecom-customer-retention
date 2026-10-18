"""Prepare a label-free SQL import from the canonical October inference files.

Never trains, changes predictions or sends data to a network service.
Generated data lives in ignored tmp/supabase, not in the schema migrations.
"""
import argparse
import csv
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def number(value):
    if value in (None, "", "NaN", "nan"):
        return None
    result = float(value)
    if not math.isfinite(result):
        raise ValueError("Nonfinite feature value")
    return result


def sql_json(value):
    return "'" + json.dumps(value, ensure_ascii=False, allow_nan=False).replace("'", "''") + "'::jsonb"


def prepare(limit=5, grant_consent=False):
    cfg = json.loads((ROOT / "ml/config.json").read_text(encoding="utf-8"))
    folder = ROOT / cfg["inference_dir"]
    source = folder / "predictions.csv"
    sha = hashlib.sha256(source.read_bytes()).hexdigest()
    with source.open(encoding="utf-8-sig", newline="") as stream:
        predictions = list(csv.DictReader(stream))
    with (folder / "features.csv").open(encoding="utf-8-sig", newline="") as stream:
        features = {r["customer_id"]: r for r in csv.DictReader(stream)}
    contexts = {r["customer_id"]: r for r in map(json.loads,
        (folder / "explanations/care_context.jsonl").read_text(encoding="utf-8").splitlines())}
    assert len(cfg["features"]) == len(set(cfg["features"])) == 127
    assert len({r["customer_id"] for r in predictions}) == len(predictions)
    predictions.sort(key=lambda r: (-float(r["churn_probability"]), r["customer_id"]))
    if limit:
        high = [r for r in predictions if float(r["churn_probability"]) > .5]
        low = [r for r in predictions if float(r["churn_probability"]) <= .5]
        predictions = high[:max(1, limit - 1)] + low[:1] if limit > 1 else high[:1]
    payloads = []
    lines = ["-- Generated label-free demo import. Uses existing frozen predictions; no model fitting.\n",
        "-- Rerunning identical data is safe. Consent only if explicitly requested at generation.\n",
        "begin;\nselect set_config('request.jwt.claims','{\"role\":\"service_role\"}',true);\n"]
    for row in predictions:
        raw = features[row["customer_id"]]
        assert raw["snapshot_date"] == row["snapshot_date"]
        assert raw["dataset_version"] == row["dataset_version"] == cfg["dataset_version"]
        assert row["label_status"] == "Unknown"
        assert row["is_synthetic"].lower() == "true"
        fs = {key: (raw[key] or None) if key in cfg["categorical_features"] else number(raw[key])
            for key in cfg["features"]}
        context = contexts[row["customer_id"]]
        assert context["requires_staff_review"] and not context["customer_outbound_allowed"]
        assert context["model_version"] == row["model_version"]
        run = {key: row[key] for key in ("dataset_version", "model_version", "calibration_version",
            "snapshot_date", "target_period_start")}
        run.update(run_key="october-" + sha[:20], source_sha256=sha, is_synthetic=True)
        prediction = {"raw_probability": float(row["raw_probability"]),
            "churn_probability": float(row["churn_probability"]),
            "explanations_status": row["explanations_status"], "explanation_version": row["explanation_version"]}
        profile = {"display_name": "Demo Customer " + row["customer_id"],
            "contract_ref": "DEMO-" + row["customer_id"],
            "monthly_fee": fs["monthly_fee_vnd"], "currency": "VND", "billing_mode": fs["billing_mode"],
            "tenure_months": int(fs["tenure_months"]) if fs["tenure_months"] is not None else None,
            "plan_name": f"Demo Internet {fs['plan_speed_mbps']:g} Mbps" if fs["plan_speed_mbps"] is not None else None}
        payload = dict(p_run=run, p_customer_ref=row["customer_id"], p_features=fs,
            p_prediction=prediction, p_context=context, p_profile=profile)
        payloads.append(payload)
        args = [sql_json(run), "'" + row["customer_id"].replace("'", "''") + "'",
            sql_json(fs), sql_json(prediction), sql_json(context), sql_json(profile)]
        lines.append("select public.retention_ingest_prediction(" + ",".join(args) + ");\n")
        if grant_consent:
            lines.append("select public.retention_set_demo_consent(id,'Zalo',true,'explicit-fictional-demo-seed') "
                "from public.customers where source_dataset=" + "'" + cfg["dataset_version"].replace("'", "''")
                + "' and customer_ref='" + row["customer_id"].replace("'", "''") + "';\n")
    lines.append("commit;\n")
    out = ROOT / "tmp/supabase"
    out.mkdir(parents=True, exist_ok=True)
    (out / "import_demo.sql").write_text("".join(lines), encoding="utf-8")
    (out / "import_payloads.json").write_text(json.dumps(payloads, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    print(f"Prepared {len(payloads)} customers; {sum(p['p_prediction']['churn_probability']>.5 for p in payloads)} alerts. "
        f"Explicit demo consent={grant_consent}. Output: tmp/supabase/import_demo.sql. Nothing uploaded.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=5, help="Small cohort by default; 0 for all inference customers")
    parser.add_argument("--grant-demo-consent", action="store_true", help="Explicit simulated consent, never real customer consent")
    args = parser.parse_args()
    if args.limit < 0:
        parser.error("limit must be >=0")
    prepare(args.limit, args.grant_demo_consent)
