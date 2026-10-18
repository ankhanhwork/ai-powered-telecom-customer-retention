export const label = value => String(value ?? 'Unknown').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
export const date = value => value ? new Date(value).toLocaleString('en-GB', {timeZone:'Asia/Ho_Chi_Minh', dateStyle:'medium', timeStyle:'short'}) : 'Not set';
export const money = (value, currency='VND') => value == null ? 'Unavailable' : new Intl.NumberFormat('en', {style:'currency',currency,maximumFractionDigits:0}).format(value);
export const factValue = fact => fact.missing ? 'Unavailable' : fact.value == null ? 'Not applicable' : typeof fact.value==='number' ? new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(fact.value) : String(fact.value);
export function shapShare(context, driver) {
  const p=context?.churn_probability, base=context?.base_value, contribution=driver?.contribution_log_odds;
  if(context?.shap_output_space!=='deployed_log_odds' || !Number.isFinite(p) || p<=0 || p>=1 || !Number.isFinite(base) || !Number.isFinite(contribution))return 'Unavailable';
  const increase=Math.log(p/(1-p))-base;
  return increase>1e-8 ? `${(100*contribution/increase).toFixed(1)}%` : 'Unavailable';
}
export function filterQueue(rows, search, status, mine, userId) {
  const term=search.trim().toLowerCase();
  return rows.filter(r => (!mine || r.assigned_agent_id===userId) && (!status || r.case_status===status) && `${r.display_name} ${r.customer_ref} ${r.contract_ref}`.toLowerCase().includes(term));
}
export function externalMessages(messages) {
  return messages.filter(m => m.visibility==='external' && (m.direction==='inbound' || m.delivery_status==='sent'));
}
export function sendBlockedReason(detail,channel){
 if(detail.case.case_status==='closed')return 'This care case is closed. Reopen it before sending a message.';
 const preference=detail.contact_preferences.find(p=>p.channel===channel);
 if(preference?.opt_out_at)return 'This customer has stopped proactive messages on '+channel+'. Sending is blocked. A customer reply does not restore contact permission.';
 if(!preference?.contact_allowed)return 'Contact permission for '+channel+' has not been recorded. Sending is blocked until permission is confirmed.';
 return '';
}
export const usedMessage = message => ['queued','sending','sent'].includes(message.delivery_status);
export const stages=[
 {id:'intake',title:'New predictions',hint:'Supervisor reviews and assigns'},
 {id:'outreach',title:'Outreach',hint:'Contact the customer and verify concerns'},
 {id:'resolution',title:'Resolving request',hint:'Coordinate the agreed next step'},
 {id:'care_completed',title:'Care completed',hint:'Care closed · outcome may still be unknown'},
 {id:'retained',title:'Continued service',hint:'Verified after the target period'},
 {id:'churned',title:'Churned',hint:'Verified after the target period'}
];
export function careStage(status){return status==='new'?'intake':status==='closed'?'care_completed':status==='resolving_request'?'resolution':'outreach'}
export function pipelineStage(row){return row.outcome_churned===true?'churned':row.outcome_churned===false?'retained':row.care_stage||careStage(row.case_status)}
