"""Calibration-only cross-fitting on separate development customer IDs."""
import numpy as np
from scipy.special import expit
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold,StratifiedGroupKFold

from evaluate import score


def fit_map(raw,y):
    raw,y = np.asarray(raw,dtype=float),np.asarray(y,dtype=int)
    if not np.isfinite(raw).all() or set(np.unique(y))!={0,1}:
        raise ValueError('Finite margins and both classes required')
    model = LogisticRegression(C=1e6,solver='lbfgs',max_iter=1000,tol=1e-9,random_state=42)
    model.fit(raw.reshape(-1,1),y)
    a,b = float(model.coef_[0,0]),float(model.intercept_[0])
    if not np.isfinite([a,b]).all() or a<=0:
        raise ValueError('Positive, finite sigmoid slope required')
    return {'method':'platt','slope':a,'intercept':b}


def apply_map(raw,calibrator):
    if calibrator['slope']<=0 or not np.isfinite([calibrator['slope'],calibrator['intercept']]).all():
        raise ValueError('Invalid monotone calibrator')
    raw = np.asarray(raw,dtype=float)
    if not np.isfinite(raw).all():
        raise ValueError('Non-finite margins')
    return expit(calibrator['slope']*raw+calibrator['intercept'])


def cross_fit(raw,y,seed=42,groups=None):
    raw,y = np.asarray(raw),np.asarray(y,dtype=int)
    oof = np.full(len(y),np.nan)
    assignments = np.full(len(y),-1,dtype=int)
    folds = []
    splitter = StratifiedKFold(5,shuffle=True,random_state=seed) if groups is None else StratifiedGroupKFold(5,shuffle=True,random_state=seed)
    for fold,(train,held) in enumerate(splitter.split(raw,y,groups)):
        assert not set(train)&set(held)
        if groups is not None:
            assert set(np.asarray(groups)[train]).isdisjoint(np.asarray(groups)[held])
        mapping = fit_map(raw[train],y[train])
        oof[held] = apply_map(raw[held],mapping)
        assignments[held] = fold
        folds.append({'fold':fold,'fit_rows':len(train),'held_rows':len(held),'held_churn':int(y[held].sum()),**mapping})
    assert np.isfinite(oof).all() and (assignments>=0).all()
    before,after = score(y,expit(raw)),score(y,oof)
    adopted = after['brier']<before['brier'] and after['log_loss']<before['log_loss']
    final = fit_map(raw,y) if adopted else {'method':'identity','slope':1.,'intercept':0.}
    final['adopted'] = adopted
    return final,{'before':before,'oof_after':after,'folds':folds},oof,assignments
