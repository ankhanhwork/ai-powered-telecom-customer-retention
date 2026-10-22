"""Export slide-ready English PNG/SVG figures from frozen predictions and SHAP."""
import json
import textwrap
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy.special import expit
from sklearn.metrics import roc_curve,precision_recall_curve,roc_auc_score,average_precision_score
from ml.common import ROOT,config,read_json,write_json,sha


def main():
    cfg=config(); evidence=ROOT/cfg['evidence_dir']; folder=ROOT/cfg['inference_dir']
    output=evidence/'figures'/'slides';output.mkdir(parents=True,exist_ok=True)
    mapping=read_json(ROOT/'ml/shap/shap_groups.json'); groups=mapping['groups']
    source=pd.read_csv(folder/'features.csv'); latest=source.snapshot_date.max()
    features=source.loc[source.snapshot_date.eq(latest)].set_index('customer_id')
    pred=pd.read_csv(folder/'predictions.csv');pred=pred.loc[pred.snapshot_date.eq(latest)].set_index('customer_id')
    grouped=pd.read_csv(ROOT/cfg['shap_dir']/'group_shap.csv');grouped=grouped.loc[grouped.snapshot_date.eq(latest)].set_index('customer_id').loc[pred.index]
    raw=pd.read_csv(ROOT/cfg['shap_dir']/'feature_shap_raw.csv');raw=raw.loc[raw.snapshot_date.eq(latest)].set_index('customer_id').loc[pred.index]
    calibrator=read_json(ROOT/cfg['models_dir']/'champion/calibrator.json')
    calibrated=raw[cfg['features']]*calibrator['slope']
    assert len(pred)==len(grouped)==len(raw)==len(features)
    np.testing.assert_allclose(expit(grouped.base_value_log_odds+grouped[[g['id'] for g in groups]].sum(axis=1)),pred.churn_probability,atol=1e-9)
    comparison=pd.read_csv(evidence/'comparison.csv'); tuned=comparison.loc[comparison.candidate.str.endswith('_tuned')]
    test=pd.read_csv(ROOT/cfg['processed_dir']/'evaluation/lightgbm_tuned_test_exploratory.csv')
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':14,'axes.spines.top':False,'axes.spines.right':False,'svg.fonttype':'none'})
    blue,orange='#176B9A','#E87524'; files=[]
    foot=f'Synthetic demo data · Snapshot {latest} · n = {len(pred):,} customers · Model attribution, not causal evidence'
    def save(name,fig,note=foot):
        fig.text(.02,.025,note,fontsize=10,color='#555555',va='bottom')
        fig.subplots_adjust(left=.08 if name=='02_test_roc_pr' else .30,right=.95,bottom=.18,top=.83 if name=='02_test_roc_pr' else .86,wspace=.35)
        for ext in ['png','svg']:
            file=output/f'{name}.{ext}';fig.savefig(file,dpi=220,facecolor='white');files.append(file.name)
        plt.close(fig)
    fig,ax=plt.subplots(figsize=(12.8,7.2));y=np.arange(len(tuned));w=.32
    for offset,column,color,label in [(-w/2,'validation_roc_auc',blue,'Validation'),(w/2,'test_roc_auc_exploratory',orange,'Exploratory test')]:
        bars=ax.barh(y+offset,tuned[column],height=w,color=color,label=label)
        ax.bar_label(bars,fmt='%.4f',padding=8,fontsize=14)
    ax.set(yticks=y,yticklabels=['LightGBM tuned','CatBoost tuned'],xlim=(0,1.07),xlabel='ROC AUC',title='Tuned model comparison · 127 features');ax.legend(loc='center',ncol=2,frameon=False)
    save('01_model_comparison',fig,'Synthetic rolling-month task · 30 Optuna trials per family · Winner selected by validation AUC before test')
    fig,axes=plt.subplots(1,2,figsize=(12.8,7.2));fpr,tpr,_=roc_curve(test.churn_next_month,test.churn_probability)
    axes[0].plot(fpr,tpr,color=blue,lw=2.5,label=f'AUC = {roc_auc_score(test.churn_next_month,test.churn_probability):.4f}');axes[0].plot([0,1],[0,1],'--',color='#777777');axes[0].set(xlabel='False-positive rate',ylabel='True-positive rate',title='ROC curve',xlim=(0,1),ylim=(0,1.02));axes[0].legend(loc='lower right')
    precision,recall,_=precision_recall_curve(test.churn_next_month,test.churn_probability)
    axes[1].plot(recall,precision,color=orange,lw=2.5,label=f'AP = {average_precision_score(test.churn_next_month,test.churn_probability):.4f}');axes[1].axhline(test.churn_next_month.mean(),ls='--',color='#777777',label=f'Prevalence = {test.churn_next_month.mean():.1%}');axes[1].set(xlabel='Recall',ylabel='Precision',title='Precision–recall curve',xlim=(0,1),ylim=(0,1.02));axes[1].legend(loc='lower left');fig.suptitle('LightGBM tuned · Exploratory test performance',fontsize=20)
    save('02_test_roc_pr',fig,f'Synthetic audit cohort · n = {len(test):,} snapshot rows / {test.customer_id.nunique():,} customers · {int(test.churn_next_month.sum())} positive rows · Overlapping windows')
    fig,ax=plt.subplots(figsize=(12.8,7.2));ax.hist(pred.churn_probability*1000,bins=np.linspace(0,1000,26),color=blue,edgecolor='white');ax.axvline(500,color=orange,lw=2.5,ls='--',label=f'>500: {int(pred.company_gt_500.sum())} of {len(pred):,}');ax.set(xlim=(0,1000),xlabel='Churn score (probability × 1,000)',ylabel='Customers',title='Latest prediction batch · Score distribution');ax.legend()
    save('03_prediction_distribution',fig,f'Synthetic demo · Issued 11 Oct 2026 · Target 11 Oct–10 Nov 2026 · n = {len(pred):,} · Outcomes Unknown')
    names={g['id']:g['name'] for g in groups}; ids=list(names)
    importance=grouped[ids].abs().mean().sort_values()
    fig,ax=plt.subplots(figsize=(12.8,7.2));bars=ax.barh([textwrap.fill(names[k],27) for k in importance.index],importance,color=blue);ax.bar_label(bars,fmt='%.3f',padding=6);ax.set(xlim=(0,importance.max()*1.22),xlabel='Mean absolute signed group contribution (log-odds)',title='Global SHAP importance · Six approved groups')
    save('04_shap_group_importance',fig)
    fi=calibrated.abs().mean().nlargest(15).sort_values();meta=mapping['feature_metadata']
    short={'prepaid_days_remaining':'Prepaid days remaining','days_since_last_payment':'Days since last payment',
           'overdue_amount_vnd':'Current overdue amount (VND)','promo_days_remaining':'Promotion days remaining',
           'service_issue_days_7d':'Service issue days · 7d','fee_change_pct_60d':'Fee change · 60d (%)',
           'inactive_days_7d':'Inactive days · 7d','usage_gb_7d':'Internet usage · 7d (GB)',
           'fee_change_pct_30d':'Fee change · 30d (%)','repeat_contacts_7d':'Repeat support contacts · 7d',
           'oldest_open_ticket_days':'Oldest open ticket age (days)','overdue_days':'Longest current overdue (days)',
           'tenure_months':'Tenure (months)','plan_change_requests_30d':'Plan change requests · 30d',
           'repeat_contacts_30d':'Repeat support contacts · 30d'}
    labels=[short.get(f,textwrap.fill(meta[f]['label'],33)) for f in fi.index]
    fig,ax=plt.subplots(figsize=(12.8,9));bars=ax.barh(labels,fi,color=blue);ax.bar_label(bars,fmt='%.3f',padding=6,fontsize=11);ax.set(xlim=(0,fi.max()*1.22),xlabel='Mean absolute feature SHAP (calibrated log-odds)',title='Top 15 feature contributions');save('05_shap_top_features',fig)
    fig,ax=plt.subplots(figsize=(12.8,7.2));rng=np.random.default_rng(42)
    for i,key in enumerate(importance.index):
        values=grouped[key].to_numpy();ax.scatter(values,i+rng.uniform(-.23,.23,len(values)),s=6,color=blue,alpha=.22,rasterized=True)
    ax.axvline(0,color='#333333',lw=1);ax.set(yticks=range(6),yticklabels=[textwrap.fill(names[k],27) for k in importance.index],xlabel='Signed group contribution to calibrated log-odds',title='SHAP direction and spread across customers');save('06_shap_group_distribution',fig)
    example=pred.churn_probability.idxmax();row=grouped.loc[example];values=row[ids].to_numpy(dtype=float);base=float(row.base_value_log_odds);ends=base+np.cumsum(values)
    fig,ax=plt.subplots(figsize=(12.8,7.2));labels=['Baseline']+[textwrap.fill(names[k],16) for k in ids]+['Prediction'];ax.bar(0,base,color='#555555');prior=base
    for i,value in enumerate(values,1):
        ax.bar(i,abs(value),bottom=min(prior,prior+value),color=orange if value>=0 else blue);ax.text(i,max(prior,prior+value)+.1,f'{value:+.2f}',ha='center',fontsize=11);prior+=value
    ax.bar(7,prior,color='#555555');ax.axhline(0,color='#444444',lw=.8);ax.set(xticks=range(8),xticklabels=labels,ylabel='Calibrated log-odds',title=f'Synthetic example · Grouped SHAP bridge · p = {expit(prior):.1%}',ylim=(min(base,*ends)-.6,max(0,*ends)+.6));ax.text(0,base-.25,f'{base:.2f}',ha='center',fontsize=11);ax.text(7,prior+.1,f'{prior:.2f}',ha='center',fontsize=11);ax.tick_params(axis='x',labelsize=10);fig.subplots_adjust(left=.10,right=.97,bottom=.23,top=.85)
    for ext in ['png','svg']:
        name=f'07_shap_example_waterfall.{ext}';fig.text(.02,.025,'Highest-scoring latest-batch synthetic example, not a typical customer · All six signed groups · Not causal evidence',fontsize=10) if ext=='png' else None;fig.savefig(output/name,dpi=220,facecolor='white');files.append(name)
    plt.close(fig)
    bridge=dict(example='Highest-scoring latest-batch synthetic profile; ID omitted',baseline_log_odds=base,group_log_odds={k:float(row[k]) for k in ids},reconstructed_probability=float(expit(prior)),saved_probability=float(pred.loc[example,'churn_probability']))
    assert abs(bridge['reconstructed_probability']-bridge['saved_probability'])<1e-9
    write_json(output/'chart_data.json',dict(snapshot=latest,customers=len(pred),alerts=int(pred.company_gt_500.sum()),group_mean_abs=importance.to_dict(),top_features=fi.to_dict(),example=bridge,source_sha256={f:sha(ROOT/cfg['shap_dir']/f) for f in ['feature_shap_raw.csv','group_shap.csv']}))
    notes='''# Biểu đồ cho slide — bộ hiện hành

English PNG (220 dpi) and editable SVG exports. Use the latest batch once per customer; do not pool overlapping inference snapshots for global SHAP.

1. `01_model_comparison`: validation/test AUC, two tuned families; selection used validation.
2. `02_test_roc_pr`: exploratory test ROC and precision–recall; repeated snapshot rows are disclosed.
3. `03_prediction_distribution`: latest batch, score >500 rule, no observed outcome claims.
4. `04_shap_group_importance`: mean(abs(signed sum of feature SHAP within each approved group)).
5. `05_shap_top_features`: top 15 feature SHAP magnitudes.
6. `06_shap_group_distribution`: signed group contributions; positive increases and negative offsets risk relative to baseline.
7. `07_shap_example_waterfall`: all six signed groups reconstruct one highest-scoring synthetic example. This is purposefully selected, not representative.

Use “Model-identified risk drivers”, not confirmed causes of churn. Contributions are calibrated log-odds, not percentages of churn probability. Group magnitude is not a count of affected customers. Prepaid postpaid-payment nulls are not evidence of debt. All data are synthetic, not measured FPT performance. `chart_data.json` retains aggregate source values and hashes; personal/customer identifiers are omitted.
'''
    (output/'README.md').write_text(notes,encoding='utf8')
    print(f'Exported {len(files)} PNG/SVG figures to the slide figures folder')


if __name__=='__main__':main()
