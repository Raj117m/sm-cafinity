import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {build} from 'esbuild';
import {createApp} from '../backend/app.mjs';
import {inject} from './inject.mjs';
const dom=new JSDOM('<!DOCTYPE html><html><body></body></html>',{url:'http://localhost/'});
for(const key of ['window','document','navigator','HTMLElement','HTMLDialogElement','Node','Event','MouseEvent','localStorage','sessionStorage','location','history'])Object.defineProperty(globalThis,key,{value:dom.window[key],configurable:true});
window.scrollTo=()=>{};globalThis.confirm=()=>true;globalThis.alert=()=>{};
HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
const app=createApp({dbPath:':memory:',rateLimit:10000});
const cookies=new Map();let es;
globalThis.EventSource=class{constructor(){es=this;}addEventListener(type,fn){this[type]=fn;}close(){}};
globalThis.fetch=async(url,options={})=>{const scope=new URL(url,'http://localhost').searchParams.get('scope')||'guest';const r=await inject(app,url,{cookie:cookies.get(scope)||'',body:options.body?JSON.parse(options.body):undefined});if(r.headers['set-cookie'])cookies.set(scope,r.headers['set-cookie'].split(';')[0]);return {ok:r.status===200,status:r.status,json:async()=>JSON.parse(r.body)};};
await build({entryPoints:['src/App.tsx'],outfile:'tests/.ui-build.mjs',bundle:true,format:'esm',platform:'node',packages:'external',jsx:'automatic',logLevel:'silent'});
const React=await import('react');const {render,screen,fireEvent,waitFor,cleanup}=await import('@testing-library/react');const {App}=await import('./.ui-build.mjs');
after(()=>{cleanup();app.close();dom.window.close();});
const click=label=>fireEvent.click(screen.getByRole('button',{name:label}));
let initialOrder;
test('customer UI: table 4, add 2 cappuccinos and sandwich, server total, cancellation',async()=>{
 render(React.createElement(App));await screen.findByText('WELCOME TO SM CAFINITY');click(/Open the menu/);await screen.findByText('From our kitchen');
 click('Add Cappuccino');click('Add Cappuccino');assert.match(screen.getByRole('button',{name:'Add Cappuccino'}).textContent,/2 added/);assert.equal(screen.queryByRole('dialog'),null);assert.ok(screen.getByRole('complementary',{name:'Pairing for Cappuccino'}));click('Add Grilled Cheese Sandwich');click(/3 items · Review order/);assert.ok(screen.getAllByText(/₹520/).length>0);click('Place Order');await screen.findByText('Order saved. Your cancellation window is open.');initialOrder=app.store.all('SELECT id FROM orders')[0].id;assert.equal(app.store.order(initialOrder).total,52000);click(/Cancel order ·/);await waitFor(()=>assert.equal(app.store.order(initialOrder).status,'CANCELLED'));await screen.findByText('Order cancelled.');
});
test('customer UI: optional account, suggestion earns coins, ingredient menu updates',async()=>{
 click('Rewards');click('Aarav · test account');await screen.findByText('Demo welcome coins');click('Games');fireEvent.change(screen.getByPlaceholderText('Monopoly? Scrabble? Your call.'),{target:{value:'Monopoly'}});click(/Send suggestion/);await waitFor(()=>assert.equal(app.store.balance(1),30));click('Menu');app.store.run('UPDATE ingredients SET available=0 WHERE id=1');es.change();await waitFor(()=>assert.equal(screen.getByRole('button',{name:'Add Cappuccino'}).disabled,true));assert.equal(screen.getByRole('button',{name:'Add Black Coffee'}).disabled,false);
});
test('staff UI: separate auth, counter order, payment modal and paid state',async()=>{
 cleanup();history.pushState({},'','/staff');render(React.createElement(App));await screen.findByText('Welcome back.');fireEvent.change(screen.getByLabelText('Password'),{target:{value:'CafinityOwner!26'}});click('Open dashboard');await screen.findByText('Start new orders, then mark them ready and served.');click('Counter order');click('Add Black Coffee');click('Confirm & send order');await screen.findByText('Counter order sent to kitchen');const o=app.store.all("SELECT id FROM orders WHERE source='COUNTER'")[0];assert.equal(app.store.order(o.id).status,'NEW');click('Tables & payments');click(/Bill #\d+ · Counter/);click('Record Payment');fireEvent.click(screen.getByRole('checkbox'));click('Confirm Payment');await waitFor(()=>assert.equal(app.store.bill(app.store.order(o.id).bill_id).status,'PAID'));assert.ok(cookies.get('staff').startsWith('cafe_staff='));assert.ok(cookies.get('guest').startsWith('cafe_session='));
});
test('customer UI: Events tab and staff UI: Attendance tab with 6-staff roster',async()=>{
 cleanup();history.pushState({},'','/');render(React.createElement(App));await screen.findByText('WELCOME TO SM CAFINITY');click(/Open the menu/);await screen.findByText('From our kitchen');
 click('Events');await screen.findByText('Café Gatherings');assert.ok(screen.getByRole('button',{name:/Request or Host an Event/}));
 cleanup();history.pushState({},'','/staff');render(React.createElement(App));await screen.findByText('Start new orders, then mark them ready and served.');
 click('Attendance');await screen.findByText(/Live Staff Roster Today/);
 assert.ok(screen.getAllByText('Rajdeep · Café Owner').length >= 1);
 assert.ok(screen.getByText('Aarav Sharma · Head Barista'));
 assert.ok(screen.getByText('Rohan Mehta · Senior Barista'));
 assert.ok(screen.getByText('Priya Verma · Kitchen & Pastry Chef'));
 assert.ok(screen.getByText('Vikram Rao · Board Games & Host'));
 assert.ok(screen.getByText('Ananya Sen · Operations Lead'));
});
test('third UI: staff mobile geolocked attendance portal and landing entry card',async()=>{
 cleanup();history.pushState({},'','/');render(React.createElement(App));await screen.findByText('WELCOME TO SM CAFINITY');
 assert.ok(screen.getByText('Staff clock-in'));
 click(/Staff clock-in/);
 await screen.findByText(/STAFF ATTENDANCE PORTAL/);
 assert.ok(screen.getAllByText(/SM CAFINITY/).length >= 1);
});
