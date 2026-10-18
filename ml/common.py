"""Shared paths, deterministic hashes, JSON and canonical model inputs."""
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def write_json(path,value):
    path = Path(path)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps(value,ensure_ascii=False,indent=2,allow_nan=False),encoding='utf-8')


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def config(path=None):
    return read_json(path or ROOT/'ml/config.json')


def matrix(frame,cfg,algorithm):
    if len(cfg['features'])!=127 or len(set(cfg['features']))!=127:
        raise ValueError('Final pipeline requires exactly 127 unique features')
    forbidden = {'churn_next_month','episode','generation_probability','max_severity'} & set(frame.columns)
    # Training callers explicitly slice X before this check.
    if forbidden:
        raise ValueError(f'Labels/audit must be separated from X: {forbidden}')
    x = frame[cfg['features']].copy()
    for feature in cfg['features']:
        if feature in cfg['categorical_features']:
            x[feature] = x[feature].astype('string').fillna('Unknown')
            if algorithm=='lightgbm':
                x[feature] = x[feature].astype(pd.CategoricalDtype(['Postpaid','Prepaid','Unknown']))
            else:
                x[feature] = x[feature].astype(str)
        else:
            x[feature] = pd.to_numeric(x[feature],errors='raise').astype(float)
    if np.isinf(x.select_dtypes(include='number').to_numpy()).any():
        raise ValueError('Infinite model input')
    return x
