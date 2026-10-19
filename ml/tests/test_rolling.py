"""Rolling windows, causal event consistency, purging and grouped calibration."""
import json
import sys
import unittest
from datetime import date
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'ml'))
sys.path.insert(0,str(ROOT/'ml/generation'))
from common import config
from data import partition,rolling_folds
from calibration import cross_fit
from generate_data import generate_v4
from rolling_quality import validate_rolling
from build_history_features import build_features
from train import choose


class RollingChecks(unittest.TestCase):
    def test_window_examples_and_censoring(self):
        cfg = config()
        for snapshot,start,end in [('2026-09-30','2026-10-01','2026-11-01'),
                                   ('2026-10-10','2026-10-11','2026-11-11'),
                                   ('2026-10-20','2026-10-21','2026-11-21')]:
            actual = pd.Timestamp(snapshot)+pd.Timedelta(days=1)
            self.assertEqual(str(actual.date()),start)
            self.assertEqual(str((actual+pd.DateOffset(months=1)).date()),end)
        self.assertEqual(partition('2026-06-10','development',cfg,'2026-07-11'),'purged_or_unused')
        self.assertEqual(partition('2026-06-30','development',cfg,'2026-08-01'),'validation')
        self.assertEqual(partition('2026-09-10','audit',cfg,'2026-10-11'),'test')
        self.assertEqual(partition('2026-09-20','audit',cfg,'2026-10-21'),'incomplete_history')

    def test_cv_purges_overlapping_future_labels(self):
        rows = []
        for d in pd.date_range('2026-01-01','2026-05-31'):
            if d.day in (10,20) or d.is_month_end:
                start = d+pd.Timedelta(days=1)
                rows.append(dict(snapshot_date=str(d.date()),target_period_start=str(start.date()),
                    target_period_end_exclusive=str((start+pd.DateOffset(months=1)).date()),partition='train'))
        folds = list(rolling_folds(pd.DataFrame(rows),config()))
        self.assertEqual(len(folds),3)
        for train,valid in folds:
            self.assertTrue(len(train)>0 and len(valid)>0)
            self.assertLessEqual(train.target_period_end_exclusive.max(),valid.target_period_start.min())

    def test_extra_snapshots_do_not_increment_month_streak(self):
        snapshots = pd.DataFrame(dict(customer_id=['A']*4,snapshot_date=['2026-01-31','2026-02-10','2026-02-20','2026-02-28'],service_issue_days_30d=[5]*4))
        days = pd.DataFrame(dict(customer_id='A',service_date=pd.date_range('2026-01-01','2026-02-28').strftime('%Y-%m-%d'),usage_gb=10.,telemetry_observed=True))
        tickets = pd.DataFrame(columns=['customer_id','opened_date','resolved_date'])
        result = build_features(snapshots,days,tickets)
        self.assertEqual(result.consecutive_issue_months.tolist(),[1,2,2,2])

    def test_calibration_holds_out_whole_customers(self):
        rng = np.random.default_rng(42)
        raw = np.repeat(rng.normal(size=250),3)
        y = np.repeat((raw[::3]+rng.normal(0,.5,size=250)>0).astype(int),3)
        groups = np.repeat(np.arange(250),3)
        _,_,_,folds = cross_fit(raw,y,groups=groups)
        self.assertTrue(pd.DataFrame(dict(customer=groups,fold=folds)).groupby('customer').fold.nunique().eq(1).all())

    def test_selection_uses_tuned_validation_auc_only(self):
        candidates = {name:dict(validation=dict(roc_auc=auc,log_loss=.2)) for name,auc in
                      [('lightgbm_baseline',.999),('lightgbm_tuned',.91),('catboost_tuned',.92)]}
        self.assertEqual(choose(candidates,config()),'catboost_tuned')

    def test_single_events_and_asof_invariance(self):
        cfg = json.loads((ROOT/'ml/generation/simulator_rolling.json').read_text())
        source = ROOT/'data/raw/telecom_customer_churn.csv'
        full,_ = generate_v4(source,16,cfg)
        self.assertTrue(validate_rolling(full,date.fromisoformat(cfg['as_of']))['checks_passed'])
        self.assertEqual(full['inference_latest'].snapshot_date.unique().tolist(),[full['customer_features'].snapshot_date.max()])
        early,_ = generate_v4(source,16,{**cfg,'as_of':'2026-07-01'})
        keys = ['customer_id','snapshot_date']
        left = early['customer_features'].set_index(keys).sort_index()
        right = full['customer_features'].set_index(keys).loc[left.index].sort_index()
        pd.testing.assert_frame_equal(left,right,check_dtype=False)
        known = early['churn_labels'].dropna(subset=['churn_next_month']).set_index(keys)
        pd.testing.assert_series_equal(known.churn_next_month,full['churn_labels'].set_index(keys).loc[known.index,'churn_next_month'])


if __name__=='__main__':
    unittest.main()
