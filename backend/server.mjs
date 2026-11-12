import { createApp } from './app.mjs';
import { networkInterfaces } from 'node:os';
if(process.env.DEMO_MODE==='false'&&(!process.env.OWNER_PASSWORD||!process.env.STAFF_PASSWORD))throw new Error('Production mode requires OWNER_PASSWORD and STAFF_PASSWORD; existing users retain their stored passwords.');
if (process.env.HOSTED_DEMO === 'true' &&
    [process.env.OWNER_PASSWORD, process.env.STAFF_PASSWORD].some(
      value => !value || value.length < 16 || /^Cafinity(?:Owner|Staff)!26$/.test(value),
    )) {
  throw new Error('Hosted demos require unique, generated staff passwords.');
}
const port=Number(process.env.PORT||4173);
const app=createApp({dbPath:process.env.DATABASE_PATH||'data/cafe.sqlite',demo:process.env.DEMO_MODE!=='false'});
app.server.on('error',error=>{console.error('Could not start the café server:',error.message);process.exit(1);});
app.server.listen(port,'0.0.0.0',()=>{console.log(`SM Cafinity running: http://localhost:${port}`);for(const xs of Object.values(networkInterfaces()))for(const x of xs||[])if(x.family==='IPv4'&&!x.internal)console.log(`LAN: http://${x.address}:${port}`);});
process.on('SIGTERM',()=>{app.close();process.exit(0);});
