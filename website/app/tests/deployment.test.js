import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Vercel proxies only the three authenticated AI webhooks',async()=>{
 const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
 assert.equal(config.framework,'vite');
 assert.equal(config.outputDirectory,'dist');
 assert.equal(config.rewrites.length,3);
 const app=await readFile(new URL('../src/main.jsx',import.meta.url),'utf8');
 assert(app.includes('https://group-2-new.app.n8n.cloud/webhook'));
 assert(!app.includes('group-2.app.n8n.cloud'));
 assert(!app.includes('the fallback worker will retry'));
 for(const type of ['message','call_script','explanation']){
  const rule=config.rewrites.find(r=>r.source===`/api/retention-ai-${type}`);
  assert.equal(rule?.destination,`https://group-2-new.app.n8n.cloud/webhook/retention-ai-${type}`);
 }
});
