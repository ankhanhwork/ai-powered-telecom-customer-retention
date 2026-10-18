"""Ranking, probability quality and operational-threshold diagnostics."""
import math

import numpy as np
import pandas as pd
from sklearn.metrics import average_precision_score,brier_score_loss,confusion_matrix,log_loss,roc_auc_score


def score(y,probabilities):
    y,p = np.asarray(y,dtype=int),np.asarray(probabilities,dtype=float)
    if not np.isfinite(p).all() or ((p<0)|(p>1)).any():
        raise ValueError('Invalid probabilities')
    k = max(1,math.ceil(len(y)*.1))
    top = np.argsort(-p,kind='stable')[:k]
    tn,fp,fn,tp = map(int,confusion_matrix(y,p>.5,labels=[0,1]).ravel())
    return {'rows':len(y),'churned':int(y.sum()),'prevalence':float(y.mean()),
            'roc_auc':float(roc_auc_score(y,p)),'average_precision':float(average_precision_score(y,p)),
            'brier':float(brier_score_loss(y,p)),'log_loss':float(log_loss(y,p,labels=[0,1])),
            'top10_k':k,'precision_top10':float(y[top].mean()),'recall_top10':float(y[top].sum()/y.sum()),
            'alerts_gt500':int((p>.5).sum()),'threshold_precision':tp/(tp+fp) if tp+fp else 0.,
            'threshold_recall':tp/(tp+fn),'tn':tn,'fp':fp,'fn':fn,'tp':tp,'max_probability':float(p.max())}


def reliability(y,p):
    y,p = np.asarray(y),np.asarray(p)
    edges = [0,.05,.1,.2,.4,.6,.8,1]
    rows = []
    for i,(low,high) in enumerate(zip(edges[:-1],edges[1:])):
        take = (p>=low)&((p<high) if i<6 else (p<=high))
        rows.append({'lower':low,'upper':high,'rows':int(take.sum()),
                     'mean_prediction':float(p[take].mean()) if take.any() else np.nan,
                     'observed_rate':float(y[take].mean()) if take.any() else np.nan})
    return pd.DataFrame(rows)
