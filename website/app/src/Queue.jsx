import React,{useEffect,useState} from 'react';
import useAutoRefresh from './useAutoRefresh';
import {supabase} from './client';
import {filterQueue,monthNames,careStage} from './data';
import CareBoards from './CareBoards';
const openStages=['intake','outreach','resolution'];
export default function Queue({staff,act,open,embedded=false,previewRows,agents=[]}){
 const [rows,setRows]=useState(null),[search,setSearch]=useState(''),[sel,setSel]=useState(null),[owner,setOwner]=useState('');
 async function load(){
  let next=previewRows;
  if(!next){const {data,error}=await supabase.from('retention_care_queue').select('*').order('churn_probability',{ascending:false});if(error)throw error;next=data}
  setRows(next);setSel(v=>{if(v)return v;const latest=next.map(r=>r.target_period_start).sort().at(-1)||'';return {year:latest.slice(0,4),mon:latest.slice(5,7)}});
 }
 useEffect(()=>{act(load)},[previewRows]);
 const syncError=useAutoRefresh(load,staff?.user_id);
 const all=rows||[],years=[...new Set(all.map(r=>r.target_period_start.slice(0,4)))].sort().reverse();
 const scoped=all.filter(r=>(!sel?.year||r.target_period_start.slice(0,4)===sel.year)&&(!sel?.mon||r.target_period_start.slice(5,7)===sel.mon)),filtered=filterQueue(scoped,search,'',staff?.role==='agent',staff?.user_id,owner);
 return <>{!embedded&&<><div className="page-title"><div><h1>Customer Care Queue</h1><p>One-month churn risk · Updated on days 1, 11 and 21.</p></div></div>
 <p style={{margin:'0 0 8px'}}><span style={{display:'inline-block',background:'var(--primary)',color:'white',fontSize:13,fontWeight:700,letterSpacing:'1px',padding:'3px 12px',borderRadius:4}}>TODAY</span></p><div className="stats"><section><i className="stat-ic" aria-hidden="true"/><small>At-risk customers in your scope</small><strong>{rows?new Set(all.map(r=>r.customer_ref)).size:'—'}</strong><p>Model prediction above the alert threshold</p></section><section><i className="stat-ic" aria-hidden="true"/><small>Open cases</small><strong>{rows?all.filter(r=>openStages.includes(r.care_stage||careStage(r.case_status))).length:'—'}</strong><p>From new prediction to resolving request</p></section><section><i className="stat-ic" aria-hidden="true"/><small>Technical referrals sent</small><strong>{rows?all.reduce((n,r)=>n+Number(r.support_referrals),0):'—'}</strong><p>Requests sent to Technical Support</p></section></div>
 <p className="muted" role="status">{syncError||'Live updates on · Checks every 3 seconds'}</p></>}{embedded&&syncError&&<p role="alert" className="error">{syncError}</p>}
 <section className="card queue-head"><div className="filters"><input aria-label="Search customer or contract" placeholder="Search customer or contract ID" value={search} onChange={e=>setSearch(e.target.value)}/>{embedded&&<select aria-label="Filter by assignee" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">All agents</option><option value="unassigned">Unassigned</option>{agents.map(a=><option key={a.id} value={a.id}>{a.name}{a.active===false?' · Inactive':''}</option>)}</select>}<select aria-label="Filter by month" value={sel?.mon??''} onChange={e=>setSel(v=>({...v,mon:e.target.value}))}><option value="">All months</option>{monthNames.map((n,i)=><option key={n} value={String(i+1).padStart(2,'0')}>{n}</option>)}</select><select aria-label="Filter by year" value={sel?.year??''} onChange={e=>setSel(v=>({...v,year:e.target.value}))}><option value="">All years</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></div>
 {rows===null?<p role="status">Loading care queue…</p>:<p className="muted">Showing {filtered.length} of {scoped.length} cases in your scope{sel?.mon||sel?.year?` for ${[sel.mon&&monthNames[Number(sel.mon)-1],sel.year].filter(Boolean).join(' ')}`:''}.</p>}</section>
 <CareBoards rows={filtered} open={open} showOutcome={!embedded}/></>
}
