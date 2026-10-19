"""Compare 127-feature models; lock validation selection before test scoring.

Rolling-month runs purge future labels and group calibration by customer.
Test metrics are exploratory synthetic benchmarks, never a selection input.
"""
import argparse
import importlib.metadata
import shutil
import time

import numpy as np
import pandas as pd
from scipy.special import expit

from calibration import apply_map,cross_fit
from common import ROOT,config,read_json,sha,write_json
from data import load,prepare
from evaluate import reliability,score
from models_api import fit,load_model,raw_predict,save_model
from predict import load_bundle,predict_frame
from tune import run as tune_model


def choose(candidates,cfg):
    if cfg['model_selection'].get('metric')=='roc_auc':
        eligible = [name for name in candidates if name.endswith('_tuned')]
        return min(eligible,key=lambda name:(-candidates[name]['validation']['roc_auc'],candidates[name]['validation']['log_loss'],name))
    best_ap = max(c['validation']['average_precision'] for c in candidates.values())
    eligible = [name for name,c in candidates.items() if c['validation']['average_precision']>=best_ap-cfg['model_selection']['ap_tolerance']]
    loss = min(candidates[name]['validation']['log_loss'] for name in eligible)
    eligible = [name for name in eligible if candidates[name]['validation']['log_loss']<=loss+cfg['model_selection']['logloss_tolerance']]
    return min(eligible,key=lambda name:candidates[name]['prediction_seconds_per_1000'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-tuning',action='store_true')
    a = parser.parse_args()
    cfg = config()
    assert len(cfg['features'])==127 and not cfg['shap_enabled']
    evidence = ROOT/cfg['evidence_dir']
    if (evidence/'comparison.json').exists():
        raise ValueError('Comparison already exists; use a new protocol/output configuration')
    if not (ROOT/cfg['processed_dir']/'features.csv').exists():
        prepare(cfg)
    frozen = read_json(evidence/'data_manifest.json')
    assert frozen['config_sha256']==sha(ROOT/'ml/config.json')
    assert frozen['features_sha256']==sha(ROOT/cfg['processed_dir']/'features.csv')
    if not a.skip_tuning:
        for algorithm in ['lightgbm','catboost']:
            tune_model(algorithm,cfg)
    frame = load(cfg)
    parts = {name:frame.loc[frame['partition'].eq(name)].copy() for name in ['train','validation','calibration','test','inference']}
    assert set(parts['calibration'].customer_id).isdisjoint(set(parts['train'].customer_id)|set(parts['validation'].customer_id)|set(parts['test'].customer_id))
    model_root = ROOT/cfg['models_dir']
    offline = ROOT/cfg['processed_dir']/'evaluation'
    offline.mkdir(parents=True,exist_ok=True)
    candidates,models,calibrators = {},{},{}
    # No test labels or scores enter fitting, calibration or champion selection.
    for algorithm in ['lightgbm','catboost']:
        for variant in ['baseline','tuned']:
            cv = read_json(evidence/f'{algorithm}_baseline_cv.json' if variant=='baseline' else evidence/f'{algorithm}_best.json')
            if variant=='tuned':
                assert cv['completed_trials']==cfg['trials_per_model']
            candidate = f'{algorithm}_{variant}'
            started = time.perf_counter()
            model,iterations = fit(algorithm,cv['parameters'],parts['train'],cfg,iterations=cv['refit_iterations'])
            fit_seconds = time.perf_counter()-started
            raw_val = raw_predict(model,algorithm,parts['validation'][cfg['features']],cfg)
            raw_cal = raw_predict(model,algorithm,parts['calibration'][cfg['features']],cfg)
            y_cal = parts['calibration']['churn_next_month'].astype(int).to_numpy()
            groups = parts['calibration']['customer_id'].to_numpy() if cfg.get('snapshot_schedule')=='three_per_month' else None
            calibrator,cal_metrics,oof,folds = cross_fit(raw_cal,y_cal,cfg['seed'],groups=groups)
            timings = []
            for _ in range(5):
                started = time.perf_counter()
                raw_predict(model,algorithm,parts['validation'][cfg['features']],cfg)
                timings.append(time.perf_counter()-started)
            bundle = model_root/algorithm/variant
            bundle.mkdir(parents=True,exist_ok=True)
            model_file = 'model.txt' if algorithm=='lightgbm' else 'model.cbm'
            save_model(model,algorithm,bundle/model_file)
            metadata = {'candidate':candidate,'algorithm':algorithm,'variant':variant,'model_file':model_file,
                        'model_sha256':sha(bundle/model_file),'calibration_version':f"{cfg['protocol_version']}_{candidate}_platt",
                        'parameters':cv['parameters'],'iterations':iterations,'feature_count':127,
                        'approval_status':'Candidate in user-authorized offline comparison; not deployed',
                        'shap_status':'Not regenerated for this new model; v4 mapping remains pinned to v4'}
            write_json(bundle/'schema.json',{'features':cfg['features'],'categorical_features':cfg['categorical_features'],
                                            'dataset_version':cfg['dataset_version'],'snapshot_schedule':cfg.get('snapshot_schedule','month_end'),'target':'One calendar month from target_period_start; end exclusive'})
            write_json(bundle/'metadata.json',metadata)
            write_json(bundle/'calibrator.json',calibrator)
            saved = load_model(algorithm,bundle/model_file)
            assert np.allclose(raw_predict(saved,algorithm,parts['validation'][cfg['features']],cfg),raw_val)
            cal_output = parts['calibration'][['customer_id','snapshot_date']].copy()
            cal_output['churn_next_month'],cal_output['raw_probability'],cal_output['calibrator_oof_probability'],cal_output['fold'] = y_cal,expit(raw_cal),oof,folds
            cal_output.to_csv(offline/f'{candidate}_calibration_oof.csv',index=False)
            reliability(y_cal,oof).to_csv(evidence/f'{candidate}_calibration_reliability.csv',index=False)
            validation = score(parts['validation']['churn_next_month'],expit(raw_val))
            candidates[candidate] = {'algorithm':algorithm,'variant':variant,'feature_count':127,
                'cv':cv,'fit_seconds':fit_seconds,'iterations':iterations,'validation':validation,
                'prediction_seconds_per_1000':float(np.median(timings)*1000/len(raw_val)),
                'calibration':cal_metrics,'calibrator_adopted':calibrator['adopted'],'bundle':str(bundle.relative_to(ROOT))}
            models[candidate],calibrators[candidate] = model,calibrator
            print(f'{candidate}: validation AP={validation["average_precision"]:.5f}; AUC={validation["roc_auc"]:.5f}; iterations={iterations}',flush=True)
    champion = choose(candidates,cfg)
    selection = {'champion':champion,'status':'Selected offline under user-authorized comparison; not deployed','test_used_for_selection':False,
                 'rule':cfg['model_selection'],'candidates_validation':{name:c['validation'] for name,c in candidates.items()},
                 'shap':'Not regenerated; old model explanations must not be attached to the new model'}
    write_json(evidence/'selection.json',selection)
    selection_hash = sha(evidence/'selection.json')
    rows = []
    # Fixed champion now; comparisons below cannot alter selection.
    for name,c in candidates.items():
        test = parts['test']
        raw = raw_predict(models[name],c['algorithm'],test[cfg['features']],cfg)
        probability = apply_map(raw,calibrators[name])
        c['test_raw'],c['test_calibrated'] = score(test['churn_next_month'],expit(raw)),score(test['churn_next_month'],probability)
        assert abs(c['test_raw']['roc_auc']-c['test_calibrated']['roc_auc'])<1e-10
        prediction = test[['customer_id','snapshot_date']].copy()
        prediction['churn_next_month'],prediction['raw_probability'],prediction['churn_probability'] = test['churn_next_month'].to_numpy(),expit(raw),probability
        prediction.to_csv(offline/f'{name}_test_exploratory.csv',index=False)
        rows.append({'candidate':name,'feature_count':127,'cv_average_precision':c['cv']['mean_ap'],'cv_roc_auc':c['cv'].get('mean_auc',float(np.mean(c['cv']['fold_auc']))),
            'validation_average_precision':c['validation']['average_precision'],'validation_roc_auc':c['validation']['roc_auc'],
            'validation_log_loss':c['validation']['log_loss'],'calibration_oof_brier':c['calibration']['oof_after']['brier'],
            'test_roc_auc_exploratory':c['test_calibrated']['roc_auc'],'test_ap_exploratory':c['test_calibrated']['average_precision'],
            'test_brier_exploratory':c['test_calibrated']['brier'],'test_recall_top10_exploratory':c['test_calibrated']['recall_top10'],
            'test_alerts_gt500':c['test_calibrated']['alerts_gt500'],'iterations':c['iterations'],
            'fit_seconds':c['fit_seconds'],'prediction_seconds_per_1000':c['prediction_seconds_per_1000'],'selected':name==champion})
    assert selection_hash==sha(evidence/'selection.json')
    pd.DataFrame(rows).to_csv(evidence/'comparison.csv',index=False)
    champion_dir = model_root/'champion'
    if champion_dir.exists():
        raise ValueError('Champion directory exists')
    shutil.copytree(ROOT/candidates[champion]['bundle'],champion_dir)
    champion_metadata = read_json(champion_dir/'metadata.json')
    champion_metadata.update(approval_status=selection['status'],selection_sha256=selection_hash)
    write_json(champion_dir/'metadata.json',champion_metadata)
    inference = parts['inference'].drop(columns='churn_next_month')
    prediction = predict_frame(load_bundle(champion_dir),inference)
    infer_dir = ROOT/cfg['inference_dir']
    infer_dir.mkdir(parents=True,exist_ok=True)
    prediction.to_csv(infer_dir/'predictions.csv',index=False)
    inference.to_csv(infer_dir/'features.csv',index=False)
    assert prediction['label_status'].eq('Unknown').all() and 'churn_next_month' not in prediction
    versions = {package:importlib.metadata.version(package) for package in ['lightgbm','catboost','optuna','scikit-learn','pandas','numpy','scipy','matplotlib']}
    result = {'protocol_version':cfg['protocol_version'],'dataset_version':cfg['dataset_version'],
              'feature_count':127,'champion':champion,'approval_status':'Selected offline under user-authorized comparison; not deployed',
              'candidates':candidates,'dependencies':versions,'selection_sha256':selection_hash,
              'inference_rows':len(prediction),'inference_unique_customers':int(prediction.customer_id.nunique()),'inference_gt500':int(prediction.company_gt_500.sum()),
              'test_status':cfg.get('test_status','Exploratory; September audit cohort previously exposed'),
              'checks':{'features_exactly_127':True,'calibration_customer_disjoint':True,'test_not_used_for_selection':True,
                        'save_reload_predictions_match':True,'monotone_calibration_preserves_test_auc':True,
                        'inference_labels_unknown':True,'no_shap_computed':True,'calibration_oof_customer_grouped':cfg.get('snapshot_schedule')=='three_per_month'},'limitations':cfg['limitations']}
    write_json(evidence/'comparison.json',result)
    print(f'Selected offline champion: {champion}; inference >500: {result["inference_gt500"]}/{len(prediction)}',flush=True)


if __name__=='__main__':
    main()
