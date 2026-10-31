'use strict';
// Measure real Electron windows with a separate Windows-encrypted synthetic history.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{once}=require('node:events'),{DatabaseSync}=require('node:sqlite');
const {startServer}=require('../server/index.cjs');
const root=path.resolve(__dirname,'../../..'),exe=path.resolve(process.argv[2]||path.join(root,'Dingdong.exe'));
const run=path.join(root,'.artifacts','history-performance',String(Date.now())),profile=path.join(run,'profile');
const {pause,until,debuggerSession}=require('./helpers/electron-debug.cjs');
// Evaluated inside the test-owned Electron main process before login.
function seedHistory(profile,server,user){
  const req=process.getBuiltinModule('module').createRequire(process.execPath);
  const {app,safeStorage}=req('electron'),path=req('node:path');
  if(app.getPath('userData')!==profile||!safeStorage.isEncryptionAvailable())throw Error('Unexpected test profile');
  const {LocalStore}=req(path.join(app.getAppPath(),'privacy/local-store.cjs'));
  const db=new LocalStore(path.join(profile,'private-history'),server,user,{encrypt:s=>safeStorage.encryptString(s),decrypt:b=>safeStorage.decryptString(b)});
  const date=i=>new Date(Date.UTC(2023,9,1)+i*86400000*1095/3000).toISOString().slice(0,10);
  try{db.transaction(()=>{
    for(let i=0;i<3000;i++){
      const sent=i%3===2,id='history-mail-'+i,from=sent?'me':'fixture-peer',to=[sent?'fixture-peer':user],folder=sent?'sent':'inbox';
      const fields={title:'교무 업무 합성검색자료 '+i,body:('학년별 교육활동 계획과 수업 자료를 확인해 주세요. ').repeat(8)+(i===0?'오래된원본문서':''),html:''};
      db.put('content','mail:'+id,fields);
      db.put('mail-history',id,{id,...fields,from,to,folder,previousFolder:folder,cc:[],unread:false,important:false,receipts:['read'],storedReceipts:{[to[0]]:1},files:[],date:date(i),time:'09:00',createdAt:Date.parse(date(i))+i});
    }
    for(let room=0;room<30;room++){
      const messages=Array.from({length:300},(_,i)=>({id:'history-chat-'+room+'-'+i,sender:i%2?'me':'fixture-peer',text:'교내 업무 대화 합성검색자료 '+i,date:date(i*10),time:'13:00',createdAt:Date.parse(date(i*10))+i}));
      db.put('room-history','room-'+room,{id:'room-'+room,name:'교무 협의 '+room,members:['fixture-peer'],messages,unread:0});
    }
  });}finally{db.close();}
  return true;
}
async function session(server,user,seed,crashCheck='',checkPaging=false){
  const sockets=[],started=performance.now();
  const child=spawn(exe,['--dingdong-client','--inspect=127.0.0.1:0','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{env:{...process.env,DINGDONG_TEST_DATA_DIR:profile},windowsHide:true,stdio:['ignore','ignore','pipe']});
  const exited=once(child,'exit');let stderr='';child.stderr.on('data',data=>{stderr+=data;});
  let inspectorSession;
  try{
    const port=await until(()=>stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1],'renderer debugger');
    const inspector=await until(()=>stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[\w-]+)/)?.[1],'main debugger');
    inspectorSession=await debuggerSession(inspector,sockets);
    const page=async match=>{
      const target=await until(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(p=>p.url.startsWith('ieum://')&&match(p.url)),'window');
      return debuggerSession(target.webSocketDebuggerUrl,sockets);
    };
    const main=await page(url=>!url.includes('workspace='));
    await until(()=>main("!!document.querySelector('#login-form')?.offsetHeight"),'login screen');
    const launchMs=performance.now()-started;
    if(seed){
      await inspectorSession('('+seedHistory.toString()+')(...'+JSON.stringify([profile,server.connection.fingerprint,user])+')');
      console.log('Seeded 12,000 synthetic messages in the test profile');
    }
    const loginAt=performance.now();
    await main("document.querySelector('#login-name').value='qa';document.querySelector('#login-password').value='Synthetic-bench-password-123';document.querySelector('#login-form').requestSubmit();true");
    await until(()=>main("(()=>{const error=document.querySelector('#login-error')?.textContent;if(error)throw Error(error);return !!document.querySelector('#connection-status') && !document.querySelector('#login-form');})()"),'signed-in main window');
    const loginMs=performance.now()-loginAt;
    if(crashCheck){
      if(crashCheck==='write'){
        const mail={id:'first-login-crash-check',title:'첫 로그인 시험',body:'이 PC의 시험 기록',to:[user],cc:[],files:[]};
        const sent=await main('window.dingdongDesktop.request("/sync",'+JSON.stringify({operations:[{type:'mail.send',value:mail}]})+')');
        assert.equal(sent.ok,true,JSON.stringify(sent));child.kill();
      }else assert.ok(await main("(async()=>{const r=await window.dingdongDesktop.request('/bootstrap');return r.data.mails.some(m=>m.id==='first-login-crash-check'&&m.body==='이 PC의 시험 기록');})()"));
      return;
    }
    if(seed)return;
    const inboxAt=performance.now();await main("window.dingdongDesktop.openWorkspace('inbox')");
    const inbox=await page(url=>url.includes('workspace=inbox'));
    await until(()=>inbox("!!document.querySelector('.mail-row[data-mail]') && !!document.querySelector('#mail-folder-select option:checked')?.textContent.includes('2000')"),'inbox with 2,000 received messages');
    const inboxMs=performance.now()-inboxAt;
    await main("window.dingdongDesktop.openWorkspace('search')");
    const search=await page(url=>url.includes('workspace=search'));
    await until(()=>search("!!document.querySelector('#work-search-form')"),'search screen');
    async function query(term,total){
      const at=performance.now();
      await search("document.querySelector('#work-search-query').value="+JSON.stringify(term)+"; document.querySelector('#work-search-form').requestSubmit();true");
      await until(()=>search("document.querySelector('.work-result-count strong')?.textContent==="+JSON.stringify(total+'건')),'search result '+total);
      return performance.now()-at;
    }
    const rareSearchMs=await query('오래된원본문서',1),broadSearchMs=await query('합성검색자료',12000);
    assert.equal(await search("document.querySelectorAll('.work-search-result').length"),50);
    if(checkPaging){
      assert.equal(await inbox("document.querySelectorAll('.mail-table-row').length"),100);
      await inbox("document.querySelector('[data-action=mail-more]').click();true");
      await until(()=>inbox("document.querySelectorAll('.mail-table-row').length===200"),'next 100 rows');
      await inbox("const by=document.querySelector('#mail-search-by');by.value='content';by.dispatchEvent(new Event('change',{bubbles:true}));const q=document.querySelector('#mail-search');q.value='오래된원본문서';q.dispatchEvent(new Event('input',{bubbles:true}));true");
      await until(()=>inbox("document.querySelectorAll('.mail-table-row').length===1 && document.querySelector('.mail-table-row').dataset.mail==='history-mail-0'"),'oldest mail matches outside first 100');
    }
    return {launchMs,loginMs,inboxMs,rareSearchMs,broadSearchMs};
  }finally{
    if(inspectorSession&&!child.killed&&child.exitCode===null)await inspectorSession("setTimeout(()=>process.getBuiltinModule('module').createRequire(process.execPath)('electron').app.quit(),50);true").catch(()=>{});
    for(const socket of sockets)socket.close();
    const fallback=setTimeout(()=>child.kill(),5000);try{await exited;}finally{clearTimeout(fallback);}
  }
}
async function main(){
  fs.mkdirSync(profile,{recursive:true});
  const server=await startServer({port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:path.join(run,'server'),admin:{username:'qa',password:'Synthetic-bench-password-123',name:'성능 시험'}});
  try{
    fs.writeFileSync(path.join(profile,'connection.json'),JSON.stringify(server.connection));
    const db=new DatabaseSync(path.join(run,'server','dingdong.sqlite'));let user;
    try{user=db.prepare('SELECT id FROM users WHERE username=?').get('qa').id;}finally{db.close();}
    const version=JSON.parse(fs.readFileSync(path.join(path.dirname(exe),'resources/app/package.json'))).version;
    if(process.argv.includes('--check-first-login')){
      await session(server,user,false,'write');await session(server,user,false,'verify');
      console.log(JSON.stringify({version,firstLoginForcedExitRecovered:true,run}));return;
    }
    await session(server,user,true);
    const samples=[];for(let i=0;i<3;i++){samples.push(await session(server,user,false,'',i===2&&process.argv.includes('--check-paging')));console.log('sample',i+1,JSON.stringify(samples[i]));}
    const median=Object.fromEntries(Object.keys(samples[0]).map(key=>[key,Math.round(samples.map(s=>s[key]).sort((a,b)=>a-b)[1])]));
    const result={version,schoolYears:3,mails:3000,received:2000,chats:9000,rooms:30,samples,median,run};
    fs.writeFileSync(path.join(run,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await server.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
