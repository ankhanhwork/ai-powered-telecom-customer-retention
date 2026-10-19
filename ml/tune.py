"""Optuna TPE, equal 30-trial budget, three chronological folds per trial."""
import argparse
import statistics

import numpy as np
import optuna
from scipy.special import expit
from sklearn.metrics import average_precision_score,roc_auc_score,log_loss

from common import ROOT,config,read_json,sha,write_json
from data import load,rolling_folds
from models_api import defaults,fit,raw_predict


def evaluate_folds(algorithm,params,frame,cfg):
    scores,iterations,aucs,losses = [],[],[],[]
    for train,validation in rolling_folds(frame,cfg):
        model,count = fit(algorithm,params,train,cfg,validation=validation)
        probabilities = expit(raw_predict(model,algorithm,validation[cfg['features']],cfg))
        y = validation['churn_next_month'].astype(int)
        scores.append(float(average_precision_score(y,probabilities)))
        aucs.append(float(roc_auc_score(y,probabilities)))
        losses.append(float(log_loss(y,probabilities)))
        iterations.append(count)
    return {'mean_ap':float(np.mean(scores)),'mean_auc':float(np.mean(aucs)),'std_ap':float(np.std(scores)),
            'fold_ap':scores,'fold_auc':aucs,'fold_logloss':losses,'fold_iterations':iterations,
            'refit_iterations':max(1,int(statistics.median(iterations)))}


def suggest(trial,algorithm):
    if algorithm=='lightgbm':
        depth = trial.suggest_int('max_depth',3,8)
        return {'learning_rate':trial.suggest_float('learning_rate',.02,.15,log=True),
                'max_depth':depth,'num_leaves':trial.suggest_int('num_leaves',7,min(63,2**depth)),
                'min_child_samples':trial.suggest_int('min_child_samples',20,100),
                'colsample_bytree':trial.suggest_float('colsample_bytree',.7,1.),
                'subsample':trial.suggest_float('subsample',.7,1.),
                'reg_lambda':trial.suggest_float('reg_lambda',.001,10.,log=True)}
    return {'learning_rate':trial.suggest_float('learning_rate',.02,.15,log=True),
            'depth':trial.suggest_int('depth',4,8),'l2_leaf_reg':trial.suggest_float('l2_leaf_reg',1.,10.,log=True),
            'random_strength':trial.suggest_float('random_strength',0.,2.),
            'bagging_temperature':trial.suggest_float('bagging_temperature',0.,1.)}


def run(algorithm,cfg):
    frame = load(cfg)
    evidence = ROOT/cfg['evidence_dir']
    state_dir = ROOT/cfg['models_dir']/'search'
    state_dir.mkdir(parents=True,exist_ok=True)
    protocol_path = evidence/'tuning_protocol.json'
    protocol = {'config':cfg,'config_sha256':sha(ROOT/'ml/config.json'),
                'source_sha256':{name:sha(ROOT/'ml'/name) for name in ['data.py','tune.py','train.py','models_api.py','calibration.py','predict.py','common.py']},
                'data_manifest_sha256':sha(evidence/'data_manifest.json'),
                'selection_data':'CV inside training only; validation/calibration/audit test excluded',
                'early_stopping':'Logloss on inner chronological validation; configured objective on the same fold',
                'final_iterations':'Median best iteration across three CV folds, fixed before outer validation',
                'sampler':'TPE(seed=42,n_startup_trials=10), sequential trials; no pruning for equal completed budgets',
                'objective':cfg['objective'],'shap':'No SHAP during model selection'}
    if protocol_path.exists():
        assert read_json(protocol_path)==protocol,'Protocol/data changed; use a new run directory'
    else:
        write_json(protocol_path,protocol)
    baseline_path = evidence/f'{algorithm}_baseline_cv.json'
    if not baseline_path.exists():
        result = evaluate_folds(algorithm,defaults(algorithm),frame,cfg)
        write_json(baseline_path,{'parameters':defaults(algorithm),**result})
    storage = 'sqlite:///'+(state_dir/'optuna.sqlite3').as_posix()
    optuna.logging.set_verbosity(optuna.logging.WARNING)
    study = optuna.create_study(direction='maximize',study_name=f"{cfg['protocol_version']}_{algorithm}",
                storage=storage,load_if_exists=True,sampler=optuna.samplers.TPESampler(seed=cfg['seed'],n_startup_trials=10))
    def objective(trial):
        params = suggest(trial,algorithm)
        result = evaluate_folds(algorithm,params,frame,cfg)
        for name,value in result.items():
            trial.set_user_attr(name,value)
        print(f"{algorithm} trial {trial.number+1}/{cfg['trials_per_model']}: AUC={result['mean_auc']:.5f}; AP={result['mean_ap']:.5f}; iterations={result['fold_iterations']}",flush=True)
        return result['mean_auc'] if cfg['model_selection'].get('metric')=='roc_auc' else result['mean_ap']
    remaining = cfg['trials_per_model']-len(study.trials)
    if remaining>0:
        study.optimize(objective,n_trials=remaining,gc_after_trial=True)
    assert len(study.trials)==cfg['trials_per_model']
    assert all(t.state==optuna.trial.TrialState.COMPLETE for t in study.trials)
    study.trials_dataframe().to_csv(evidence/f'{algorithm}_trials.csv',index=False)
    best = study.best_trial
    write_json(evidence/f'{algorithm}_best.json',{'trial':best.number,'parameters':best.params,
               'mean_ap':best.value,'completed_trials':len(study.trials),**best.user_attrs})
    try:
        importance = optuna.importance.get_param_importances(study,seed=cfg['seed'])
    except TypeError:
        importance = optuna.importance.get_param_importances(study,evaluator=optuna.importance.FanovaImportanceEvaluator(seed=cfg['seed']))
    write_json(evidence/f'{algorithm}_parameter_importance.json',importance)
    print(f"{algorithm} complete: {cfg['objective']}={study.best_value:.5f}",flush=True)


if __name__=='__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--algorithm',choices=['lightgbm','catboost'],required=True)
    args = parser.parse_args()
    run(args.algorithm,config())
