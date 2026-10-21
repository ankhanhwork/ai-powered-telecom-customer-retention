import React,{useState} from 'react';
import {rpc} from './client';
import {label,date,money,factValue,shapShare,careStage} from './data';
import AIRequestButton from './AIRequestButton';
import RewriteRequest from './RewriteRequest';
import Notes from './Notes';
import Progress from './Progress';
import ManualAssignment from './ManualAssignment';

const Badge=({children})=><span className="badge">{children}</span>;
const Empty=({children})=><p className="empty">{children}</p>;
const key=()=>crypto.randomUUID();

export function InfoTab({detail,staff,staffList,busy,act,load}){
 const {customer:c,case:cs,prediction:p}=detail,[reminder,setReminder]=useState('');
 const last=detail.outcomes.at(-1);
 return <div className="panel-tab">
  <div className="facts compact"><div>Contract<strong>{c.contract_ref}</strong></div><div>Plan<strong>{c.plan_name}</strong></div><div>Monthly fee<strong>{money(c.monthly_fee,c.currency)}</strong></div><div>Tenure<strong>{c.tenure_months??'Unknown'} months</strong></div><div>Churn risk<strong>{(p.churn_probability*100).toFixed(1)}%</strong></div><div>Last contact<strong>{date(cs.last_contact_at)}</strong></div><div>Retention outcome<strong>{last?label(last.churned===null?'unknown':last.churned?'churned':'active at period end'):'Unknown'}</strong></div></div>
  {cs.case_status==='closed'&&<div className={careStage(cs.case_status,cs.contact_result)==='failed'?'advice':'bx'}><strong>{careStage(cs.case_status,cs.contact_result)==='failed'?'Care failed':'Care completed'}</strong>{cs.close_reason&&<p>{cs.close_reason}</p>}<small>Contact result: {label(cs.contact_result)}</small></div>}
  {staff.role==='supervisor'&&<section className="panel-card"><ManualAssignment caseData={cs} agents={staffList} busy={busy} act={act} reload={load}/></section>}
  <section className="panel-card"><h3>Care follow-up</h3>
  <label>Set reminder (your local time)<input type="datetime-local" value={reminder} onChange={e=>setReminder(e.target.value)}/></label><button disabled={busy||!reminder} onClick={()=>act(async()=>{await rpc('retention_schedule_reminder',{p_case_id:cs.id,p_due_at:new Date(reminder).toISOString(),p_request_key:key()});setReminder('');await load()},'Reminder scheduled.')}>Set reminder</button>
  {detail.follow_up_tasks.map(t=><article className="saved" key={t.id}><strong>{label(t.task_type)}</strong><p>{date(t.due_at)} · {label(t.status)}</p>{['pending','due'].includes(t.status)&&<button disabled={busy} onClick={()=>act(async()=>{await rpc('retention_complete_task',{p_task_id:t.id});await load()})}>Complete task</button>}</article>)}
  <p className="muted">Automatic no-reply delay is a proposed setting. A reminder never sends a message automatically.</p></section>
  <Progress detail={detail} busy={busy} act={act} reload={load}/>
 </div>;
}

