"""Native tree SHAP, approved signed groups, and grounded English care facts.

No fitting, labels, LLM calls or automatic customer messages. Group totals are
sums of feature attributions, not coalition-level Shapley values or percentages.
"""
import argparse
import json
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
from catboost import Pool
from scipy.special import expit

from ml.train_finetune.calibration import apply_map
from ml.common import ROOT, config, matrix, read_json, sha, write_json
from ml.train_finetune.models_api import raw_predict
from ml.predict.predict import load_bundle, predict_frame


def validate_mapping(mapping, schema):
    if not mapping.get('approved'):
        raise ValueError('Group mapping must be approved before use')
    groups = mapping['groups']
    names = [group['id'] for group in groups]
    assigned = [feature for group in groups for feature in group['features']]
    if len(groups)!=6 or len(set(names))!=6:
        raise ValueError('Exactly six unique approved groups required')
    if len(assigned)!=127 or len(set(assigned))!=127 or set(assigned)!=set(schema['features']):
        raise ValueError('Each of the 127 model features must occur in exactly one group')
    if set(mapping['feature_metadata'])!=set(schema['features']):
        raise ValueError('Readable metadata required for every model feature')
    return {feature:group['id'] for group in groups for feature in group['features']}


def aggregate(values, features, groups):
    """Signed net contribution, never sum(abs(feature SHAP))."""
    positions = {feature:i for i,feature in enumerate(features)}
    return np.column_stack([values[:,[positions[f] for f in group['features']]].sum(axis=1) for group in groups])


def top_groups(values, groups, limit=3, epsilon=1e-10):
    positive = [i for i,value in enumerate(values) if value>epsilon]
    return sorted(positive,key=lambda i:(-values[i],groups[i]['id']))[:limit]


def fact(feature, value, contribution, metadata):
    missing = bool(pd.isna(value))
    if missing:
        converted = None
        observation = f"{metadata['label']} is not available at this snapshot; verify before drawing conclusions."
    else:
        converted = str(value) if isinstance(value,str) else float(value)
        rendered = converted if isinstance(converted,str) else f'{converted:,.2f}'.rstrip('0').rstrip('.')
        unit = metadata['unit']
        if unit=='fraction':
            rendered = f'{converted*100:,.2f}'.rstrip('0').rstrip('.')
            unit = 'percentage points' if feature.startswith('late_rate_change_') else '%'
        observation = f"{metadata['label']}: {rendered}{(' '+unit) if unit else ''}."
    return {'feature':feature,'label':metadata['label'],'value':converted,'unit':metadata['unit'],
        'window_days':metadata['window_days'],'family':metadata['family'],'missing':missing,
        'model_contribution_log_odds':float(contribution),'observation':observation}


def care_drivers(row, contributions, group_values, schema, mapping):
    """Prefer observed facts and distinct feature families; preserve all SHAP offline."""
    features,groups = schema['features'],mapping['groups']
    positions = {feature:i for i,feature in enumerate(features)}
    drivers = []
    for group_index in top_groups(group_values,groups,epsilon=mapping['positive_epsilon']):
        group = groups[group_index]
        positive = [f for f in group['features'] if contributions[positions[f]]>mapping['positive_epsilon']]
        positive.sort(key=lambda f:(bool(pd.isna(row[f])),-contributions[positions[f]],f))
        selected,families = [],set()
        for feature in positive:
            meta = mapping['feature_metadata'][feature]
            if meta['family'] in families:
                continue
            families.add(meta['family'])
            selected.append(fact(feature,row[feature],contributions[positions[feature]],meta))
            if len(selected)==3:
                break
        # Missingness may itself contribute, but cannot establish customer behavior.
        observed = [item for item in selected if not item['missing']]
        observations = ' '.join(item['observation'] for item in observed)
        if not observations:
            observations = 'Available evidence is insufficient to describe the current customer situation. Verify missing information before contacting the customer.'
        rank = len(drivers)+1
        not_applicable = group['id']=='payment_overdue' and str(row.get('billing_mode','Unknown'))=='Prepaid'
        action = group['action']
        status = 'Observed synthetic facts' if observed else 'Missing evidence; verification required'
        if not_applicable:
            status = 'Not applicable to prepaid billing; model signal only'
            action = 'Review prepaid renewal information instead. Do not request an overdue payment based on this group.'
            observations = ('This customer uses prepaid billing. Postpaid overdue-invoice fields are not applicable. '
                'The model uses this data pattern, but it is not evidence of late payment or unpaid debt.')
        elif not observed:
            action = 'Verify data availability before proposing an action for this group.'
        explanation = (f'{observations} This group ranks #{rank} among signals increasing the model\'s risk assessment. '
            +action)
        drivers.append({'rank':rank,'group_id':group['id'],'group_name':group['name'],
            'contribution_log_odds':float(group_values[group_index]),'facts':selected,
            'evidence_status':status,'supports_customer_situation_claim':bool(observed) and not not_applicable,
            'explanation_draft':explanation,'suggested_action':action,
            'requires_staff_review':True})
    return drivers


