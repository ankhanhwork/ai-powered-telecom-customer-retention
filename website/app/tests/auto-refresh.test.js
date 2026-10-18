import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('live refresh pauses hidden pages, avoids overlapping loads and cleans up',async()=>{
 const source=await readFile(new URL('../src/useAutoRefresh.js',import.meta.url),'utf8');
 let tick,cleanup,listener,cleared=false,calls=0,release;
 const target={hidden:false,addEventListener:(_name,fn)=>{listener=fn},removeEventListener:(_name,fn)=>assert.equal(fn,listener)};
 const hook=new Function('useEffect','useRef','useState','document','setInterval','clearInterval',source.replace(/^import .*?;\n/,'').replace('export default function','return function'));
 const run=hook(effect=>{cleanup=effect()},value=>({current:value}),()=>['',()=>{}],target,fn=>{tick=fn;return 1},id=>{assert.equal(id,1);cleared=true});
 run(()=>{calls++;return new Promise(resolve=>{release=resolve})},'case');
 target.hidden=true;await tick();assert.equal(calls,0);
 target.hidden=false;const pending=tick();await tick();assert.equal(calls,1);
 release();await pending;const next=tick();assert.equal(calls,2);release();await next;
 cleanup();assert(cleared);await tick();assert.equal(calls,2);
});
