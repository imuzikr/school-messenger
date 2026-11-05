'use strict';
// Regression: parallel login requests must not get more password checks than the limit allows.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https');
const {startServer}=require('../server/index.cjs');
const PASSWORD='Fixture-login-limit-123';
async function fixture(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-login-limit-'));let server,agent;
  try{
    server=await startServer({port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:path.join(root,'server'),admin:{username:'admin',password:PASSWORD}});
    // Warm, kept-alive TLS connections let a burst reach the server together.
    agent=new https.Agent({keepAlive:true,maxSockets:24,ca:server.connection.certificate});
    const call=(route,payload)=>new Promise((resolve,reject)=>{const raw=payload===undefined?null:JSON.stringify(payload),req=https.request({agent,hostname:'127.0.0.1',port:server.port,path:route,method:raw?'POST':'GET',headers:raw?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{}},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(Buffer.concat(chunks).toString('utf8'))}));});req.on('error',reject);if(raw)req.write(raw);req.end();});
    await Promise.all(Array.from({length:24},()=>call('/health')));
    return await fn({call});
  }finally{agent?.destroy();if(server)await server.close();const absolute=path.resolve(root);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('dingdong-login-limit-'));fs.rmSync(absolute,{recursive:true,force:true});}
}
test('parallel wrong passwords cannot exceed the per-account attempt limit',()=>fixture(async({call})=>{
  const burst=await Promise.all(Array.from({length:12},()=>call('/login',{username:'admin',password:'wrong-password-1'})));
  for(const r of burst)assert.ok([401,429].includes(r.status),'unexpected status '+r.status);
  let checked=burst.filter(r=>r.status===401).length;
  assert.ok(checked<=8,'burst produced '+checked+' password checks');
  while(checked<8){const r=await call('/login',{username:'admin',password:'wrong-password-2'});assert.equal(r.status,401);checked++;}
  assert.equal((await call('/login',{username:'admin',password:'wrong-password-3'})).status,429);
  assert.equal((await call('/login',{username:'admin',password:PASSWORD})).status,429,'the account stays locked for this address');
}));
test('one address gets at most two concurrent password checks, across usernames',()=>fixture(async({call})=>{
  const burst=await Promise.all(Array.from({length:20},(_,i)=>call('/login',{username:'missing-'+i,password:'wrong-password'})));
  for(const r of burst)assert.ok([401,429].includes(r.status),'unexpected status '+r.status);
  assert.ok(burst.some(r=>r.status===429&&/잠시 후/.test(r.error)),'some requests were held back by the concurrency limit');
  // Slots are released afterwards: sequential checks keep working.
  assert.equal((await call('/login',{username:'missing-after',password:'wrong-password'})).status,401);
  const ok=await call('/login',{username:'admin',password:PASSWORD});
  assert.equal(ok.status,200);assert.match(ok.token,/^[a-f0-9]{64}$/);
}));