def explain_frame(bundle, frame, mapping, threads=4, batch_size=256):
    model,metadata,schema,calibrator = bundle
    algorithm = metadata['algorithm']
    if algorithm not in ('catboost','lightgbm'):
        raise ValueError('Only native CatBoost or LightGBM SHAP is supported')
    if metadata['model_sha256']!=mapping['model_sha256']:
        raise ValueError('Mapping is bound to a different approved model')
    validate_mapping(mapping,schema)
    forbidden = {'churn_next_month','episode','generation_probability','max_severity'} & set(frame.columns)
    if forbidden:
        raise ValueError(f'Labels and generator audit are forbidden: {forbidden}')
    if frame.empty or frame.duplicated(['customer_id','snapshot_date']).any():
        raise ValueError('Nonempty unique customer snapshots required')
    if batch_size<1:
        raise ValueError('Positive batch size required')
    x = matrix(frame,schema,algorithm)
    names = list(model.feature_names_) if algorithm=='catboost' else model.feature_name()
    if names!=schema['features']:
        raise ValueError('Model feature order differs from saved schema')
    parts = []
    for start in range(0,len(x),batch_size):
        batch = x.iloc[start:start+batch_size]
        if algorithm=='catboost':
            pool = Pool(batch,cat_features=schema['categorical_features'])
            parts.append(np.asarray(model.get_feature_importance(pool,type='ShapValues',thread_count=threads)))
        else:
            parts.append(np.asarray(model.predict(batch,pred_contrib=True,num_threads=threads)))
        print(f'SHAP: {min(start+batch_size,len(x))}/{len(x)} snapshots',flush=True)
    shap = np.concatenate(parts)
    if shap.shape!=(len(frame),128) or not np.isfinite(shap).all():
        raise ValueError('Expected finite native SHAP matrix with 127 features plus baseline')
    raw = raw_predict(model,algorithm,x,schema)
    raw_error = float(np.max(np.abs(shap.sum(axis=1)-raw)))
    if raw_error>1e-7:
        raise ValueError('Native SHAP does not reconstruct RawFormulaVal')
    # Positive-slope Platt map is affine in log-odds. Identity is the current
    # chosen model's fallback because OOF calibration failed its adoption gate.
    a,b = calibrator['slope'],calibrator['intercept']
    expected_probability = apply_map(raw,calibrator)
    values,base = a*shap[:,:-1],a*shap[:,-1]+b
    grouped = aggregate(values,schema['features'],mapping['groups'])
    probability_error = float(np.max(np.abs(expit(base+grouped.sum(axis=1))-expected_probability)))
    if probability_error>1e-9:
        raise ValueError('Grouped SHAP does not reconstruct deployed probability')
    keys = frame[['customer_id','snapshot_date']].reset_index(drop=True)
    feature_output = pd.concat([keys,pd.DataFrame(shap[:,:-1],columns=schema['features'])],axis=1)
    feature_output['base_value_raw_margin'] = shap[:,-1]
    groups_output = pd.concat([keys,pd.DataFrame(grouped,columns=[g['id'] for g in mapping['groups']])],axis=1)
    groups_output['base_value_log_odds'] = base
    groups_output['churn_probability'] = expected_probability
    records = []
    for position,(_,row) in enumerate(frame.iterrows()):
        records.append({'customer_id':str(row['customer_id']),'snapshot_date':str(row['snapshot_date']),
            'target_period_start':str(row['target_period_start']),'model_version':metadata['candidate'],
            **({'target_period_end_exclusive':str(row['target_period_end_exclusive'])} if 'target_period_end_exclusive' in row else {}),
            'model_sha256':metadata['model_sha256'],'explanation_version':mapping['version'],
            'shap_method':f'{algorithm} native TreeSHAP; summed feature groups',
            'shap_output_space':'deployed_log_odds','base_value':float(base[position]),
            'churn_probability':float(expected_probability[position]),'calibrator_method':calibrator['method'],
            'is_synthetic':True,'label_status':'Unknown','title':'Top risk drivers',
            'drivers':care_drivers(row,values[position],grouped[position],schema,mapping),
            'explanation_source':'Deterministic grounded English draft; no LLM invoked',
            'requires_staff_review':True,'customer_outbound_allowed':False})
    verification = {'rows':len(frame),'feature_count':127,'group_count':6,'raw_margin_max_abs_error':raw_error,
        'deployed_probability_max_abs_error':probability_error,'calibrator_method':calibrator['method'],
        'calibration_adopted':calibrator['adopted'],'mapping_complete_unique':True,
        'group_rule':'signed sum; top up to three strictly positive groups',
        'zero_positive_group_rows':sum(not record['drivers'] for record in records),
        'prepaid_payment_cards_marked_not_applicable':sum(d['evidence_status'].startswith('Not applicable') for r in records for d in r['drivers']),
        'no_labels_or_audit_used':True,'no_training_performed':True,'no_llm_invoked':True}
    return feature_output,groups_output,records,verification


