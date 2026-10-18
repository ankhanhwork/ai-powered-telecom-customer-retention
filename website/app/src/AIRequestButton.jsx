import React,{useEffect,useRef,useState} from 'react';

export default function AIRequestButton({type,jobs,request,act,disabled,children,instructions=null,source=null}){
 const [submitting,setSubmitting]=useState(false),[jobId,setJobId]=useState(null),[done,setDone]=useState(false);
 const clicked=useRef(false);
 const pending=jobs.find(j=>j.status==='queued'&&j.request_key.startsWith(`manual:${type}:`));
 const tracked=jobs.find(j=>j.id===jobId);
 useEffect(()=>{if(pending)setJobId(pending.id)},[pending?.id]);
 useEffect(()=>{
  if(tracked?.status!=='completed')return;
  setDone(true);const timer=setTimeout(()=>{setDone(false);setJobId(null)},1800);
  return()=>clearTimeout(timer);
 },[tracked?.id,tracked?.status]);
 const running=submitting||!!pending,failed=tracked?.status==='failed',cancelled=tracked?.status==='cancelled';
 async function start(){
  if(clicked.current||running||done)return;
  clicked.current=true;setSubmitting(true);setDone(false);setJobId(null);
  try{await act(async()=>setJobId(await request(type,instructions,source)))}
  finally{clicked.current=false;setSubmitting(false)}
 }
 return <span className="ai-request"><button disabled={disabled||running||done} aria-busy={running} onClick={start}>
  {running?<><span className="spinner" aria-hidden="true"/>Working…</>:done?<><span aria-hidden="true">✓</span> Done</>:failed?'Request failed · Retry':cancelled?'Request cancelled · Retry':children}
 </button><span className="sr-only" role="status">{running?'AI is working. Please wait.':done?'AI result is ready.':failed?'AI request failed. You can retry.':''}</span></span>;
}
