'use strict';
// Reproducible 70-account HTTPS/SSE + real PrivateClient + renderer-backend load test.
// No Electron windows/DPAPI or school network are included. Accounts are already authenticated.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https'),vm=require('node:vm'),assert=require('node:assert/strict'),{fork}=require('node:child_process');
const {PrivateClient}=require('../desktop/private-client.cjs'),{createEventStream}=require('../desktop/event-stream.cjs');
const count=70,label=process.argv[2]||'current',output=path.resolve(__dirname,'../../../.artifacts/concurrent-presence',label+'.json'),baseline=process.argv[3]&&path.resolve(process.argv[3]);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-concurrent-')),child=fork(path.join(__dirname,'helpers/concurrent-server.cjs'),[],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});
let serial=0,stderr='',active=0,last=performance.now(),records=[],logical=[],events={},networkErrors=[],sequence=0;
const pending=new Map(),clients=[],failures=[];child.stderr.on('data',v=>stderr+=v);
child.on('message',m=>{const job=pending.get(m.id);if(job){pending.delete(m.id);m.error?job.reject(Error(m.error)):job.resolve(m.result);}});
child.on('exit',code=>{for(const job of pending.values())job.reject(Error('server exited '+code+' '+stderr));pending.clear();});
function rpc(op,extra={}){const id=++serial;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});child.send({id,op,...extra});});}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,name,timeout=90000){const end=Date.now()+timeout;while(!fn()){if(failures.length||Date.now()>end)throw Error('Timed out or failed: '+name+' '+JSON.stringify({active,requests:records.length,failures,missingShared:clients.filter(c=>!c.backend.baseline?.events.some(e=>e.id==='shared-all')).map(c=>c.user.id)}));await pause(50);}}
async function settled(){await until(()=>!active&&performance.now()-last>750&&clients.every(c=>!c.backend.refreshTimer&&!c.backend.refreshJob&&!c.backend.pending),'quiet clients');}
function summary(rows){const times=rows.map(r=>r.ms).sort((a,b)=>a-b);return {count:rows.length,bytes:rows.reduce((n,r)=>n+(r.bytes||0),0),p95Ms:+(times[Math.max(0,Math.ceil(times.length*.95)-1)]||0).toFixed(1),maxMs:+(times.at(-1)||0).toFixed(1)};}
async function phase(name,run){
  console.log('Starting '+name);await settled();records=[];logical=[];events={};networkErrors=[];await rpc('reset');const start=performance.now();
  const extra=await run();await settled();const server=await rpc('metrics');
  const report={name,wallMs:Math.round(performance.now()-start),http:summary(records),bootstrap:summary(records.filter(r=>r.route==='/bootstrap')),clientRefresh:summary(logical),events,networkErrors,server,...extra};
  assert.equal(failures.length,0,JSON.stringify(failures));console.log(JSON.stringify({...report,server:{...server,topQueries:undefined}}));return report;
}
(async()=>{
  let agent;
  try{
    const {users,connection}=await rpc('start',{root,count,...(baseline?{serverSource:path.join(baseline,'index.cjs')}:{})});agent=new https.Agent({keepAlive:true,maxSockets:300,ca:connection.certificate});
    const raw=(user,route,payload)=>new Promise((resolve,reject)=>{
      const body=payload===undefined?null:JSON.stringify(payload),started=performance.now();active++;
      const req=https.request(new URL(route,connection.url),{agent,method:body?'POST':'GET',headers:{authorization:'Bearer '+user.token,...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{})}},res=>{
        const chunks=[];res.on('data',c=>chunks.push(c));res.on('error',reject);res.on('end',()=>{const data=Buffer.concat(chunks);records.push({route:route.split('?')[0],ms:performance.now()-started,bytes:data.length});try{const result=JSON.parse(data.toString('utf8'));if(res.statusCode>=400)failures.push({route,status:res.statusCode,error:result.error});resolve({...result,status:res.statusCode});}catch(e){reject(e);}});
      });req.on('error',reject);req.setTimeout(60000,()=>req.destroy(Error('HTTPS timeout')));req.end(body);
    }).catch(error=>{networkErrors.push({route,user:user.id,error:error.code||error.message});throw error;}).finally(()=>{active--;last=performance.now();});
    const source=fs.readFileSync(baseline?path.join(baseline,'backend.js'):path.join(__dirname,'../js/backend.js'),'utf8');
    for(const user of users){
      const client=new PrivateClient({root:path.join(root,user.id),server:connection.fingerprint,user,request:(r,p)=>raw(user,r,p),protector:{encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()}});
      const context={window:{},setTimeout,clearTimeout};vm.runInNewContext(source,context);
      const entry={client,user,connected:false,arrivals:new Map()},native={connection:async()=>connection,subscribe:fn=>entry.listener=fn,request:async(r,p)=>{const start=performance.now();try{const result=await client.request(r,p);if(r==='/bootstrap')logical.push({ms:performance.now()-start});return result;}catch(error){failures.push({user:user.id,route:r,error:error.stack});throw error;}}};
      entry.backend=new context.window.DingdongBackend(native,{data:r=>{entry.data=r.data;for(const m of r.data.mails)if(!entry.arrivals.has(m.id))entry.arrivals.set(m.id,performance.now());},status:()=>{},error:e=>failures.push(e),expired:()=>failures.push('unexpected expiration'),presence:()=>{}});
      entry.stream=createEventStream({current:()=>({token:user.token,connection}),emit:e=>{last=performance.now();events[e.kind]=(events[e.kind]||0)+1;if(e.kind==='connected')entry.connected=true;entry.listener(e);},expired:()=>failures.push('expired SSE')});clients.push(entry);
    }
    // Prepare keys and each PC's existing authenticated snapshot before measuring reconnects.
    await Promise.all(clients.map(c=>c.client.initialize()));await Promise.all(clients.map(c=>c.backend.init()));await settled();
    const reports=[];
    reports.push(await phase('connect-70',async()=>{for(const c of clients)c.stream.start();await until(()=>clients.every(c=>c.connected),'70 SSE connections');await settled();const correctViews=clients.filter(c=>c.backend.baseline.people.filter(p=>p.status==='online').length===count).length;if(!baseline)assert.equal(correctViews,count);return {correctViews};}));
    reports.push(await phase('reconnect-10',async()=>{
      for(const c of clients.slice(0,10)){c.connected=false;c.stream.stop();}
      last=performance.now();
      await settled();const correctOfflineViews=clients.slice(10).filter(c=>c.backend.baseline.people.filter(p=>p.status==='online').length===60).length;if(!baseline)assert.equal(correctOfflineViews,60);
      for(const c of clients.slice(0,10))c.stream.start();await until(()=>clients.every(c=>c.connected),'reconnected');await settled();const correctViews=clients.filter(c=>c.backend.baseline.people.filter(p=>p.status==='online').length===count).length;if(!baseline)assert.equal(correctViews,count);return {correctOfflineViews,correctViews};
    }));
    reports.push(await phase('group-message-69-recipients',async()=>{
      const start=performance.now(),id='load-message-'+(++sequence);
      await clients[0].client.request('/sync',{operations:[{type:'mail.send',value:{id,title:'동시 접속 시험',body:'합성 메시지',to:users.slice(1).map(u=>u.id),cc:[],files:[]}}]});
      await settled();const arrivals=clients.slice(1).map(c=>c.arrivals.get(id)).filter(Boolean),deliveryMs=arrivals.length===count-1?Math.round(Math.max(...arrivals)-start):null;
      const storedReceipts=Object.keys(clients[0].client.store.get('mail-history',id).storedReceipts||{}).length-1;
      if(!baseline){assert.equal(arrivals.length,count-1);assert.equal(storedReceipts,count-1);for(const c of clients.slice(1))assert.equal(c.backend.baseline.mails.filter(m=>m.id===id).length,1);}
      return {deliveryMs,received:arrivals.length,storedReceipts};
    }));
    reports.push(await phase('shared-calendar-change',async()=>{
      await raw(users[0],'/sync',{operations:[{type:'event.upsert',value:{id:'shared-all',title:'공유 변경 시험',date:'2026-11-12',start:'10:00',end:'11:00',type:'group',targets:users.map(u=>u.id),note:'',place:''}}]});
      await settled();const correctViews=clients.filter(c=>c.backend.baseline.events.some(e=>e.id==='shared-all')).length;if(!baseline)assert.equal(correctViews,count);return {correctViews};
    }));
    reports.push(await phase('two-person-calendar-change',async()=>{
      await raw(users[0],'/sync',{operations:[{type:'event.upsert',value:{id:'shared-pair',title:'두 명의 일정',date:'2026-11-12',start:'10:00',end:'11:00',type:'group',targets:[users[1].id],note:'',place:''}}]});
      await settled();const viewers=clients.filter(c=>c.backend.baseline.events.some(e=>e.id==='shared-pair')).map(c=>c.user.id);if(!baseline)assert.deepEqual(viewers,users.slice(0,2).map(u=>u.id));return {viewers:viewers.length};
    }));
    reports.push(await phase('settings-backup',async()=>{await rpc('backup',{file:path.join(root,'backup.sqlite')});}));
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({label,at:new Date().toISOString(),node:process.version,cpu:os.cpus()[0].model,count,seededEvents:840,model:'one renderer backend and durable PrivateClient per account; separate server process; authenticated sessions; localhost TLS; no Electron rendering or school LAN',reports},null,2));console.log('Saved '+output);
  }finally{
    for(const c of clients){c.backend.active=false;c.stream.stop();clearTimeout(c.backend.refreshTimer);clearTimeout(c.backend.loginRetry);}
    await Promise.all(clients.map(c=>c.client.queue));for(const c of clients)c.client.close();agent?.destroy();
    if(child.connected)await rpc('stop');
    assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert.ok(path.basename(root).startsWith('dingdong-concurrent-'));fs.rmSync(root,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);if(child.connected)child.kill();process.exitCode=1;});