def export(bundle_dir,input_file,output_dir,mapping_file=None):
    bundle_dir,input_file,output_dir = Path(bundle_dir),Path(input_file),Path(output_dir)
    mapping_file = Path(mapping_file or ROOT/'ml/shap/shap_groups.json')
    mapping = read_json(mapping_file)
    bundle = load_bundle(bundle_dir)
    frame = pd.read_csv(input_file)
    if 'partition' in frame:
        frame = frame.loc[frame['partition'].eq('inference')].copy()
    features,groups,records,checks = explain_frame(bundle,frame,mapping)
    output_dir.mkdir(parents=True,exist_ok=True)
    features.to_csv(output_dir/'feature_shap_raw.csv',index=False)
    groups.to_csv(output_dir/'group_shap.csv',index=False)
    with (output_dir/'care_context.jsonl').open('w',encoding='utf-8') as stream:
        for record in records:
            stream.write(json.dumps(record,ensure_ascii=False,allow_nan=False)+'\n')
    prediction = predict_frame(bundle,frame)
    prediction['explanations_status'] = 'SHAP available; care drafts require staff review'
    prediction['explanation_version'] = mapping['version']
    prediction.to_csv(output_dir/'predictions.csv',index=False)
    # Descriptive aggregate over this scoring cohort, not validation importance.
    importance = pd.DataFrame({'group_id':[g['id'] for g in mapping['groups']],
        'group_name':[g['name'] for g in mapping['groups']],
        'mean_abs_net_log_odds':groups[[g['id'] for g in mapping['groups']]].abs().mean().to_numpy(),
        'mean_signed_log_odds':groups[[g['id'] for g in mapping['groups']]].mean().to_numpy(),
        'top3_customer_count':[sum(any(d['group_id']==g['id'] for d in r['drivers']) for r in records) for g in mapping['groups']]})
    importance.to_csv(output_dir/'group_importance.csv',index=False)
    checks.update(model_sha256=bundle[1]['model_sha256'],mapping_sha256=sha(mapping_file),
        schema_sha256=sha(bundle_dir/'schema.json'),calibrator_sha256=sha(bundle_dir/'calibrator.json'),
        input_sha256=sha(input_file),explanation_version=mapping['version'],
        output_sha256={name:sha(output_dir/name) for name in ['feature_shap_raw.csv','group_shap.csv','care_context.jsonl','predictions.csv','group_importance.csv']})
    write_json(output_dir/'manifest.json',checks)
    return checks


