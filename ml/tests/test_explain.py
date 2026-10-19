import copy
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from common import ROOT,config,read_json
from explain import aggregate,care_drivers,explain_frame,fact,top_groups,validate_mapping
from predict import load_bundle


class ExplanationChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cfg = config(ROOT/'ml/config_monthend_v4.json')
        cls.bundle = load_bundle(ROOT/cfg['models_dir']/'champion')
        cls.mapping = read_json(ROOT/'ml/shap_groups_monthend_v4.json')
        cls.frame = pd.read_csv(ROOT/cfg['inference_dir']/'features.csv').head(8)

    def test_complete_mapping_rejects_duplicates_missing_and_wrong_feature(self):
        schema = self.bundle[2]
        self.assertEqual(len(validate_mapping(self.mapping,schema)),127)
        for mutation in ['duplicate','missing','unknown']:
            bad = copy.deepcopy(self.mapping)
            if mutation=='duplicate':
                bad['groups'][1]['features'].append(bad['groups'][0]['features'][0])
            elif mutation=='missing':
                bad['groups'][0]['features'].pop()
            else:
                bad['groups'][0]['features'][0]='not_a_model_feature'
            with self.assertRaises(ValueError):
                validate_mapping(bad,schema)

    def test_signed_cancellation_and_no_forced_three(self):
        groups = [{'id':'a','features':['x','y']},{'id':'b','features':['z']},{'id':'c','features':['w']}]
        values = aggregate(np.array([[10.,-12.,1.,0.]]),['x','y','z','w'],groups)[0]
        np.testing.assert_allclose(values,[-2.,1.,0.])
        self.assertEqual(top_groups(values,groups),[1])
        self.assertEqual(top_groups(np.array([-1.,0.,0.]),groups),[])

    def test_missing_facts_and_fraction_units(self):
        meta = {'label':'Late invoice share','unit':'fraction','window_days':30,'family':'late_invoice_rate'}
        missing = fact('late_invoice_rate_30d',np.nan,.5,meta)
        self.assertIsNone(missing['value'])
        self.assertIn('not available',missing['observation'])
        known = fact('late_invoice_rate_30d',.5,.5,meta)
        self.assertIn('50 %',known['observation'])

    def test_positive_facts_deduplicate_windows(self):
        schema = self.bundle[2]
        row = self.frame.iloc[0].copy()
        values = np.zeros(127)
        for feature in ['disconnect_count_7d','disconnect_count_30d','outage_minutes_7d']:
            values[schema['features'].index(feature)] = 1.
            row[feature] = 5.
        totals = aggregate(values[None,:],schema['features'],self.mapping['groups'])[0]
        drivers = care_drivers(row,values,totals,schema,self.mapping)
        self.assertEqual(len(drivers),1)
        self.assertEqual(len(drivers[0]['facts']),2)
        self.assertTrue(drivers[0]['requires_staff_review'])

    def test_prepaid_payment_missingness_is_not_called_debt(self):
        schema = self.bundle[2]
        row = self.frame.iloc[0].copy()
        row['billing_mode']='Prepaid'
        values = np.zeros(127)
        for feature in self.mapping['groups'][2]['features']:
            row[feature]=np.nan
            values[schema['features'].index(feature)]=.1
        totals = aggregate(values[None,:],schema['features'],self.mapping['groups'])[0]
        driver = care_drivers(row,values,totals,schema,self.mapping)[0]
        self.assertFalse(driver['supports_customer_situation_claim'])
        self.assertIn('not applicable',driver['explanation_draft'])
        self.assertIn('Do not request an overdue payment',driver['suggested_action'])

    def test_native_shap_reconstructs_raw_and_nonidentity_calibration(self):
        features,groups,records,checks = explain_frame(self.bundle,self.frame,self.mapping,batch_size=4)
        self.assertLess(checks['raw_margin_max_abs_error'],1e-7)
        self.assertLess(checks['deployed_probability_max_abs_error'],1e-9)
        changed = (*self.bundle[:3],{'method':'platt','slope':2*self.bundle[3]['slope'],'intercept':2*self.bundle[3]['intercept']+.3,'adopted':True})
        _,mapped,_,mapped_checks = explain_frame(changed,self.frame,self.mapping,batch_size=8)
        names = [group['id'] for group in self.mapping['groups']]
        np.testing.assert_allclose(mapped[names],2*groups[names])
        np.testing.assert_allclose(mapped.base_value_log_odds,2*groups.base_value_log_odds+.3)
        self.assertLess(mapped_checks['deployed_probability_max_abs_error'],1e-9)
        for record in records:
            self.assertLessEqual(len(record['drivers']),3)
            self.assertEqual(record['label_status'],'Unknown')
            self.assertFalse(record['customer_outbound_allowed'])

    def test_reject_labels_audit_and_wrong_model(self):
        for column in ['churn_next_month','generation_probability','episode','max_severity']:
            with self.assertRaises(ValueError):
                explain_frame(self.bundle,self.frame.assign(**{column:0}),self.mapping)
        bad = copy.deepcopy(self.mapping)
        bad['model_sha256']='wrong-model'
        with self.assertRaises(ValueError):
            explain_frame(self.bundle,self.frame,bad)


class LightGBMExplanationChecks(ExplanationChecks):
    @classmethod
    def setUpClass(cls):
        cfg = config()
        cls.bundle = load_bundle(ROOT/cfg['models_dir']/'champion')
        cls.mapping = read_json(ROOT/'ml/shap_groups.json')
        cls.frame = pd.read_csv(ROOT/cfg['inference_dir']/'features.csv').head(8)


if __name__=='__main__':
    unittest.main()
