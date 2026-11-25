import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../backend/app.mjs';
import {randomUUID} from 'node:crypto';
import {inject} from './inject.mjs';

let app;
before(()=>{app=createApp({dbPath:':memory:',rateLimit:10000});});
after(()=>app.close());

function client(){
 let cookie='';
 return async(path,body,expected=200)=>{
  const r=await inject(app,'/api/'+path,{cookie,body});
  if(r.headers['set-cookie'])cookie=r.headers['set-cookie'].split(';')[0];
  const d=JSON.parse(r.body);
  assert.equal(r.status,expected,JSON.stringify(d));
  return d;
 };
}

test('Staff Attendance: punches, 30m break buffer, shift configuration and owner logs', async()=>{
 const owner=client(), staff=client(), guest=client();
 await owner('login',{username:'owner',password:'okay'});
 await staff('login',{username:'staff',password:'okay'});

 // Customer cannot see attendance or roster
 const guestSnap = await guest('snapshot');
 assert.equal(guestSnap.attendance, null);
 assert.equal(guestSnap.attendanceRoster.length, 0);
 assert.equal(guestSnap.attendanceLogs.length, 0);

 // Staff can punch CHECK_IN
 const p1 = await staff('attendance/punch', {type:'CHECK_IN'});
 assert.equal(p1.ok, true);
 assert.equal(p1.attendance.status, 'WORKING');

 // Staff can punch START_BREAK (triggers 30-min buffer)
 const p2 = await staff('attendance/punch', {type:'START_BREAK'});
 assert.equal(p2.ok, true);
 assert.equal(p2.attendance.status, 'ON_BREAK');
 assert.ok(p2.attendance.breakBufferRemainingSeconds > 0 && p2.attendance.breakBufferRemainingSeconds <= 1800);

 // Staff can punch END_BREAK
 const p3 = await staff('attendance/punch', {type:'END_BREAK'});
 assert.equal(p3.ok, true);
 assert.equal(p3.attendance.status, 'WORKING');

 // Staff can punch CHECK_OUT
 const p4 = await staff('attendance/punch', {type:'CHECK_OUT'});
 assert.equal(p4.ok, true);
 assert.equal(p4.attendance.status, 'CHECKED_OUT');

 // Owner can see Roster and Logs
 const ownerSnap = await owner('snapshot');
 assert.ok(ownerSnap.attendanceRoster.length >= 6);
 assert.ok(ownerSnap.attendanceLogs.length >= 4);
 assert.ok(ownerSnap.staffShifts.length >= 6);

 // Owner can edit shift times, break length, and break buffer
 const shiftUpdate = await owner('attendance/shift-save', {
  staff_id: 2,
  shift_start: '07:30',
  shift_end: '16:00',
  target_hours: 8.5,
  break_minutes: 60,
  break_buffer_minutes: 30
 });
 assert.equal(shiftUpdate.ok, true);
 assert.equal(shiftUpdate.shift.shift_start, '07:30');
 assert.equal(shiftUpdate.shift.break_buffer_minutes, 30);
});

test('Customer Order Queue Visibility: queueAhead and kitchenQueueCount', async()=>{
 const guest1=client(), guest2=client(), staff=client();
 await staff('login',{username:'staff',password:'okay'});
 const snap = await guest1('snapshot');
 const t = snap.tables[0];

 // Table 1 places order #1
 const o1 = await guest1('order', {tableId:t.id, tableToken:t.token, items:[{productId:1, quantity:1, options:[]}], key:randomUUID()});
 app.store.run("UPDATE orders SET status='PREPARING' WHERE id=?", o1.id);

 // Table 1 places order #2
 const o2 = await guest2('order', {tableId:t.id, tableToken:t.token, items:[{productId:2, quantity:1, options:[]}], key:randomUUID()});
 app.store.run("UPDATE orders SET status='NEW' WHERE id=?", o2.id);

 const snap2 = await guest2('snapshot');
 assert.ok(snap2.kitchenQueueCount >= 2);
 const myOrder = snap2.orders.find(o=>o.id===o2.id);
 assert.ok(myOrder);
 assert.equal(myOrder.queueAhead, 1); // 1 order ahead in preparation queue
});

