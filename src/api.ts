export const uid=()=>globalThis.crypto?.randomUUID?.()||Array.from(globalThis.crypto.getRandomValues(new Uint8Array(20)),n=>n.toString(16).padStart(2,'0')).join('');
export async function api<T=unknown>(path:string,body?:unknown):Promise<T>{
 const isStaffScope = ['/staff', '/', '/qr', '/attendance', '/clockin'].includes(location.pathname);
 const r=await fetch('/api/'+path+(path.includes('?')?'&':'?')+'scope='+(isStaffScope?'staff':'guest'),{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),credentials:'same-origin'});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'Unable to complete request');return data as T;
}
export const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n/100);
export const time=(n:number)=>new Date(n).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'});
