import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {supabase,rpc,read} from './client';
import {label,date,externalMessages,usedMessage} from './data';
import Queue from './Queue';
import StageBar from './StageBar';
import AssignmentPage from './AssignmentPage';
import AssignmentPreview from './AssignmentPreview.jsx';
import Dashboard from './Dashboard.jsx';
import CaseList from './CaseList';
import {InfoTab,CallTab,InsightsTab} from './CasePanels';
import RewriteRequest from './RewriteRequest';
import AIRequestButton from './AIRequestButton';
import SupportTicket from './SupportTicket';
import './style.css';
import useAutoRefresh from './useAutoRefresh';

const key=()=>crypto.randomUUID();
const icon={width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:2,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':'true'};
const SparkIcon=()=><svg {...icon}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.7 1.8 1.8.7-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z"/></svg>;
const SendIcon=()=><svg {...icon} width="20" height="20"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg>;
function Badge({children}){return <span className="badge">{children}</span>}
function Empty({children}){return <p className="empty">{children}</p>}
function Messages({messages,portal=false}){return <div className="messages">{messages.length?messages.map(m=><article key={m.id} className={`bubble ${(m.direction==='inbound')===portal?'mine':''}`}><small>{m.direction==='inbound'?'Customer':'Customer Service'}</small><p>{m.body}</p><small>{date(m.sent_at||m.created_at)}</small></article>):<Empty>No messages yet. Sent messages and replies will appear here.</Empty>}</div>}

function ProfileMenu({name,role,onSignOut}){
 const [open,setOpen]=useState(false);
 useEffect(()=>{if(!open)return;const close=e=>{if(!e.target.closest('.profile'))setOpen(false)};document.addEventListener('click',close);return()=>document.removeEventListener('click',close)},[open]);
 return <div className="profile"><button type="button" aria-haspopup="menu" aria-expanded={open} onClick={()=>setOpen(v=>!v)}><span>{name}<small>{role}</small></span><span aria-hidden="true">▾</span></button>{open&&<div className="profile-menu" role="menu"><button type="button" role="menuitem" onClick={()=>{setOpen(false);onSignOut()}}>Sign out</button></div>}</div>
}
function App(){
 const [page,setPage]=useState('queue');
 const [session,setSession]=useState(null),[ready,setReady]=useState(false),[staff,setStaff]=useState(null),[portal,setPortal]=useState(false);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[selected,setSelected]=useState(null),[view,setView]=useState('queue'),[notifications,setNotifications]=useState(null);
 useEffect(()=>{supabase.auth.getSession().then(({data,error})=>{if(error)setError(error.message);setSession(data.session);setReady(true)});
  const {data}=supabase.auth.onAuthStateChange((_event,value)=>{setSession(value)});return()=>data.subscription.unsubscribe();},[]);
 useEffect(()=>{setSelected(null);setView('queue');setNotifications(null);setStaff(null);setPortal(false);if(!session)return;let live=true;(async()=>{try{const {data,error}=await supabase.from('staff_members').select('*').eq('user_id',session.user.id).eq('active',true).maybeSingle();if(error)throw error;if(!live)return;if(data){setStaff(data);setView(data.role==='supervisor'?'dashboard':'queue')}else setPortal(true)}catch(e){if(live)setError(e.message)}})();return()=>{live=false}},[session?.user.id]);
 async function act(fn,success){setBusy(true);setError('');setNotice('');try{await fn();if(success)setNotice(success)}catch(e){setError(e.message||'Request failed. Please try again.')}finally{setBusy(false)}}
 async function showNotifications(){await act(async()=>{const {data,error}=await supabase.from('notifications').select('*').eq('recipient_user_id',session.user.id).order('created_at',{ascending:false}).limit(30);if(error)throw error;setNotifications(data)});}
 return <><header><img src="/logo.png" alt="FPT Telecom"/><strong>{portal?'Internet Support':'Retention Workspace'}</strong>{staff&&<nav className="top-nav" aria-label="Workspace">{(staff.role==='supervisor'?[['dashboard','Dashboard'],['assign','Assignment']]:[['queue','Care Queue'],['chat','Conversations']]).map(([id,title])=><button key={id} aria-current={view===id?'page':undefined} className={view===id?'on':''} onClick={()=>setView(id)}>{title}</button>)}</nav>}<div className="account">{session?<>{staff&&<button aria-label="Open notifications" onClick={showNotifications}>Notifications</button>}<ProfileMenu name={staff?.display_name||session.user.email} role={staff?(staff.role==='agent'?'Customer Care':label(staff.role)):'Customer portal'} onSignOut={()=>act(()=>supabase.auth.signOut().then(({error})=>{if(error)throw error}))}/></>:<span>Customer care</span>}</div></header>
 <div className="announcements" aria-live="polite">{error&&<div role="alert" className="error">{error}</div>}{notice&&<div className="success">{notice}</div>}{busy&&<div role="status">Saving…</div>}</div>
 {!ready?<Empty>Loading session…</Empty>:!session?<Login act={act} busy={busy}/>:staff?<div className="layout topbar-layout"><main className={view==='chat'?'chat-main':''}>{view==='chat'?<ChatScreen staff={staff} selected={selected} setSelected={setSelected} busy={busy} act={act}/>:staff.role==='supervisor'?(view==='assign'?<AssignmentPage act={act}/>:<Dashboard openCase={id=>{setSelected(id);setView('chat')}}/>):<Queue staff={staff} act={act} open={id=>{setSelected(id);setView('chat')}}/>}</main></div>:portal?<Portal act={act} busy={busy}/>:<Empty>Loading account access…</Empty>}
 {notifications&&<section className="notification-panel" aria-label="Notifications"><div className="row"><h2>Notifications</h2><button onClick={()=>setNotifications(null)}>Close</button></div>{notifications.length?notifications.map(n=><article key={n.id}><strong>{n.title}</strong><p>{date(n.created_at)}</p><div className="row"><button onClick={()=>{setSelected(n.case_id);setView('chat');setNotifications(null)}}>Open case</button>{!n.read_at&&<button disabled={busy} onClick={()=>act(async()=>{await rpc('retention_mark_notification_read',{p_notification_id:n.id});setNotifications(v=>v.map(x=>x.id===n.id?{...x,read_at:new Date().toISOString()}:x))})}>Mark read</button>}</div></article>):<Empty>No notifications.</Empty>}</section>}
 <footer>Synthetic customer data · Human approval required · Zalo and Messenger are simulated</footer></>
}
function Login({act,busy}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState('');
 return <main className="login"><div className="eyebrow">CUSTOMER CARE WORKSPACE</div><h1>The next conversation<br/>starts here.</h1><p>Review customer signals, agree on the next step, and keep every conversation in one place.</p><form onSubmit={e=>{e.preventDefault();act(async()=>{const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;setPassword('')})}}><h2>Sign in to your workspace</h2><label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required/></label><button className="primary" disabled={busy}>Sign in</button><p className="muted">Use a provisioned Agent, Supervisor or Customer account. Open customer chat in a separate browser profile.</p></form></main>
}
function ChatScreen({staff,selected,setSelected,busy,act}){
 const [listOpen,setListOpen]=useState(true),[panelOpen,setPanelOpen]=useState(true),[widths,setWidths]=useState({list:280,panel:360});
 const limits={list:[200,480],panel:[280,640]};
 function startResize(which,e){
  e.preventDefault();const x0=e.clientX,w0=widths[which],sign=which==='list'?1:-1,[min,max]=limits[which];
  const move=ev=>setWidths(w=>({...w,[which]:Math.min(max,Math.max(min,w0+sign*(ev.clientX-x0)))}));
  const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);document.body.classList.remove('resizing')};
  document.body.classList.add('resizing');window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);
 }
 function nudge(which,e){const d=e.key==='ArrowLeft'?-16:e.key==='ArrowRight'?16:0;if(!d)return;e.preventDefault();const sign=which==='list'?1:-1,[min,max]=limits[which];setWidths(w=>({...w,[which]:Math.min(max,Math.max(min,w[which]+sign*d))}))}
 const grip=which=><div className="resizer" role="separator" aria-orientation="vertical" aria-label={which==='list'?'Resize conversation list':'Resize details panel'} tabIndex={0} onPointerDown={e=>startResize(which,e)} onKeyDown={e=>nudge(which,e)}/>;
 const cols=[listOpen&&widths.list+'px',listOpen&&'6px','minmax(0,1fr)',selected&&panelOpen&&'6px',selected&&panelOpen&&widths.panel+'px'].filter(Boolean).join(' ');
 return <div className="chat-screen" style={{gridTemplateColumns:cols}}>{listOpen&&<><CaseList staff={staff} selected={selected} onSelect={setSelected} act={act}/>{grip('list')}</>}
  {selected?<Details key={selected} id={selected} staff={staff} busy={busy} act={act} ui={{listOpen,setListOpen,panelOpen,setPanelOpen,grip}}/>:<section className="chat-center"><div className="chat-head"><button aria-expanded={listOpen} onClick={()=>setListOpen(v=>!v)}>☰ Conversations</button></div><Empty>Select a conversation to start. Open a customer from the Care Queue or from the list.</Empty></section>}</div>
}
function Details({id,staff,act,busy,ui}){
 const [detail,setDetail]=useState(null),[staffList,setStaffList]=useState([]),[editor,setEditor]=useState(null),[body,setBody]=useState(''),[offer,setOffer]=useState(''),[tab,setTab]=useState('info'),[jobs,setJobs]=useState([]),[messageInstructions,setMessageInstructions]=useState(''),[approving,setApproving]=useState(false),[sendingId,setSendingId]=useState(null),[sendDone,setSendDone]=useState(false);
 const channel='Zalo',pendingAI=useRef(null),thread=useRef(null);
 async function loadCapacity(){const capacity=await rpc('retention_agent_capacity');setStaffList(capacity.agents.map(a=>({...a,limits:capacity.limits})))}
 async function load(){setDetail(await rpc('retention_case_detail',{p_case_id:id}));const {data,error}=await supabase.from('automation_jobs').select('id,status,request_key,created_at,claimed_at').eq('case_id',id).order('created_at',{ascending:false});if(error)throw error;setJobs(data);if(staff.role==='supervisor')await loadCapacity()}
 useEffect(()=>{setDetail(null);setEditor(null);setBody('');pendingAI.current=null;act(load)},[id]);
 const syncError=useAutoRefresh(load,id);
 const delivery=detail?.messages.find(m=>m.id===sendingId);
 const sending=approving||detail?.messages.some(m=>['queued','sending'].includes(m.delivery_status));
 useEffect(()=>{if(delivery?.delivery_status!=='sent')return;setSendDone(true);const timer=setTimeout(()=>{setSendDone(false);setSendingId(null)},1800);return()=>clearTimeout(timer)},[delivery?.id,delivery?.delivery_status]);
 useEffect(()=>{if(!pendingAI.current||!detail)return;const fresh=detail.messages.find(m=>m.direction==='outbound'&&!pendingAI.current.has(m.id)&&!usedMessage(m));if(!fresh)return;pendingAI.current=null;if(!body.trim())edit(fresh)},[detail]);
 useEffect(()=>{const t=thread.current;if(t)t.scrollTop=t.scrollHeight},[detail?.messages.length,detail?.support_requests.length]);
 if(!detail)return <section className="chat-center"><Empty>Loading customer details…</Empty></section>;
 const {customer:c,case:cs,prediction:p}=detail;
 const closed=cs.case_status==='closed';
 const outbound=detail.messages.filter(m=>m.direction==='outbound'),unused=outbound.filter(m=>!usedMessage(m));
 const current=detail.messages.find(m=>m.id===editor?.message_id);
 const clean=editor&&editor.body===body&&editor.channel===channel&&editor.offer===offer;
 const events=detail.support_requests.filter(t=>t.handoff_status!=='draft').map(t=>({id:'t'+t.id,at:t.submitted_at||t.created_at,ticket:t}));
 const items=[...externalMessages(detail.messages).map(m=>({id:m.id,at:m.sent_at||m.created_at,m})),...events].sort((a,b)=>a.at.localeCompare(b.at));
 async function requestAI(type,instructions=null,sourceText=null){if(type==='message')pendingAI.current=new Set(outbound.map(m=>m.id));const jobId=await (type==='ticket'?rpc('retention_request_ticket',{p_case_id:id,p_request_key:`manual:ticket:${key()}`}):rpc('retention_request_recommendation',{p_case_id:id,p_request_key:`manual:${type}:${key()}`,p_instructions:instructions,p_source_text:sourceText}));const {data}=await supabase.auth.getSession();try{const response=await fetch(`${import.meta.env.PROD?'/api':'https://group-2-new.app.n8n.cloud/webhook'}/retention-ai-${type}`,{method:'POST',headers:{'Content-Type':'application/json','apikey':import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,'Authorization':`Bearer ${data.session.access_token}`},body:JSON.stringify({job_id:jobId}),signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error('Workflow unavailable');const result=await response.json();if(result.message!=='Workflow was started')throw new Error('Unexpected workflow response')}catch{throw new Error('Request saved, but immediate processing could not start. Ask the demo operator to run the worker; automatic retries are disabled. Use Retry if the request stalls.')}await load();return jobId;}
 async function save(){const result=await rpc('retention_save_draft',{p_case_id:id,p_body:body,p_request_key:key(),p_channel:channel,p_message_id:editor?.message_id||null,p_expected_revision:editor?.revision??null,p_offer_id:offer||null,p_internal:false});setEditor({...result,body,internal:false,channel,offer});await load();return result}
 function edit(m){setBody(m.body);setOffer(m.offer_id||'');setEditor({message_id:m.id,revision:m.current_revision,body:m.body,internal:false,channel,offer:m.offer_id||''})}
 async function send(){if(approving||sending)return;setApproving(true);setSendDone(false);try{await act(async()=>{const saved=clean?editor:await save();await rpc('retention_review_message',{p_message_id:saved.message_id,p_revision:saved.revision,p_decision:'approved'});setSendingId(saved.message_id);setEditor(null);setBody('');await load()},'Approved. Simulated delivery is in progress.')}finally{setApproving(false)}}
 const initials=c.display_name.split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();
 const loadable=unused.filter(m=>m.id!==editor?.message_id);
 return <><section className="chat-center">
  <div className="chat-head"><button aria-expanded={ui.listOpen} onClick={()=>ui.setListOpen(v=>!v)}>☰</button><div className="avatar" aria-hidden="true">{initials}</div><div className="chat-title"><h1>{c.display_name}</h1><small>{c.contract_ref} · {c.plan_name}</small></div><StageBar detail={detail} busy={busy} act={act} reload={load}/><button aria-expanded={ui.panelOpen} onClick={()=>ui.setPanelOpen(v=>!v)}>{ui.panelOpen?'Hide details':'Show details'}</button></div>
  <p className="muted sync" role="status">{syncError||'Live updates on · Checks every 3 seconds'}</p>
  <div className="chat-thread" ref={thread}>{items.map(i=>i.m?<article key={i.id} className={`bubble ${i.m.direction==='inbound'?'':'mine'}`}><small>{i.m.direction==='inbound'?'Customer':'Customer Service'}</small><p>{i.m.body}</p><small>{date(i.at)}</small></article>:<div key={i.id} className="ticket-event">Ticket submitted to {i.ticket.department||'support'} · {label(i.ticket.handoff_status)} · {date(i.at)}{i.ticket.external_receipt?` · Receipt ${i.ticket.external_receipt}`:''}<small>Visible to staff only</small></div>)}{!items.length&&<Empty>No messages yet. Sent messages and replies will appear here.</Empty>}</div>
  <div className="composer">
   {loadable.length>0&&<div className="draft-chips">{loadable.map(m=><button key={m.id} type="button" disabled={busy||(!!body.trim()&&!clean)} onClick={()=>edit(m)}>Load draft: {m.body.slice(0,40)}{m.body.length>40?'…':''}</button>)}</div>}
   <div className="compose-line"><AIRequestButton type="message" jobs={jobs} request={requestAI} act={act} disabled={busy||closed}><SparkIcon/> AI message</AIRequestButton><textarea aria-label="Message to customer" rows="3" maxLength="10000" value={body} onChange={e=>setBody(e.target.value)} placeholder="Type a message, or request an AI draft…"/><button className="primary send-button" aria-label="Send message" title="Send message" aria-busy={!!sending} disabled={busy||sending||sendDone||!body.trim()||closed||current?.approval_status==='approved'} onClick={send}>{sending?<span className="spinner" aria-hidden="true"/>:sendDone?'✓':<SendIcon/>}</button></div>
   <small className="muted">Zalo (simulated) · Staff review required. Sending approves this exact text.</small>
   {delivery?.delivery_status==='failed'&&<p role="alert" className="error">Simulated delivery failed. Review the draft and try again.</p>}
   <details><summary>Rewrite with instructions</summary><RewriteRequest jobs={jobs} type="message" value={messageInstructions} onChange={setMessageInstructions} source={body} busy={busy} closed={closed} request={requestAI} act={act}/></details>
  </div></section>
  {ui.panelOpen&&<>{ui.grip('panel')}<section className="chat-panel"><div className="tabs" aria-label="Case details">{[['info','Info'],['call','Call'],['ticket','Ticket'],['insights','Insights']].map(([value,title])=><button key={value} aria-pressed={tab===value} className={tab===value?'active':''} onClick={()=>setTab(value)}>{title}</button>)}</div>
   {tab==='info'&&<InfoTab detail={detail} staff={staff} staffList={staffList} busy={busy} act={act} load={load}/>}
   {tab==='call'&&<CallTab detail={detail} jobs={jobs} busy={busy} act={act} load={load} request={requestAI}/>}
   <div hidden={tab!=='ticket'} className="panel-tab"><SupportTicket detail={detail} jobs={jobs} busy={busy} act={act} reload={load} request={requestAI} clarify={instructions=>requestAI('message',instructions,null)} confirm={instructions=>requestAI('message',instructions,null)}/></div>
   {tab==='insights'&&<InsightsTab detail={detail} jobs={jobs} busy={busy} act={act} request={requestAI}/>}
  </section></>}</>
}
function Portal({act,busy}){
 const [threads,setThreads]=useState(null),[threadId,setThreadId]=useState(''),[messages,setMessages]=useState([]),[body,setBody]=useState('');
 const activeThread=useRef(threadId);activeThread.current=threadId;
 async function loadThreads(){const t=await rpc('retention_portal_threads');setThreads(t);setThreadId(current=>t.some(x=>x.conversation_id===current)?current:t[0]?.conversation_id||'')}
 useEffect(()=>{act(loadThreads)},[]);
 async function load(){const requested=threadId;const d=await rpc('retention_portal_thread',{p_conversation_id:requested});if(activeThread.current===requested)setMessages(d.messages)}
 useEffect(()=>{setMessages([]);if(threadId)act(load)},[threadId]);
 const syncError=useAutoRefresh(async()=>{await loadThreads();if(threadId)await load()},threadId);
 return <main className="portal"><div className="page-title"><div><div className="eyebrow">VJCBI TELECOM · INTERNET SUPPORT</div><h1>How can we help?</h1></div><Badge>Demo environment</Badge></div><div className="advice">Our team will confirm availability before scheduling technical support.</div><section className="card">{threads===null?<Empty>Loading your conversations…</Empty>:!threads.length?<Empty>No support conversation is linked to your account. Please contact the demo administrator.</Empty>:<><div className="row"><label>Conversation<select value={threadId} onChange={e=>setThreadId(e.target.value)}>{threads.map(t=><option key={t.conversation_id} value={t.conversation_id}>{t.channel} · {t.display_name}</option>)}</select></label><button onClick={()=>act(load)}>Refresh messages</button></div><p className="muted" role="status">{syncError||'Messages update automatically · Demo selector shows Outreach customers with delivered messages'}</p><Messages portal messages={messages}/><form onSubmit={e=>{e.preventDefault();act(async()=>{await rpc('retention_portal_send',{p_conversation_id:threadId,p_body:body,p_event_key:key()});setBody('');await load()},'Message received by Customer Service.')}}><label>Your message<textarea required maxLength="10000" value={body} onChange={e=>setBody(e.target.value)} placeholder="Type a message…"/></label><button className="primary" disabled={busy||!body.trim()}>Send message</button></form><button className="text-button" disabled={busy} onClick={()=>act(()=>rpc('retention_opt_out',{p_conversation_id:threadId}),'Proactive messages stopped. You can still contact support.')}>Stop proactive messages</button></>}</section></main>
}
function DashboardPreview(){return <><header><img src="/logo.png" alt="FPT Telecom"/><strong>Retention Workspace</strong><div className="account">Trần Thanh Hằng · Supervisor</div></header><div className="layout"><aside><button className="active">◫ Dashboard</button><a href="/">← Open signed-in workspace</a></aside><main><Dashboard preview/></main></div><footer>Customer Care Workspace</footer></>}
const dashboardPreview=import.meta.env.DEV&&new URLSearchParams(location.search).get('preview')==='dashboard';
const assignmentPreview=import.meta.env.DEV&&new URLSearchParams(location.search).get('preview')==='assignment';
createRoot(document.getElementById('root')).render(assignmentPreview?<AssignmentPreview/>:dashboardPreview?<DashboardPreview/>:<App/>);
