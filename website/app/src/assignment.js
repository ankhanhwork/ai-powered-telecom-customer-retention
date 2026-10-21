export const assignmentMethods=[
 {id:'manual',name:'Manual',tag:'YOU CHOOSE',icon:'↗',summary:'Pick the right person for each case.',detail:'Choose an agent for each customer. Best for exceptions or a small set of cases. Daily and open-case limits apply to manual and batch assignments.'},
 {id:'round_robin',name:'Round-robin',tag:'EVEN DISTRIBUTION',icon:'⇄',summary:'Take turns, starting with the highest risk.',detail:'Cases are ordered by churn risk, then waiting time. Selected agents take turns; agents at capacity are skipped. The next confirmed run continues after the last assigned agent. This balances new assignments, not the existing workload.'},
 {id:'weighted',name:'Weighted',tag:'CONTEXT & CAPACITY',icon:'⚖',summary:'Match customer history, experience and workload.',detail:'Among agents with capacity, choose the highest score: continuity × its weight + relevant case experience × its weight + available workload × its weight. Load updates after every proposed assignment. Ties favour fewer open cases, then fewer received today. SHAP groups are model signals, not confirmed churn causes.'}
];
export const suggestedWeights={continuity:40,experience:30,load:30};
export const availableSlots=(agent,limits)=>Math.max(0,Math.min(limits.daily-agent.today,limits.open-agent.open));
export function previewAssignment({cases,agents,selectedIds,method,limits,weights=suggestedWeights,overrides={},cursor=null}){
 if(!assignmentMethods.some(m=>m.id===method))throw new Error('Choose an assignment method.');
 if(!Number.isInteger(limits.daily)||!Number.isInteger(limits.open)||limits.daily<1||limits.open<1)throw new Error('Limits must be positive whole numbers.');
 const weightValues=Object.keys(suggestedWeights).map(k=>weights[k]);
 if(method==='weighted'&&(weightValues.some(w=>!Number.isFinite(w)||w<0||w>100)||Math.abs(weightValues.reduce((n,w)=>n+w,0)-100)>1e-8))throw new Error('Weights must be between 0 and 100 and total 100%.');
 const pool=agents.filter(a=>a.active!==false&&selectedIds.includes(a.id)).map(a=>({...a})).sort((a,b)=>a.id.localeCompare(b.id));
 if(!pool.length)throw new Error('Select at least one active agent.');
 const eligible=cases.filter(c=>!c.owner&&c.stage!=='closed'&&c.risk>0.5).sort((a,b)=>b.risk-a.risk||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
 const proposals=[],remaining=[];let last=cursor;
 for(const c of eligible){
  if(c.blocked){remaining.push({...c,reason:c.blocked});continue}
  const ready=pool.filter(a=>a.open<limits.open&&(a.today<limits.daily||c.receivedToday?.includes(a.id)));
  const maxExperience=Math.max(0,...ready.map(a=>a.experience?.[c.group]||0));
  const ranked=ready.map(a=>{
   const continuity=c.previousAgent===a.id?1:0,experience=maxExperience?(a.experience?.[c.group]||0)/maxExperience:0,load=1-a.open/limits.open;
   return {agent:a,score:continuity*weights.continuity+experience*weights.experience+load*weights.load,components:{continuity,experience,load}};
  }).sort((a,b)=>b.score-a.score||a.agent.open-b.agent.open||a.agent.today-b.agent.today||a.agent.id.localeCompare(b.agent.id));
  const explicit=Object.hasOwn(overrides,c.id);let chosen;
  if(explicit||method==='manual')chosen=ranked.find(x=>x.agent.id===overrides[c.id]);
  else if(method==='weighted')chosen=ranked[0];
  else {const next=ready.find(a=>!last||a.id>last)||ready[0];chosen=ranked.find(x=>x.agent.id===next?.id)}
  if(!chosen){remaining.push({...c,reason:method==='manual'&&!overrides[c.id]?'No agent selected':explicit?'Selected agent is unavailable or at capacity':'All selected agents are at capacity'});continue}
  const a=chosen.agent;
  const reason=method==='weighted'?`${chosen.components.continuity?'Previously cared for this customer · ':''}${a.experience?.[c.group]||0} past ${c.group||'matching'} cases · ${a.open}/${limits.open} open`:`${explicit||method==='manual'?'Chosen by supervisor':'Next agent in rotation'} · ${a.today}/${limits.daily} today · ${a.open}/${limits.open} open`;
  proposals.push({...c,agentId:a.id,agentName:a.name,score:method==='weighted'?chosen.score:null,components:chosen.components,reason,override:explicit&&method!=='manual'});
  a.open++;if(!c.receivedToday?.includes(a.id))a.today++;if(method==='round_robin')last=a.id;
 }
 return {proposals,remaining,agents:pool,cursor:method==='round_robin'?last:cursor,eligible:eligible.length};
}
