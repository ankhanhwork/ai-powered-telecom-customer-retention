export const OPEN_LIMIT=40;
export const suggestedWeights={continuity:40,skill:30,load:30};
export const weightsTotal=w=>Number(w.continuity)+Number(w.skill)+Number(w.load);
export const isOpen=row=>row.case_status!=='closed';
export const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];

export function openCounts(rows,agentIds){
 const counts=Object.fromEntries(agentIds.map(id=>[id,0]));
 for(const r of rows)if(isOpen(r)&&r.assigned_agent_id in counts)counts[r.assigned_agent_id]++;
 return counts;
}
export const byPriority=(a,b)=>b.churn_probability-a.churn_probability||String(a.created_at).localeCompare(String(b.created_at))||String(a.case_id).localeCompare(String(b.case_id));
export const latestPeriod=rows=>{const latest=rows.map(r=>r.target_period_start).sort().at(-1)||'';return {year:latest.slice(0,4),mon:latest.slice(5,7)}};
export const inPeriod=(row,sel)=>(!sel?.year||row.target_period_start.slice(0,4)===sel.year)&&(!sel?.mon||row.target_period_start.slice(5,7)===sel.mon);

// Deterministic plan. Continuity and skill need care history that is not connected yet, so they count as 0.
export function planAssignment({cases,agents,strategy,weights,counts,start=0,limit=OPEN_LIMIT}){
 const load={...counts},items=[],unassigned=[];
 let pointer=agents.length?start%agents.length:0;
 for(const c of [...cases].sort(byPriority)){
  let pick=-1;
  if(strategy==='round_robin'){
   for(let i=0;i<agents.length;i++){const idx=(pointer+i)%agents.length;if((load[agents[idx]]||0)<limit){pick=idx;break}}
  }else{
   const cands=agents.map((id,idx)=>({id,idx,score:weights.load*(1-(load[id]||0)/limit)})).filter(x=>(load[x.id]||0)<limit);
   cands.sort((x,y)=>y.score-x.score||(load[x.id]||0)-(load[y.id]||0)||(x.id<y.id?-1:1));
   pick=cands.length?cands[0].idx:-1;
  }
  if(pick<0){unassigned.push(c);continue}
  const id=agents[pick],before=load[id]||0;
  load[id]=before+1;
  const score=strategy==='round_robin'?null:weights.load*(1-before/limit);
  items.push({case:c,agent:id,score,reason:(strategy==='round_robin'?'Round-robin':'Workload balance')+` · ${before+1}/${limit} open after assignment`});
  if(strategy==='round_robin')pointer=(pick+1)%agents.length;
 }
 return {items,unassigned,next:pointer};
}
export function summarize(items){
 const out={};
 for(const i of items)out[i.agent]=(out[i.agent]||0)+1;
 return out;
}