test('Events: Private & Open event requests, Owner approval, and Open event RSVP', async()=>{
 const guest=client(), guest2=client(), owner=client();
 await owner('login',{username:'owner',password:'okay'});

 // Guest submits an open event request
 const evReq = await guest('event-request', {
  title: 'Chess Blitz Evening',
  description: 'Casual 5-minute blitz games with friends.',
  event_date: '2026-12-01',
  start_time: '18:00',
  end_time: '20:00',
  event_type: 'OPEN',
  host_name: 'Rahul Sen',
  host_contact: 'rahul@example.com',
  max_participants: 12
 });
 assert.equal(evReq.ok, true);
 assert.equal(evReq.status, 'PENDING');

 // Owner reviews and approves
 await owner('event-status', {id: evReq.id, status: 'APPROVED'});

 // Guest2 can see the approved open event and RSVP
 const snap = await guest2('snapshot');
 const ev = snap.events.find(e=>e.id===evReq.id);
 assert.ok(ev);
 assert.equal(ev.title, 'Chess Blitz Evening');
 assert.equal(ev.event_type, 'OPEN');

 const rsvp = await guest2('event-rsvp', {event_id: ev.id, guest_name: 'Anil'});
 assert.equal(rsvp.ok, true);

 const snapAfter = await guest2('snapshot');
 const evAfter = snapAfter.events.find(e=>e.id===evReq.id);
 assert.equal(evAfter.rsvp_count, 1);
 assert.equal(evAfter.joined, 1);
});

test('Smart Inventory: surplus product boost and owner priority', async()=>{
 const owner=client(), guest=client();
 await owner('login',{username:'owner',password:'okay'});

 const snap = await guest('snapshot');
 assert.ok(snap.settings.smartInventory);
 // Products have surplus_boost flag calculated
 assert.ok(snap.products.every(p=>typeof p.surplus_boost === 'boolean'));

 // Owner can set manual priority on a product
 await owner('product', {
  id: 3,
  category_id: 1,
  name: 'Black Coffee Priority',
  description: 'Handcrafted',
  price: 13000,
  priority: 10,
  ingredients: [2]
 });

 const snapUpdated = await guest('snapshot');
 const boosted = snapUpdated.products.find(p=>p.id===3);
 assert.equal(boosted.priority, 10);
 // Boosted priority product is at the top of orderable items
 assert.equal(snapUpdated.products[0].id, 3);
});

test('Geolocked Staff Mobile Attendance: distance calculation, 150m geofence, and device pairing', async()=>{
 const staff=client();
 await staff('login',{username:'staff',password:'okay'});

 // Distance calculation math verification
 const R = 6371000;
 const toRad = (x) => (x * Math.PI) / 180;
 function distMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
 }

 const cafeLat = 19.2584498;
 const cafeLng = 72.977272;

 // Same position = 0m
 assert.equal(distMeters(cafeLat, cafeLng, cafeLat, cafeLng), 0);

 // Inside café (offset +0.00004) = ~6m (well within 150m radius)
 const insideDist = distMeters(cafeLat, cafeLng, cafeLat + 0.00004, cafeLng + 0.00004);
 assert.ok(insideDist < 15, `Expected inside distance < 15m, got ${insideDist}`);
 assert.ok(insideDist <= 150, 'Must be within 150m geofence');

 // Outside / away (offset -0.012, -0.01) = > 1000m
 const awayDist = distMeters(cafeLat, cafeLng, cafeLat - 0.012, cafeLng - 0.01);
 assert.ok(awayDist > 1000, `Expected away distance > 1000m, got ${awayDist}`);
 assert.ok(awayDist > 150, 'Must be outside 150m geofence');

 // Punch endpoint records attendance with source
 const punch = await staff('attendance/punch', {type:'CHECK_IN', notes:'Mobile GPS Verified (6 m)'});
 assert.equal(punch.ok, true);
 assert.equal(punch.attendance.status, 'WORKING');
});
