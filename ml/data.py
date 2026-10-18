"""Freeze v4 inputs and assign customer-disjoint calibration before tuning."""
import hashlib

import pandas as pd

from common import ROOT,config,read_json,sha,write_json


def customer_role(customer_id,source_role,cfg):
    if source_role=='audit_holdout':
        return 'audit'
    value = int(hashlib.sha256(f"{cfg['calibration_hash_salt']}:{customer_id}".encode()).hexdigest()[:16],16)
    return 'calibration' if value%cfg['calibration_modulus']==cfg['calibration_remainder'] else 'development'


def partition(snapshot,role):
    month = int(snapshot[5:7])
    if month==9:
        return 'inference'
    if role=='audit':
        return 'test' if month==8 else 'audit_history'
    if role=='calibration':
        return 'calibration' if month==7 else 'calibration_history'
    if month<=6:
        return 'train'
    return 'validation' if month==7 else 'unused_development'


def prepare(cfg):
    source,output = ROOT/cfg['dataset_dir'],ROOT/cfg['processed_dir']
    output.mkdir(parents=True,exist_ok=True)
    manifest = read_json(source/'dataset_manifest.json')
    if manifest['dataset_version']!=cfg['dataset_version']:
        raise ValueError('Unexpected dataset version')
    feature_file = cfg['feature_file']
    x = pd.read_csv(source/feature_file).rename(columns={'split':'source_split','cohort_role':'source_cohort'}).copy()
    if len(cfg['features'])!=127 or len(set(cfg['features']))!=127:
        raise ValueError('This final comparison requires exactly 127 features')
    missing = set(cfg['features'])-set(x.columns)
    if missing:
        raise ValueError(f'Missing features: {missing}')
    y = pd.read_csv(source/'churn_labels.csv')
    assert not x.duplicated(['customer_id','snapshot_date']).any()
    x['evaluation_role'] = [customer_role(cid,role,cfg) for cid,role in zip(x['customer_id'],x['source_cohort'])]
    x['partition'] = [partition(snapshot,role) for snapshot,role in zip(x['snapshot_date'],x['evaluation_role'])]
    combined = x.merge(y[['customer_id','snapshot_date','churn_next_month']],on=['customer_id','snapshot_date'],validate='one_to_one')
    ids = {name:set(combined.loc[combined['partition'].eq(name),'customer_id']) for name in ['train','validation','calibration','test']}
    assert ids['train'].isdisjoint(ids['calibration']|ids['test'])
    assert ids['validation'].isdisjoint(ids['calibration']|ids['test'])
    assert ids['calibration'].isdisjoint(ids['test'])
    assert combined.loc[combined['partition'].eq('inference'),'churn_next_month'].isna().all()
    for name in ['train','validation','calibration','test']:
        part = combined.loc[combined['partition'].eq(name)]
        assert part['churn_next_month'].notna().all() and part['churn_next_month'].nunique()==2
    x.to_csv(output/'features.csv',index=False)
    y.to_csv(output/'labels.csv',index=False)
    x[['customer_id','snapshot_date','evaluation_role','partition']].to_csv(output/'split_manifest.csv',index=False)
    summary = combined.groupby(['snapshot_date','partition'],as_index=False).agg(rows=('customer_id','size'),known=('churn_next_month','count'),churned=('churn_next_month','sum'))
    summary.loc[summary['known'].eq(0),'churned'] = pd.NA
    evidence = ROOT/cfg['evidence_dir']
    evidence.mkdir(parents=True,exist_ok=True)
    summary.to_csv(evidence/'split_summary.csv',index=False)
    write_json(evidence/'data_manifest.json',{'protocol_version':cfg['protocol_version'],
        'dataset_version':cfg['dataset_version'],'source_files':{file:sha(source/file) for file in [feature_file,'churn_labels.csv','dataset_manifest.json']},
        'feature_whitelist':cfg['features'],'calibration_customer_disjoint':True,'test_customer_disjoint':True,
        'config_sha256':sha(ROOT/'ml/config.json'),'rows':len(x),'features_sha256':sha(output/'features.csv'),
        'labels_sha256':sha(output/'labels.csv'),'split_sha256':sha(output/'split_manifest.csv')})
    return combined


def load(cfg):
    directory = ROOT/cfg['processed_dir']
    x,y = pd.read_csv(directory/'features.csv'),pd.read_csv(directory/'labels.csv')
    return x.merge(y[['customer_id','snapshot_date','churn_next_month']],on=['customer_id','snapshot_date'],validate='one_to_one')


def rolling_folds(frame,cfg):
    train = frame.loc[frame['partition'].eq('train')]
    month = train['snapshot_date'].str[5:7].astype(int)
    for val_month in cfg['cv_validation_snapshot_months']:
        earlier,later = train.loc[month<val_month],train.loc[month.eq(val_month)]
        assert earlier['target_period_end_exclusive'].le(later['target_period_start'].min()).all()
        yield earlier,later


if __name__=='__main__':
    prepare(config())
