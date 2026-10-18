import React,{useState} from 'react';
import {rpc} from './client';
import {date} from './data';
export default function Notes({detail,busy,act,reload}){
 const [body,setBody]=useState('');
 return <><h3>Staff notes</h3><p className="muted">Internal only. Notes are never included in the customer portal or AI conversation context.</p><label>New internal note<textarea rows="6" maxLength="10000" value={body} onChange={e=>setBody(e.target.value)} placeholder="Record verified concerns, call results and agreed next steps…"/></label><button disabled={busy||!body.trim()||detail.case.case_status==='closed'} onClick={()=>act(async()=>{await rpc('retention_save_draft',{p_case_id:detail.case.id,p_body:body,p_request_key:crypto.randomUUID(),p_internal:true});setBody('');await reload()},'Internal note saved.')}>Save internal note</button>{detail.messages.filter(m=>m.visibility==='internal').map(m=><article className="saved" key={m.id}><p>{m.body}</p><small>{date(m.created_at)}</small></article>)}</>
}
