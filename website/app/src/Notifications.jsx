import React,{useEffect,useState} from 'react';
import {supabase,rpc} from './client';
import {buildFeed,feedDate} from './notifications.js';

const paths={
 chat:'M4 5h16v10H8l-4 4z',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2',alert:'M12 3 2 20h20zM12 10v4m0 3v.5',
 user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 8a7 7 0 0 1 14 0',users:'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15h3a5 5 0 0 0-4-5',
 chart:'M4 20V10m6 10V4m6 16v-7m4 7H2',bell:'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zm4 4h4',read:'M3 6h18v12H3zm0 0 9 7 9-7M15 16l2 2 4-4'
};
export const Icon=({name,...rest})=><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}><path d={paths[name]||paths.bell}/></svg>;
const Text=({parts})=>parts.map((p,i)=>typeof p==='string'?<React.Fragment key={i}>{p}</React.Fragment>:<strong key={i}>{p.b}</strong>);

export default function Notifications({staff,act,busy,onClose,onOpenCase,onOpenView,previewData}){
 const [data,setData]=useState(previewData||null),[tab,setTab]=useState('important');
 async function load(){
  const [n,q]=await Promise.all([supabase.from('notifications').select('*').eq('recipient_user_id',staff.user_id).order('created_at',{ascending:false}).limit(50),
   supabase.from('retention_care_queue').select('case_id,display_name,assigned_agent_id,case_owner,case_status,contact_result,churn_probability,pending_drafts,target_period_start,created_at')]);
  if(n.error)throw n.error;if(q.error)throw q.error;setData({notifications:n.data,rows:q.data});
 }
 useEffect(()=>{if(!previewData)act(load)},[staff.user_id]);
 useEffect(()=>{const k=e=>{if(e.key==='Escape')onClose()};window.addEventListener('keydown',k);return()=>window.removeEventListener('keydown',k)},[]);
 const feed=data&&buildFeed({role:staff.role,userId:staff.user_id,...data}),items=feed?.items.filter(i=>i.tab===tab)||[];
 const markRead=ids=>{if(!ids.length)return;setData(d=>({...d,notifications:d.notifications.map(n=>ids.includes(n.id)?{...n,read_at:new Date().toISOString()}:n)}));if(!previewData)act(async()=>{for(const id of ids)await rpc('retention_mark_notification_read',{p_notification_id:id})})};
 const unreadStored=feed?.items.filter(i=>i.stored&&!i.read).map(i=>i.id)||[];
 function go(item){if(item.stored&&!item.read)markRead([item.id]);if(item.caseId)onOpenCase(item.caseId);else if(item.view)onOpenView(item.view);onClose()}
 return <section className="notification-panel notif" aria-label="Notifications">
  <div className="notif-head"><button className="notif-icon-btn" title="Mark all as read" aria-label="Mark all as read" disabled={busy||!unreadStored.length} onClick={()=>markRead(unreadStored)}><Icon name="read"/></button><h2>Notifications</h2><button className="notif-icon-btn" aria-label="Close notifications" onClick={onClose}>✕</button></div>
  <div className="notif-tabs" role="tablist">{[['important','Important'],['updates','Updates']].map(([id,title])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'on':''} onClick={()=>setTab(id)}>{title}{feed?.unread[id]>0&&<span className="notif-count">{feed.unread[id]}</span>}</button>)}</div>
  <div className="notif-list">{!feed?<p className="empty">Loading notifications…</p>:items.length?items.map(i=><button key={i.id} className={`notif-item${i.read?'':' unread'}`} onClick={()=>go(i)}><span className={`notif-badge ${i.tone}`}><Icon name={i.icon}/></span><span className="notif-body"><span><Text parts={i.text}/></span><small>{i.live?'Live · ':''}{feedDate(i.at)}</small></span></button>):<p className="empty">{tab==='important'?'Nothing needs your attention right now.':'No updates yet.'}</p>}</div>
 </section>;
}

// DEV-only demo (?preview=notifications): both roles side by side with synthetic rows, no Supabase calls.
export function NotificationsPreview(){
 const at=h=>new Date(Date.parse('2026-10-22T03:00:00Z')-h*3600e3).toISOString();
 const agents=[['a1','Nguyễn Minh Anh'],['a2','Trần Thu Hà'],['a3','Lê Hoàng Nam']];
 const rows=Array.from({length:14},(_,i)=>({case_id:'c'+i,display_name:['Phạm Văn Tú','Đỗ Thị Mai','Hoàng Quốc Bảo','Vũ Thanh Lam','Ngô Gia Huy','Bùi Thu Trang','Lý Minh Khoa'][i%7]+(i>6?' (2)':''),
  assigned_agent_id:i<3?null:agents[i%3][0],case_owner:i<3?null:agents[i%3][1],case_status:i<8?'new':i<11?'waiting_customer':'closed',contact_result:i<8?'not_contacted':'contacted',
  churn_probability:.52+i*.03,pending_drafts:i===9?1:0,target_period_start:'2026-10-11',created_at:'2026-10-11T01:00:00Z'}));
 const n=(id,type,c,h,title='',read=false)=>({id,type,case_id:c,title,created_at:at(h),read_at:read?at(0):null});
 const agentData={rows,notifications:[n('1','new_message','c9',0.5),n('2','follow_up_due','c10',2),n('3','delivery_failed','c4',5),n('4','case_assigned','c3',20,'',true),n('5','case_assignment_batch',null,26,'You have 5 new cases',true),n('6','new_message','c12',30,'',true)]};
 const supData={rows,notifications:[n('7','new_message','c1',1)]};
 return <div className="notif-preview">{[['Agent · Nguyễn Minh Anh',{user_id:'a1',role:'agent'},agentData],['Supervisor · Trần Thanh Hằng',{user_id:'s1',role:'supervisor'},supData]].map(([title,staff,data])=><div key={title}><h3>{title}</h3><Notifications staff={staff} act={f=>f()} busy={false} onClose={()=>{}} onOpenCase={()=>{}} onOpenView={()=>{}} previewData={data}/></div>)}</div>;
}
