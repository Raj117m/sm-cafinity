import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export const token=()=>randomBytes(24).toString('hex');
export const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function password(p,salt=token()){return salt+':'+scryptSync(p,salt,64).toString('hex');}
export function checkPassword(p,s){const [salt,h]=s.split(':');return timingSafeEqual(Buffer.from(h,'hex'),scryptSync(p,salt,64));}

export const todayStr=(offsetMs=19800000)=>new Date(Date.now()+offsetMs).toISOString().slice(0,10);

export function createStore(path='data/cafe.sqlite'){
 if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
 const db=new DatabaseSync(path);db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
 db.exec(readFileSync(new URL('./migrations/001_initial.sql',import.meta.url),'utf8'));
 const all=(q,...p)=>db.prepare(q).all(...p), one=(q,...p)=>db.prepare(q).get(...p), run=(q,...p)=>db.prepare(q).run(...p);

 if(!all('PRAGMA table_info(products)').some(c=>c.name==='compare_at_price'))db.exec("ALTER TABLE products ADD COLUMN compare_at_price INTEGER; ALTER TABLE products ADD COLUMN pairing_product_id INTEGER; ALTER TABLE products ADD COLUMN pairing_reason TEXT NOT NULL DEFAULT ''; UPDATE products SET compare_at_price=18000 WHERE name='French Fries'; UPDATE products SET pairing_product_id=6,pairing_reason='Its bold, roasted flavour pairs beautifully with something rich and chocolatey.' WHERE name='Cappuccino'; UPDATE products SET pairing_product_id=5,pairing_reason='Crisp and salty meets soft and chocolatey — a playful contrast for the table.' WHERE name='French Fries'");
 if(!all('PRAGMA table_info(games)').some(c=>c.name==='quantity_total'))db.exec("ALTER TABLE games ADD COLUMN quantity_total INTEGER NOT NULL DEFAULT 1 CHECK(quantity_total BETWEEN 1 AND 50); UPDATE games SET quantity_total=CASE name WHEN 'UNO' THEN 3 WHEN 'Chess' THEN 2 ELSE 1 END");

 if(!all('PRAGMA table_info(products)').some(c=>c.name==='priority'))db.exec("ALTER TABLE products ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;");
 if(!all('PRAGMA table_info(ingredients)').some(c=>c.name==='stock_units'))db.exec("ALTER TABLE ingredients ADD COLUMN stock_units INTEGER NOT NULL DEFAULT 100;");

 db.exec(`
  CREATE TABLE IF NOT EXISTS staff_shifts (
    staff_id INTEGER PRIMARY KEY REFERENCES staff_profiles(id),
    shift_start TEXT NOT NULL DEFAULT '08:00',
    shift_end TEXT NOT NULL DEFAULT '16:30',
    target_hours REAL NOT NULL DEFAULT 8.0,
    break_minutes INTEGER NOT NULL DEFAULT 60,
    break_buffer_minutes INTEGER NOT NULL DEFAULT 30
  );
  CREATE TABLE IF NOT EXISTS staff_punches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER NOT NULL REFERENCES staff_profiles(id),
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('CHECK_IN','START_BREAK','END_BREAK','CHECK_OUT')),
    timestamp INTEGER NOT NULL,
    notes TEXT DEFAULT '',
    source TEXT NOT NULL DEFAULT 'app'
  );
  CREATE INDEX IF NOT EXISTS idx_punches_staff_date ON staff_punches(staff_id, date);
  CREATE TABLE IF NOT EXISTS cafe_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    event_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('PRIVATE','OPEN')),
    host_name TEXT NOT NULL,
    host_contact TEXT NOT NULL DEFAULT '',
    session_token TEXT,
    customer_id INTEGER REFERENCES customers(id),
    table_id INTEGER REFERENCES cafe_tables(id),
    max_participants INTEGER DEFAULT 12,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','DECLINED')),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS event_rsvps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES cafe_events(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL,
    customer_id INTEGER REFERENCES customers(id),
    guest_name TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE(event_id, session_token)
  );
 `);

 const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 const audit=(actor,action,entity,details={})=>run('INSERT INTO audit_events(actor,action,entity,details,created_at) VALUES(?,?,?,?,?)',String(actor),action,String(entity),JSON.stringify(details),Date.now());

 const staffSeed = [
  { username: 'owner', name: 'Rajdeep · Café Owner', role: 'owner', start: '08:00', end: '17:00', target: 8.5, breakMin: 60, bufferMin: 30 },
  { username: 'staff', name: 'Aarav Sharma · Head Barista', role: 'staff', start: '08:00', end: '16:30', target: 8.0, breakMin: 60, bufferMin: 30 },
  { username: 'rohan', name: 'Rohan Mehta · Senior Barista', role: 'staff', start: '08:30', end: '17:00', target: 8.0, breakMin: 60, bufferMin: 30 },
  { username: 'priya', name: 'Priya Verma · Kitchen & Pastry Chef', role: 'staff', start: '09:00', end: '17:30', target: 8.0, breakMin: 60, bufferMin: 30 },
  { username: 'vikram', name: 'Vikram Rao · Board Games & Host', role: 'staff', start: '11:00', end: '19:30', target: 8.0, breakMin: 60, bufferMin: 30 },
  { username: 'ananya', name: 'Ananya Sen · Operations Lead', role: 'staff', start: '14:00', end: '22:30', target: 8.0, breakMin: 60, bufferMin: 30 },
 ];

 function seedStaffAndEvents(){
  for(const s of staffSeed){
   run("INSERT OR IGNORE INTO staff_profiles(username,name,role,password_hash) VALUES(?,?,?,?)", s.username, s.name, s.role, password('okay'));
   const p = one("SELECT id FROM staff_profiles WHERE username=?", s.username);
   if(p){
    run("INSERT OR IGNORE INTO staff_shifts(staff_id, shift_start, shift_end, target_hours, break_minutes, break_buffer_minutes) VALUES(?,?,?,?,?,?)", p.id, s.start, s.end, s.target, s.breakMin, s.bufferMin);
   }
  }
  const eventsCount = one("SELECT COUNT(*) n FROM cafe_events").n;
  if(eventsCount === 0){
   const d1 = new Date(Date.now() + 86400000 * 2 + 19800000).toISOString().slice(0, 10);
   const d2 = new Date(Date.now() + 86400000 * 4 + 19800000).toISOString().slice(0, 10);
   run("INSERT INTO cafe_events(title, description, event_date, start_time, end_time, event_type, host_name, host_contact, status, max_participants, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    'Open Catan & Strategy Board Game Showdown',
    'Open game night! Multiple tables running Settlers of Catan, Codenames, and Ticket to Ride. Free entry for all guests ordering coffee or snacks.',
    d1, '18:00', '21:30', 'OPEN', 'Vikram Rao · Host', 'vikram@smcafinity.in', 'APPROVED', 16, Date.now()
   );
   run("INSERT INTO cafe_events(title, description, event_date, start_time, end_time, event_type, host_name, host_contact, status, max_participants, created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    'Specialty Coffee Sensory Cupping & Tasting',
    'Guided tasting workshop exploring Coorg & Chikmagalur single-origin roasts, acidity balancing, and brewing notes with our head baristas.',
    d2, '16:00', '18:00', 'OPEN', 'Aarav Sharma · Barista', 'aarav@smcafinity.in', 'APPROVED', 10, Date.now()
   );
  }
 }

 function seed(){tx(()=>{
  run('INSERT OR IGNORE INTO schema_migrations VALUES(1,?)',Date.now());
  run('INSERT INTO cafe_settings VALUES(1,?)',JSON.stringify({cafeName:'SM Cafinity',tableCount:12,cancellationSeconds:10,earnCoins:5,earnPer:10000,coinValue:100,maxDiscountPercent:10,suggestionCoins:5,cooldownDays:30,smartInventory:true}));
  for(let n=1;n<=12;n++)run('INSERT INTO cafe_tables(id,token) VALUES(?,?)',n,token());
  ['Coffee','Cold Beverages','Snacks','Desserts'].forEach((x,i)=>run('INSERT INTO menu_categories VALUES(?,?)',i+1,x));
  ['Milk','Coffee','Bread','Cheese','Chocolate','Potato'].forEach((x,i)=>run('INSERT INTO ingredients(id,name,stock_units) VALUES(?,?,?)',i+1,x,100));
  const menu=[['Cappuccino','A velvety espresso, steamed milk and a little everyday magic.',18000,1,'coffee',[1,2]],['Cold Coffee','Chilled, creamy coffee. Your afternoon, upgraded.',20000,2,'cold',[1,2]],['Black Coffee','Bold, clean and beautifully uncomplicated.',13000,1,'black',[2]],['Grilled Cheese Sandwich','Golden toasted bread with a generous melted cheese centre.',16000,3,'sandwich',[3,4]],['French Fries','Crisp golden fries, made for sharing. Or not.',14000,3,'fries',[6]],['Chocolate Brownie','Rich chocolate, a soft centre, a very happy ending.',17000,4,'brownie',[5]]];
  menu.forEach((p,i)=>{run('INSERT INTO products(id,name,description,price,compare_at_price,category_id,image,options,priority) VALUES(?,?,?,?,?,?,?,?,?)',i+1,p[0],p[1],p[2],i===4?18000:null,p[3],'/images/'+p[4]+'-menu.jpg',i===0?JSON.stringify([{id:'oat',name:'Oat-style demo variation',price:3000,group:'Milk choice'},{id:'shot',name:'Extra espresso shot',price:4000,group:'Add-ons'}]):'[]',0);p[5].forEach(x=>run('INSERT INTO product_ingredients VALUES(?,?)',i+1,x));});
  run("UPDATE products SET pairing_product_id=6,pairing_reason='Its bold, roasted flavour pairs beautifully with something rich and chocolatey.' WHERE id=1");run("UPDATE products SET pairing_product_id=5,pairing_reason='Crisp and salty meets soft and chocolatey — a playful contrast for the table.' WHERE id=5");
  ['UNO','Chess','Jenga','Connect Four'].forEach((x,i)=>run('INSERT INTO games(id,name,description,quantity_total) VALUES(?,?,?,?)',i+1,x,['A little friendly rivalry. 2–10 players.','Make your next move. 2 players.','Steady hands, great company. 2+ players.','Four in a row. Endless rematches.'][i],[3,2,1,1][i]));
  run("INSERT OR IGNORE INTO staff_roles VALUES('owner'),('staff')");
  seedStaffAndEvents();
  ['Aarav · test account','Diya · test account'].forEach((x,i)=>{run('INSERT INTO customers(id,name,created_at) VALUES(?,?,?)',i+1,x,Date.now());run('INSERT INTO loyalty_transactions(customer_id,coins,reason,unique_key,created_at) VALUES(?,?,?,?,?)',i+1,25,'Demo welcome coins','seed-'+i,Date.now());});
 });}

 if(!one('SELECT id FROM cafe_settings'))seed();
 else {
  seedStaffAndEvents();
  if(process.env.OWNER_PASSWORD)run("UPDATE staff_profiles SET password_hash=? WHERE username='owner'",password(process.env.OWNER_PASSWORD));
  if(process.env.STAFF_PASSWORD)run("UPDATE staff_profiles SET password_hash=? WHERE username='staff'",password(process.env.STAFF_PASSWORD));
 }

 const settings=()=>{
  const s = JSON.parse(one('SELECT data FROM cafe_settings WHERE id=1').data);
  return { smartInventory: true, ...s };
 };
 const balance=id=>one('SELECT COALESCE(SUM(coins),0) n FROM loyalty_transactions WHERE customer_id=?',id).n;

 const products=(cfg=settings())=>{
  const items = all('SELECT * FROM products WHERE active=1').map(p=>({
   ...p,
   priority: p.priority || 0,
   options: JSON.parse(p.options),
   ingredients: all('SELECT ingredient_id FROM product_ingredients WHERE product_id=?',p.id).map(x=>x.ingredient_id),
   orderable: !!p.available && !one('SELECT 1 FROM product_ingredients pi JOIN ingredients i ON i.id=pi.ingredient_id WHERE pi.product_id=? AND i.available=0',p.id)
  }));

  const salesMap = new Map();
  for(const r of all('SELECT product_id, SUM(quantity) as qty FROM order_items GROUP BY product_id')){
   salesMap.set(r.product_id, r.qty);
  }

  // Smart Inventory Calculation: items with lower sales and surplus ingredient stock get boosted
  return items.map(p=>{
   const sales = salesMap.get(p.id) || 0;
   const surplusBoost = cfg.smartInventory && sales <= 2;
   return { ...p, surplus_boost: surplusBoost };
  }).sort((a,b)=>{
   if(b.orderable !== a.orderable) return b.orderable ? 1 : -1;
   if((b.priority || 0) !== (a.priority || 0)) return (b.priority || 0) - (a.priority || 0);
   if(cfg.smartInventory && b.surplus_boost !== a.surplus_boost) return b.surplus_boost ? 1 : -1;
   return a.id - b.id;
  });
 };

 const queueAhead=(createdAt)=>one("SELECT COUNT(*) n FROM orders WHERE status IN ('NEW','PREPARING') AND created_at < ?", createdAt).n;
 const kitchenQueueCount=()=>one("SELECT COUNT(*) n FROM orders WHERE status IN ('NEW','PREPARING')").n;

 const order=id=>{
  const o=one('SELECT o.*,b.table_id FROM orders o JOIN table_bills b ON b.id=o.bill_id WHERE o.id=?',id);
  if(!o) return null;
  const transitions=all("SELECT details,created_at FROM audit_events WHERE entity=? AND action='ORDER_STATUS' ORDER BY id",String(id));
  const statusTimes={};
  for(const event of transitions){statusTimes[JSON.parse(event.details).to]=event.created_at;}
  const ahead = (o.status === 'NEW' || o.status === 'PREPARING') ? queueAhead(o.created_at) : 0;
  return {
   ...o,
   preparing_at:statusTimes.PREPARING||null,
   ready_at:statusTimes.READY||null,
   served_at:statusTimes.SERVED||null,
   queueAhead: ahead,
   session_token:undefined,
   request_hash:undefined,
   items:all('SELECT * FROM order_items WHERE order_id=?',id)
  };
 };

 const bill=id=>{
  const b=one('SELECT * FROM table_bills WHERE id=?',id);
  if(!b)return null;
  const orders=all('SELECT id FROM orders WHERE bill_id=?',id).map(x=>order(x.id));
  const gross=orders.filter(o=>o.status!=='CANCELLED').reduce((s,o)=>s+o.total,0);
  const discount=one("SELECT COALESCE(SUM(r.value),0) n FROM reward_redemptions r JOIN orders o ON o.id=r.order_id WHERE o.bill_id=? AND r.status!='REVERSED'",id).n;
  const paid=one('SELECT COALESCE(SUM(amount),0) n FROM payments WHERE bill_id=? AND voided_at IS NULL',id).n;
  return {...b,orders,gross,discount,total:gross-discount,paid,outstanding:gross-discount-paid,payments:all('SELECT * FROM payments WHERE bill_id=?',id)};
 };

 const release=()=>run("UPDATE orders SET status='NEW' WHERE status='CANCELLATION_PENDING' AND deadline<=?",Date.now()).changes;

 // Attendance Helpers
 function getStaffShift(staffId){
  let s = one("SELECT * FROM staff_shifts WHERE staff_id=?", staffId);
  if(!s){
   run("INSERT OR IGNORE INTO staff_shifts(staff_id, shift_start, shift_end, target_hours, break_minutes, break_buffer_minutes) VALUES(?,'08:00','16:30',8.0,60,30)", staffId);
   s = one("SELECT * FROM staff_shifts WHERE staff_id=?", staffId);
  }
  return s;
 }

 function calculateWorkedAndBreak(punches, now=Date.now()){
  let workedMs = 0;
  let breakMs = 0;
  let lastCheckIn = null;
  let lastBreakStart = null;
  let currentStatus = 'NOT_CHECKED_IN';

  for(const p of punches){
   if(p.type === 'CHECK_IN'){
    lastCheckIn = p.timestamp;
    currentStatus = 'WORKING';
   } else if(p.type === 'START_BREAK'){
    if(lastCheckIn) workedMs += (p.timestamp - lastCheckIn);
    lastCheckIn = null;
    lastBreakStart = p.timestamp;
    currentStatus = 'ON_BREAK';
   } else if(p.type === 'END_BREAK'){
    if(lastBreakStart) breakMs += (p.timestamp - lastBreakStart);
    lastBreakStart = null;
    lastCheckIn = p.timestamp;
    currentStatus = 'WORKING';
   } else if(p.type === 'CHECK_OUT'){
    if(lastCheckIn) workedMs += (p.timestamp - lastCheckIn);
    if(lastBreakStart) breakMs += (p.timestamp - lastBreakStart);
    lastCheckIn = null;
    lastBreakStart = null;
    currentStatus = 'CHECKED_OUT';
   }
  }

  if(currentStatus === 'WORKING' && lastCheckIn){
   workedMs += Math.max(0, now - lastCheckIn);
  } else if(currentStatus === 'ON_BREAK' && lastBreakStart){
   breakMs += Math.max(0, now - lastBreakStart);
  }

  const lastPunch = punches[punches.length - 1];
  let breakBufferRemaining = 0;
  if(currentStatus === 'ON_BREAK' && lastPunch){
   const bufferMs = 30 * 60 * 1000; // 30-minute buffer
   breakBufferRemaining = Math.max(0, Math.floor((bufferMs - (now - lastPunch.timestamp)) / 1000));
  }

  return {
   status: currentStatus,
   workedSeconds: Math.floor(workedMs / 1000),
   breakSeconds: Math.floor(breakMs / 1000),
   breakBufferRemainingSeconds: breakBufferRemaining
  };
 }

 function getStaffAttendance(staffId, date=todayStr()){
  const shift = getStaffShift(staffId);
  const punches = all("SELECT * FROM staff_punches WHERE staff_id=? AND date=? ORDER BY timestamp ASC", staffId, date);
  const calc = calculateWorkedAndBreak(punches);
  return {
   staff_id: staffId,
   shift,
   punches,
   ...calc
  };
 }

 function getTodayRoster(date=todayStr()){
  const staffMembers = all("SELECT id, username, name, role, active FROM staff_profiles WHERE active=1 ORDER BY id ASC");
  return staffMembers.map(st => {
   const shift = getStaffShift(st.id);
   const punches = all("SELECT * FROM staff_punches WHERE staff_id=? AND date=? ORDER BY timestamp ASC", st.id, date);
   const calc = calculateWorkedAndBreak(punches);
   return {
    staff_id: st.id,
    name: st.name,
    username: st.username,
    role: st.role,
    shift,
    status: calc.status,
    workedSeconds: calc.workedSeconds,
    breakSeconds: calc.breakSeconds,
    lastPunch: punches[punches.length - 1] || null
   };
  });
 }

 function getAttendanceLogs(limit=100){
  return all("SELECT p.*, s.name as staff_name FROM staff_punches p JOIN staff_profiles s ON s.id=p.staff_id ORDER BY p.id DESC LIMIT ?", limit);
 }

 function getStaffShifts(){
  return all("SELECT s.*, p.name as staff_name, p.username, p.role FROM staff_shifts s JOIN staff_profiles p ON p.id=s.staff_id ORDER BY p.id ASC");
 }

 function saveStaffShift(b){
  run(`INSERT INTO staff_shifts(staff_id, shift_start, shift_end, target_hours, break_minutes, break_buffer_minutes)
       VALUES(?,?,?,?,?,?)
       ON CONFLICT(staff_id) DO UPDATE SET
       shift_start=excluded.shift_start,
       shift_end=excluded.shift_end,
       target_hours=excluded.target_hours,
       break_minutes=excluded.break_minutes,
       break_buffer_minutes=excluded.break_buffer_minutes`,
   Number(b.staff_id), String(b.shift_start), String(b.shift_end), Number(b.target_hours||8), Number(b.break_minutes||60), Number(b.break_buffer_minutes||30)
  );
  return getStaffShift(b.staff_id);
 }

 function recordPunch(staffId, type, notes='', date=todayStr(), ts=Date.now(), source='app'){
  const id = Number(run("INSERT INTO staff_punches(staff_id, date, type, timestamp, notes, source) VALUES(?,?,?,?,?,?)", staffId, date, type, ts, notes, source).lastInsertRowid);
  return one("SELECT * FROM staff_punches WHERE id=?", id);
 }

 // Events Helpers
 function getEvents(sessionToken='', isStaff=false){
  if(isStaff){
   return all(`SELECT e.*,
     (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id) as rsvp_count
     FROM cafe_events e ORDER BY e.event_date ASC, e.start_time ASC`);
  }
  return all(`SELECT e.*,
    (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id) as rsvp_count,
    (SELECT COUNT(*) FROM event_rsvps r WHERE r.event_id=e.id AND r.session_token=?) as joined
    FROM cafe_events e
    WHERE e.status='APPROVED' OR e.session_token=?
    ORDER BY e.event_date ASC, e.start_time ASC`, sessionToken, sessionToken);
 }

 return {
  db,all,one,run,tx,audit,seed,settings,balance,products,order,bill,release,
  queueAhead,kitchenQueueCount,
  getStaffShift,getStaffAttendance,getTodayRoster,getAttendanceLogs,getStaffShifts,saveStaffShift,recordPunch,
  getEvents,todayStr
 };
}
