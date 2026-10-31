'use strict';
// Explains a possible confound: file bytes share a JSON TEXT column with the
// message. This isolates SQLite text decoding/JSON parsing, not encryption.
const {DatabaseSync}=require('node:sqlite');
const crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const fs=require('node:fs');
const path=require('node:path');
const db=new DatabaseSync(':memory:');
db.exec('CREATE TABLE samples(id TEXT PRIMARY KEY,payload TEXT)');
const file={name:'synthetic-file.bin',data:'data:application/octet-stream;base64,'+crypto.randomBytes(1024*1024).toString('base64')};
const content='가나다라마바사 성능 검증 본문입니다. '.repeat(150);
const encoded=crypto.randomBytes(Buffer.byteLength(content)).toString('base64');
const cases={koreanPlain:{title:'시험 메시지',body:content,files:[file]},asciiEnvelope:{title:'Encrypted message',body:encoded,files:[file]},koreanLabelEnvelope:{title:'암호화 메시지',body:encoded,files:[file]}};
const insert=db.prepare('INSERT INTO samples VALUES(?,?)'),get=db.prepare('SELECT payload FROM samples WHERE id=?');
for(const [id,payload]of Object.entries(cases))insert.run(id,JSON.stringify(payload));
const rows=Object.fromEntries(Object.keys(cases).map(key=>[key,[]]));
for(let repetition=0;repetition<25;repetition++) {
  const order=Object.keys(cases);if(repetition%2)order.reverse();
  for(const id of order) {
    const started=performance.now();
    for(let recipient=0;recipient<70;recipient++) {
      const payload=JSON.parse(get.get(id).payload);
      Buffer.from(JSON.stringify({...payload,files:payload.files.map(item=>({name:item.name,stored:true}))}));
    }
    if(repetition>=5)rows[id].push(performance.now()-started);
  }
}
db.close();
const report={scope:'70 SQLite TEXT reads + JSON parse + attachment metadata serialization, no network/crypto',samples:20,results:Object.fromEntries(Object.entries(rows).map(([id,values])=>[id,{medianMs:[...values].sort((a,b)=>a-b)[Math.ceil(values.length*.5)-1],raw:values}]))};
const destination=path.resolve('.artifacts/message-crypto-benchmark/encoding-control.json');
fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(report.results).map(([id,value])=>[id,value.medianMs]))));
