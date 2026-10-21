import {defineConfig} from 'vite';
import {readFile} from 'node:fs/promises';

export default defineConfig({plugins:[{
 name:'local-dashboard-fixture',
 configureServer(server){
  server.middlewares.use('/__dashboard-fixture.json',async(_req,res)=>{
   try{const body=await readFile(new URL('./.dashboard-fixture.json',import.meta.url));res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(body)}
   catch{res.statusCode=404;res.end('Run scripts/seed-dashboard.py to prepare the local fixture.')}
  });
 }
}]});
