import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export const token=()=>randomBytes(24).toString('hex');
export const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function password(p,salt=token()){return salt+':'+scryptSync(p,salt,64).toString('hex');}
export function checkPassword(p,s){const [salt,h]=s.split(':');return timingSafeEqual(Buffer.from(h,'hex'),scryptSync(p,salt,64));}
export function createStore(path='data/cafe.sqlite'){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 db.exec(readFileSync(new URL('./migrations/001_initial.sql',import.meta.url),'utf8'));
 const all=(q,...p)=>db.prepare(q).all(...p), one=(q,...p)=>db.prepare(q).get(...p), run=(q,...p)=>db.prepare(q).run(...p);
 if(!all('PRAGMA table_info(products)').some(c=>c.name==='compare_at_price'))db.exec("ALTER TABLE products ADD COLUMN compare_at_price INTEGER; ALTER TABLE products ADD COLUMN pairing_product_id INTEGER; ALTER TABLE products ADD COLUMN pairing_reason TEXT NOT NULL DEFAULT ''; UPDATE products SET compare_at_price=18000 WHERE name='French Fries'; UPDATE products SET pairing_product_id=6,pairing_reason='Its bold, roasted flavour pairs beautifully with something rich and chocolatey.' WHERE name='Cappuccino'; UPDATE products SET pairing_product_id=5,pairing_reason='Crisp and salty meets soft and chocolatey — a playful contrast for the table.' WHERE name='French Fries'");
 if(!all('PRAGMA table_info(games)').some(c=>c.name==='quantity_total'))db.exec("ALTER TABLE games ADD COLUMN quantity_total INTEGER NOT NULL DEFAULT 1 CHECK(quantity_total BETWEEN 1 AND 50); UPDATE games SET quantity_total=CASE name WHEN 'UNO' THEN 3 WHEN 'Chess' THEN 2 ELSE 1 END");
 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const audit=(actor,action,entity,details={})=>run('INSERT INTO audit_events(actor,action,entity,details,created_at) VALUES(?,?,?,?,?)',String(actor),action,String(entity),JSON.stringify(details),Date.now());
 function seed(){tx(()=>{
  run('INSERT OR IGNORE INTO schema_migrations VALUES(1,?)',Date.now());
  run('INSERT INTO cafe_settings VALUES(1,?)',JSON.stringify({cafeName:'SM Cafinity',tableCount:12,cancellationSeconds:10,earnCoins:5,earnPer:10000,coinValue:100,maxDiscountPercent:10,suggestionCoins:5,cooldownDays:30}));
  for(let n=1;n<=12;n++)run('INSERT INTO cafe_tables(id,token) VALUES(?,?)',n,token());
  ['Coffee','Cold Beverages','Snacks','Desserts'].forEach((x,i)=>run('INSERT INTO menu_categories VALUES(?,?)',i+1,x));
  ['Milk','Coffee','Bread','Cheese','Chocolate','Potato'].forEach((x,i)=>run('INSERT INTO ingredients(id,name) VALUES(?,?)',i+1,x));
  const menu=[['Cappuccino','A velvety espresso, steamed milk and a little everyday magic.',18000,1,'coffee',[1,2]],['Cold Coffee','Chilled, creamy coffee. Your afternoon, upgraded.',20000,2,'cold',[1,2]],['Black Coffee','Bold, clean and beautifully uncomplicated.',13000,1,'black',[2]],['Grilled Cheese Sandwich','Golden toasted bread with a generous melted cheese centre.',16000,3,'sandwich',[3,4]],['French Fries','Crisp golden fries, made for sharing. Or not.',14000,3,'fries',[6]],['Chocolate Brownie','Rich chocolate, a soft centre, a very happy ending.',17000,4,'brownie',[5]]];
  menu.forEach((p,i)=>{run('INSERT INTO products(id,name,description,price,compare_at_price,category_id,image,options) VALUES(?,?,?,?,?,?,?,?)',i+1,p[0],p[1],p[2],i===4?18000:null,p[3],'/images/'+p[4]+'-menu.jpg',i===0?JSON.stringify([{id:'oat',name:'Oat-style demo variation',price:3000,group:'Milk choice'},{id:'shot',name:'Extra espresso shot',price:4000,group:'Add-ons'}]):'[]');p[5].forEach(x=>run('INSERT INTO product_ingredients VALUES(?,?)',i+1,x));});
  run("UPDATE products SET pairing_product_id=6,pairing_reason='Its bold, roasted flavour pairs beautifully with something rich and chocolatey.' WHERE id=1");run("UPDATE products SET pairing_product_id=5,pairing_reason='Crisp and salty meets soft and chocolatey — a playful contrast for the table.' WHERE id=5");
  ['UNO','Chess','Jenga','Connect Four'].forEach((x,i)=>run('INSERT INTO games(id,name,description,quantity_total) VALUES(?,?,?,?)',i+1,x,['A little friendly rivalry. 2–10 players.','Make your next move. 2 players.','Steady hands, great company. 2+ players.','Four in a row. Endless rematches.'][i],[3,2,1,1][i]));
  run("INSERT INTO staff_roles VALUES('owner'),('staff')");
  run('INSERT INTO staff_profiles(username,name,role,password_hash) VALUES(?,?,?,?)','owner','Café Owner','owner',password(process.env.OWNER_PASSWORD||'CafinityOwner!26'));
  run('INSERT INTO staff_profiles(username,name,role,password_hash) VALUES(?,?,?,?)','staff','Café Team','staff',password(process.env.STAFF_PASSWORD||'CafinityStaff!26'));
  ['Aarav · test account','Diya · test account'].forEach((x,i)=>{run('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)',i+1,x,Date.now());run('INSERT INTO loyalty_transactions(customer_id,coins,reason,unique_key,created_at) VALUES(?,?,?,?,?)',i+1,25,'Demo welcome coins','seed-'+i,Date.now());});
 });}
 if(!one('SELECT id FROM cafe_settings'))seed();
 else {
  if(process.env.OWNER_PASSWORD)run("UPDATE staff_profiles SET password_hash=? WHERE username='owner'",password(process.env.OWNER_PASSWORD));
  if(process.env.STAFF_PASSWORD)run("UPDATE staff_profiles SET password_hash=? WHERE username='staff'",password(process.env.STAFF_PASSWORD));
 }
 const settings=()=>JSON.parse(one('SELECT data FROM cafe_settings WHERE id=1').data);
 const balance=id=>one('SELECT COALESCE(SUM(coins),0) n FROM loyalty_transactions WHERE customer_id=?',id).n;
 const products=()=>all('SELECT * FROM products WHERE active=1').map(p=>({...p,options:JSON.parse(p.options),ingredients:all('SELECT ingredient_id FROM product_ingredients WHERE product_id=?',p.id).map(x=>x.ingredient_id),orderable:!!p.available&&!one('SELECT 1 FROM product_ingredients pi JOIN ingredients i ON i.id=pi.ingredient_id WHERE pi.product_id=? AND i.available=0',p.id)}));
 const order=id=>{const o=one('SELECT o.*,b.table_id FROM orders o JOIN table_bills b ON b.id=o.bill_id WHERE o.id=?',id);const transitions=all("SELECT details,created_at FROM audit_events WHERE entity=? AND action='ORDER_STATUS' ORDER BY id",String(id));const statusTimes={};for(const event of transitions){statusTimes[JSON.parse(event.details).to]=event.created_at;}return o?{...o,preparing_at:statusTimes.PREPARING||null,ready_at:statusTimes.READY||null,served_at:statusTimes.SERVED||null,session_token:undefined,request_hash:undefined,items:all('SELECT * FROM order_items WHERE order_id=?',id)}:null;};
 const bill=id=>{const b=one('SELECT * FROM table_bills WHERE id=?',id);if(!b)return null;const orders=all('SELECT id FROM orders WHERE bill_id=?',id).map(x=>order(x.id));const gross=orders.filter(o=>o.status!=='CANCELLED').reduce((s,o)=>s+o.total,0);const discount=one("SELECT COALESCE(SUM(r.value),0) n FROM reward_redemptions r JOIN orders o ON o.id=r.order_id WHERE o.bill_id=? AND r.status!='REVERSED'",id).n;const paid=one('SELECT COALESCE(SUM(amount),0) n FROM payments WHERE bill_id=? AND voided_at IS NULL',id).n;return {...b,orders,gross,discount,total:gross-discount,paid,outstanding:gross-discount-paid,payments:all('SELECT * FROM payments WHERE bill_id=?',id)};};
 const release=()=>run("UPDATE orders SET status='NEW' WHERE status='CANCELLATION_PENDING' AND deadline<=?",Date.now()).changes;
 return {db,all,one,run,tx,audit,seed,settings,balance,products,order,bill,release};
}
