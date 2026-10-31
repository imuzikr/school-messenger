'use strict';
// Offline/local benchmark, never contacts the demo preview or real school server.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const https = require('node:https');
const crypto = require('node:crypto');
const {fork} = require('node:child_process');
const {performance, monitorEventLoopDelay} = require('node:perf_hooks');
const fixtureCrypto = require('./crypto-cost.cjs');

const args = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/,'').split('=')));
const smoke = args.smoke === 'true';
const repeats = Number(args.repeats || (smoke ? 2 : 30));
const warmups = Number(args.warmups || (smoke ? 1 : 5));
const output = path.resolve(args.output || path.join(__dirname,'../../../../.artifacts/message-crypto-benchmark/results.json'));
const sourceHashes = ['server/index.cjs','desktop/main.cjs','js/backend.js','benchmarks/message-crypto/crypto-cost.cjs','benchmarks/message-crypto/server-fixture.cjs','benchmarks/message-crypto/run.cjs'].map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../..',file))).digest('hex')}));
assert.ok(Number.isInteger(repeats) && repeats >= 2 && repeats <= 200);
assert.ok(Number.isInteger(warmups) && warmups >= 1 && warmups <= 20);
const percentile = (values, p) => {
  const sorted = [...values].sort((a,b)=>a-b);
  return sorted[Math.max(0, Math.ceil(p*sorted.length)-1)];
};
const stats = values => ({n:values.length, median:percentile(values,.5), p95:percentile(values,.95), min:Math.min(...values), max:Math.max(...values), mean:values.reduce((a,b)=>a+b,0)/values.length});
const cpuMs = (a,b) => (b.user-a.user+b.system-a.system)/1000;
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
function contentAt(bytes) {
  const unit = '가나다라마바사아자차카타파하 메시지 성능 검증용 합성 본문입니다. ';
  let body = unit.repeat(Math.ceil(bytes/Buffer.byteLength(unit)));
  while(Buffer.byteLength(body)>bytes) body=body.slice(0,-1);
  body=body.trim();
  return {title:'성능 검증용 합성 메시지',body,html:''};
}
function summarizeRows(rows) {
  const keys = ['encryptMs','sendAckMs','allMessagesMs','allAttachmentsMs','senderRefreshMs','clientCpuMs','serverCpuMs','decryptTotalMs','decryptPerRecipientMs','wireBytes','clientRssMiB','serverRssMiB','eventLoopMaxMs'];
  return Object.fromEntries(keys.map(key=>[key,stats(rows.map(row=>row[key]))]));
}

