import React,{useEffect,useState} from 'react';
import {rpc,supabase} from './client';
import {dashboardMetrics,careNames,rate,localDay,issueBreakdown} from './dashboard.js';
import CareBoards from './CareBoards';
import './dashboard.css';

// The dashboard RPC has no contact result, customer name or assignment time; read them from the care queue view
// and case.assigned events (same RLS scope).
async function loadLive(){
 const [data,queue,assignments,roles]=await Promise.all([rpc('retention_supervisor_dashboard'),
  supabase.from('retention_care_queue').select('case_id,display_name,contact_result,churn_probability'),
  supabase.from('interaction_events').select('case_id,occurred_at').eq('event_type','case.assigned').order('occurred_at'),
  supabase.from('staff_members').select('user_id,role')]);
 for(const r of [queue,assignments,roles])if(r.error)throw r.error;
 const byId=new Map(queue.data.map(r=>[r.case_id,r])),assignedAt=new Map(assignments.data.map(e=>[e.case_id,e.occurred_at])),role=new Map(roles.data.map(s=>[s.user_id,s.role]));
 return {...data,staff:data.staff.map(s=>({...s,role:role.get(s.id)})),cases:data.cases.map(c=>({...c,contact:c.contact??byId.get(c.id)?.contact_result??null,name:byId.get(c.id)?.display_name,probability:byId.get(c.id)?.churn_probability,assigned_at:assignedAt.get(c.id)??null}))};
}
const fmt=value=>new Intl.NumberFormat('en').format(value);
function Bars({items,onSelect}){const max=Math.max(1,...items.map(i=>i.value));return <div className="dash-bars">{items.map((i,index)=><button key={i.label} className="dash-bar" onClick={()=>onSelect?.(i)} disabled={!onSelect} aria-label={`${i.label}: ${i.value}`}><span>{i.label}</span><span className="dash-bar-track"><span style={{width:`${i.value/max*100}%`,background:i.color||['var(--primary)','var(--link)','var(--warn)','#8a80bf','var(--muted)'][index%5]}}/></span><strong>{fmt(i.value)}</strong></button>)}</div>}
function Panel({title,note,children,action}){return <section className="card dash-panel"><div className="row"><h2>{title}</h2>{action}</div>{note&&<p className="muted">{note}</p>}{children}</section>}
function Stats({items}){return <div className="stats dash-stats">{items.map(([title,value,note,onClick])=><section key={title} role="button" tabIndex={0} onClick={onClick} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onClick()}}}><i className="stat-ic" aria-hidden="true"/><small>{title}</small><strong>{typeof value==='number'?fmt(value):value}</strong><p>{note}</p></section>)}</div>}
const attentionTypes=[['Unassigned','var(--danger)'],['Not yet cared','var(--warn)'],['Support request not handed off','#8a80bf'],['Message not delivered','var(--muted)']];
export default function Dashboard({preview=false,openCase}){
 const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(false);
 const [cohort,setCohort]=useState(''),[owner,setOwner]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[inspection,setInspection]=useState(null),[search,setSearch]=useState(''),[reason,setReason]=useState(''),[tab,setTab]=useState('performance');
 async function load(){setLoading(true);setError('');try{let next;if(preview){const res=await fetch('/__dashboard-fixture.json');if(!res.ok)throw new Error('Local fixture unavailable. Run the dashboard seed script.');next=await res.json()}else next=await loadLive();setData(next)}catch(e){setError(e.message)}finally{setLoading(false)}}
 useEffect(()=>{load()},[preview]);
 useEffect(()=>{function onKey(e){if(e.key==='Escape')setInspection(null)}window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
 if(!data)return <section className="card"><h1>Supervisor Dashboard</h1>{error?<p role="alert">{error}</p>:<p role="status">Loading dashboard…</p>}<button onClick={load} disabled={loading}>Retry</button></section>;
 const metrics=dashboardMetrics(data,{cohort,owner,from,to}),m=metrics;
 const issues=issueBreakdown(m.cases,data.as_of),issueMax=Math.max(1,...issues.map(i=>i.cases.length));
 const cohorts=[...new Set(data.cases.map(c=>c.start))].sort().reverse();
 const staffName=id=>data.staff.find(s=>s.id===id)?.name||'Unassigned';
 const inspect=(title,cases,opts={})=>{setSearch('');setReason(opts.reason||'');setInspection({title,cases,reasons:!!opts.reasons})};
 const shown=inspection?inspection.cases.filter(c=>`${c.ref} ${staffName(c.owner)}`.toLowerCase().includes(search.toLowerCase())&&(!reason||c.reasons?.includes(reason))):[];
 const attentionItems=attentionTypes.map(([label,color])=>({label,color,value:m.attention.filter(c=>c.reasons.includes(label)).length}));
 const rows=m.cases.map(c=>({case_id:c.id,display_name:c.name||c.ref,contract_ref:c.ref,churn_probability:c.probability??(c.score==null?null:c.score/1000),case_owner:c.owner?staffName(c.owner):null,case_status:c.stage,contact_result:c.contact,outcome_churned:c.outcome}));
 const knownGroups=[{label:'Active at period end',value:m.active.length,color:'var(--success)',cases:m.active},{label:'Churned',value:m.churned.length,color:'var(--danger)',cases:m.churned},{label:'Missing outcome',value:m.missing,color:'var(--warn-tag)',cases:m.eligible.filter(c=>c.outcome===null)},{label:'Awaiting period end',value:m.awaiting,color:'var(--border-control)',cases:m.cases.filter(c=>!m.eligible.includes(c))}];
 return <div className="dashboard"><div className="page-title"><div><h1>Supervisor Dashboard</h1><p>Care performance from current case work · Period outcomes updated by the system after each target period.</p></div><small className="muted">Updated {new Date(data.as_of).toLocaleString('en-GB',{timeZone:'Asia/Ho_Chi_Minh'})} ICT</small><button onClick={load} disabled={loading}>{loading?'Refreshing…':'↻ Refresh data'}</button></div>
 {error&&<p className="error" role="alert">Refresh failed: {error}. Showing the previous data.</p>}
 <section className="card queue-head dash-filters" aria-label="Dashboard filters"><div className="filters"><select aria-label="Prediction cohort" value={cohort} onChange={e=>setCohort(e.target.value)}><option value="">All prediction cohorts</option>{cohorts.map(c=><option key={c} value={c}>{c} → {data.cases.find(x=>x.start===c).end} (exclusive)</option>)}</select><select aria-label="Current case owner" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">All agents</option>{data.staff.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}<option value="unassigned">Unassigned</option></select><label>Activity from<input type="date" value={from} max={to||localDay(data.as_of)} onChange={e=>setFrom(e.target.value)}/></label><label>Activity through<input type="date" value={to} min={from} max={localDay(data.as_of)} onChange={e=>setTo(e.target.value)}/></label><button onClick={()=>{setCohort('');setOwner('');setFrom('');setTo('')}}>Reset</button></div><p className="muted">Showing {m.cases.length} cases · Workload = current state · Activity = selected dates · Outcomes = full prediction windows</p></section>

 <div className="dash-tabs" role="tablist" aria-label="Dashboard sections">{[['performance','Care performance'],['outcome','Period outcome']].map(([id,title])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'on':''} onClick={()=>setTab(id)}>{title}</button>)}</div>
 {tab==='performance'&&<>
 <Stats items={[
  ['Open cases',m.open.length,'From new prediction to resolving request',()=>inspect('Open cases',m.open)],
  ['Unassigned',m.unassigned.length,'Open cases needing an owner',()=>inspect('Unassigned',m.unassigned)],
  ['Not yet cared',`${fmt(m.notCared.length)} / ${fmt(m.assigned.length)}`,`Assigned ${from||to?'in the selected dates':'cases'} still in New predictions`,()=>inspect('Not yet cared',m.notCared)],
  ['Technical referrals sent',m.tickets.filter(t=>t.status==='sent').length,'Requests sent to Technical Support',()=>inspect('Technical referrals sent',m.cases.filter(c=>m.tickets.some(t=>t.case_id===c.id&&t.status==='sent')))]
 ]}/>
 <div className="dash-grid"><Panel title="Where care stands" note="Current care stage · Same stages as the Care pipeline"><Bars items={m.stages} onSelect={item=>inspect(item.label,m.cases.filter(c=>c.care===item.stage))}/></Panel>
 <Panel title="Needs attention" note={`${m.attention.length} open cases flagged · A case can match more than one type`} action={<button onClick={()=>inspect('Needs attention',m.attention,{reasons:true})}>View all</button>}><Bars items={attentionItems} onSelect={i=>inspect('Needs attention',m.attention,{reasons:true,reason:i.label})}/>{!m.attention.length&&<p className="empty">No open cases flagged by the available rules.</p>}</Panel></div>
 <CareBoards rows={rows} open={preview?null:openCase} showOutcome={false}/>
 <Panel title="Team workload & activity" note="Not yet cared = cases assigned in the selected dates still in New predictions. Open work belongs to the current owner. Sent activity belongs to the reviewer of the delivered message.">
 <div className="table-scroll"><table><thead><tr><th>Team member</th><th>Not yet cared / assigned</th><th>Open now</th><th>Sent messages</th><th>Submitted tickets</th><th/></tr></thead><tbody>{m.team.map(s=><tr key={s.id||'none'}><td><span className="dash-avatar">{s.name[0]}</span><strong>{s.name}</strong></td><td>{s.id?<span className={s.notCared?'dash-danger':''}>{s.notCared} / {s.assigned}</span>:'—'}</td><td>{s.open}</td><td>{s.id?s.sent:'—'}</td><td>{s.id?s.tickets:'—'}</td><td><button onClick={()=>inspect(`${s.name} · current cases`,m.cases.filter(c=>c.owner===s.id))}>View cases ↗</button></td></tr>)}</tbody></table></div><p className="muted">Ticket activity uses the submitter where recorded; legacy requests fall back to the recorded requester. No productivity ranking or inferred retention impact.</p></Panel>

 </>}
 {tab==='outcome'&&<>
 <p className="muted dash-tab-note">Updated by the system after each complete target period.</p>
 <Stats items={[
  ['Active at period end',rate(m.active.length,m.known.length)||'—',m.known.length?`${m.active.length} / ${m.known.length} known outcomes`:'No known outcomes yet',()=>inspect('Active at period end',m.active)],
  ['Observed churn rate',rate(m.churned.length,m.known.length)||'—',`${m.churned.length} churned in completed windows`,()=>inspect('Churned',m.churned)],
  ['Outcome coverage',rate(m.known.length,m.eligible.length)||'—',`${m.known.length} / ${m.eligible.length} completed windows have an outcome`,()=>inspect('Missing outcome',m.eligible.filter(c=>c.outcome===null))],
  ['Awaiting period end',m.awaiting,'Target period not complete · outcome unknown',()=>inspect('Awaiting period end',m.cases.filter(c=>!m.eligible.includes(c)))]
 ]}/>
 <CareBoards rows={rows} open={preview?null:openCase} showCare={false}/>
 <p className="muted dash-caution">Continued service does not prove an effect of care. Outcomes are observed only after the complete target period.</p>
 <Panel title="Observed service outcomes" note="Mature windows only · Missing = period complete but no outcome recorded"><Bars items={knownGroups} onSelect={i=>inspect(i.label,i.cases)}/></Panel>
 <Panel title="Primary care issues · Contracts & churn" note="Completed windows first · Each contract uses its latest selected window. Groups describe the primary care issue, not a confirmed cause of churn.">
 <div className="dash-legend"><span><i style={{background:'var(--primary)'}}/>Contracts</span><span><i style={{background:'var(--danger)'}}/>Confirmed churn</span></div>
 <div className="dash-issues">{issues.map(i=><div className="dash-issue" key={i.label}><div className="dash-issue-label"><strong>{i.label}</strong><small>{i.known} / {i.cases.length} outcomes known{i.known?` · ${rate(i.churned.length,i.known)} churn rate`:''}</small></div><div>{[{label:'Contracts',value:i.cases.length,cases:i.cases,color:'var(--primary)'},{label:'Confirmed churn',value:i.known?i.churned.length:null,cases:i.churned,color:'var(--danger)'}].map(series=><button className="dash-issue-series" key={series.label} disabled={series.value===null} onClick={()=>inspect(`${i.label} · ${series.label}`,series.cases)} aria-label={`${i.label}: ${series.label} ${series.value??'not available'}`}><span className="dash-bar-track"><span style={{width:`${(series.value||0)/issueMax*100}%`,background:series.color}}/></span><strong>{series.value??'—'}</strong></button>)}</div></div>)}</div>
 {!issues.length&&<p className="empty">No contracts in this selection.</p>}
 <details><summary>View chart data</summary><table><thead><tr><th>Primary issue</th><th>Contracts</th><th>Known outcomes</th><th>Confirmed churn</th><th>Churn rate</th></tr></thead><tbody>{issues.map(i=><tr key={i.label}><td>{i.label}</td><td>{i.cases.length}</td><td>{i.known}</td><td>{i.known?i.churned.length:'Not available'}</td><td>{rate(i.churned.length,i.known)||'Not available'}</td></tr>)}</tbody></table></details>
 </Panel>
 </>}

 {inspection&&<div className="dash-overlay"><section className="dash-inspection" role="dialog" aria-modal="true" aria-label={inspection.title}><div className="row"><h2>{inspection.title}</h2><button autoFocus onClick={()=>setInspection(null)}>Close</button></div><p>{shown.length} matching cases</p><div className="row dash-inspect-filters"><label>Search cases<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Case reference or owner"/></label>{inspection.reasons&&<label>Attention type<select value={reason} onChange={e=>setReason(e.target.value)}><option value="">All types</option>{attentionTypes.map(([t])=><option key={t} value={t}>{t}</option>)}</select></label>}</div><div className="table-scroll"><table><thead><tr><th>Case</th>{inspection.reasons&&<th>Needs attention for</th>}<th>Owner</th><th>Care stage</th><th>Window</th><th>Outcome</th>{!preview&&<th/>}</tr></thead><tbody>{shown.map(c=><tr key={c.id}><td>{c.ref}</td>{inspection.reasons&&<td>{c.reasons.map(r=><span className="dash-tag" key={r}>{r}</span>)}</td>}<td>{staffName(c.owner)}</td><td>{careNames[c.care]}</td><td>{c.start} → {c.end}</td><td>{c.outcome===null?'Unknown':c.outcome?'Churned':'Active at period end'}</td>{!preview&&<td><button onClick={()=>openCase(c.id)}>Open case</button></td>}</tr>)}</tbody></table></div></section></div>}
 </div>;
}
