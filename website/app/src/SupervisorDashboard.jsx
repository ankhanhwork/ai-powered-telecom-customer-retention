import React,{useEffect,useState} from 'react';
import {supabase,read} from './client';
import {stages,pipelineStage,failReasons} from './data';
import useAutoRefresh from './useAutoRefresh';
import PeriodFilter from './PeriodFilter';
import {OPEN_LIMIT,latestPeriod,inPeriod,isOpen,openCounts} from './assign';

const funnelColors=['#0050b3','#096dd9','#1890ff','#40a9ff','#69c0ff'];
const bands=[['90% and above',.9,1.01],['80–90%',.8,.9],['70–80%',.7,.8],['60–70%',.6,.7],['50–60%',.5,.6]];
const Sample=()=><span className="sample-tag">Sample data</span>;

function Bars({items,max,color}){
 return <div className="bars">{items.map(([name,value,text])=><div className="bar-row" key={name}><span>{name}</span><span className="bar"><i style={{width:(max?Math.min(100,value/max*100):0)+'%',background:typeof color==='function'?color(value,name):color}}/></span><strong>{text??value}</strong></div>)}</div>;
}

export default function SupervisorDashboard({act}){
 const [rows,setRows]=useState(null),[agents,setAgents]=useState([]),[sel,setSel]=useState(null);
 async function load(){
  const {data,error}=await supabase.from('retention_care_queue').select('*');
  if(error)throw error;
  setRows(data);setSel(v=>v||latestPeriod(data));
  setAgents((await read('staff_members')).filter(s=>s.role==='agent'&&s.active).sort((a,b)=>a.display_name.localeCompare(b.display_name)));
 }
 useEffect(()=>{act(load)},[]);
 useAutoRefresh(load,'dashboard');
 const all=rows||[],scoped=all.filter(r=>inPeriod(r,sel));
 const stageCount=Object.fromEntries(stages.map(s=>[s.id,scoped.filter(r=>pipelineStage(r)===s.id).length]));
 const unassigned=scoped.filter(r=>!r.assigned_agent_id&&isOpen(r)).length;
 const referrals=scoped.reduce((n,r)=>n+Number(r.support_referrals),0);
 const counts=openCounts(all,agents.map(a=>a.user_id));
 const bandCounts=bands.map(([t,lo,hi])=>[t,scoped.filter(r=>r.churn_probability>=lo&&r.churn_probability<hi).length]);
 const fmt=v=>rows?v:'—';
 const kpis=[['At-risk customers',new Set(scoped.map(r=>r.customer_ref)).size,'Prediction above the alert threshold'],['Unassigned',unassigned,'Open cases with no owner'],['Open cases',scoped.filter(isOpen).length,'New predictions to resolving request'],['Technical referrals',referrals,'Simulated handoffs'],['Care completed',stageCount.care_completed,'Care closed after contact'],['Failed',stageCount.failed,'Could not reach or engage']];
 const funnelMax=Math.max(1,...Object.values(stageCount));
 return <>
  <div className="page-title"><div><h1>Dashboard</h1><p>Care performance for the selected prediction period.</p></div><PeriodFilter rows={all} sel={sel} setSel={setSel}/></div>
  <div className="stats kpi">{kpis.map(([t,v,d])=><section key={t}><i className="stat-ic" aria-hidden="true"/><small>{t}</small><strong>{fmt(v)}</strong><p>{d}</p></section>)}
   <section><i className="stat-ic" aria-hidden="true"/><small>Contact success rate <Sample/></small><strong>64%</strong><p>Contacted out of all attempts</p></section>
   <section><i className="stat-ic" aria-hidden="true"/><small>Avg time to first contact <Sample/></small><strong>2h 40m</strong><p>From assignment to first contact</p></section></div>
  <div className="dash-grid">
   <section className="card"><h2>Care pipeline</h2><p className="muted">Customers by care stage.</p>
    <div className="funnel-bars">{stages.map((s,i)=><div className="funnel-row" key={s.id}><span>{s.title}</span><span className="funnel-track"><i style={{width:Math.max(6,stageCount[s.id]/funnelMax*100)+'%',background:s.id==='failed'?'var(--warn)':funnelColors[Math.min(i,4)]}}>{fmt(stageCount[s.id])}</i></span></div>)}</div></section>
   <section className="card"><h2>Workload by agent</h2><p className="muted">Open cases against the limit of {OPEN_LIMIT}.</p>
    <Bars items={agents.map(a=>[a.display_name,counts[a.user_id]||0,`${counts[a.user_id]||0}/${OPEN_LIMIT}`])} max={OPEN_LIMIT} color={v=>v>=OPEN_LIMIT*.8?'var(--warn)':'var(--primary)'}/>{!agents.length&&<p className="empty">No active agents.</p>}</section>
   <section className="card"><h2>Risk distribution</h2><p className="muted">Customers by predicted churn probability.</p>
    <Bars items={bandCounts} max={Math.max(1,...bandCounts.map(b=>b[1]))} color="var(--primary)"/></section>
   <section className="card"><h2>Why care failed <Sample/></h2><p className="muted">Share of failed cases by reason. Mockup values.</p>
    <Bars items={[[failReasons[1].title,41,'41%'],[failReasons[2].title,22,'22%'],[failReasons[0].title,28,'28%'],[failReasons[3].title,9,'9%']]} max={50} color="var(--warn)"/></section>
   <section className="card wide"><h2>Contact success by day <Sample/></h2><p className="muted">Last 7 days. Mockup values.</p>
    <div className="spark">{[['Mon',52],['Tue',58],['Wed',61],['Thu',55],['Fri',66],['Sat',70],['Sun',64]].map(([d,v])=><div key={d}><span className="spark-bar"><i style={{height:v+'%'}}/></span><small>{d}</small><strong>{v}%</strong></div>)}</div></section>
  </div>
  <p className="muted">Metrics marked Sample data are placeholders until the dashboard indicators are agreed.</p>
 </>;
}
