"""Native categorical adapters for LightGBM and CatBoost; no SHAP code."""
import os
from pathlib import Path
import lightgbm as lgb
import numpy as np
from catboost import CatBoostClassifier

from ml.common import matrix


def defaults(algorithm):
    if algorithm=='lightgbm':
        return {'learning_rate':.05,'num_leaves':15,'max_depth':6,'min_child_samples':30,
                'colsample_bytree':1.,'subsample':1.,'reg_lambda':1.}
    return {'learning_rate':.05,'depth':6,'l2_leaf_reg':3.,'random_strength':1.,'bagging_temperature':1.}


def fit(algorithm,params,train,cfg,validation=None,iterations=None):
    xt = matrix(train[cfg['features']],cfg,algorithm)
    yt = train['churn_next_month'].astype(int)
    if algorithm=='lightgbm':
        model = lgb.LGBMClassifier(**params,objective='binary',metric='binary_logloss',
            n_estimators=iterations or cfg['max_iterations'],random_state=cfg['seed'],n_jobs=cfg['threads'],
            subsample_freq=1,verbosity=-1,deterministic=True,force_col_wise=True)
        kwargs = {'categorical_feature':cfg['categorical_features']}
        if validation is not None:
            kwargs.update(eval_set=[(matrix(validation[cfg['features']],cfg,algorithm),validation['churn_next_month'].astype(int))],
                          callbacks=[lgb.early_stopping(cfg['early_stopping_rounds'],first_metric_only=True,verbose=False)])
        model.fit(xt,yt,**kwargs)
        count = int(model.best_iteration_ or model.n_estimators_)
    else:
        model = CatBoostClassifier(**params,iterations=iterations or cfg['max_iterations'],loss_function='Logloss',
            eval_metric='Logloss',random_seed=cfg['seed'],thread_count=cfg['threads'],verbose=False,
            allow_writing_files=False,bootstrap_type='Bayesian')
        kwargs = {'cat_features':cfg['categorical_features']}
        if validation is not None:
            kwargs.update(eval_set=(matrix(validation[cfg['features']],cfg,algorithm),validation['churn_next_month'].astype(int)),
                          early_stopping_rounds=cfg['early_stopping_rounds'],use_best_model=True)
        model.fit(xt,yt,**kwargs)
        count = int(model.tree_count_)
    actual = int(model.n_features_in_) if algorithm=='lightgbm' else len(model.feature_names_)
    if actual!=127:
        raise ValueError(f'Expected 127 fitted features, got {actual}')
    return model,count


def raw_predict(model,algorithm,x,cfg):
    values = matrix(x,cfg,algorithm)
    if algorithm=='lightgbm':
        predictor = model.booster_ if hasattr(model,'booster_') else model
        return np.asarray(predictor.predict(values,raw_score=True))
    return np.asarray(model.predict(values,prediction_type='RawFormulaVal')).reshape(-1)


def save_model(model,algorithm,path):
    path = Path(path).resolve()
    if algorithm=='lightgbm':
        # Python handles Vietnamese Windows paths; native fopen may not.
        path.write_text(model.booster_.model_to_string(),encoding='utf-8')
    else:
        previous = Path.cwd()
        try:
            os.chdir(path.parent)
            model.save_model(path.name)
        finally:
            os.chdir(previous)


def load_model(algorithm,path):
    if algorithm=='lightgbm':
        return lgb.Booster(model_str=Path(path).read_text(encoding='utf-8'))
    return CatBoostClassifier().load_model(blob=Path(path).read_bytes())
