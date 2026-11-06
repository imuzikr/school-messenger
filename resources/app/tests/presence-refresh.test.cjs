'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),https=require('node:https');
const fixture=require('./helpers/transfer-fixture.cjs');
const source=fs.readFileSync(path.join(__dirname,'../js/backend.js'),'utf8');
const snapshot=(revision=0,online=[])=>({user:{id:'a'},data:{people:[{id:'a',status:'offline'},{id:'b',status:'offline'}],mails:[],events:[]},presence:{epoch:'server-1',revision,online}});
function backend(){
  let now=0,id=0;const timers=new Map(),requests=[],updates=[],presence=[];
  const context={window:{},Date:{now:()=>now},setTimeout:(fn,delay=0)=>{const key=++id;timers.set(key,{fn,at:now+delay});return key;},clearTimeout:key=>timers.delete(key)};
  vm.runInNewContext(source,context);
  const native={subscribe:()=>{},request:route=>new Promise(resolve=>requests.push({route,resolve}))};
  const b=new context.window.DingdongBackend(native,{data:r=>updates.push(r),presence:p=>presence.push(p),status:()=>{},expired:()=>{}});b.activate(snapshot());
  const tick=()=>{const [key,timer]=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];timers.delete(key);now=timer.at;timer.fn();};
  return {b,requests,updates,presence,timers,tick};
}
test('presence updates require no full refresh and a stale snapshot cannot roll them back',async()=>{
  const {b,requests,updates,presence,timers}=backend();
  const refresh=b.refresh();assert.equal(requests.length,1);
  b.onEvent({kind:'presence',presence:{epoch:'server-1',revision:2,online:['a','b']}});
  assert.equal(timers.size,0);assert.equal(updates.length,1);assert.equal(presence.at(-1)[1].status,'online');
  requests[0].resolve(snapshot(1,['a']));await refresh;
  assert.equal(b.baseline.people[1].status,'online');assert.equal(updates.at(-1).data.people[1].status,'online');
  b.onEvent({kind:'presence',presence:{epoch:'server-1',revision:1,online:[]}});
  assert.equal(b.baseline.people[1].status,'online');assert.equal(requests.length,1);
});
test('bursts coalesce and updates during a refresh cause only one follow-up without being lost',async()=>{
  const {b,requests,timers,tick}=backend();
  for(let i=0;i<70;i++)b.onEvent({kind:'changed'});
  assert.equal(timers.size,1);tick();assert.equal(requests.length,1);
  for(let i=0;i<70;i++){b.onEvent({kind:'changed'});tick();}
  assert.equal(requests.length,1);const first=b.refreshJob;requests[0].resolve(snapshot());await first;
  assert.equal(timers.size,1);tick();assert.equal(requests.length,2);
  const next=b.refreshJob,latest=snapshot();latest.data.mails.push({id:'new-message'});requests[1].resolve(latest);await next;
  assert.equal(b.baseline.mails[0].id,'new-message');assert.equal(timers.size,0);
});
test('old servers fall back to a refresh, restart accepts a new presence epoch, and logout drops late data',async()=>{
  const {b,requests,timers,tick,updates}=backend();
  b.onEvent({kind:'presence'});assert.equal(timers.size,1);tick();let job=b.refreshJob;requests[0].resolve(snapshot(99,['a']));await job;
  b.onEvent({kind:'connected'});b.onEvent({kind:'presence',presence:{epoch:'server-2',revision:1,online:['b']}});tick();job=b.refreshJob;
  requests[1].resolve(snapshot(100,['a']));await job;assert.equal(b.baseline.people[0].status,'offline');assert.equal(b.baseline.people[1].status,'online');
  job=b.refresh();const before=updates.length;b.onEvent({kind:'logout'});requests[2].resolve(snapshot(101,['a','b']));await job;
  assert.equal(updates.length,before);assert.equal(b.baseline,null);assert.equal(b.active,false);assert.equal(timers.size,0);
});
test('a pending delivery keeps its retry delay, while a new server change can expedite it',async()=>{
  const {b,requests,timers,tick}=backend();const job=b.refresh();requests[0].resolve({...snapshot(),outgoingPending:true});await job;
  assert.equal([...timers.values()][0].at,3000);b.onEvent({kind:'changed'});assert.equal([...timers.values()][0].at,100);
  tick();const next=b.refreshJob;requests[1].resolve(snapshot());await next;assert.equal(timers.size,0);
});
test('a dropped bootstrap connection retries cached offline history even with a healthy event stream',async()=>{
  const {b,requests,timers,tick}=backend();const first=b.refresh();requests[0].resolve({...snapshot(),offline:true});await first;
  assert.equal([...timers.values()][0].at,3000);tick();const next=b.refreshJob;requests[1].resolve(snapshot(2,['a','b']));await next;
  assert.equal(b.baseline.people[1].status,'online');assert.equal(timers.size,0);
});

