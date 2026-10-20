import React,{useEffect,useRef,useState} from 'react';
import {rpc} from './client';
import {date,label,externalMessages} from './data';
import AIRequestButton from './AIRequestButton';
import {ticketCategories,ticketDepartments,ticketForm,ticketPayload,clarificationInstructions,ticketSourceChanged} from './ticket';

export default function SupportTicket({detail,jobs,busy,act,reload,request,clarify}){
 const tickets=[...detail.support_requests].sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const [record,setRecord]=useState(tickets[0]||null),[form,setForm]=useState(()=>ticketForm(tickets[0])),[dirty,setDirty]=useState(false);
 const requestKey=useRef(crypto.randomUUID()),clicked=useRef(false);
 const latest=tickets[0],current=tickets.find(t=>t.id===record?.id),closed=detail.case.case_status==='closed';
 const conversation=externalMessages(detail.messages).sort((a,b)=>(a.sent_at||a.created_at).localeCompare(b.sent_at||b.created_at)||a.id.localeCompare(b.id));
 const hasChat=conversation.some(m=>m.direction==='inbound'),editable=!record||record.handoff_status==='draft';
 function select(row){setRecord(row);setForm(ticketForm(row));setDirty(false);requestKey.current=crypto.randomUUID()}
 useEffect(()=>{if(!dirty&&latest?.source_job_id&&latest.id!==record?.id)select(latest)},[latest?.id]);
 useEffect(()=>{if(!dirty&&current&&JSON.stringify(current)!==JSON.stringify(record))select(current)},[current?.version,current?.handoff_status]);
 function change(field,value){setForm(f=>({...f,[field]:value}));setDirty(true)}
 async function save(){const saved=await rpc('retention_save_ticket',{p_case_id:detail.case.id,p_ticket:ticketPayload(form),p_request_key:requestKey.current,p_ticket_id:record?.id||null,p_expected_version:record?.version||null});select(saved);await reload();return saved}
 async function submit(){if(clicked.current)return;clicked.current=true;try{await act(async()=>{await rpc('retention_submit_ticket',{p_ticket_id:record.id,p_expected_version:record.version});await reload()},'Ticket submitted for simulated handoff. The demo operator processes the queue.')}finally{clicked.current=false}}
 return <div className="support-ticket"><div className="row"><h3>Chat-to-Ticket</h3><span className="badge">{record?.source_job_id?'AI draft':'Manual draft'}</span><AIRequestButton type="ticket" jobs={jobs} request={request} act={act} disabled={busy||closed||!hasChat||dirty}>Draft ticket from chat</AIRequestButton></div>
 <p className="muted">Chat only · AI drafts are saved separately. Staff reviews every ticket before submission.</p>
 {!hasChat&&<p className="ticket-info">No conversation yet. Add customer messages before generating an AI draft.</p>}
 {dirty&&<p className="muted">Unsaved changes. Save this draft before requesting another AI draft.</p>}
 {ticketSourceChanged(record,conversation)&&<p className="advice" role="status">New messages received since this draft. Review the conversation or generate a new draft.</p>}
 <fieldset disabled={busy||closed||!editable}><label>Description<textarea rows="5" maxLength="10000" value={form.description} onChange={e=>change('description',e.target.value)} placeholder="Describe the customer issue, or draft it from the conversation…"/></label>
 <div className="row"><label>Category<select value={form.category} onChange={e=>change('category',e.target.value)}><option value="">Select category</option>{Object.entries(ticketCategories).map(([value,title])=><option key={value} value={value}>{title}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e=>change('priority',e.target.value)}><option value="">Select priority</option>{['low','normal','high'].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label></div>
 <label>Receiving department<input readOnly value={ticketDepartments[form.category]||''} placeholder="Select a category to route the ticket"/></label>
 <div className="row"><label>Repeat issue<select value={form.repeat_issue} onChange={e=>change('repeat_issue',e.target.value)}>{['unknown','yes','no'].map(v=><option key={v} value={v}>{label(v)}</option>)}</select></label><label>Churn concern<select value={form.churn_concern} onChange={e=>change('churn_concern',e.target.value)}>{[['unknown','Unknown'],['explicit','Explicit cancellation concern'],['not_observed','Not observed in chat']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></label></div>
 <label>Preferred contact time<input maxLength="500" value={form.preferred_contact_time} onChange={e=>change('preferred_contact_time',e.target.value)} placeholder="Optional, as requested by the customer"/></label>
 <label>Information to confirm (one detail per line)<textarea rows="2" value={form.missing_fields.join('\n')} onChange={e=>change('missing_fields',e.target.value.split('\n'))}/></label>
 </fieldset>
 {!!record?.evidence?.length&&<div className="ticket-info"><strong>AI evidence from conversation</strong>{record.evidence.map((e,i)=><p key={i}><b>{label(e.field)}</b> · “{e.quote}”<small>Original AI suggestion · Review again after editing fields</small></p>)}</div>}
 {!!form.missing_fields.filter(s=>s.trim()).length&&<div className="advice"><strong>Information to confirm</strong><ul>{form.missing_fields.filter(s=>s.trim()).map((f,i)=><li key={i}>{f}</li>)}</ul><button disabled={busy||closed||!editable} onClick={()=>act(async()=>{await save();await clarify(clarificationInstructions(form.missing_fields.filter(s=>s.trim())))})}>Draft clarification message</button><small>Creates an AI message draft for review in the Message tab. Nothing is sent automatically.</small></div>}
 <div className="row"><button disabled={busy||closed||!editable||!form.description.trim()||record&&!dirty} onClick={()=>act(save,'Ticket draft saved. Review before submitting.')}>Save draft</button><button className="primary" disabled={busy||closed||!editable||!record||dirty||!form.category||!form.priority} onClick={submit}>Submit ticket</button><button disabled={busy||dirty} onClick={()=>select(null)}>New draft</button><span className="muted">{record?label(record.handoff_status):'Not submitted'}{record?.submitted_at?' · Submitted '+date(record.submitted_at):''}</span></div>
 <p className="muted">Staff review required. AI never submits tickets automatically. Simulated handoff; appointments are not confirmed.</p>
 {record?.external_receipt&&<p className="ticket-info">Simulated receipt: {record.external_receipt}</p>}
 <h3>Saved tickets</h3>{tickets.length?tickets.map(t=><article className="saved" key={t.id}><p>{t.request_body}</p><small>{date(t.created_at)} · {t.department||'Department not selected'} · {label(t.handoff_status)}</small><button disabled={busy||dirty} onClick={()=>select(t)}>View / review</button></article>):<p className="muted">No saved tickets yet.</p>}
 </div>;
}
