import test from 'node:test';
import assert from 'node:assert/strict';
import {shapShare,filterQueue,externalMessages,careStage,pipelineStage,sendBlockedReason,usedMessage,stalledAIRequest} from '../src/data.js';

test('AI retry unlocks unclaimed jobs after 30 seconds and claimed jobs after the server five-minute expiry',()=>{
 const now=Date.parse('2026-10-21T00:00:00Z');
 const job={status:'queued',created_at:new Date(now-30001).toISOString(),claimed_at:null};
 assert(stalledAIRequest(job,now));
 assert(!stalledAIRequest(job,now-1));
 assert(!stalledAIRequest({...job,claimed_at:new Date(now-30001).toISOString()},now));
 assert(stalledAIRequest({...job,claimed_at:new Date(now-300001).toISOString()},now));
 for(const status of ['completed','failed','cancelled'])assert(!stalledAIRequest({...job,status},now));
 assert(!stalledAIRequest(undefined,now));
});

test('send eligibility explains opt-out, missing permission and closed care separately',()=>{
 const detail={case:{case_status:'waiting_customer'},contact_preferences:[{channel:'Zalo',contact_allowed:false,opt_out_at:'2026-10-18T09:05:40Z'}]};
 assert.match(sendBlockedReason(detail,'Zalo'),/stopped proactive messages/);
 assert.match(sendBlockedReason(detail,'Portal'),/not been recorded/);
 detail.contact_preferences[0].contact_allowed=true;
 assert.match(sendBlockedReason(detail,'Zalo'),/stopped proactive messages/);
 detail.contact_preferences[0].opt_out_at=null;assert.equal(sendBlockedReason(detail,'Zalo'),'');
 detail.case.case_status='closed';assert.match(sendBlockedReason(detail,'Zalo'),/case is closed/);
});

test('only messages committed to delivery move to Used; failed messages can be retried',()=>{
 for(const delivery_status of ['queued','sending','sent'])assert(usedMessage({delivery_status}));
 for(const delivery_status of ['not_queued','failed','cancelled'])assert(!usedMessage({delivery_status}));
});
test('queue combines ownership, status and case-insensitive search',()=>{
 const rows=[{display_name:'Demo One',customer_ref:'ABC',contract_ref:'DEMO-1',assigned_agent_id:'a',case_status:'new'}, {display_name:'Demo Two',customer_ref:'DEF',assigned_agent_id:'b',case_status:'closed'}];
 assert.deepEqual(filterQueue(rows,'demo-1','new',true,'a'),[rows[0]]);
 assert.equal(filterQueue(rows,'','',true,'c').length,0);
 assert.equal(filterQueue(rows,'def','closed',false,'a').length,1);
});
test('care completion stays separate from verified period outcomes',()=>{
 assert.equal(careStage('closed'),'care_completed');
 assert.equal(pipelineStage({case_status:'closed',outcome_churned:null}),'care_completed');
 assert.equal(pipelineStage({case_status:'closed',outcome_churned:false}),'retained');
 assert.equal(pipelineStage({case_status:'resolving_request',outcome_churned:true}),'churned');
 assert.equal(careStage('waiting_customer'),'outreach');
 assert.equal(careStage('resolving_request'),'resolution');
});
test('staff conversation excludes internal notes and unsent drafts',()=>{
 const sent={visibility:'external',direction:'outbound',delivery_status:'sent'};
 const received={visibility:'external',direction:'inbound',delivery_status:'received'};
 assert.deepEqual(externalMessages([sent,received,{visibility:'internal',direction:'internal'},{visibility:'external',direction:'outbound',delivery_status:'queued'}]),[sent,received]);
});

test('SHAP share uses full net increase, preserves offsets and rejects invalid contexts',()=>{
 const context={shap_output_space:'deployed_log_odds',churn_probability:1/(1+Math.exp(-2)),base_value:-2};
 assert.equal(shapShare(context,{contribution_log_odds:2}),'50.0%');
 assert.equal(shapShare(context,{contribution_log_odds:5}),'125.0%');
 for(const change of [{churn_probability:1},{base_value:null},{shap_output_space:'raw'},{churn_probability:0.1}])assert.equal(shapShare({...context,...change},{contribution_log_odds:2}),'Unavailable');
});


test('rolling period label uses exclusive end and local dates',async()=>{
 const {periodLabel}=await import('../src/data.js');
 assert.equal(periodLabel('2026-10-11','2026-11-11'),'11 Oct 2026 – 10 Nov 2026');
 assert.equal(periodLabel('2026-09-01','2026-10-01'),'01 Sept 2026 – 30 Sept 2026');
 assert.equal(periodLabel(null,null),'Unknown period');
});


test('queue switches to valid latest period after replacing a batch',async()=>{
 const {queuePeriod}=await import('../src/data.js');
 const rows=[{target_period_start:'2026-10-11'},{target_period_start:'2026-10-21'}];
 assert.equal(queuePeriod(rows,'2026-10-01'),'2026-10-21');
 assert.equal(queuePeriod(rows,'2026-10-11'),'2026-10-11');
 assert.equal(queuePeriod([],null),'');
});