test('server batches presence changes and only the last connection makes an account offline',()=>fixture(async({users,tokens,port,connection,advance,call,restart})=>{
  const connections=[];
  const until=async fn=>{for(let i=0;i<300;i++){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('presence event timeout');};
  async function connect(name){
    const events=[];let response,buffer='';
    const request=https.get({hostname:'127.0.0.1',port:port(),path:'/events',ca:connection().certificate,headers:{authorization:'Bearer '+tokens[name]}},res=>{response=res;res.setEncoding('utf8');res.on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,at);buffer=buffer.slice(at+2);const data=frame.split('\n').find(s=>s.startsWith('data: '));if(data)events.push(JSON.parse(data.slice(6)));}});});
    request.on('error',()=>{});connections.push(request);await until(()=>response&&events.length);return {request,events};
  }
  try{
    const a=await connect('a'),b=await connect('b');await advance(100);await until(()=>a.events.at(-1).presence.online.length===2);
    assert.equal(a.events.length,2,'initial state plus one coalesced broadcast');
    const state=(await call('a','/bootstrap')).presence;assert.deepEqual([...state.online].sort(),[users.a.id,users.b.id].sort());
    const a2=await connect('a');assert.equal(a2.events[0].presence.revision,state.revision);
    a.request.destroy();await new Promise(resolve=>setTimeout(resolve,30));await advance(100);
    assert.ok((await call('b','/bootstrap')).presence.online.includes(users.a.id));
    a2.request.destroy();await until(async()=>!(await call('b','/bootstrap')).presence.online.includes(users.a.id));
    await advance(100);await until(()=>!b.events.at(-1).presence.online.includes(users.a.id));
    assert.equal(b.events.at(-1).presence.revision,state.revision+1);
    b.request.destroy();await until(async()=>(await call('b','/bootstrap')).presence.online.length===0);
    await restart();const restarted=(await call('b','/bootstrap')).presence;assert.notEqual(restarted.epoch,state.epoch);assert.equal(restarted.revision,0);
  }finally{for(const request of connections)request.destroy();}
}));

test('ordinary calendar changes notify current and former participants; common settings still notify everyone',()=>fixture(async({users,tokens,port,connection,advance,call})=>{
  const streams=[];
  const wait=async fn=>{for(let i=0;i<300;i++){if(fn())return;await new Promise(resolve=>setTimeout(resolve,10));}throw Error('calendar notification timeout');};
  try{
    for(const name of ['a','b','c']){
      const entry={name,changed:0,ready:false};let buffer='';
      entry.request=https.get({hostname:'127.0.0.1',port:port(),path:'/events',ca:connection().certificate,headers:{authorization:'Bearer '+tokens[name]}},res=>{res.setEncoding('utf8');res.on('data',chunk=>{buffer+=chunk;let at;while((at=buffer.indexOf('\n\n'))>=0){const frame=buffer.slice(0,at);buffer=buffer.slice(at+2);const line=frame.split('\n').find(s=>s.startsWith('data: '));if(line){entry.ready=true;if(JSON.parse(line.slice(6)).kind==='changed')entry.changed++;}}});});entry.request.on('error',()=>{});streams.push(entry);
    }
    await wait(()=>streams.every(s=>s.ready));await advance(100);
    const event={id:'scoped-calendar',title:'참여자 일정',date:'2026-11-12',start:'09:00',end:'10:00',type:'group',targets:[users.b.id],note:'',place:''};
    const upsert=value=>call('a','/sync',{operations:[{type:'event.upsert',value}]});
    assert.equal((await upsert(event)).status,200);await wait(()=>streams[0].changed===1&&streams[1].changed===1);assert.equal(streams[2].changed,0);
    // A removed participant must also refresh, to remove their old calendar view.
    assert.equal((await upsert({...event,targets:[users.c.id]})).status,200);await wait(()=>streams[0].changed===2&&streams[1].changed===2&&streams[2].changed===1);
    assert.ok(!(await call('b','/bootstrap')).data.events.some(e=>e.id===event.id));assert.ok((await call('c','/bootstrap')).data.events.some(e=>e.id===event.id));
    assert.equal((await call('a','/sync',{operations:[{type:'event.delete',id:event.id}]})).status,200);await wait(()=>streams[0].changed===3&&streams[2].changed===2);assert.equal(streams[1].changed,2);
    assert.equal((await call('a','/sync',{operations:[{type:'classes.upsert',value:{classes:[]}}]})).status,200);await wait(()=>streams[0].changed===4&&streams[1].changed===3&&streams[2].changed===3);
  }finally{for(const stream of streams)stream.request.destroy();}
}));
