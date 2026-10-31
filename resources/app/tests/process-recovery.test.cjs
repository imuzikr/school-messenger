'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),{fork}=require('node:child_process');
const fixture=require('./helpers/transfer-fixture.cjs');
async function terminateAtBoundary(config,expected){
  const child=fork(path.join(__dirname,'helpers/crash-client.cjs'),[],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc']});let stderr='';child.stderr.on('data',v=>stderr+=v);
  try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Crash checkpoint timed out: '+stderr)),15000);child.once('message',m=>{clearTimeout(timer);m.checkpoint===expected?resolve():reject(Error(JSON.stringify(m)));});child.once('error',e=>{clearTimeout(timer);reject(e);});child.send(config);});}
  finally{const exited=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await exited;}
}
test('forced process termination before ACK or after server acceptance never loses or duplicates a message',()=>fixture(async({a,b,c,send,users,tokens,root,make,port,connection,sql,restart})=>{
  await send(a,'receiver-crash',[users.b.id]);const id=a.store.get('mail-history','receiver-crash').relayPacket;b.close();
  await terminateAtBoundary({mode:'receive',root:path.join(root,'b'),port:port(),connection:connection(),user:users.b,token:tokens.b},'pc-saved-before-ack');
  assert.equal(sql('SELECT COUNT(*) n FROM relay_targets WHERE packet_id=?',[id])[0].n,1);await restart();const receiver=make('b'),r=await receiver.request('/bootstrap');assert.equal(r.data.mails.filter(m=>m.id==='receiver-crash').length,1);assert.equal(sql('SELECT COUNT(*) n FROM relay_packets WHERE id=?',[id])[0].n,0);
  a.close();await terminateAtBoundary({mode:'send',root:path.join(root,'a'),port:port(),connection:connection(),user:users.a,token:tokens.a,operation:{type:'mail.send',value:{id:'sender-crash',title:'강제 종료 시험',body:'합성 기록',to:[users.c.id],cc:[],files:[]}}},'server-accepted-before-client-commit');
  assert.equal((await c.request('/bootstrap')).data.mails.filter(m=>m.id==='sender-crash').length,1);await restart();const sender=make('a');await sender.request('/bootstrap');await c.request('/bootstrap');assert.equal(c.store.all('mail-history').filter(m=>m.id==='sender-crash').length,1);assert.equal(sender.store.get('mail-history','sender-crash').pendingDelivery,false);assert.equal(sql('SELECT COUNT(*) n FROM relay_packets')[0].n,0);assert.equal(sql('SELECT COUNT(*) n FROM relay_positions')[0].n,0);
}));
