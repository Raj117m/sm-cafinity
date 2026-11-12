// Exercises the real HTTP request listener without opening a socket.
// This is not a browser, LAN or network latency test.
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
export function inject(app,url,{cookie='',body,method,headers={},stream=false}={}){
 return new Promise((resolve,reject)=>{
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]);
  req.url=url;req.method=method||(body===undefined?'GET':'POST');req.headers={host:'localhost',cookie,...headers};req.socket={remoteAddress:'127.0.0.1'};
  const res=new EventEmitter();res.headers={};res.statusCode=200;res.body='';res.headersSent=false;res.writableEnded=false;
  res.setHeader=(k,v)=>{res.headers[k.toLowerCase()]=v;};
  res.writeHead=(code,h={})=>{res.statusCode=code;res.headersSent=true;for(const [k,v]of Object.entries(h))res.setHeader(k,v);};
  res.write=chunk=>{res.body+=chunk;res.emit('chunk',chunk);if(stream)resolve({res,req});return true;};
  res.end=chunk=>{if(chunk)res.body+=chunk;res.writableEnded=true;resolve({status:res.statusCode,headers:res.headers,body:res.body});};
  req.on('error',reject);app.server.emit('request',req,res);
 });
}
