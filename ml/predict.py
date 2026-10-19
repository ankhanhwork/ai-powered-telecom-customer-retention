"""Load the selected bundle and score unlabeled customers, optionally with SHAP."""
import argparse
from pathlib import Path

import pandas as pd
from scipy.special import expit

from calibration import apply_map
from common import ROOT,config,read_json,sha
from models_api import load_model,raw_predict


def load_bundle(directory):
    directory = Path(directory)
    metadata = read_json(directory/'metadata.json')
    model_file = directory/metadata['model_file']
    if sha(model_file)!=metadata['model_sha256']:
        raise ValueError('Model hash does not match bundle')
    cfg = read_json(directory/'schema.json')
    calibrator = read_json(directory/'calibrator.json')
    return load_model(metadata['algorithm'],model_file),metadata,cfg,calibrator


def predict_frame(bundle,frame):
    model,metadata,cfg,calibrator = bundle
    if 'churn_next_month' in frame or 'generation_probability' in frame or 'episode' in frame:
        raise ValueError('Inference must not receive labels or generator audit')
    raw = raw_predict(model,metadata['algorithm'],frame,cfg)
    probability = apply_map(raw,calibrator)
    columns = ['customer_id','snapshot_date','target_period_start']
    if 'target_period_end_exclusive' in frame:
        columns.append('target_period_end_exclusive')
    output = frame[columns].copy()
    output['raw_probability'] = expit(raw)
    output['churn_probability'] = probability
    output['churn_score'] = probability*1000
    output['company_gt_500'] = probability>.5
    output['dataset_version'] = cfg['dataset_version']
    output['model_version'] = metadata['candidate']
    output['calibration_version'] = metadata['calibration_version']
    output['is_synthetic'] = True
    output['label_status'] = 'Unknown'
    output['explanations_status'] = 'SHAP not generated for this call; use --explain or ml/explain.py'
    return output


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--bundle',type=Path)
    p.add_argument('--input',type=Path)
    p.add_argument('--output',type=Path)
    p.add_argument('--explain',action='store_true',help='Export approved grouped SHAP and grounded care drafts')
    a = p.parse_args()
    cfg = config()
    bundle = a.bundle or ROOT/cfg['models_dir']/'champion'
    if a.explain:
        from explain import export,publish_summary
        path = a.output or ROOT/cfg['inference_dir']/'predictions.csv'
        output_dir = path.parent/'explanations'
        checks = export(bundle,a.input or ROOT/cfg['inference_dir']/'features.csv',output_dir)
        publish_summary(output_dir,bundle,path)
        print(f'Scored and explained {checks["rows"]} customers with 127 features')
        return
    frame = pd.read_csv(a.input or ROOT/cfg['processed_dir']/'features.csv')
    if 'partition' in frame:
        frame = frame.loc[frame['partition'].eq('inference')]
    output = predict_frame(load_bundle(bundle),frame)
    path = a.output or ROOT/cfg['inference_dir']/'predictions.csv'
    path.parent.mkdir(parents=True,exist_ok=True)
    output.to_csv(path,index=False)
    print(f'Scored {len(output)} customers; >500: {int(output.company_gt_500.sum())}')


if __name__=='__main__':
    main()
