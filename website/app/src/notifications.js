import {careStage,monthNames} from './data.js';

// Builds the role-specific notification feed: stored notifications (read state in the DB) enriched with the
// customer from the care queue, plus live alerts derived from current queue state (no read state, not stored).
// Text parts: plain strings, or {b:'...'} for bold.
const pct=p=>p==null?null:`${(p*100).toFixed(1)}%`;
const plural=(n,one,many=one+'s')=>`${n} ${n===1?one:many}`;
export function buildFeed({role,userId,notifications=[],rows=[],now=new Date().toISOString()}){
 const byCase=new Map(rows.map(r=>[r.case_id,r]));
 const who=n=>byCase.get(n.case_id)?.display_name||'a customer';
 const stored=notifications.map(n=>{
  const r=byCase.get(n.case_id),base={id:n.id,stored:true,read:!!n.read_at,at:n.created_at,caseId:n.case_id};
  switch(n.type){
   case 'new_message':return {...base,tab:'important',icon:'chat',tone:'primary',text:[{b:who(n)},' sent a new message',...(role==='supervisor'&&!r?.assigned_agent_id?['. The case has no owner yet — assign an agent to reply.']:['. Review and reply in Conversations.'])]};
   case 'follow_up_due':return {...base,tab:'important',icon:'clock',tone:'warn',text:['Follow-up due: ',{b:who(n)},' has not replied since your last message.']};
   case 'delivery_failed':return {...base,tab:'important',icon:'alert',tone:'danger',text:['Your message to ',{b:who(n)},' could not be delivered. Review and resend.']};
   case 'case_assigned':return {...base,tab:'updates',icon:'user',tone:'success',text:['New case assigned to you: ',{b:who(n)},...(pct(r?.churn_probability)?[` · churn risk ${pct(r.churn_probability)}.`]:['.'])]};
   case 'case_assignment_batch':{const count=Number(/(\d+)/.exec(n.title)?.[1]);return {...base,tab:'updates',icon:'users',tone:'success',caseId:null,view:'queue',text:Number.isFinite(count)?['You received ',{b:plural(count,'new case')},' in the latest assignment. Start with the highest churn risk.']:[n.title]}}
   default:return {...base,tab:'updates',icon:'bell',tone:'primary',text:[n.title]};
  }
 });
 const open=rows.filter(r=>r.case_status!=='closed'),latest=rows.map(r=>r.target_period_start).sort().at(-1);
 const periodName=latest?`${monthNames[Number(latest.slice(5,7))-1]} ${latest.slice(0,4)}`:'';
 const derived=[];
 if(role==='supervisor'){
  const unassigned=open.filter(r=>!r.assigned_agent_id);
  if(unassigned.length)derived.push({id:'unassigned',tab:'important',icon:'users',tone:'danger',view:'assign',text:[{b:plural(unassigned.length,'at-risk customer')},` ${unassigned.length===1?'is':'are'} not assigned to an agent yet. Open Assignment to distribute them.`]});
  const pending=new Map();
  for(const r of open)if(r.assigned_agent_id&&careStage(r.case_status,r.contact_result)==='intake')pending.set(r.case_owner||'An agent',(pending.get(r.case_owner||'An agent')||0)+1);
  for(const [name,count] of [...pending].sort((a,b)=>b[1]-a[1]).slice(0,3))derived.push({id:'pending:'+name,tab:'important',icon:'clock',tone:'warn',view:'dashboard',text:[{b:name},' has ',{b:plural(count,'case')},' still in New predictions (not yet cared).']});
  const batch=rows.filter(r=>r.target_period_start===latest);
  if(batch.length)derived.push({id:'batch:'+latest,tab:'updates',icon:'chart',tone:'primary',view:'dashboard',at:batch.map(r=>r.created_at).filter(Boolean).sort()[0],text:['New prediction batch for ',{b:periodName},': ',{b:plural(batch.length,'customer')},' above the churn alert threshold.']});
 }else{
  const mine=open.filter(r=>r.assigned_agent_id===userId&&careStage(r.case_status,r.contact_result)==='intake');
  if(mine.length)derived.push({id:'not-cared',tab:'important',icon:'clock',tone:'warn',view:'queue',text:['You have ',{b:plural(mine.length,'case')},' still in New predictions. Start outreach to move them forward.']});
  const ready=open.filter(r=>r.assigned_agent_id===userId&&Number(r.pending_drafts)>0);
  if(ready.length)derived.push({id:'drafts',tab:'important',icon:'chat',tone:'primary',view:'chat',caseId:ready[0].case_id,text:[{b:plural(ready.length,'draft message')},' waiting for your review before sending.']});
 }
 const items=[...derived.map(d=>({...d,live:true,read:false,at:d.at||now})),...stored];
 items.sort((a,b)=>(b.live-a.live)||String(b.at).localeCompare(String(a.at)));
 return {items,unread:{important:items.filter(i=>i.tab==='important'&&!i.read).length,updates:items.filter(i=>i.tab==='updates'&&!i.read).length}};
}
export const feedDate=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',weekday:'short',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value));