async function main() {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-crypto-bench-'));
  const child = fork(path.join(__dirname,'server-fixture.cjs'),[testDir],{stdio:['ignore','ignore','pipe','ipc'],windowsHide:true});
  child.stderr.on('data',chunk=>process.stderr.write(chunk));
  const pendingRpc = new Map(); let rpcId=0;
  const serverReady = new Promise((resolve,reject)=>{
    child.on('message',message=>{
      if(message.ready) resolve(message);
      if(message.rpc && pendingRpc.has(message.rpc)) {
        const task = pendingRpc.get(message.rpc);pendingRpc.delete(message.rpc);clearTimeout(task.timer);
        message.error ? task.reject(new Error(message.error)) : task.resolve(message);
      }
    });
    child.on('error',reject);
    child.on('exit',(code)=>{if(code)reject(new Error('Benchmark server exit '+code));for(const task of pendingRpc.values()){clearTimeout(task.timer);task.reject(new Error('Benchmark server exited'));}pendingRpc.clear();});
  });
  const rpc = (kind,extra={})=>new Promise((resolve,reject)=>{
    const rpc=++rpcId;
    const timer=setTimeout(()=>{pendingRpc.delete(rpc);reject(new Error('RPC timeout '+kind));},30000);
    pendingRpc.set(rpc,{resolve,reject,timer});child.send({kind,rpc,...extra});
  });
  let clients=[],activeStreams=[];
  try {
    const server = await serverReady;
    clients = server.users.map(user=>({...user,...fixtureCrypto.keyPair(),agent:new https.Agent({keepAlive:true,maxSockets:3,maxFreeSockets:2})}));
    const sender=clients[0], recipients=clients.slice(1), signer=fixtureCrypto.signingPair();
    let wireCounter = 0;
    function call(client,route,value) {
      return new Promise((resolve,reject)=>{
        const raw=value===undefined ? null : JSON.stringify(value);
        if(raw) wireCounter += Buffer.byteLength(raw);
        const req=https.request({hostname:'127.0.0.1',port:server.port,path:route,method:raw?'POST':'GET',
          ca:server.certificate,minVersion:'TLSv1.2',agent:client.agent,
          headers:{authorization:'Bearer '+client.token,...(raw?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{})}},res=>{
          const chunks=[];res.on('data',chunk=>{wireCounter+=chunk.length;chunks.push(chunk);});res.on('error',reject);
          res.on('end',()=>{try{const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert.equal(res.statusCode,200,route+': '+JSON.stringify(data).slice(0,300));resolve(data);}catch(error){reject(error);}});
        });
        req.setTimeout(30000,()=>req.destroy(new Error('HTTP timeout '+route)));req.on('error',reject);if(raw)req.write(raw);req.end();
      });
    }
    function connect(client) {
      return new Promise((resolve,reject)=>{
        let buffer='',settled=false;
        const stream={client,current:null,request:null};
        const req=https.get({hostname:'127.0.0.1',port:server.port,path:'/events',ca:server.certificate,
          minVersion:'TLSv1.2',agent:client.agent,headers:{authorization:'Bearer '+client.token}},res=>{
          assert.equal(res.statusCode,200);res.setEncoding('utf8');
          res.on('data',chunk=>{
            buffer+=chunk;let end;
            while((end=buffer.indexOf('\n\n'))>=0) {
              const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
              if(frame.includes('event: ready')&&!settled){settled=true;resolve(stream);}
              const line=frame.split('\n').find(line=>line.startsWith('data: '));
              if(!line)continue;
              const event=JSON.parse(line.slice(6));
              if(event.kind==='changed' && stream.current && !stream.current.started) {
                const job=stream.current;job.started=true;
                setTimeout(()=>job.consume().then(job.resolve,job.reject),0);
              }
            }
          });
          res.on('error',error=>{if(stream.current)stream.current.reject(error);if(!settled)reject(error);});
        });
        req.on('error',error=>{if(!settled)reject(error);if(stream.current)stream.current.reject(error);});
        stream.request=req;
      });
    }
    const checks=fixtureCrypto.selfCheck();
    const micro=[];
    for(const count of [1,70])for(const bytes of [1024,10240,51200]) {
      const content=contentAt(bytes), targets=[sender,...recipients.slice(0,count)];
      const enc=[],dec=[];
      for(let i=0;i<(smoke?5:105);i++) {
        const id='micro-'+count+'-'+bytes+'-'+i;
        let t=performance.now();const packet=fixtureCrypto.encryptContent(content,id,targets,signer);const e=performance.now()-t;
        t=performance.now();assert.deepEqual(fixtureCrypto.decryptContent(packet,id,targets[1],signer.publicKey),content);const d=performance.now()-t;
        if(i>=(smoke?1:5)){enc.push(e);dec.push(d);}
      }
      micro.push({recipients:count,bodyBytes:Buffer.byteLength(content.body),senderEncryptMs:stats(enc),oneReceiverDecryptMs:stats(dec)});
    }
    const configurations=smoke ? [{recipients:1,bytes:1024,fileBytes:0},{recipients:70,bytes:10240,fileBytes:0},{recipients:70,bytes:10240,fileBytes:1024*1024}]
      : [1,70].flatMap(count=>[1024,10240,51200].map(bytes=>({recipients:count,bytes,fileBytes:0}))).concat({recipients:70,bytes:10240,fileBytes:1024*1024});
    const results=[];
    const eventLoop=monitorEventLoopDelay({resolution:10});eventLoop.enable();
    let sequence=0;
    for(const config of configurations) {
      for(const stream of activeStreams){stream.current=null;stream.request.destroy();}
      activeStreams=[];
      const selected=recipients.slice(0,config.recipients);
      activeStreams=await Promise.all(selected.map(connect));
      await Promise.all([sender,...selected].map(client=>call(client,'/bootstrap')));
      await pause(50);
      const content=contentAt(config.bytes);
      const attachment=config.fileBytes?crypto.randomBytes(config.fileBytes):null;
      const fileData=attachment?'data:application/octet-stream;base64,'+attachment.toString('base64'):null;
      const fileDigest=attachment?crypto.createHash('sha256').update(attachment).digest('hex'):null;
      const rows={plain:[],encrypted:[]},pairs=[];
      const count=config.fileBytes?Math.min(repeats,12):repeats;
      async function trial(encrypted,collect) {
        await rpc('reset');
        const before=await rpc('metrics');const localCpu=process.cpuUsage();
        const id='perf-'+String(++sequence).padStart(7,'0');
        wireCounter=0;eventLoop.reset();
        const start=performance.now();
        const data=encrypted ? {title:'Encrypted benchmark message',body:fixtureCrypto.encryptContent(content,id,[sender,...selected],signer),html:''} : {...content};
        const encryptMs=performance.now()-start;
        const receiveTimes=[],decryptTimes=[],attachmentTimes=[];
        let completed=0;
        let releaseDownloads;
        const allMessagesReceived=new Promise(resolve=>{releaseDownloads=resolve;});
        const jobs=activeStreams.map(stream=>new Promise((resolve,reject)=>{
          stream.current={resolve,reject,started:false,consume:async()=>{
            const snapshot=await call(stream.client,'/bootstrap');
            const mail=snapshot.data.mails.find(mail=>mail.id===id);assert.ok(mail,'message delivered');
            const t=performance.now();
            const decoded=encrypted?fixtureCrypto.decryptContent(mail.body,id,stream.client,signer.publicKey):{title:mail.title,body:mail.body,html:mail.html};
            assert.deepEqual(decoded,content);decryptTimes.push(performance.now()-t);
            receiveTimes.push(performance.now()-start);completed++;
            if(completed===selected.length)releaseDownloads();
            assert.equal(mail.files.length,attachment?1:0);
            if(attachment) {
              // Downloads are normally user initiated. Separate the load test's
              // download burst from message receipt to avoid request-order bias.
              await allMessagesReceived;
              const response=await call(stream.client,'/attachment',{mail:id,index:0});
              const bytes=Buffer.from(response.file.data.split(',')[1],'base64');
              assert.equal(bytes.length,attachment.length);
              assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),fileDigest);
              attachmentTimes.push(performance.now()-start);
            }
          }};
        }));
        let timeout;
        const timeoutPromise=new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error('Delivery timeout '+id+' '+completed+'/'+selected.length)),60000);});
        let sendAckMs,senderRefreshMs;
        const sending=(async()=>{
          await call(sender,'/sync',{operations:[{type:'mail.send',value:{id,...data,to:selected.map(c=>c.id),cc:[],files:attachment?[{name:'synthetic-file.bin',data:fileData}]:[]}}]});
          sendAckMs=performance.now()-start;
          const snapshot=await call(sender,'/bootstrap');
          const own=snapshot.data.mails.find(mail=>mail.id===id);assert.ok(own);
          assert.deepEqual(encrypted?fixtureCrypto.decryptContent(own.body,id,sender,signer.publicKey):{title:own.title,body:own.body,html:own.html},content);
          senderRefreshMs=performance.now()-start;
        })();
        try{await Promise.race([Promise.all([sending,...jobs]),timeoutPromise]);}finally{clearTimeout(timeout);for(const stream of activeStreams)stream.current=null;}
        const after=await rpc('metrics');
        const row={id,encryptMs,sendAckMs,senderRefreshMs,allMessagesMs:Math.max(...receiveTimes),allAttachmentsMs:attachment?Math.max(...attachmentTimes):0,
          clientCpuMs:cpuMs(localCpu,process.cpuUsage()),serverCpuMs:cpuMs(before.cpu,after.cpu),
          decryptTotalMs:decryptTimes.reduce((a,b)=>a+b,0),decryptPerRecipientMs:percentile(decryptTimes,.5),wireBytes:wireCounter,
          clientRssMiB:process.memoryUsage().rss/1024/1024,serverRssMiB:after.memory.rss/1024/1024,eventLoopMaxMs:eventLoop.max/1e6};
        if(collect)rows[encrypted?'encrypted':'plain'].push(row);
        // Inspect one trial per mode/case outside the measured time.
        if(collect && rows[encrypted?'encrypted':'plain'].length===1) {
          const saved=await rpc('inspect',{id});assert.equal(saved.mails,1);assert.equal(saved.recipients,selected.length);assert.equal(saved.extractedItems,0);
          if(encrypted){assert.ok(!saved.payload.body.includes(content.body));assert.equal(saved.payload.html,'');}
          else assert.equal(saved.payload.body,content.body);
          if(attachment)assert.equal(saved.payload.files[0].data,fileData,'attachment must remain unencrypted');
        }
        return row;
      }
      process.stdout.write('CASE '+JSON.stringify(config)+' warmup='+warmups+' pairs='+count+'\n');
      for(let i=0;i<warmups+count;i++) {
        // Balanced AB/BA paired order prevents always giving one mode a warm cache.
        const encryptedFirst=i%2===1;
        const first=await trial(encryptedFirst,i>=warmups),second=await trial(!encryptedFirst,i>=warmups);
        if(i>=warmups){const plain=encryptedFirst?second:first,encrypted=encryptedFirst?first:second;pairs.push({allMessagesMs:encrypted.allMessagesMs-plain.allMessagesMs,sendAckMs:encrypted.sendAckMs-plain.sendAckMs,allAttachmentsMs:encrypted.allAttachmentsMs-plain.allAttachmentsMs});}
        if((i+1)%10===0)process.stdout.write('  completed '+(i+1)+' pairs\n');
      }
      const result={...config,bodyBytes:Buffer.byteLength(content.body),contentBytes:Buffer.byteLength(JSON.stringify(content)),repeats:count,warmups,
        plain:summarizeRows(rows.plain),encrypted:summarizeRows(rows.encrypted),
        pairedDelta:Object.fromEntries(['allMessagesMs','sendAckMs','allAttachmentsMs'].map(key=>[key,stats(pairs.map(pair=>pair[key]))])),raw:rows,pairs};
      results.push(result);
      process.stdout.write('RESULT '+JSON.stringify({recipients:config.recipients,bodyBytes:result.bodyBytes,fileBytes:config.fileBytes,plainMs:result.plain.allMessagesMs.median,encryptedMs:result.encrypted.allMessagesMs.median,pairedDeltaMs:result.pairedDelta.allMessagesMs.median})+'\n');
    }
    eventLoop.disable();
    const report={createdAt:new Date().toISOString(),kind:'MESSAGE-CONTENT-ONLY PERFORMANCE PROTOTYPE; NOT PRODUCTION E2EE',
      environment:{platform:process.platform,release:os.release(),arch:process.arch,node:process.version,openssl:process.versions.openssl,cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,totalMemoryGiB:os.totalmem()/1024**3},
      methodology:{transport:'Pinned-certificate HTTPS on 127.0.0.1; /sync -> SQLite -> SSE changed -> /bootstrap -> verify/decrypt; sender bootstrap refresh included as load',
        topology:'Unmodified app server in a child process; all 70 client simulators in one Node process on the same PC; warmed persistent TLS connections; synthetic users/sessions',
        crypto:'Benchmark cost model: fresh AES-256-GCM content key per message, X25519 + HKDF-SHA256 + AES-GCM key wraps for each recipient plus sender, Ed25519 signature',
        encoding:'Encrypted envelope occupies existing body field; complete recipient key list is sent to each client; this conservative adapter is not a production wire format',
        contents:'Title, body and HTML encrypted. Standalone attachment bytes/name unencrypted at application layer; HTTPS remains enabled in both modes.',
        timing:'Wall clock starts before sender encryption; allMessagesMs ends after last recipient verifies/decrypts content. Only then do all clients concurrently download the unencrypted attachment. allAttachmentsMs includes that download phase and SHA-256 checks.',
        history:'Database message history cleared between trials so both modes have equal one-message history. Public keys generated and pretrusted before timing.',
        ordering:'Warmup excluded; paired runs alternate AB/BA. Median/p95 and raw trials retained; no outlier removal.',
        exclusions:['Electron IPC, DOM rendering and UI responsiveness','Durable per-user local message database','School LAN and 70 physical PCs','First login/TLS cold start/key enrollment','Identity verification/key rotation/ratchet/recovery/security audit','Auto schedule extraction of meaningful dates and encrypted search','Server delivery-ack deletion and ten-day file retention']},sourceHashes,checks,cryptoMicrobenchmarks:micro,results};
    fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
    process.stdout.write('SAVED '+output+'\n');
  } finally {
    for(const stream of activeStreams){stream.current=null;stream.request.destroy();}
    for(const client of clients)client.agent.destroy();
    if(child.connected)await rpc('close').catch(()=>child.kill());
    if(child.exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),pause(2000)]);
    if(child.exitCode===null)child.kill();
    const resolved=path.resolve(testDir),root=path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved).toLowerCase(),root.toLowerCase());assert.ok(path.basename(resolved).startsWith('dingdong-crypto-bench-'));
    fs.rmSync(resolved,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
