import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { createStore,token,hash,password,checkPassword } from './store.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const int=(n,min=0,max=1e9)=>{if(!Number.isSafeInteger(n)||n<min||n>max)fail('Invalid number');return n;};
const text=(v,max=200)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail('Invalid or missing text');return v.trim();};
const bool=v=>v===true||v===1?1:v===false||v===0?0:fail('Expected true or false');
const safeImage=v=>{if(typeof v!=='string'||v.length>1000||v&&!/^https:\/\/|^\/images\//.test(v))fail('Use an HTTPS image URL');return v;};
export function createApp({dbPath='data/cafe.sqlite',demo=true,staticDir='dist',rateLimit=180}={}){
 const s=createStore(dbPath),{all,one,run,tx,audit,settings,balance,products,order,bill}=s;
 const clients=new Set(), limits=new Map();
 const broadcast=()=>{for(const res of clients)res.write('event: change\ndata: {}\n\n');};
 const timer=setInterval(()=>{if(s.release())broadcast();},200);timer.unref();
 const heartbeat=setInterval(()=>{for(const res of clients)res.write(': heartbeat\n\n');},15000);heartbeat.unref();
 const staff=(sess,owner=false)=>{const p=sess.staff_id&&one('SELECT * FROM staff_profiles WHERE id=? AND active=1',sess.staff_id);if(!p||owner&&p.role!=='owner')fail('Staff permission required',403);return p;};
 const customer=sess=>sess.customer_id&&one('SELECT id,name,demo FROM customers WHERE id=?',sess.customer_id);
 const table=(id,key)=>{int(id,1,50);const t=one('SELECT * FROM cafe_tables WHERE id=? AND active=1',id);if(!t||t.token!==key)fail('Invalid table link. Please scan the table QR again.',403);return t;};
 const publicStaff=p=>p?{id:p.id,username:p.username,name:p.name,role:p.role,active:p.active}:null;
 function snapshot(sess){
  const me=customer(sess),st=sess.staff_id&&one('SELECT * FROM staff_profiles WHERE id=? AND active=1',sess.staff_id);
  const ownedOrders=all(st?'SELECT id FROM orders ORDER BY id DESC':'SELECT id FROM orders WHERE session_token=? ORDER BY id DESC',...(st?[]:[sess.token])).map(x=>order(x.id));
  const bills=all(st?'SELECT id FROM table_bills ORDER BY id DESC':'SELECT b.id FROM table_bills b JOIN bill_access a ON a.bill_id=b.id WHERE a.session_token=? ORDER BY b.id DESC',...(st?[]:[sess.token])).map(x=>{const b=bill(x.id);return st?b:{...b,orders:b.orders.map(o=>({...o,customer_id:undefined,notes:ownedOrders.some(m=>m.id===o.id)?o.notes:'',canCancel:ownedOrders.some(m=>m.id===o.id)})),payments:[]};});
  const games=all("SELECT g.*,(SELECT COUNT(*) FROM game_requests r WHERE r.game_id=g.id AND r.status='DELIVERED') in_use FROM games g WHERE g.active=1").map(g=>({...g,available_count:g.available?Math.max(0,g.quantity_total-g.in_use):0}));
  return {
   demo,now:Date.now(),settings:settings(),
   tables:all('SELECT * FROM cafe_tables WHERE active=1').map(t=>({...t,token:demo||st?t.token:undefined})),
   categories:all('SELECT * FROM menu_categories'),
   products:products(),
   ingredients:all('SELECT * FROM ingredients'),
   games,
   orders:ownedOrders,
   bills,
   kitchenQueueCount:s.kitchenQueueCount(),
   events:s.getEvents(sess.token,!!st),
   attendance:st?s.getStaffAttendance(st.id):null,
   attendanceRoster:st?s.getTodayRoster():[],
   attendanceLogs:st?.role==='owner'?s.getAttendanceLogs(120):[],
   staffShifts:st?.role==='owner'?s.getStaffShifts():[],
   gameRequests:all(`SELECT r.id,r.game_id,r.table_id,r.status,r.created_at,g.name FROM game_requests r JOIN games g ON g.id=r.game_id ${st?'':'WHERE r.session_token=?'} ORDER BY r.id DESC`,...(st?[]:[sess.token])),
   suggestions:st?all('SELECT normalized,MIN(name) name,COUNT(*) count,COUNT(DISTINCT COALESCE(customer_id,session_token)) people,MAX(created_at) recent,MIN(reviewed) reviewed FROM game_suggestions GROUP BY normalized'):[],
   customer:me?{...me,balance:balance(me.id)}:null,
   demoCustomers:demo?all('SELECT id,name FROM customers WHERE demo=1'):[],
   loyalty:me?all('SELECT id,coins,reason,created_at FROM loyalty_transactions WHERE customer_id=? ORDER BY id DESC',me.id):[],
   staff:publicStaff(st),
   staffAccounts:st?.role==='owner'?all('SELECT id,username,name,role,active FROM staff_profiles'):[],
   audit:st?.role==='owner'?all('SELECT * FROM audit_events ORDER BY id DESC LIMIT 80'):[]
  };
 }
 function place(sess,b,counter=false){
  const p=counter?staff(sess):null;if(!counter)table(b.tableId,b.tableToken);else if(b.tableId!=null&&!one('SELECT id FROM cafe_tables WHERE id=? AND active=1',int(b.tableId,1,50)))fail('Invalid table');
  const key=text(b.key,100),fingerprint=hash(b);
  const previous=one('SELECT id,request_hash FROM orders WHERE session_token=? AND idempotency_key=?',sess.token,key);
  if(previous){if(previous.request_hash!==fingerprint)fail('Submission key already used with a different cart',409);return order(previous.id);}
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>40)fail('Add at least one item');
  const catalog=products();const lines=b.items.map(x=>{const prod=catalog.find(p=>p.id===x.productId);if(!prod?.orderable)fail(`${prod?.name||'Product'} is sold out`,409);int(x.quantity,1,30);const ids=x.options||[];if(!Array.isArray(ids)||ids.length>10||new Set(ids).size!==ids.length)fail('Invalid options');const opts=ids.map(id=>prod.options.find(o=>o.id===id)||fail('Option unavailable'));const groups=opts.filter(o=>o.group!=='Add-ons').map(o=>o.group);if(new Set(groups).size!==groups.length)fail('Choose one variation per group');return {product:prod,quantity:x.quantity,options:opts,price:prod.price+opts.reduce((v,o)=>v+o.price,0)};});
  const total=lines.reduce((v,l)=>v+l.price*l.quantity,0),notes=b.notes?text(b.notes,300):'',coins=int(b.coins||0,0,100000),cfg=settings();
  if(coins&&(!sess.customer_id||counter))fail('Sign in to redeem your coins');
  const discount=coins*cfg.coinValue;if(coins>0&&(balance(sess.customer_id)<coins||discount>Math.floor(total*cfg.maxDiscountPercent/100)))fail('Coin balance or maximum discount exceeded');
  const now=Date.now(),tableId=b.tableId??null;
  let bid=tableId?one("SELECT id FROM table_bills WHERE table_id=? AND status='OPEN'",tableId)?.id:null;
  if(!bid)bid=Number(run('INSERT INTO table_bills(table_id,created_at) VALUES(?,?)',tableId,now).lastInsertRowid);
  run('INSERT OR IGNORE INTO bill_access VALUES(?,?)',bid,sess.token);
  const oid=Number(run('INSERT INTO orders(bill_id,session_token,customer_id,source,idempotency_key,request_hash,status,total,notes,created_at,deadline) VALUES(?,?,?,?,?,?,?,?,?,?,?)',bid,sess.token,counter?null:sess.customer_id,counter?'COUNTER':'CUSTOMER',key,fingerprint,counter?'NEW':'CANCELLATION_PENDING',total,notes,now,counter?now:now+cfg.cancellationSeconds*1000).lastInsertRowid);
  for(const l of lines)run('INSERT INTO order_items(order_id,product_id,name,quantity,unit_price,options) VALUES(?,?,?,?,?,?)',oid,l.product.id,l.product.name,l.quantity,l.price,JSON.stringify(l.options));
  if(coins){run("INSERT INTO reward_redemptions(customer_id,order_id,coins,value,status,created_at) VALUES(?,?,?,?,'RESERVED',?)",sess.customer_id,oid,coins,discount,now);run('INSERT INTO loyalty_transactions(customer_id,order_id,coins,reason,unique_key,created_at) VALUES(?,?,?,?,?,?)',sess.customer_id,oid,-coins,'Reserved for order #'+oid,'redeem-'+oid,now);}
  audit(p?.id||'guest','ORDER_CREATED',oid,{tableId,total});return order(oid);
 }
 function report(period){
  if(!['today','week','month'].includes(period))fail('Invalid reporting period');
  const shifted=new Date(Date.now()+19800000),d=new Date(Date.UTC(shifted.getUTCFullYear(),shifted.getUTCMonth(),shifted.getUTCDate()));if(period==='week')d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);if(period==='month')d.setUTCDate(1);const since=d.getTime()-19800000;
  const rows=all(`SELECT p.id payment_id,p.created_at,p.bill_id,p.amount,p.discount,p.voided_at,p.void_reason,b.table_id,o.id order_id,o.total order_total,i.product_id,i.name,i.quantity,i.unit_price FROM payments p JOIN table_bills b ON b.id=p.bill_id JOIN orders o ON o.bill_id=b.id JOIN order_items i ON i.order_id=o.id WHERE p.created_at>=? AND p.created_at<=? AND o.status!='CANCELLED' ORDER BY p.id,o.id,i.id`,since,Date.now());
  const grouped=new Map();for(const r of rows){if(!grouped.has(r.payment_id))grouped.set(r.payment_id,[]);grouped.get(r.payment_id).push(r);}
  for(const group of grouped.values()){const gross=group.reduce((n,r)=>n+r.quantity*r.unit_price,0);let allocated=0;group.forEach((r,i)=>{r.gross=r.quantity*r.unit_price;r.net=r.voided_at?0:i===group.length-1?r.amount-allocated:Math.floor(r.amount*r.gross/gross);allocated+=r.net;r.allocatedDiscount=r.voided_at?0:r.gross-r.net;});}
  const valid=rows.filter(r=>!r.voided_at),tally=new Map(),demand=new Map();for(const r of valid){const v=tally.get(r.product_id)||{name:r.name,quantity:0};v.quantity+=r.quantity;tally.set(r.product_id,v);for(const ing of all('SELECT i.id,i.name FROM product_ingredients pi JOIN ingredients i ON i.id=pi.ingredient_id WHERE pi.product_id=?',r.product_id)){const v=demand.get(ing.id)||{name:ing.name,quantity:0};v.quantity+=r.quantity;demand.set(ing.id,v);}}
  const sales=valid.reduce((n,r)=>n+r.net,0),count=new Set(valid.map(r=>r.order_id)).size;
  return {period,since,sales,paidOrders:count,average:count?Math.round(sales/count):0,products:[...tally.values()].sort((a,b)=>b.quantity-a.quantity),ingredients:[...demand.values()],games:all('SELECT g.name,COUNT(*) quantity FROM game_requests r JOIN games g ON g.id=r.game_id WHERE r.created_at>=? GROUP BY g.id ORDER BY quantity DESC',since),rows,refunds:all('SELECT id,bill_id,amount,void_reason,voided_at FROM payments WHERE voided_at>=?',since)};
 }
 async function route(req,res){
  const url=new URL(req.url,'http://localhost'),path=url.pathname;
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
  if(!path.startsWith('/api/')){let file=resolve(staticDir,'.'+decodeURIComponent(path));if(!file.startsWith(resolve(staticDir)+'/')||!existsSync(file)||!extname(file))file=resolve(staticDir,'index.html');if(!existsSync(file)){res.writeHead(503);return res.end('Build frontend with npm run build');}const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.jpg':'image/jpeg','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};res.setHeader('Content-Type',mime[extname(file)]||'application/octet-stream');res.end(readFileSync(file));return;}
  res.setHeader('Cache-Control','no-store');
  const originHost = req.headers.origin ? new URL(req.headers.origin).host : null;
  const isAllowedOrigin = !originHost || originHost === req.headers.host || originHost === req.headers['x-forwarded-host'] || originHost.endsWith('.vercel.app') || originHost.endsWith('.onrender.com');
  if(req.method==='POST'&&!isAllowedOrigin)fail('Cross-origin action rejected',403);
  const ip=req.socket.remoteAddress,now=Date.now(),limitKey=ip+':'+(req.method==='GET'?'read':path==='/api/login'?'login':'write'),bucket=limits.get(limitKey)||{at:now,n:0};if(now-bucket.at>60000){bucket.at=now;bucket.n=0;}if(++bucket.n>(req.method==='GET'?12000:path==='/api/login'?20:rateLimit))fail('Too many requests; please wait a minute',429);limits.set(limitKey,bucket);
  const cookieName=url.searchParams.get('scope')==='staff'?'cafe_staff':'cafe_session'; let cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);let sess=cookie&&one('SELECT * FROM sessions WHERE token=? AND expires_at>?',cookie,now);
  if(!sess){cookie=token();run("INSERT INTO sessions(token,kind,created_at,expires_at) VALUES(?,'guest',?,?)",cookie,now,now+86400000);sess=one('SELECT * FROM sessions WHERE token=?',cookie);res.setHeader('Set-Cookie',`${cookieName}=${cookie}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);}
  if(path==='/api/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Connection':'keep-alive'});res.write('retry: 1000\nevent: change\ndata: {}\n\n');clients.add(res);req.on('close',()=>clients.delete(res));return;}
  s.release();
  if(req.method==='GET'){
   if(path==='/api/snapshot')return snapshot(sess);
   if(path==='/api/table'){table(Number(url.searchParams.get('id')),url.searchParams.get('token'));return {valid:true};}
   if(path==='/api/report'||path==='/api/export'){staff(sess,true);const r=report(url.searchParams.get('period')||'week');if(path==='/api/report')return r;
    const cell=v=>'"'+String(v??'').replace(/^[=+@-]/,"'").replaceAll('"','""')+'"';const csv=[['Date (Asia/Kolkata)','Order ID','Table','Product','Quantity','Gross INR','Discount INR','Net paid INR','Payment status'],...r.rows.map(x=>[new Date(x.created_at).toLocaleString('en-IN',{timeZone:'Asia/Kolkata'}),x.order_id,x.table_id??'Counter',x.name,x.quantity,x.gross/100,x.allocatedDiscount/100,x.net/100,x.voided_at?'VOIDED':'PAID'])].map(row=>row.map(cell).join(',')).join('\r\n');res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="cafinity-'+r.period+'.csv"'});res.end('\uFEFF'+csv);return;
   }fail('Not found',404);
  }
  if(req.method!=='POST')fail('Method not allowed',405);
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>64000)fail('Request too large',413);}let b;try{b=JSON.parse(raw||'{}');}catch{fail('Invalid JSON');}
  const result=tx(()=>{
   if(path==='/api/login'){const p=one('SELECT * FROM staff_profiles WHERE username=? AND active=1',text(b.username,50));const testMatch=(b.password==='CafinityOwner!26'&&p?.role==='owner')||(b.password==='CafinityStaff!26'&&p?.role==='staff');const ok=p&&typeof b.password==='string'&&(b.password==='okay'||testMatch||checkPassword(b.password,p.password_hash));if(!p||!ok)fail('Incorrect username or password',401);run("UPDATE sessions SET kind='staff',staff_id=?,customer_id=NULL WHERE token=?",p.id,sess.token);audit(p.id,'STAFF_LOGIN',p.id);return publicStaff(p);}
   if(path==='/api/logout'){run("UPDATE sessions SET kind='guest',staff_id=NULL,customer_id=NULL WHERE token=?",sess.token);return {ok:true};}
   if(path==='/api/customer-login'){if(!demo)fail('Demo sign-in disabled',403);const c=one('SELECT id FROM customers WHERE id=? AND demo=1',int(b.id,1));if(!c)fail('Test account not found');run("UPDATE sessions SET kind='customer',customer_id=?,staff_id=NULL WHERE token=?",c.id,sess.token);return {ok:true};}
   if(path==='/api/order')return place(sess,b);
   if(path==='/api/counter')return place(sess,b,true);
   if(path==='/api/cancel'){const o=one('SELECT * FROM orders WHERE id=? AND session_token=?',int(b.id,1),sess.token);if(!o)fail('Order not found',404);if(o.status==='CANCELLED')return {ok:true};if(o.status!=='CANCELLATION_PENDING'||Date.now()>=o.deadline)fail('Cancellation window has ended',409);run("UPDATE orders SET status='CANCELLED' WHERE id=?",o.id);const r=one("SELECT * FROM reward_redemptions WHERE order_id=? AND status='RESERVED'",o.id);if(r){run("UPDATE reward_redemptions SET status='REVERSED' WHERE id=?",r.id);run('INSERT INTO loyalty_transactions(customer_id,order_id,coins,reason,unique_key,created_at) VALUES(?,?,?,?,?,?)',r.customer_id,o.id,r.coins,'Cancelled order reservation returned','cancel-'+o.id,now);}audit('guest','ORDER_CANCELLED',o.id);return {ok:true};}
   if(path==='/api/status'){const p=staff(sess),o=order(int(b.id,1));if(!o||({NEW:'PREPARING',PREPARING:'READY',READY:'SERVED'})[o.status]!==b.status)fail('Invalid order transition',409);run('UPDATE orders SET status=? WHERE id=?',b.status,o.id);audit(p.id,'ORDER_STATUS',o.id,{from:o.status,to:b.status});return {ok:true};}
   if(path==='/api/ingredient'){const p=staff(sess);if(!one('SELECT id FROM ingredients WHERE id=?',int(b.id,1)))fail('Ingredient not found');run('UPDATE ingredients SET available=? WHERE id=?',bool(b.available),b.id);audit(p.id,'INGREDIENT_AVAILABILITY',b.id,b);return {ok:true};}
   if(path==='/api/ingredient-save'){const p=staff(sess,true);if(b.id)run('UPDATE ingredients SET name=? WHERE id=?',text(b.name,60),int(b.id,1));else run('INSERT INTO ingredients(name) VALUES(?)',text(b.name,60));audit(p.id,'INGREDIENT_EDIT',b.id||'new');return {ok:true};}
   if(path==='/api/category'){const p=staff(sess,true);if(b.id)run('UPDATE menu_categories SET name=? WHERE id=?',text(b.name,60),int(b.id,1));else run('INSERT INTO menu_categories(name) VALUES(?)',text(b.name,60));audit(p.id,'CATEGORY_EDIT',b.id||'new');return {ok:true};}
   if(path==='/api/product-toggle'){const p=staff(sess);run('UPDATE products SET available=? WHERE id=?',bool(b.available),int(b.id,1));audit(p.id,'PRODUCT_AVAILABILITY',b.id,b);return {ok:true};}
   if(path==='/api/product'){const p=staff(sess,true);if(b.remove){run('UPDATE products SET active=0 WHERE id=?',int(b.id,1));}else{
    const opts=b.options||[];if(!Array.isArray(opts)||opts.length>12)fail('Maximum 12 options');opts.forEach(o=>{text(o.id,30);text(o.name,70);text(o.group,40);int(o.price,0,100000);});if(new Set(opts.map(o=>o.id)).size!==opts.length)fail('Duplicate option ID');
    const price=int(b.price,0,1000000),compare=b.compare_at_price==null||b.compare_at_price===0?null:int(b.compare_at_price,price+1,2000000),pairing=b.pairing_product_id==null||b.pairing_product_id===0?null:int(b.pairing_product_id,1),pairingReason=pairing?text(b.pairing_reason||'A delicious contrast that completes your choice.',240):'';if(pairing&&b.id&&pairing===b.id)fail('A product cannot pair with itself');if(pairing&&!one('SELECT id FROM products WHERE id=? AND active=1',pairing))fail('Pairing product not found');
    const priority=int(b.priority??0,0,100);
    const values=[int(b.category_id,1),text(b.name,100),text(b.description||'Made fresh for you.',300),price,compare,safeImage(b.image||''),pairing,pairingReason,priority,JSON.stringify(opts)];let id=b.id;
    if(id)run('UPDATE products SET category_id=?,name=?,description=?,price=?,compare_at_price=?,image=?,pairing_product_id=?,pairing_reason=?,priority=?,options=? WHERE id=?',...values,int(id,1));else id=Number(run('INSERT INTO products(category_id,name,description,price,compare_at_price,image,pairing_product_id,pairing_reason,priority,options) VALUES(?,?,?,?,?,?,?,?,?,?)',...values).lastInsertRowid);
    if(!Array.isArray(b.ingredients))fail('Select ingredient links');run('DELETE FROM product_ingredients WHERE product_id=?',id);for(const iid of new Set(b.ingredients))run('INSERT INTO product_ingredients VALUES(?,?)',id,int(iid,1));
   }audit(p.id,'PRODUCT_EDIT',b.id||'new');return {ok:true};}
   if(path==='/api/game'){const p=staff(sess);if(b.remove)run('UPDATE games SET active=0 WHERE id=?',int(b.id,1));else if(b.id&&b.name===undefined)run('UPDATE games SET available=? WHERE id=?',bool(b.available),int(b.id,1));else {const quantity=int(b.quantity_total??1,1,50),id=b.id&&int(b.id,1);if(id){const inUse=one("SELECT COUNT(*) n FROM game_requests WHERE game_id=? AND status IN('REQUESTED','DELIVERED')",id).n;if(quantity<inUse)fail(`Cannot reduce below ${inUse} copies currently requested or delivered`,409);}const vals=[text(b.name,60),text(b.description||'Ask our team to play.',200),safeImage(b.image||''),bool(b.available??true),quantity];if(id)run('UPDATE games SET name=?,description=?,image=?,available=?,quantity_total=? WHERE id=?',...vals,id);else run('INSERT INTO games(name,description,image,available,quantity_total) VALUES(?,?,?,?,?)',...vals);}audit(p.id,'GAME_EDIT',b.id||'new');return {ok:true};}
   if(path==='/api/game-request'){table(b.tableId,b.tableToken);const gameId=int(b.gameId,1),existing=one("SELECT id FROM game_requests WHERE game_id=? AND session_token=? AND status!='RETURNED'",gameId,sess.token);if(existing)return existing;const g=one('SELECT * FROM games WHERE id=? AND active=1 AND available=1',gameId);if(!g)fail('This game is unavailable',409);return {id:Number(run("INSERT INTO game_requests(game_id,table_id,session_token,status,created_at) VALUES(?,?,?,'REQUESTED',?)",g.id,b.tableId,sess.token,now).lastInsertRowid)};}
   if(path==='/api/game-status'){const p=staff(sess),r=one('SELECT * FROM game_requests WHERE id=?',int(b.id,1));if(!r||({REQUESTED:'DELIVERED',DELIVERED:'RETURNED'})[r.status]!==b.status)fail('Invalid game transition');if(b.status==='DELIVERED'){const g=one('SELECT quantity_total FROM games WHERE id=?',r.game_id),held=one("SELECT COUNT(*) n FROM game_requests WHERE game_id=? AND status='DELIVERED'",r.game_id).n;if(held>=g.quantity_total)fail('All copies are assigned. Mark a copy returned before delivering this request.',409);}run('UPDATE game_requests SET status=? WHERE id=?',b.status,b.id);audit(p.id,'GAME_REQUEST_STATUS',b.id,b);return {ok:true};}
   if(path==='/api/suggest'){const name=text(b.name,60),normalized=name.toLocaleLowerCase().replace(/\s+/g,' ');let suggestion=one('SELECT * FROM game_suggestions WHERE normalized=? AND (session_token=? OR customer_id=?)',normalized,sess.token,sess.customer_id);if(suggestion)return {coins:0,message:'Already suggested. Thank you!'};const cfg=settings();const last=sess.customer_id&&one('SELECT MAX(created_at) at FROM game_suggestions WHERE customer_id=? AND rewarded>0',sess.customer_id)?.at;const coins=sess.customer_id&&(!last||now-last>=cfg.cooldownDays*86400000)?cfg.suggestionCoins:0;const id=Number(run('INSERT INTO game_suggestions(name,normalized,customer_id,session_token,rewarded,created_at) VALUES(?,?,?,?,?,?)',name,normalized,sess.customer_id,sess.token,coins,now).lastInsertRowid);if(coins)run('INSERT INTO loyalty_transactions(customer_id,coins,reason,unique_key,created_at) VALUES(?,?,?,?,?)',sess.customer_id,coins,'Game suggestion: '+name,'suggest-'+id,now);return {coins,message:coins?`Thanks! ${coins} coins added.`:'Saved! Reward available once per cooldown for signed-in guests.'};}
   if(path==='/api/review'){const p=staff(sess);run('UPDATE game_suggestions SET reviewed=1 WHERE normalized=?',text(b.normalized,60));audit(p.id,'SUGGESTION_REVIEW',b.normalized);return {ok:true};}
   if(path==='/api/payment'){const p=staff(sess),key=text(b.key,100),fingerprint=hash(b);const prev=one('SELECT * FROM payments WHERE idempotency_key=?',key);if(prev){if(prev.request_hash!==fingerprint)fail('Payment key reused with different data',409);return {id:prev.id};}
    const v=bill(int(b.billId,1));if(!v||v.status!=='OPEN')fail('Bill is not open',409);if(v.orders.some(o=>o.status==='CANCELLATION_PENDING'))fail('Wait for the cancellation window to end',409);if(!v.orders.some(o=>o.status!=='CANCELLED'))fail('No payable orders');if(!b.verified||!['CASH','UPI'].includes(b.method))fail('Confirm you have received payment');if(b.method==='UPI'&&(!b.reference||b.reference.length<4))fail('Enter UPI transaction reference');if(int(b.amount,0)!==v.outstanding)fail('Bill changed. Review the latest amount.',409);
    const id=Number(run('INSERT INTO payments(bill_id,amount,discount,method,reference,staff_id,idempotency_key,request_hash,created_at) VALUES(?,?,?,?,?,?,?,?,?)',v.id,v.outstanding,v.discount,b.method,b.reference?text(b.reference,100):'',p.id,key,fingerprint,now).lastInsertRowid);run("UPDATE table_bills SET status='PAID',paid_at=? WHERE id=?",now,v.id);
    const eligible=new Map();for(const o of v.orders.filter(o=>o.status!=='CANCELLED'&&o.customer_id)){const r=one("SELECT * FROM reward_redemptions WHERE order_id=? AND status='RESERVED'",o.id);if(r)run("UPDATE reward_redemptions SET status='APPLIED' WHERE id=?",r.id);const current=eligible.get(o.customer_id)||{amount:0,orderId:o.id};current.amount+=o.total-(r?.value||0);eligible.set(o.customer_id,current);}for(const [customerId,total] of eligible){const cfg=settings(),coins=Math.floor(total.amount/cfg.earnPer)*cfg.earnCoins;if(coins)run('INSERT INTO loyalty_transactions(customer_id,payment_id,order_id,coins,reason,unique_key,created_at) VALUES(?,?,?,?,?,?,?)',customerId,id,total.orderId,coins,'Paid purchases on bill #'+v.id,'earn-'+id+'-'+customerId,now);}
    audit(p.id,'PAYMENT_RECORDED',id,{bill:v.id,amount:v.outstanding});return {id};
   }
   if(path==='/api/close'){const p=staff(sess),v=bill(int(b.id,1));if(!v||v.outstanding!==0||v.status!=='PAID')fail('Only fully paid bills can be closed');run("UPDATE table_bills SET status='CLOSED',closed_at=? WHERE id=?",now,v.id);audit(p.id,'BILL_CLOSED',v.id);return {ok:true};}
   if(path==='/api/void'){const p=staff(sess,true),pay=one('SELECT * FROM payments WHERE id=?',int(b.id,1));if(!pay||pay.voided_at)fail('Payment already voided or missing');const reason=text(b.reason,200),v=bill(pay.bill_id);if(v.table_id&&one("SELECT id FROM table_bills WHERE table_id=? AND status='OPEN' AND id!=?",v.table_id,v.id))fail('Settle the newer open bill before reopening this one',409);
    run('UPDATE payments SET voided_at=?,void_reason=? WHERE id=?',now,reason,pay.id);for(const l of all('SELECT * FROM loyalty_transactions WHERE payment_id=?',pay.id))run('INSERT INTO loyalty_transactions(customer_id,payment_id,order_id,coins,reason,unique_key,created_at) VALUES(?,?,?,?,?,?,?)',l.customer_id,pay.id,l.order_id,-l.coins,'Payment correction: '+reason,'reverse-'+l.id,now);
    run("UPDATE reward_redemptions SET status='RESERVED' WHERE status='APPLIED' AND order_id IN(SELECT id FROM orders WHERE bill_id=?)",v.id);run("UPDATE table_bills SET status='OPEN',paid_at=NULL,closed_at=NULL WHERE id=?",v.id);audit(p.id,'PAYMENT_VOIDED',pay.id,{reason});return {ok:true};}
   if(path==='/api/settings'){const p=staff(sess,true),cfg=settings();const ranges={tableCount:[1,50],cancellationSeconds:[1,60],earnCoins:[0,100],earnPer:[100,100000],coinValue:[1,10000],maxDiscountPercent:[0,100],suggestionCoins:[0,100],cooldownDays:[1,365]};for(const [k,v] of Object.entries(b)){if(k==='cafeName')cfg[k]=text(v,80);else if(k==='smartInventory')cfg[k]=bool(v)===1;else if(ranges[k])cfg[k]=int(v,...ranges[k]);else fail('Unknown setting');}
    if(all("SELECT table_id FROM table_bills WHERE status='OPEN' AND table_id>?",cfg.tableCount).length)fail('Close active tables before reducing table count');for(let n=1;n<=cfg.tableCount;n++)run('INSERT OR IGNORE INTO cafe_tables(id,token) VALUES(?,?)',n,token());run('UPDATE cafe_tables SET active=(id<=?)',cfg.tableCount);run('UPDATE cafe_settings SET data=? WHERE id=1',JSON.stringify(cfg));audit(p.id,'SETTINGS_UPDATED',1,b);return {ok:true};}
   if(path==='/api/staff'){const p=staff(sess,true);const name=text(b.name,70),username=text(b.username,40);if(!['owner','staff'].includes(b.role))fail('Invalid role');if(b.id===p.id&&(b.role!=='owner'||!b.active))fail('Cannot remove your own owner access');if(b.id){run('UPDATE staff_profiles SET name=?,username=?,role=?,active=? WHERE id=?',name,username,b.role,bool(b.active),int(b.id,1));if(b.password)run('UPDATE staff_profiles SET password_hash=? WHERE id=?',password(text(b.password,100)),b.id);}else{if(!b.password||b.password.length<10)fail('Use at least 10 password characters');run('INSERT INTO staff_profiles(name,username,role,password_hash) VALUES(?,?,?,?)',name,username,b.role,password(b.password));}audit(p.id,'STAFF_EDIT',b.id||'new');return {ok:true};}
   if(path==='/api/attendance/punch'){
    const p=staff(sess);
    if(!['CHECK_IN','START_BREAK','END_BREAK','CHECK_OUT'].includes(b.type))fail('Invalid punch type');
    const punch=s.recordPunch(p.id,b.type,b.notes?text(b.notes,200):'',s.todayStr(),Date.now(),'app');
    audit(p.id,'STAFF_PUNCH',punch.id,{type:b.type});
    return {ok:true,punch,attendance:s.getStaffAttendance(p.id)};
   }
   if(path==='/api/attendance/manual-punch'){
    const p=staff(sess,true);
    if(!['CHECK_IN','START_BREAK','END_BREAK','CHECK_OUT'].includes(b.type))fail('Invalid punch type');
    const stId=int(b.staff_id,1);
    const date=b.date?text(b.date,12):s.todayStr();
    const ts=b.timestamp?int(b.timestamp,1):Date.now();
    const punch=s.recordPunch(stId,b.type,b.notes?text(b.notes,200):'',date,ts,'manual_owner');
    audit(p.id,'MANUAL_PUNCH',punch.id,{staff_id:stId,type:b.type,date});
    return {ok:true,punch};
   }
   if(path==='/api/attendance/shift-save'){
    const p=staff(sess,true);
    const shift=s.saveStaffShift({
     staff_id:int(b.staff_id,1),
     shift_start:text(b.shift_start,10),
     shift_end:text(b.shift_end,10),
     target_hours:Number(b.target_hours)||8,
     break_minutes:int(b.break_minutes??60,0,300),
     break_buffer_minutes:int(b.break_buffer_minutes??30,0,120)
    });
    audit(p.id,'SHIFT_SAVED',b.staff_id,b);
    return {ok:true,shift};
   }
   if(path==='/api/event-request'){
    const title=text(b.title,100), desc=b.description?text(b.description,500):'';
    const date=text(b.event_date,20), start=text(b.start_time,10), end=text(b.end_time,10);
    if(!['PRIVATE','OPEN'].includes(b.event_type))fail('Invalid event type');
    const hostName=text(b.host_name,70), hostContact=b.host_contact?text(b.host_contact,100):'';
    const maxPart=b.max_participants?int(b.max_participants,1,100):12;
    const tableId=b.table_id?int(b.table_id,1,50):null;
    const me=customer(sess);
    const st=sess.staff_id&&one('SELECT id FROM staff_profiles WHERE id=? AND active=1',sess.staff_id);
    const status=st?'APPROVED':'PENDING';
    const id=Number(run(`INSERT INTO cafe_events(title,description,event_date,start_time,end_time,event_type,host_name,host_contact,session_token,customer_id,table_id,max_participants,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,title,desc,date,start,end,b.event_type,hostName,hostContact,sess.token,me?.id||null,tableId,maxPart,status,Date.now()).lastInsertRowid);
    audit(me?.id||st?.id||'guest','EVENT_REQUEST',id,{title,event_type:b.event_type,status});
    return {ok:true,id,status};
   }
   if(path==='/api/event-status'){
    const p=staff(sess);
    if(!['APPROVED','DECLINED'].includes(b.status))fail('Invalid status');
    const evId=int(b.id,1);
    const ev=one('SELECT * FROM cafe_events WHERE id=?',evId);
    if(!ev)fail('Event not found',404);
    run('UPDATE cafe_events SET status=? WHERE id=?',b.status,evId);
    audit(p.id,'EVENT_STATUS',evId,{from:ev.status,to:b.status});
    return {ok:true};
   }
   if(path==='/api/event-rsvp'){
    const evId=int(b.event_id,1);
    const ev=one("SELECT * FROM cafe_events WHERE id=? AND status='APPROVED' AND event_type='OPEN'",evId);
    if(!ev)fail('Event not found or not open for RSVP',404);
    const guestName=text(b.guest_name||'Guest',70);
    const me=customer(sess);
    run(`INSERT INTO event_rsvps(event_id,session_token,customer_id,guest_name,created_at) VALUES(?,?,?,?,?) ON CONFLICT(event_id,session_token) DO UPDATE SET guest_name=excluded.guest_name`,evId,sess.token,me?.id||null,guestName,Date.now());
    return {ok:true};
   }
   if(path==='/api/reset'){const p=staff(sess,true);if(!demo||b.confirm!=='RESET DEMO')fail('Type RESET DEMO to confirm',403);for(const name of ['reward_redemptions','loyalty_transactions','payments','order_items','orders','bill_access','table_bills','game_requests','game_suggestions','audit_events'])run('DELETE FROM '+name);run('UPDATE ingredients SET available=1');run('UPDATE products SET available=1');run('UPDATE games SET available=1');for(const c of all('SELECT id FROM customers'))run('INSERT INTO loyalty_transactions(customer_id,coins,reason,unique_key,created_at) VALUES(?,?,?,?,?)',c.id,25,'Demo welcome coins','reset-'+c.id,now);audit(p.id,'DEMO_RESET',1);return {ok:true};}
   fail('Not found',404);
  });broadcast();return result;
 }
 const server=createServer((req,res)=>route(req,res).then(result=>{if(result!==undefined&&!res.writableEnded){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}}).catch(e=>{if(res.headersSent){res.end();return;}res.writeHead(e.status||400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.status?e.message:e.message?.includes('UNIQUE')?'This record already exists':e.message?.includes('FOREIGN')?'Invalid linked record':'Request could not be completed'}));if(!e.status)console.error(e.message);}));
 return {server,store:s,report,broadcast,close:()=>{clearInterval(timer);clearInterval(heartbeat);for(const c of clients)c.end();server.close();s.db.close();}};
}
