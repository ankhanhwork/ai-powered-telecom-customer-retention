export const label = value => String(value ?? 'Unknown').replaceAll('_', ' ').replace(/^./, c => c.toUpperCase());
export const date = value => value ? new Date(value).toLocaleString('en-GB', {timeZone:'Asia/Ho_Chi_Minh', dateStyle:'medium', timeStyle:'short'}) : 'Not set';
export const periodLabel = (start,endExclusive) => {
 if(!start||!endExclusive)return 'Unknown period';
 const end=new Date(endExclusive+'T00:00:00+07:00');end.setUTCDate(end.getUTCDate()-1);
 const fmt=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'short',year:'numeric'});
 return `${fmt.format(new Date(start+'T00:00:00+07:00'))} – ${fmt.format(end)}`;
};
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
export function sendBlockedReason(detail){
 if(detail.case.case_status==='closed')return 'This care case is closed. Reopen it before sending a message.';
 return '';
}
export const usedMessage = message => ['queued','sending','sent'].includes(message.delivery_status);
export const stalledAIRequest = (job,now=Date.now()) => job?.status==='queued' && now-Date.parse(job.claimed_at||job.created_at)>(job.claimed_at?300000:30000);
export const stages=[
 {id:'intake',title:'New predictions',hint:'Supervisor reviews and assigns'},
 {id:'outreach',title:'Outreach',hint:'Contact the customer and verify concerns'},
 {id:'resolution',title:'Resolving request',hint:'Coordinate the agreed next step'},
 {id:'care_completed',title:'Care completed',hint:'Care closed · outcome may still be unknown'},
 {id:'failed',title:'Failed',hint:'Could not reach or engage the customer'}
];
export const outcomeStages=[
 {id:'retained',title:'Continued service',hint:'Verified after the target period'},
 {id:'churned',title:'Churned',hint:'Verified after the target period'}
];
export const failReasons=[
 {id:'wrong_number',title:'Wrong number',contact:'wrong_contact'},
 {id:'no_answer',title:'No answer to calls',contact:'no_answer'},
 {id:'no_reply',title:'No reply to messages',contact:'no_answer'},
 {id:'other',title:'Other',contact:'not_contacted'}
];
const failedContacts=['not_contacted','no_answer','wrong_contact'];
export function careStage(status,contact){return status==='new'?'intake':status==='closed'?(failedContacts.includes(contact)?'failed':'care_completed'):status==='resolving_request'?'resolution':'outreach'}
export function pipelineStage(row){return careStage(row.case_status,row.contact_result)}
export function outcomeStage(row){return row.outcome_churned===true?'churned':row.outcome_churned===false?'retained':'unknown'}

export const queuePeriod = (rows,current) => rows.some(r=>r.target_period_start===current) ? current : rows.map(r=>r.target_period_start).sort().at(-1)||'';
export const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
