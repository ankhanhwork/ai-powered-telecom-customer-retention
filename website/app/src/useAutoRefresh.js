import {useEffect,useRef,useState} from 'react';

// Poll only the visible page; keep editor inputs independent of refreshed records.
export default function useAutoRefresh(load,scope,delay=3000){
 const latest=useRef(load);latest.current=load;
 const [syncError,setSyncError]=useState('');
 useEffect(()=>{
  let stopped=false,running=false;
  async function refresh(){
   if(stopped||running||document.hidden)return;
   running=true;
   try{await latest.current();if(!stopped)setSyncError('')}
   catch(e){if(!stopped)setSyncError(e.message||'Live update failed. Use Refresh to retry.')}
   finally{running=false}
  }
  const timer=setInterval(refresh,delay);
  document.addEventListener('visibilitychange',refresh);
  return()=>{stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh)};
 },[scope,delay]);
 return syncError;
}