export function CallTab({detail,jobs,busy,act,load,request}){
 const cs=detail.case,closed=cs.case_status==='closed';
 const [view,setView]=useState('unused'),[instructions,setInstructions]=useState('');
 const results=detail.recommendations.filter(r=>r.generation_mode==='llm'&&r.request_key.startsWith('manual:call_script:')).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const shown=results.filter(r=>view==='used'?!!r.used_at:!r.used_at),current=shown[0];
 return <div className="panel-tab">
  <div className="row"><h3>Call script</h3><AIRequestButton type="call_script" jobs={jobs} request={(...a)=>{setView('unused');return request(...a)}} act={act} disabled={busy||closed}>Request AI call script</AIRequestButton></div>
  <div className="tabs" aria-label="Call script usage">{['unused','used'].map(v=><button key={v} aria-pressed={view===v} className={view===v?'active':''} onClick={()=>setView(v)}>{label(v)} ({results.filter(r=>v==='used'?!!r.used_at:!r.used_at).length})</button>)}</div>
  {shown.map(r=><article className="saved" key={r.id}><div className="call-script">{r.call_script}</div><small>{date(r.created_at)}{r.used_at?' · Used '+date(r.used_at):''}</small>{!r.used_at&&<button disabled={busy} onClick={()=>act(async()=>{await rpc('retention_mark_script_used',{p_recommendation_id:r.id});await load()},'Script moved to Used.')}>Mark as used</button>}</article>)}
  {!shown.length&&<Empty>No {view} AI call scripts.</Empty>}
  <details><summary>Rewrite the script</summary><RewriteRequest jobs={jobs} type="call_script" value={instructions} onChange={setInstructions} source={current?.call_script} busy={busy} closed={closed} request={request} act={act}/></details>
  <h3>Contact result</h3>
  <select aria-label="Contact result" value={cs.contact_result} disabled={busy} onChange={e=>act(async()=>{await rpc('retention_update_case',{p_case_id:cs.id,p_status:cs.case_status,p_contact_result:e.target.value,p_close_reason:cs.close_reason});await load()})}>{['not_contacted','no_answer','contacted','wrong_contact'].map(v=><option key={v} value={v}>{label(v)}</option>)}</select>
  <p className="muted">Staff makes the call. Record what the customer said in the note below, then set the contact result.</p>
  <Notes detail={detail} busy={busy} act={act} reload={load}/>
 </div>;
}

export function InsightsTab({detail,jobs,busy,act,request}){
 const cs=detail.case,p=detail.prediction;
 const context=detail.contexts?.[0]?.context,drivers=context?.drivers||[];
 const latestAI=detail.recommendations.filter(r=>r.generation_mode==='llm'&&r.request_key.startsWith('manual:explanation:')).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
 return <div className="panel-tab">
  <div className="row"><h3>AI explanation</h3><AIRequestButton type="explanation" jobs={jobs} request={request} act={act} disabled={busy||cs.case_status==='closed'}>Request AI explanation</AIRequestButton></div>
  {latestAI?<div className="advice"><p>{latestAI.rationale}</p><small>Generated by AI · {date(latestAI.created_at)} · Staff review required</small></div>:<Empty>No AI explanation requested yet. Facts below come from the stored customer snapshot.</Empty>}
  <p className="muted">AI runs only after a staff request. Results update automatically.</p>
  {jobs.filter(j=>j.request_key.startsWith('manual:explanation:')).slice(0,3).map(j=><p key={j.id}><Badge>{j.status==='queued'&&j.claimed_at?'Running':label(j.status)}</Badge> {date(j.created_at)}</p>)}
  <div className="row"><h3>Risk driver groups</h3><Badge>{(p.churn_probability*100).toFixed(1)}% churn risk</Badge></div>
  <p className="muted">Signals to help you verify the customer's situation. These are not confirmed reasons for leaving. Shares compare each group with the total increase above the model baseline, in log-odds, and can exceed 100% when other groups reduce risk. Facts describe the saved snapshot, not live usage.</p>
  <div className="drivers stacked">{drivers.map((d,i)=><article key={d.group_id||i}><div className="eyebrow">{String(d.rank).padStart(2,'0')} · {label(d.evidence_status)}</div><h3>{d.group_name}</h3><p><strong>{shapShare(context,d)}</strong> of net SHAP increase</p>{(d.facts||[]).map((f,j)=><p key={j}><strong>{f.label}: </strong>{d.evidence_status?.startsWith('Not applicable')?'Not applicable to prepaid billing':factValue(f)} {f.missing?'':f.unit}</p>)}</article>)}</div>
  {!drivers.length&&<Empty>Driver explanation unavailable. Ask the customer for context.</Empty>}
 </div>;
}
