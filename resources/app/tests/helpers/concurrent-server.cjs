'use strict';
// Test-only server process: synthetic accounts, independent CPU/SQLite counters.
const fs=require('node:fs'),path=require('node:path'),{DatabaseSync}=require('node:sqlite'),{randomBytes}=require('node:crypto');
const {monitorEventLoopDelay}=require('node:perf_hooks'),{digest}=require('../../privacy/crypto.cjs');
const prepare=DatabaseSync.prototype.prepare;let measuring=false,queries={},cpu,start,server;
DatabaseSync.prototype.prepare=function(sql){const stmt=prepare.call(this,sql);for(const key of ['all','get','run']){const fn=stmt[key];stmt[key]=function(...args){if(measuring)queries[sql]=(queries[sql]||0)+1;return fn.apply(this,args);};}return stmt;};
const lag=monitorEventLoopDelay({resolution:10});lag.enable();
process.on('message',async m=>{try{
  let result;
  if(m.op==='start'){
    let implementation=require('../../server/index.cjs');
    if(m.serverSource){const {Module}=require('node:module'),file=path.resolve(__dirname,'../../server/index.cjs'),copy=new Module(file,module);copy.filename=file;copy.paths=Module._nodeModulePaths(path.dirname(file));copy._compile(fs.readFileSync(m.serverSource,'utf8'),file);implementation=copy.exports;}
    server=await implementation.startServer({port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:path.join(m.root,'server'),admin:{username:'load-admin',password:'Synthetic-concurrency-123'}});
    const db=new DatabaseSync(path.join(m.root,'server/dingdong.sqlite')),base=db.prepare('SELECT * FROM users').get(),users=[];
    db.exec('BEGIN');
    for(let i=0;i<m.count;i++){
      const id=i?'load-'+i:base.id,token=randomBytes(32).toString('hex');
      if(i)db.prepare('INSERT INTO users(id,username,name,department,role,subject,extension,digest,salt) VALUES(?,?,?,?,?,?,?,?,?)').run(id,'load-'+i,'시험 교사 '+i,'시험부','교사','','',base.digest,base.salt);
      db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),id,Date.now()+86400000);
      users.push({id,name:'시험 교사 '+i,admin:i===0,token});
      for(let j=0;j<10;j++)db.prepare('INSERT INTO events VALUES(?,?,?)').run('load-event-'+i+'-'+j,id,JSON.stringify({title:'합성 공유 일정',date:'2026-11-10',start:'09:00',end:'10:00',type:'group',targets:[base.id],note:'시험 일정',place:''}));
      for(let j=0;j<2;j++)db.prepare('INSERT INTO events VALUES(?,?,?)').run('load-duty-'+i+'-'+j,id,JSON.stringify({title:'급식 지도',date:'2026-11-11',start:'12:00',end:'13:00',type:'group',targets:[base.id,id],duty:{kind:'lunch',assigned:[id],safety:[],general:[id]}}));
    }
    db.prepare('INSERT OR REPLACE INTO metadata VALUES(?,?)').run('dutySettings',JSON.stringify({safetyDepartment:'시험부',managers:{safety:[],lunch:[base.id],study:[],timetable:[],lessons:[]}}));
    db.exec('COMMIT');db.close();result={users,connection:{...server.connection,url:'https://localhost:'+server.port}};
  }else if(m.op==='reset'){queries={};cpu=process.cpuUsage();start=performance.now();lag.reset();measuring=true;result={ok:true};}
  else if(m.op==='metrics'){
    measuring=false;const used=process.cpuUsage(cpu),elapsed=performance.now()-start;
    result={elapsedMs:Math.round(elapsed),cpuMs:Math.round((used.user+used.system)/1000),eventLoopP95Ms:+(lag.percentile(95)/1e6).toFixed(1),eventLoopMaxMs:+(lag.max/1e6).toFixed(1),sqlQueries:Object.values(queries).reduce((a,b)=>a+b,0),topQueries:Object.entries(queries).sort((a,b)=>b[1]-a[1]).slice(0,10),online:server.stats().online};
  }else if(m.op==='backup'){server.backup(m.file);result={ok:true};}
  else if(m.op==='stop'){await server.close();lag.disable();process.send({id:m.id,result:{ok:true}},()=>process.exit(0));return;}
  process.send({id:m.id,result});
}catch(e){process.send({id:m.id,error:e.stack});}});
