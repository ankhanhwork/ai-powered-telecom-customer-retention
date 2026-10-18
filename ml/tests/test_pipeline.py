import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.special import expit
from sklearn.metrics import brier_score_loss

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from calibration import apply_map,cross_fit
from common import ROOT,config,matrix
from data import customer_role,partition,rolling_folds
from models_api import defaults,fit,load_model,raw_predict,save_model
from predict import predict_frame


class PipelineChecks(unittest.TestCase):
    def test_locked_127_feature_contract(self):
        cfg = config()
        self.assertEqual(len(cfg['features']),127)
        self.assertEqual(len(set(cfg['features'])),127)
        self.assertEqual(cfg['feature_file'],'features_127.csv')
        bad = {**cfg,'features':cfg['features'][:22]}
        with self.assertRaises(ValueError):
            matrix(pd.DataFrame(),bad,'lightgbm')

    def test_customer_role_and_snapshot_partition(self):
        cfg = config()
        self.assertEqual(customer_role('A','audit_holdout',cfg),'audit')
        for role in ['audit','calibration','development']:
            self.assertEqual(partition('2026-09-30',role),'inference')
        self.assertEqual(partition('2026-07-31','calibration'),'calibration')
        self.assertEqual(partition('2026-06-30','calibration'),'calibration_history')
        self.assertEqual(partition('2026-08-31','audit'),'test')
        self.assertEqual(partition('2026-07-31','development'),'validation')
        self.assertEqual(customer_role('A','development',cfg),customer_role('A','development',cfg))

    def test_rolling_folds_prevent_future_labels_and_exclude_other_roles(self):
        rows = []
        for month in range(1,8):
            snapshot = pd.Timestamp(2026,month,1)+pd.offsets.MonthEnd(0)
            rows.append({'snapshot_date':snapshot.strftime('%Y-%m-%d'),'partition':'train' if month<=6 else 'validation',
                         'target_period_start':(snapshot+pd.Timedelta(days=1)).strftime('%Y-%m-%d'),
                         'target_period_end_exclusive':(snapshot+pd.offsets.MonthBegin(2)).strftime('%Y-%m-%d')})
        folds = list(rolling_folds(pd.DataFrame(rows),config()))
        self.assertEqual(len(folds),3)
        self.assertEqual([len(t) for t,v in folds],[3,4,5])
        self.assertEqual([v.snapshot_date.str[5:7].iloc[0] for t,v in folds],['04','05','06'])

    def test_calibration_cross_fit_corrects_bias(self):
        rng = np.random.default_rng(44)
        x = rng.normal(size=1000)
        raw = .2*x-2.5
        y = rng.binomial(1,expit(1.5*x-.2))
        mapping,report,oof,folds = cross_fit(raw,y)
        self.assertTrue(mapping['adopted'])
        self.assertLess(brier_score_loss(y,oof),brier_score_loss(y,expit(raw)))
        self.assertEqual(set(folds),set(range(5)))
        self.assertEqual(len(report['folds']),5)
        self.assertTrue((np.diff(apply_map(np.sort(raw),mapping))>=0).all())

    def test_both_model_families_save_reload_with_127_native_features(self):
        cfg = {**config(),'max_iterations':12,'early_stopping_rounds':3}
        rng = np.random.default_rng(23)
        n = 60
        columns = {f:np.zeros(n) for f in cfg['features']}
        columns['billing_mode'] = ['Prepaid','Postpaid']*(n//2)
        columns[cfg['features'][0]] = rng.normal(size=n)
        columns[cfg['features'][1]] = np.where(np.arange(n)%3==0,np.nan,rng.random(n))
        frame = pd.DataFrame(columns)
        frame['customer_id'] = [f'TOY-{i}' for i in range(n)]
        frame['snapshot_date'],frame['target_period_start'] = '2026-09-30','2026-10-01'
        frame['churn_next_month'] = (frame[cfg['features'][0]]>0).astype(int)
        temp_root = (ROOT/'tmp').resolve()
        temp_root.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=temp_root) as directory:
            self.assertTrue(Path(directory).resolve().is_relative_to(temp_root))
            for algorithm in ['lightgbm','catboost']:
                model,count = fit(algorithm,defaults(algorithm),frame,cfg,iterations=10)
                self.assertEqual(count,10)
                x = frame.drop(columns='churn_next_month')
                before = raw_predict(model,algorithm,x,cfg)
                filename = Path(directory)/(algorithm+'.model')
                save_model(model,algorithm,filename)
                saved = load_model(algorithm,filename)
                np.testing.assert_allclose(before,raw_predict(saved,algorithm,x,cfg))
                metadata = {'algorithm':algorithm,'candidate':'toy','calibration_version':'identity'}
                bundle = (saved,metadata,cfg,{'slope':1.,'intercept':0.})
                output = predict_frame(bundle,x)
                self.assertEqual(len(output),n)
                self.assertNotIn('churn_next_month',output)
                self.assertTrue(output['label_status'].eq('Unknown').all())
                self.assertTrue(output['explanations_status'].str.contains('SHAP not generated').all())
                with self.assertRaises(ValueError):
                    predict_frame(bundle,frame)


if __name__=='__main__':
    unittest.main()