def publish_summary(output_dir, bundle_dir, prediction_file):
    """Publish evidence and replace only the operational prediction export."""
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    output_dir,bundle_dir,prediction_file = Path(output_dir),Path(bundle_dir),Path(prediction_file)
    checks = read_json(output_dir/'manifest.json')
    evidence = ROOT/config()['evidence_dir']
    write_json(evidence/'shap_summary.json',checks)
    importance = pd.read_csv(output_dir/'group_importance.csv')
    importance.to_csv(evidence/'shap_group_importance.csv',index=False)
    counts = pd.DataFrame([{'group_id':group['id'],'name':group['name'],'feature_count':len(group['features'])}
                           for group in read_json(ROOT/'ml/shap/shap_groups.json')['groups']])
    counts.to_csv(evidence/'shap_mapping_coverage.csv',index=False)
    records = [json.loads(line) for line in (output_dir/'care_context.jsonl').read_text(encoding='utf-8').splitlines()]
    sample = max(records,key=lambda record:record['churn_probability']).copy()
    sample['customer_id'] = 'SYNTHETIC-EXAMPLE'
    sample['sample_note'] = 'Highest scoring synthetic inference profile; descriptive example, not typical or real FPT evidence.'
    write_json(evidence/'shap_example.json',sample)
    fig,axis = plt.subplots(figsize=(10,4.5),constrained_layout=True)
    ranked = importance.sort_values('mean_abs_net_log_odds')
    axis.barh(ranked.group_name,ranked.mean_abs_net_log_odds,color='#1673ad')
    axis.set(title='Grouped SHAP magnitude — October synthetic scoring cohort',
             xlabel='Mean absolute signed group total (log-odds); n = '+str(checks['rows']))
    for i,value in enumerate(ranked.mean_abs_net_log_odds):
        axis.text(value+.005,i,f'{value:.3f}',va='center')
    axis.set_xlim(0,ranked.mean_abs_net_log_odds.max()*1.2)
    figures = evidence/'figures'
    figures.mkdir(exist_ok=True)
    fig.savefig(figures/'shap_group_importance.png',dpi=170)
    plt.close(fig)
    source = pd.read_csv(output_dir/'predictions.csv')
    if prediction_file.exists():
        previous = pd.read_csv(prediction_file)
        if not previous[['customer_id','snapshot_date']].equals(source[['customer_id','snapshot_date']]):
            raise ValueError('Refusing to overwrite another prediction cohort')
        if not np.allclose(previous.churn_probability,source.churn_probability,atol=1e-12,rtol=0):
            raise ValueError('Explanation must not change existing prediction probabilities')
    prediction_file.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(output_dir/'predictions.csv',prediction_file)
    # Keep run-time selection/metrics immutable; store current approval separately.
    write_json(bundle_dir/'approval.json',{'model':read_json(bundle_dir/'metadata.json')['candidate'],'model_approved':True,'groups_approved':True,
        'approved_on':read_json(ROOT/'ml/shap/shap_groups.json')['approved_on'],'model_sha256':checks['model_sha256'],
        'explanation_version':checks['explanation_version'],'mapping_sha256':checks['mapping_sha256']})


def main():
    cfg = config()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bundle',type=Path,default=ROOT/cfg['models_dir']/'champion')
    parser.add_argument('--input',type=Path,default=ROOT/cfg['inference_dir']/'features.csv')
    parser.add_argument('--output',type=Path,default=ROOT/cfg['shap_dir'])
    args = parser.parse_args()
    checks = export(args.bundle,args.input,args.output)
    if args.output.resolve()==(ROOT/cfg['shap_dir']).resolve():
        publish_summary(args.output,args.bundle,ROOT/cfg['inference_dir']/'predictions.csv')
    print(json.dumps(checks,indent=2))


if __name__=='__main__':
    main()
