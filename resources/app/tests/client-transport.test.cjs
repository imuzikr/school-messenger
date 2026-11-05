'use strict';
// Regression: desktop transport keeps Korean text intact and the live event stream recovers.
const {test}=require('node:test'),assert=require('node:assert/strict');
const http=require('node:http'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
const {createBodyCollector,MAX_RESPONSE_BYTES}=require('../desktop/response-body.cjs');
const {createEventStream}=require('../desktop/event-stream.cjs');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const KOREAN=JSON.stringify({name:'한글 교직원',title:'수업 변경 안내 · 3교시'});
// Split inside the three UTF-8 bytes of the first character '한'.
const splitInsideCharacter=()=>{const bytes=Buffer.from(KOREAN,'utf8'),at=KOREAN.indexOf('한');const cut=Buffer.byteLength(KOREAN.slice(0,at))+1;return [bytes.subarray(0,cut),bytes.subarray(cut)];};

test('a multi-byte character split across chunks is decoded intact',()=>{
  const [first,second]=splitInsideCharacter();
  // The previous string concatenation corrupted exactly this case.
  assert.notEqual(''+first+second,KOREAN);
  const collected=createBodyCollector();assert.equal(collected.push(first),true);assert.equal(collected.push(second),true);
  assert.equal(collected.text(),KOREAN);assert.deepEqual(JSON.parse(collected.text()),JSON.parse(KOREAN));
  assert.equal(collected.bytes,Buffer.byteLength(KOREAN));
});
test('the response size limit counts bytes, not characters',()=>{
  assert.equal(MAX_RESPONSE_BYTES,16*1024*1024);
  const collected=createBodyCollector(10);
  assert.equal(collected.push(Buffer.from('abcdef')),true);
  assert.equal(collected.push(Buffer.from('한글')),false,'only 8 characters, but 12 bytes');
  const exact=createBodyCollector(6);assert.equal(exact.push(Buffer.from('한글')),true);assert.equal(exact.text(),'한글');
});
test('a real HTTP response written in split chunks is decoded intact',async()=>{
  const [first,second]=splitInsideCharacter();
  const server=http.createServer((req,res)=>{res.writeHead(200,{'content-type':'application/json; charset=utf-8'});res.write(first);setTimeout(()=>res.end(second),50);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const text=await new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port:server.address().port,path:'/'},res=>{const collected=createBodyCollector();let chunks=0;res.on('data',chunk=>{chunks++;collected.push(chunk);});res.on('error',reject);res.on('end',()=>{assert.ok(chunks>=2,'the body arrived in separate chunks');resolve(collected.text());});}).on('error',reject);});
    assert.equal(text,KOREAN);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

function harness({token='token-1'}={}){
  const pending=new Set(),requests=[],events=[];let expiredCount=0;
  const timers={setTimeout(fn,ms){const t={fn,ms};pending.add(t);return t;},clearTimeout(t){pending.delete(t);}};
  const state={token,connection:{url:'https://school.test:8443',certificate:'fixture'}};
  const request=(url,options,onResponse)=>{
    const req=new EventEmitter();req.destroyed=false;
    req.destroy=()=>{if(req.destroyed)return;req.destroyed=true;process.nextTick(()=>req.emit('error',new Error('socket hang up')));};
    const entry={url:String(url),options,req,respond(status){const res=new PassThrough();res.statusCode=status;onResponse(res);return res;}};
    requests.push(entry);return req;
  };
  const stream=createEventStream({emit:e=>events.push(e),current:()=>({token:state.token,connection:state.connection}),expired:()=>{expiredCount++;state.token=null;},request,timers});
  const timersWith=ms=>[...pending].filter(t=>t.ms===ms);
  const fire=t=>{pending.delete(t);t.fn();};
  return {stream,state,requests,events,pending,timersWith,fire,expired:()=>expiredCount};
}

test('a temporary server error schedules a reconnect',async()=>{
  const h=harness();h.stream.start();assert.equal(h.requests.length,1);
  assert.equal(h.requests[0].url,'https://school.test:8443/events');assert.equal(h.requests[0].options.headers.authorization,'Bearer token-1');
  h.requests[0].respond(503);await tick();
  assert.deepEqual(h.events,[{kind:'disconnected'}]);
  const retries=h.timersWith(3000);assert.equal(retries.length,1);assert.equal(h.timersWith(60000).length,0,'idle watch is cleared');
  h.fire(retries[0]);assert.equal(h.requests.length,2);
  h.requests[1].respond(200);await tick();assert.deepEqual(h.events.at(-1),{kind:'connected'});
  assert.equal(h.timersWith(3000).length,0);
  h.stream.stop();
});
test('401 reports an expired login once and does not reconnect',async()=>{
  const h=harness();h.stream.start();h.requests[0].respond(401);await tick();
  assert.equal(h.expired(),1);assert.equal(h.pending.size,0);assert.deepEqual(h.events,[]);
  h.requests[0].req.emit('error',new Error('late socket error'));await tick();
  assert.equal(h.pending.size,0);assert.equal(h.requests.length,1);
});
test('other client errors are retried slowly',async()=>{
  const h=harness();h.stream.start();h.requests[0].respond(404);await tick();
  assert.equal(h.timersWith(30000).length,1);assert.equal(h.timersWith(3000).length,0);
  const busy=harness();busy.stream.start();busy.requests[0].respond(429);await tick();assert.equal(busy.timersWith(3000).length,1);
  h.stream.stop();busy.stream.stop();assert.equal(h.pending.size+busy.pending.size,0);
});
test('events are parsed, including Korean split across chunks, and the stream end reconnects',async()=>{
  const h=harness();h.stream.start();const res=h.requests[0].respond(200);
  const frame=Buffer.from('event: update\ndata: {"kind":"changed","note":"한글"}\n\n','utf8'),cut=frame.indexOf(Buffer.from('한'))+1;
  res.write(frame.subarray(0,cut));res.write(frame.subarray(cut));await tick();
  assert.deepEqual(h.events,[{kind:'connected'},{kind:'changed',note:'한글'}]);
  res.end();await tick();await tick();
  assert.deepEqual(h.events.at(-1),{kind:'disconnected'});assert.equal(h.timersWith(3000).length,1);
  h.fire(h.timersWith(3000)[0]);assert.equal(h.requests.length,2);h.stream.stop();
});
test('a silent connection is dropped after the idle limit and reconnected',async()=>{
  const h=harness();h.stream.start();const res=h.requests[0].respond(200);await tick();
  res.write(': heartbeat\n\n');await tick();
  const idle=h.timersWith(60000);assert.equal(idle.length,1,'one idle watch at a time');
  h.fire(idle[0]);await tick();
  assert.equal(h.requests[0].req.destroyed,true);assert.deepEqual(h.events.at(-1),{kind:'disconnected'});
  assert.equal(h.timersWith(3000).length,1);assert.equal(h.events.filter(e=>e.kind==='disconnected').length,1,'destroy does not report twice');
  h.stream.stop();
});
test('a connection that never answers is also covered by the idle limit',async()=>{
  const h=harness();h.stream.start();assert.equal(h.timersWith(60000).length,1);
  h.fire(h.timersWith(60000)[0]);await tick();
  assert.equal(h.requests[0].req.destroyed,true);assert.equal(h.timersWith(3000).length,1);h.stream.stop();
});
test('network errors reconnect; stop and logout do not',async()=>{
  const h=harness();h.stream.start();h.requests[0].req.emit('error',new Error('ECONNREFUSED'));await tick();
  assert.equal(h.timersWith(3000).length,1);
  h.stream.stop();assert.equal(h.pending.size,0);await tick();assert.equal(h.pending.size,0,'destroying the stopped request schedules nothing');
  h.stream.start();assert.equal(h.requests.length,2);h.state.token=null;h.requests[1].req.emit('error',new Error('ECONNRESET'));await tick();
  assert.equal(h.pending.size,0,'no reconnect after logout');
});
test('restarting the stream does not let the old connection schedule a reconnect',async()=>{
  const h=harness();h.stream.start();h.requests[0].respond(200);await tick();
  h.stream.start();await tick();await tick();
  assert.equal(h.requests[0].req.destroyed,true);assert.equal(h.requests.length,2);
  assert.equal(h.timersWith(3000).length,0);assert.equal(h.events.filter(e=>e.kind==='disconnected').length,0);
  h.stream.stop();assert.equal(h.pending.size,0);
});
test('without a login or connection nothing is requested',()=>{
  const h=harness({token:null});h.stream.start();assert.equal(h.requests.length,0);assert.equal(h.pending.size,0);
});
