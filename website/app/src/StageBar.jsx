import React,{useEffect,useState} from 'react';
import {rpc} from './client';
import {careStage,failReasons} from './data';

const steps=[
 {id:'intake',title:'New predictions',status:'new'},
 {id:'outreach',title:'Outreach',status:'in_progress'},
 {id:'resolution',title:'Resolving request',status:'resolving_request'},
 {id:'care_completed',title:'Care completed',status:'closed'},
 {id:'failed',title:'Failed',status:'closed'}
];
export default function StageBar({detail,busy,act,reload}){
 const c=detail.case,current=careStage(c.case_status,c.contact_result),index=steps.findIndex(s=>s.id===current);
 const [open,setOpen]=useState(false),[closing,setClosing]=useState(false),[failing,setFailing]=useState(false),[reason,setReason]=useState(''),[failReason,setFailReason]=useState(''),[failNote,setFailNote]=useState('');
 const submitted=detail.support_requests.some(t=>t.handoff_status!=='draft');
 const failedWhy={no_answer:'No answer to calls',wrong_contact:'Wrong number'}[c.contact_result];
 const failSuggest=c.case_status!=='closed'&&failedWhy;
 const suggest=!failSuggest&&index<2&&(submitted||c.contact_result==='contacted');
 const move=(status,closeReason=null,done='Care stage updated. Retention outcome is unchanged.',contact=c.contact_result)=>act(async()=>{await rpc('retention_update_case',{p_case_id:c.id,p_status:status,p_contact_result:contact,p_close_reason:closeReason});setClosing(false);setFailing(false);setReason('');setFailReason('');setFailNote('');await reload()},done);
 const chosen=failReasons.find(f=>f.id===failReason);
 useEffect(()=>{if(!open)return;const close=e=>{if(!e.target.closest('.stage-menu'))setOpen(false)};document.addEventListener('click',close);return()=>document.removeEventListener('click',close)},[open]);
 function pick(step){
  setOpen(false);
  if(step.id===current)return;
  if(step.id==='care_completed'){setFailing(false);setClosing(true);return}
  if(step.id==='failed'){setClosing(false);setFailing(true);return}
  setClosing(false);setFailing(false);move(step.status);
 }
 return <>
  <div className="stage-menu"><button type="button" className="stage-trigger" aria-haspopup="true" aria-expanded={open} disabled={busy} onClick={()=>setOpen(v=>!v)}>Stage: <strong>{steps.find(x=>x.id===current)?.title}</strong> <span aria-hidden="true">▾</span></button>
  {open&&<div className="stage-bar stage-pop"><ol aria-label="Care stage">{steps.map((s,i)=><li key={s.id}><button type="button" disabled={busy} aria-current={s.id===current?'step':undefined} className={`stage ${s.id===current?'current':i<index?'past':''}`} onClick={()=>pick(s)}>{s.title}</button></li>)}</ol></div>}</div>
  <div className="stage-notices">
  {failSuggest&&<div className="stage-suggest"><span>Contact result: {failedWhy}. Suggested next step:</span><button type="button" className="primary" disabled={busy} onClick={()=>move('closed','Failed: '+failedWhy,'Care marked as failed.',c.contact_result)}>Move to Failed</button></div>}
  {suggest&&<div className="stage-suggest"><span>{submitted?'Ticket submitted.':'Customer contacted.'} Suggested next step:</span><button type="button" className="primary" disabled={busy} onClick={()=>move('resolving_request')}>Move to Resolving request</button></div>}
  {failing&&<div className="stage-close"><label>Why did care fail?<select autoFocus value={failReason} onChange={e=>setFailReason(e.target.value)}><option value="">Select a reason</option>{failReasons.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select></label>{failReason==='other'&&<label>Details<input value={failNote} onChange={e=>setFailNote(e.target.value)} placeholder="Describe what happened"/></label>}<button type="button" className="primary" disabled={busy||!chosen||(failReason==='other'&&!failNote.trim())} onClick={()=>move('closed','Failed: '+(failReason==='other'?failNote.trim():chosen.title),'Care marked as failed.',chosen.contact)}>Mark as failed</button><button type="button" onClick={()=>setFailing(false)}>Cancel</button><small>Failing care closes the case and cancels outstanding follow-ups, unsent delivery and queued AI requests.</small></div>}
  {closing&&<div className="stage-close"><span>Mark care as completed?</span><button type="button" className="primary" disabled={busy} onClick={()=>move('closed',null,'Care stage updated. Retention outcome is unchanged.','contacted')}>Complete care</button><button type="button" onClick={()=>setClosing(false)}>Cancel</button><small>Completing care cancels outstanding follow-ups, unsent delivery and queued AI requests. It does not confirm retention.</small></div>}
  </div></>;
}
