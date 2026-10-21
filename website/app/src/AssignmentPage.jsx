import React,{useEffect,useState} from 'react';
import {rpc} from './client';
import {periodLabel} from './data';
import AutoAssign from './AutoAssign.jsx';

export default function AssignmentPage({act,previewData,onPreviewConfirm}){
 const [liveData,setData]=useState(null),[open,setOpen]=useState(false),data=previewData||liveData,limits=data?.limits||{daily:20,open:40};
 async function load(){if(!previewData)setData(await rpc('retention_agent_capacity'))}
 useEffect(()=>{act(load)},[]);
 const period=data?[...new Set(data.cases.map(c=>c.start))].sort().at(-1)||'':'';
 const end=data?.cases.find(c=>c.start===period)?.end;
 const waiting=data?data.cases.filter(c=>c.start===period&&!c.owner&&c.stage!=='closed'&&c.risk>.5).length:0;
 return <>
  <div className="page-title"><div><h1>Assignment</h1><p>{period?`Prediction period ${periodLabel(period,end)}`:'Assign alert cases to customer care agents.'}</p></div>
   <button className="primary" disabled={!data||!period} onClick={()=>setOpen(true)}>Assign cases</button>{!previewData&&<button onClick={()=>act(load)}>Refresh</button>}</div>
  {!data?<p role="status">Loading team capacity…</p>:<>
   <div className="stats"><section><small>Unassigned alert cases</small><strong>{waiting}</strong><p>Ordered by risk, then waiting time</p></section><section><small>Agents</small><strong>{data.agents.filter(a=>a.active!==false).length}</strong><p>Active in this team</p></section><section><small>Capacity limits</small><strong>{limits.daily} / {limits.open}</strong><p>New per day · open per agent</p></section></div>
   <section className="card"><h2>Team workload</h2><div className="table-scroll"><table><thead><tr><th>Agent</th><th>Received today</th><th>Open cases</th></tr></thead><tbody>{data.agents.map(a=><tr key={a.id}><td>{a.name}{a.active===false?' · Inactive':''}</td><td>{a.today}/{limits.daily}</td><td>{a.open}/{limits.open}</td></tr>)}</tbody></table></div></section></>}
  {open&&data&&<AutoAssign cases={data.cases} agents={data.agents} initialPeriod={period} cursor={data.cursor} initialSettings={data} live={!previewData} onSettings={setData} onClose={()=>setOpen(false)} onConfirm={previewData?onPreviewConfirm:load}/>}
 </>;
}
