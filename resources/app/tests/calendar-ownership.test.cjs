'use strict';
// Regression: a received mail must never overwrite, take over or delete a calendar
// entry that belongs to someone else on the recipient's PC. Synthetic accounts only.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),https=require('node:https'),assert=require('node:assert/strict'),{randomBytes}=require('node:crypto'),{DatabaseSync}=require('node:sqlite');
const {test}=require('node:test');
const appDir=path.resolve(__dirname,'..');
const {startServer}=require(path.join(appDir,'server/index.cjs')),{PrivateClient}=require(path.join(appDir,'desktop/private-client.cjs')),crypto=require(path.join(appDir,'privacy/crypto.cjs'));
const DATE='2030-04-15';
const personal=(id,title)=>({id,title,date:DATE,start:'09:00',end:'10:00',type:'personal',targets:[],note:title+' 메모',place:''});
async function fixture(fn){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-calendar-owner-')),clients=[],tokens={},users={};let server;
  try{
    server=await startServer({port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:path.join(root,'server'),admin:{username:'audit',password:'Synthetic-audit-password-123'}});
    const call=(name,route,payload)=>new Promise((resolve,reject)=>{const body=payload===undefined?null:JSON.stringify(payload),req=https.request({hostname:'127.0.0.1',port:server.port,path:route,method:body?'POST':'GET',ca:server.connection.certificate,headers:{...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{}),...(tokens[name]?{authorization:'Bearer '+tokens[name]}:{})}},res=>{const chunks=[];res.on('data',s=>chunks.push(s));res.on('end',()=>resolve({status:res.statusCode,...JSON.parse(Buffer.concat(chunks).toString('utf8'))}));});req.on('error',reject);if(body)req.write(body);req.end();});
    const login=await call(null,'/login',{username:'audit',password:'Synthetic-audit-password-123'});tokens.a=login.token;users.a=login.user;
    const sql=(q,values=[],write=false)=>{const db=new DatabaseSync(path.join(root,'server/dingdong.sqlite'));try{return write?db.prepare(q).run(...values):db.prepare(q).all(...values);}finally{db.close();}};
    const base=sql('SELECT * FROM users WHERE id=?',[users.a.id])[0];for(const name of ['b','c']){users[name]={id:'audit-'+name,name,username:name};tokens[name]=randomBytes(32).toString('hex');sql('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt) VALUES(?,?,?,?,?,?,?,?,?)',[users[name].id,name,name,'시험','교사','','',base.digest,base.salt],true);sql('INSERT INTO sessions VALUES(?,?,?)',[crypto.digest(tokens[name]),users[name].id,Date.now()+86400000],true);}
    const make=name=>{const c=new PrivateClient({root:path.join(root,name),server:server.connection.fingerprint,user:users[name],request:(r,p)=>call(name,r,p),protector:{encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()}});clients.push(c);return c;};
    const a=make('a'),b=make('b'),c=make('c');await Promise.all(clients.map(c=>c.initialize()));for(const cl of clients)await cl.request('/bootstrap');
    // A modified sender client: the action is signed by the real sender key but skips local checks.
    const deliver=async(action,targets=[users.b.id])=>{a.stage(action,targets);await a.request('/bootstrap');assert.equal(a.store.all('relay-outbox').length,0,'forged packet was sent');assert.equal(a.store.all('relay-failed').length,0,'forged packet was accepted by the server');};
    const forgedMail=(id,extra={})=>({type:'mail.create',value:{id,title:'합성 위조 '+id,body:'합성 위조 본문 '+id,html:'',to:[users.b.id],cc:[],files:[],createdAt:Date.now(),date:DATE,time:'09:00',scheduled:'',...extra}});
    const mailOp=(id,extra={},to=[users.b.id])=>({type:'mail.send',value:{id,title:'합성 '+id,body:'합성 본문 '+id,html:'',to,cc:[],files:[],...extra}});
    return await fn({a,b,c,users,deliver,forgedMail,mailOp});
  }finally{for(const c of clients)if(c.store.db)c.close();if(server)await server.close();const absolute=path.resolve(root);assert.equal(path.dirname(absolute),path.resolve(os.tmpdir()));assert.ok(path.basename(absolute).startsWith('dingdong-calendar-owner-'));fs.rmSync(absolute,{recursive:true,force:true});}
}
function assertIntact(client,result,event){
  const stored=client.store.get('local-events',event.id);
  assert.ok(stored&&!stored.deleted,event.id+' must remain on the recipient PC');
  assert.equal(stored.title,event.title);assert.equal(stored.owner,client.user.id);assert.equal(stored.date,event.date);assert.equal(stored.start,event.start);
  const shown=result.data.events.find(e=>e.id===event.id);
  assert.ok(shown,event.id+' must remain visible');assert.equal(shown.title,event.title);
}
test('a received calendar link cannot overwrite, take over or delete the recipient\'s own entry',()=>fixture(async({a,b,users,deliver,forgedMail})=>{
  const plan=personal('victim-plan','내 개인 일정');
  assert.equal((await b.request('/sync',{operations:[{type:'event.upsert',value:plan}]})).ok,true);
  assert.equal(b.store.get('local-events',plan.id).owner,users.b.id);
  await deliver(forgedMail('forged-overwrite',{calendarEvent:plan.id,calendarDetails:{...plan,title:'위조된 제목',type:'group',targets:[users.b.id],owner:users.a.id}}));
  let r=await b.request('/bootstrap');
  assert.ok(r.data.mails.some(m=>m.id==='forged-overwrite'),'the mail itself is still delivered');
  assert.equal(b.store.get('mail-history','forged-overwrite').calendarEvent,undefined,'the conflicting calendar link is dropped');
  assertIntact(b,r,plan);
  const failures=r.incomingFailures;
  await deliver({type:'calendar.update',id:plan.id,value:{date:'2030-04-16',start:'11:00',end:'12:00',title:'위조된 제목'}});
  await deliver({type:'calendar.update',id:plan.id,deleted:true});
  r=await b.request('/bootstrap');
  assertIntact(b,r,plan);assert.equal(r.incomingFailures,failures+2,'forged calendar updates are quarantined');
  await deliver({type:'mail.recall',mail:'forged-overwrite',at:Date.now()});
  r=await b.request('/bootstrap');
  assert.ok(!r.data.mails.some(m=>m.id==='forged-overwrite'),'the unread mail is recalled');
  assertIntact(b,r,plan);
}));
test('recalling a mail that only names the recipient\'s entry leaves that entry in place',()=>fixture(async({b,deliver,forgedMail})=>{
  const plan=personal('victim-recall','회수 시험 개인 일정');
  assert.equal((await b.request('/sync',{operations:[{type:'event.upsert',value:plan}]})).ok,true);
  await deliver(forgedMail('forged-link',{calendarEvent:plan.id}));
  let r=await b.request('/bootstrap');assert.ok(r.data.mails.some(m=>m.id==='forged-link'));assertIntact(b,r,plan);
  await deliver({type:'mail.recall',mail:'forged-link',at:Date.now()});
  r=await b.request('/bootstrap');assert.ok(!r.data.mails.some(m=>m.id==='forged-link'));
  assertIntact(b,r,plan);
}));
test('a lesson notice cannot replace an entry through a chosen mail id',()=>fixture(async({b,users,deliver,forgedMail})=>{
  const plan=personal('forged-notice-p3','보강 충돌 개인 일정');
  assert.equal((await b.request('/sync',{operations:[{type:'event.upsert',value:plan}]})).ok,true);
  await deliver(forgedMail('forged-notice',{notice:{kind:'makeup',date:DATE,rows:[{period:3,teacher:users.b.id,className:''}]}}));
  let r=await b.request('/bootstrap');assert.ok(r.data.mails.some(m=>m.id==='forged-notice'));assertIntact(b,r,plan);
  await deliver({type:'mail.recall',mail:'forged-notice',at:Date.now()});
  r=await b.request('/bootstrap');assertIntact(b,r,plan);
}));
test('the sender can still share, update and recall their own calendar entry',()=>fixture(async({a,b,c,users,mailOp})=>{
  const shared={id:'shared-plan',title:'함께 볼 일정',date:DATE,start:'13:00',end:'14:00',type:'group',targets:[users.b.id],note:'공유 메모',place:''};
  assert.equal((await a.request('/sync',{operations:[{type:'event.upsert',value:shared},mailOp('share-1',{calendarEvent:shared.id})]})).ok,true);
  let r=await b.request('/bootstrap');let copy=b.store.get('local-events',shared.id);
  assert.equal(copy.owner,users.a.id);assert.equal(copy.deliveryMail,'share-1');assert.equal(r.data.events.find(e=>e.id===shared.id).title,'함께 볼 일정');
  assert.equal(b.store.get('mail-history','share-1').calendarEvent,shared.id);
  // A recipient may not forward someone else's entry as their own.
  await assert.rejects(b.request('/sync',{operations:[mailOp('reshare',{calendarEvent:shared.id},[users.c.id])]}),/본인의 일정만/);
  assert.equal(b.store.get('mail-history','reshare'),null);
  await c.request('/bootstrap');assert.equal(c.store.get('local-events',shared.id),null);
  assert.equal((await a.request('/sync',{operations:[{type:'event.upsert',value:{...shared,title:'바뀐 공유 일정'}},mailOp('share-2',{calendarEvent:shared.id})]})).ok,true);
  r=await b.request('/bootstrap');copy=b.store.get('local-events',shared.id);
  assert.equal(copy.title,'바뀐 공유 일정');assert.equal(copy.owner,users.a.id);assert.equal(copy.deliveryMail,'share-2');
  assert.equal((await a.request('/sync',{operations:[{type:'mail.update',id:'share-2',recall:true}]})).ok,true);
  r=await b.request('/bootstrap');copy=b.store.get('local-events',shared.id);
  assert.equal(copy.deleted,true);assert.equal(copy.owner,users.a.id,'the tombstone keeps its owner');
  assert.ok(!r.data.events.some(e=>e.id===shared.id));
}));
