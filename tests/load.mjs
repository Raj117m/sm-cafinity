import {performance} from 'node:perf_hooks';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../backend/app.mjs';
import {inject} from './inject.mjs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'cafe-load-')),app=createApp({dbPath:join(dir,'cafe.sqlite'),rateLimit:10000});
const measure=async(fn)=>{const start=performance.now();const value=await fn();return {ms:performance.now()-start,value};};
const stats=xs=>{const v=xs.map(x=>x.ms).sort((a,b)=>a-b);return {p50_ms:+v[Math.floor(v.length*.5)].toFixed(2),p95_ms:+v[Math.min(v.length-1,Math.floor(v.length*.95))].toFixed(2),max_ms:+v.at(-1).toFixed(2)};};
try{
 const menus=await Promise.all(Array.from({length:30},()=>measure(()=>inject(app,'/api/snapshot'))));
 const clients=menus.map(x=>({cookie:x.value.headers['set-cookie'].split(';')[0],snapshot:JSON.parse(x.value.body)}));
 const admin=await inject(app,'/api/login',{body:{username:'owner',password:'CafinityOwner!26'}}),staffCookie=admin.headers['set-cookie'].split(';')[0];
 await inject(app,'/api/settings',{cookie:staffCookie,body:{cancellationSeconds:1}});
 const stream=await inject(app,'/api/events',{cookie:staffCookie,stream:true});
 const notifications=[];stream.res.on('chunk',()=>{const now=Date.now();for(const o of app.store.all("SELECT id,deadline FROM orders WHERE status='NEW'"))if(!notifications.find(n=>n.id===o.id))notifications.push({id:o.id,ms:now-o.deadline});});
 const requests=clients.map((c,i)=>({tableId:i%12+1,tableToken:c.snapshot.tables.find(t=>t.id===i%12+1).token,items:[{productId:3,quantity:1,options:[]}],key:randomUUID()}));
 const creates=await Promise.all(clients.map((c,i)=>measure(()=>inject(app,'/api/order',{cookie:c.cookie,body:requests[i]}))));
 for(const x of creates)assert.equal(x.value.status,200,x.value.body);assert.equal(app.store.one('SELECT COUNT(*) n FROM orders').n,30);
 await new Promise(r=>setTimeout(r,1400));assert.equal(notifications.length,30);
 const duplicates=await Promise.all(clients.map((c,i)=>inject(app,'/api/order',{cookie:c.cookie,body:requests[i]})));for(const x of duplicates)assert.equal(x.status,200);assert.equal(app.store.one('SELECT COUNT(*) n FROM orders').n,30);
 stream.req.emit('close');await inject(app,'/api/order',{cookie:clients[0].cookie,body:{...requests[0],key:randomUUID()}});
 const reconnect=await inject(app,'/api/snapshot',{cookie:staffCookie});assert.equal(JSON.parse(reconnect.body).orders.length,31);
 const reads=Array.from({length:100},()=>{const start=performance.now();app.store.all('SELECT * FROM orders WHERE status=?','NEW');return {ms:performance.now()-start};});
 const results={measured_at:new Date().toISOString(),environment:'Node HTTP listener injection + file-backed SQLite WAL, 30 independent cookie sessions on one process. No network sockets, browser rendering or physical devices.',sessions:30,menu_handler:stats(menus),order_handler:stats(creates),actionable_event_after_deadline:stats(notifications),database_status_query:stats(reads),orders_after_retry:30,reconnect_snapshot_orders:31,assertions:'30 successful orders, 30 actionable notifications, no duplicate retry writes, missed order recovered through snapshot',limits:'Not a real network or browser load test. Event timings exclude transmission, frontend rendering, Wi-Fi and device latency.'};
 writeFileSync('docs/performance-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}finally{app.close();rmSync(dir,{recursive:true});}
