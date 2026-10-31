'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const tools=require('../js/work-tools.js');
const deadlines=require('../js/message-deadlines.js');

test('completion requests exclude the sender and CC and deduplicate recipients',()=>{
  assert.deepEqual(tools.request({kind:'submission',dueDate:'2028-02-29'},['a','b','a','me','sender'],['b'],'sender'),{kind:'submission',dueDate:'2028-02-29',targets:['a']});
  assert.throws(()=>tools.request({kind:'submission',dueDate:'2027-02-29'},['a']),/마감일/);
  assert.throws(()=>tools.request({kind:'reply'},['a'],['a']),/대상/);
});
test('read and completion are independent; recalled and undelivered requests are excluded',()=>{
  const mail={to:['a','b','c','d'],workRequest:{targets:['a','b','c','d']},receipts:['read','unread','recalled','unread'],workDelivery:{d:'scheduled'},workResponses:{b:{done:true,note:'별도 제출'}}};
  const s=tools.summary(mail);assert.equal(s.total,2);assert.equal(s.done,1);assert.deepEqual(s.pending,['a']);assert.equal(s.excluded,2);
  assert.equal(tools.summary({...mail,scheduled:'2099-01-01'}).total,0);
  assert.equal(tools.summary({...mail,scheduled:'2000-01-01',workDelivery:{a:'read',b:'unread',c:'recalled',d:'unread'}}).total,3);
});
const data={people:[{id:'a',name:'홍길동'}],mails:[{id:'mail',from:'a',title:'평가 계획',body:'1학기 자료',date:'2026-10-30',folder:'inbox',files:[{name:'평가양식.PDF'}]},{id:'trash',title:'평가 삭제',folder:'trash'}],rooms:[{id:'room',name:'교무실',messages:[{id:'chat',sender:'a',text:'평가 협의',date:'2026-10-29'}]}],events:[{id:'event',title:'평가 회의',owner:'a',date:'2026-10-31',note:'도서관'}],deadlines:[{id:'deadline',title:'평가 제출',date:'2026-10-30'}]};
test('unified search returns all four kinds and source identifiers, never trash',()=>{
  const s=tools.search(data,{query:'평가'});assert.equal(s.total,5);assert.deepEqual(s.counts,{mail:1,message:1,event:2,file:1});assert.equal(s.results.find(r=>r.kind==='file').id,'mail');assert.ok(!s.results.some(r=>r.id==='trash'));
});
test('search combines kind, sender, inclusive dates and case insensitive tokens',()=>{
  assert.equal(tools.search(data,{query:'pdf',kind:'file',sender:'a',from:'2026-10-30',until:'2026-10-30'}).total,1);
  assert.equal(tools.search(data,{query:'평가 자료',kind:'mail'}).total,1);
  assert.equal(tools.search(data,{query:'평가',sender:'me'},{id:'a',name:'홍길동'}).total,5);
  assert.throws(()=>tools.search(data,{from:'2026-11-01',until:'2026-10-01'}),/시작일/);
  assert.throws(()=>tools.filters({offset:-1}),/페이지/);
});
test('search pagination has stable order and bounded snippets',()=>{
  const mails=Array.from({length:121},(_,i)=>({id:'m'+String(i).padStart(3,'0'),from:'a',title:'보고',body:'본문'.repeat(300),date:'2026-10-30',folder:'inbox'}));
  const a=tools.search({mails},{query:'보고'}),b=tools.search({mails},{query:'보고',offset:50}),c=tools.search({mails},{query:'보고',offset:100});
  assert.equal(a.total,121);assert.equal(a.results.length,50);assert.equal(c.results.length,21);assert.equal(c.hasMore,false);assert.equal(new Set([...a.results,...b.results,...c.results].map(r=>r.id)).size,121);assert.ok(a.results.every(r=>r.text.length<190));
});
test('reminders do not create duplicate calendar deadlines',()=>{
  const data={mails:[{id:'reminder',folder:'sent',title:'자료 제출',body:'2026년 11월 2일까지 제출해 주세요.',date:'2026-10-30',workReminderOf:'original'}],rooms:[],events:[],deadlines:[],defaultPeriods:[]};
  deadlines.applyDemo(data);assert.equal(data.events.length,0);assert.equal(data.deadlines.length,0);
});
test('accumulated message history keeps date-only deadlines, periods, ranges and timed events',()=>{
  const rules=require('../js/message-deadlines.js');
  const periods=[{period:2,start:'09:50',end:'10:40'}],date='2026-10-30';
  const rows=['내일까지 자료 제출','오전 중 회신 부탁드립니다','오늘 2교시 회의','내일 9:10부터 10:20까지 회의','오후 3시 강당에서 모입시다','교무실 수업 자료를 확인해 주세요.'];
  for(const [index,text] of rows.entries()){
    const data={rooms:[{id:'r',messages:[{id:String(index),text,date}]}],mails:[],defaultPeriods:periods};
    const events=[...rules.extractEvents(text,date),...rules.extractStartEvents(text,date,data)];
    const deadlines=rules.extract(text,date,data);
    rules.applyDemo(data);
    assert.ok(index===rows.length-1||events.length+deadlines.length>0,text);
    assert.deepEqual(data.events.map(e=>[e.date,e.start,e.end]),events.map(e=>[e.date,e.start,e.end]),text);
    assert.deepEqual(data.deadlines.map(d=>[d.date,d.dueTime]),deadlines.map(d=>[d.date,d.dueTime]),text);
  }
});
