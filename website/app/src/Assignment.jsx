import React,{useEffect,useState} from 'react';
import {supabase,rpc,read} from './client';
import {label,stages,pipelineStage} from './data';
import useAutoRefresh from './useAutoRefresh';
import PeriodFilter from './PeriodFilter';
import {OPEN_LIMIT,suggestedWeights,weightsTotal,isOpen,openCounts,byPriority,latestPeriod,inPeriod,planAssignment,summarize} from './assign';

const RR_KEY='retention.rr.next';
const readNext=()=>{try{return Number(localStorage.getItem(RR_KEY))||0}catch{return 0}};
const saveNext=n=>{try{localStorage.setItem(RR_KEY,String(n))}catch{}};

export default function Assignment({act}){
 const [rows,setRows]=useState(null),[agents,setAgents]=useState([]),[sel,setSel]=useState(null),[search,setSearch]=useState('');
 const [chosen,setChosen]=useState(null),[strategy,setStrategy]=useState('round_robin'),[weights,setWeights]=useState(suggestedWeights);
 const [preview,setPreview]=useState(null),[result,setResult]=useState(''),[limit,setLimit]=useState(50);
 async function load(){
  const {data,error}=await supabase.from('retention_care_queue').select('*').order('churn_probability',{ascending:false});
  if(error)throw error;
  setRows(data);setSel(v=>v||latestPeriod(data));
  const staff=await read('staff_members');
  setAgents(staff.filter(s=>s.role==='agent'&&s.active).sort((a,b)=>a.display_name.localeCompare(b.display_name)));
 }
 useEffect(()=>{act(load)},[]);
 useAutoRefresh(load,'assignment');
 const all=rows||[],scoped=all.filter(r=>inPeriod(r,sel));
 const ids=agents.map(a=>a.user_id),counts=openCounts(all,ids);
 const picked=chosen??ids,name=id=>agents.find(a=>a.user_id===id)?.display_name||'Unassigned';
 const unassigned=scoped.filter(r=>!r.assigned_agent_id&&isOpen(r)).sort(byPriority);
 const total=weightsTotal(weights),weightsOk=total===100;
 const canPreview=picked.length>0&&unassigned.length>0&&(strategy==='round_robin'||weightsOk);
 function runPreview(){
  setResult('');
  const plan=planAssignment({cases:unassigned,agents:ids.filter(id=>picked.includes(id)),strategy,weights,counts,start:readNext()});
  setPreview({...plan,strategy});
 }
 function changeAgent(caseId,agent){setPreview(p=>({...p,items:p.items.map(i=>i.case.case_id===caseId?{...i,agent,reason:'Changed by supervisor'}:i)}))}
 async function confirm(){
  await act(async()=>{
   const {data,error}=await supabase.from('retention_care_queue').select('case_id,case_status,assigned_agent_id');
   if(error)throw error;
   const fresh=new Map(data.map(r=>[r.case_id,r]));
   const valid=preview.items.filter(i=>{const r=fresh.get(i.case.case_id);return r&&!r.assigned_agent_id&&r.case_status!=='closed'});
   let next=0,failed=0;
   async function worker(){while(next<valid.length){const i=valid[next++];try{await rpc('retention_assign_case',{p_case_id:i.case.case_id,p_agent_id:i.agent})}catch{failed++}}}
   await Promise.all(Array.from({length:Math.min(5,valid.length)},worker));
   if(preview.strategy==='round_robin')saveNext(preview.next);
   const skipped=preview.items.length-valid.length+failed;
   setResult(`Assigned ${valid.length-failed} of ${preview.items.length} cases.${skipped?` Skipped ${skipped} that were no longer unassigned or failed.`:''}${preview.unassigned.length?` ${preview.unassigned.length} cases stay unassigned because every selected agent is at capacity.`:''}`);
   setPreview(null);await load();
  });
 }
 function manual(row,agent){
  if(agent&&(counts[agent]||0)>=OPEN_LIMIT&&!window.confirm(`${name(agent)} already has ${counts[agent]} open cases (limit ${OPEN_LIMIT}). Assign anyway?`))return;
  return act(async()=>{await rpc('retention_assign_case',{p_case_id:row.case_id,p_agent_id:agent||null});await load()},'Case owner updated.');
 }
 const term=search.trim().toLowerCase();
 const list=scoped.filter(r=>`${r.display_name} ${r.customer_ref} ${r.contract_ref}`.toLowerCase().includes(term)).sort((a,b)=>(!!a.assigned_agent_id-!!b.assigned_agent_id)||byPriority(a,b));
 const summary=preview?summarize(preview.items):{};
 return <>
  <div className="page-title"><div><h1>Case Assignment</h1><p>Assign at-risk customers to Customer Care agents.</p></div></div>
  <section className="card queue-head"><div className="filters"><input aria-label="Search customer or contract" placeholder="Search customer or contract ID" value={search} onChange={e=>setSearch(e.target.value)}/><PeriodFilter rows={all} sel={sel} setSel={setSel}/></div>
   <p className="muted">{rows===null?'Loading cases…':`${scoped.length} cases in the selected period · ${unassigned.length} unassigned · ${agents.length} active agents`}</p></section>

  <section className="card"><h2>Auto-assign</h2>
   <p className="muted">Assigns every unassigned, open case in the selected period, highest churn risk first. Nothing is saved until you confirm.</p>
   <h3>Agents</h3>
   <div className="agent-grid">{agents.map(a=>{const n=counts[a.user_id]||0;return <label key={a.user_id} className="agent-pick"><input type="checkbox" checked={picked.includes(a.user_id)} onChange={e=>setChosen(picked.includes(a.user_id)?picked.filter(x=>x!==a.user_id):[...picked,a.user_id])}/><span><strong>{a.display_name}</strong><small>{n}/{OPEN_LIMIT} open cases</small><span className="bar"><i style={{width:Math.min(100,n/OPEN_LIMIT*100)+'%'}} className={n>=OPEN_LIMIT?'full':''}/></span></span></label>})}{!agents.length&&<p className="empty">No active agents.</p>}</div>
   <p className="muted">Daily new-case limit is not checked here. Open-case limit is {OPEN_LIMIT} per agent.</p>
   <h3>Method</h3>
   <div className="method">
    <label className={`method-opt ${strategy==='round_robin'?'on':''}`}><input type="radio" name="strategy" checked={strategy==='round_robin'} onChange={()=>{setStrategy('round_robin');setPreview(null)}}/><span><strong>Round-robin</strong><small>Take turns across the selected agents and skip anyone at capacity.</small></span></label>
    <label className={`method-opt ${strategy==='weighted'?'on':''}`}><input type="radio" name="strategy" checked={strategy==='weighted'} onChange={()=>{setStrategy('weighted');setPreview(null)}}/><span><strong>Weighted</strong><small>Score each agent by continuity, skill and workload.</small></span></label>
   </div>
   {strategy==='weighted'&&<div className="weights"><div className="row">{[['continuity','Continuity'],['skill','Skill'],['load','Load']].map(([k,t])=><label key={k}>{t} %<input type="number" min="0" max="100" value={weights[k]} onChange={e=>{setWeights(w=>({...w,[k]:Number(e.target.value)}));setPreview(null)}}/></label>)}<button type="button" onClick={()=>{setWeights(suggestedWeights);setPreview(null)}}>Reset to suggested</button></div>
    <p className={weightsOk?'muted':'weights-error'}>Total {total}%{weightsOk?'':' · weights must add up to 100%'}</p>
    <p className="muted">Continuity and skill need care history that isn't connected yet, so they count as 0. For now Weighted balances workload.</p></div>}
   <div className="row"><button type="button" className="primary" disabled={!canPreview} onClick={runPreview}>Preview</button>{!unassigned.length&&rows&&<span className="muted">No unassigned cases in this period.</span>}</div>
   {result&&<p className="advice" role="status">{result}</p>}
   {preview&&<div className="preview">
    <h3>Proposed assignment</h3>
    <div className="chips">{Object.entries(summary).map(([id,n])=><span key={id} className="count">{name(id)} · {n} new</span>)}</div>
    {!!preview.unassigned.length&&<p className="weights-error">{preview.unassigned.length} cases cannot be assigned because every selected agent is at capacity.</p>}
    <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Risk</th><th>Agent</th><th>Score</th><th>Reason</th></tr></thead><tbody>{preview.items.slice(0,100).map(i=><tr key={i.case.case_id}><td><strong>{i.case.display_name}</strong><small>{i.case.contract_ref}</small></td><td><span className="risk">{(i.case.churn_probability*100).toFixed(1)}%</span></td><td><select aria-label={`Agent for ${i.case.display_name}`} value={i.agent} onChange={e=>changeAgent(i.case.case_id,e.target.value)}>{agents.map(a=><option key={a.user_id} value={a.user_id}>{a.display_name}</option>)}</select></td><td>{i.score==null?'—':i.score.toFixed(1)}</td><td>{i.reason}</td></tr>)}</tbody></table></div>
    {preview.items.length>100&&<p className="muted">Showing the first 100 of {preview.items.length} proposals. All are assigned on confirm.</p>}
    <div className="row"><button type="button" className="primary" onClick={confirm}>Confirm assignment</button><button type="button" onClick={()=>setPreview(null)}>Discard</button></div>
   </div>}
  </section>

  <section className="card"><h2>Cases</h2>
   <p className="muted">Assign or change the owner of a single case. Unassigned cases are listed first.</p>
   <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Risk</th><th>Care stage</th><th>Owner</th></tr></thead><tbody>{list.slice(0,limit).map(r=><tr key={r.case_id}><td><strong>{r.display_name}</strong><small>{r.contract_ref}</small></td><td><span className="risk">{(r.churn_probability*100).toFixed(1)}%</span></td><td>{stages.find(s=>s.id===pipelineStage(r))?.title}</td><td><select aria-label={`Owner of ${r.display_name}`} disabled={r.case_status==='closed'} value={r.assigned_agent_id||''} onChange={e=>manual(r,e.target.value)}><option value="">Unassigned</option>{agents.map(a=><option key={a.user_id} value={a.user_id}>{a.display_name} · {counts[a.user_id]||0}/{OPEN_LIMIT} open</option>)}</select></td></tr>)}</tbody></table></div>
   {list.length>limit&&<div className="row"><button type="button" onClick={()=>setLimit(n=>n+50)}>Show 50 more</button><span className="muted">Showing {limit} of {list.length}</span></div>}
   {rows&&!list.length&&<p className="empty">No cases match.</p>}
  </section>
 </>;
}
