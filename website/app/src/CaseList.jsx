import React,{useEffect,useState} from 'react';
import {supabase} from './client';
import {filterQueue,stages,pipelineStage} from './data';
import useAutoRefresh from './useAutoRefresh';

export default function CaseList({staff,selected,onSelect,act}){
 const [rows,setRows]=useState(null),[search,setSearch]=useState('');
 async function load(){const {data,error}=await supabase.from('retention_care_queue').select('*').order('churn_probability',{ascending:false});if(error)throw error;setRows(data)}
 useEffect(()=>{act(load)},[]);
 useAutoRefresh(load,staff.user_id);
 const shown=filterQueue(rows||[],search,'',staff.role==='agent',staff.user_id);
 return <div className="case-list"><h2>Conversations</h2><input aria-label="Search customer or contract" placeholder="Search customer or contract ID" value={search} onChange={e=>setSearch(e.target.value)}/>
  <div className="case-items">{shown.map(r=><button key={r.case_id} type="button" aria-current={r.case_id===selected?'true':undefined} className={`case-item ${r.case_id===selected?'selected':''}`} onClick={()=>onSelect(r.case_id)}><strong>{r.display_name}</strong><small>{r.contract_ref}</small><span className="row"><span className="risk">{(r.churn_probability*100).toFixed(1)}%</span><small>{stages.find(s=>s.id===pipelineStage(r))?.title}</small></span></button>)}
  {rows&&!shown.length&&<p className="empty">No cases</p>}{!rows&&<p className="empty">Loading…</p>}</div></div>;
}
