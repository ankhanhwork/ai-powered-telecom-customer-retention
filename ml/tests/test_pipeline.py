import sys
import tempfile
import unittest
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[2]))

import numpy as np
import pandas as pd
from scipy.special import expit
from sklearn.metrics import brier_score_loss

from ml.train_finetune.calibration import apply_map,cross_fit
from ml.common import ROOT,config,matrix
from ml.preprocess.data import customer_role,partition,rolling_folds
from ml.train_finetune.models_api import defaults,fit,load_model,raw_predict,save_model
from ml.predict.predict import predict_frame


class PipelineChecks(unittest.TestCase):
    def test_explicit_explanation_output_does_not_publish_canonical_artifacts(self):
        from ml.predict import predict
        cfg = config()
        with patch('ml.shap.explain.export',return_value={'rows':8}) as export, \
             patch('ml.shap.explain.publish_summary') as publish:
            with patch('sys.argv',['predict','--explain','--output','tmp/check/predictions.csv']):
                predict.main()
            self.assertEqual(export.call_args.args[2],Path('tmp/check/explanations'))
            publish.assert_not_called()
            with patch('sys.argv',['predict','--explain']):
                predict.main()
            publish.assert_called_once_with(ROOT/cfg['shap_dir'],ROOT/cfg['models_dir']/'champion',ROOT/cfg['inference_dir']/'predictions.csv')

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
            self.assertEqual(partition('2026-09-30',role,cfg,'2026-11-01'),'inference')
        self.assertEqual(partition('2026-06-30','calibration',cfg,'2026-08-01'),'calibration')
        self.assertEqual(partition('2026-05-31','calibration',cfg,'2026-07-01'),'calibration_history')
        self.assertEqual(partition('2026-08-31','audit',cfg,'2026-10-01'),'test')
        self.assertEqual(partition('2026-06-30','development',cfg,'2026-08-01'),'validation')
        self.assertEqual(customer_role('A','development',cfg),customer_role('A','development',cfg))

    def test_rolling_folds_prevent_future_labels_and_exclude_other_roles(self):
        rows = []
        for snapshot in pd.date_range('2026-01-01','2026-07-31'):
            if snapshot.day not in (10,20) and not snapshot.is_month_end:
                continue
            start = snapshot+pd.Timedelta(days=1)
            rows.append(dict(snapshot_date=str(snapshot.date()),target_period_start=str(start.date()),
                target_period_end_exclusive=str((start+pd.DateOffset(months=1)).date()),
                partition='train' if start.month<=6 else 'validation'))
        folds = list(rolling_folds(pd.DataFrame(rows),config()))
        self.assertEqual(len(folds),3)
        for train,valid in folds:
            self.assertLessEqual(train.target_period_end_exclusive.max(),valid.target_period_start.min())
            self.assertTrue(train.partition.eq('train').all())
            self.assertTrue(valid.partition.eq('train').all())

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
        frame['target_period_end_exclusive'] = '2026-11-01'
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
                self.assertTrue(output['target_period_end_exclusive'].eq('2026-11-01').all())
                self.assertNotIn('churn_next_month',output)
                self.assertTrue(output['label_status'].eq('Unknown').all())
                self.assertTrue(output['explanations_status'].str.contains('SHAP not generated').all())
                with self.assertRaises(ValueError):
                    predict_frame(bundle,frame)


if __name__=='__main__':
    unittest.main()
