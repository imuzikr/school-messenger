'use strict';
// Opt-in Windows/Electron smoke test. Isolated profiles and synthetic messages.
// node tests/privacy-native.cjs [--hold] from resources/app.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {startServer}=require('../server/index.cjs');
const {PrivateClient}=require('../desktop/private-client.cjs');
const root=path.resolve(__dirname,'../../..'),run=path.join(root,'.artifacts','privacy-native',String(Date.now()));
fs.mkdirSync(run,{recursive:true});
let server,child;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
  let diskShortage=false;
  server=await startServer({port:0,host:'127.0.0.1',address:'https://localhost:8443',dataDir:path.join(run,'server'),admin:{username:'qa',password:'Fixture-native-123',name:'시험 교사'},attachmentFreeBytes:root=>{
    if(diskShortage)return 1024**3;const v=fs.statfsSync(root);return v.bavail*(v.frsize||v.bsize);
  }});
  const profile=path.join(run,'profile');fs.mkdirSync(profile);fs.writeFileSync(path.join(profile,'connection.json'),JSON.stringify(server.connection));
  child=spawn(process.env.DINGDONG_TEST_EXECUTABLE||path.join(root,'Dingdong.exe'),[...(process.env.DINGDONG_TEST_EXECUTABLE?[]:['--dingdong-client']),'--inspect=127.0.0.1:0','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{env:{...process.env,DINGDONG_TEST_DATA_DIR:profile},windowsHide:true,stdio:['ignore','pipe','pipe']});
  let debug='',stderr='';child.stderr.on('data',v=>{stderr+=v;const m=stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//);if(m)debug=m[1];});
  for(let i=0;i<100&&!debug;i++)await sleep(100);assert.ok(debug,'Electron debugger did not start: '+stderr.slice(-2000));
  let pages=[];for(let i=0;i<100&&!pages.some(p=>p.url.startsWith('ieum://'));i++){pages=await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json();await sleep(100);}
  const page=pages.find(p=>p.url.startsWith('ieum://'));assert.ok(page,'Electron page not found');
  const ws=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});let seq=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
  const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  for(let i=0;i<100&&!await evaluate("!!document.querySelector('#login-name')");i++)await sleep(100);
  const {execFileSync}=require('node:child_process');
  const expected=process.env.DINGDONG_TEST_EXECUTABLE||path.join(root,'Dingdong.exe');
  for(const folder of ['startup-items','desktop-items']){
    const shortcut=path.join(profile,folder,'띵동 메신저.lnk');
    for(let i=0;i<100&&!fs.existsSync(shortcut);i++)await sleep(50);
    assert.ok(fs.existsSync(shortcut),'packaged client creates '+folder+' shortcut before messenger login');
    const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',
      '[Console]::OutputEncoding=[Text.Encoding]::UTF8; $link=(New-Object -ComObject WScript.Shell).CreateShortcut($env:DINGDONG_FIXTURE_LINK); @($link.TargetPath,$link.Arguments,$link.WorkingDirectory,$link.IconLocation) | ConvertTo-Json -Compress'],
      {env:{...process.env,DINGDONG_FIXTURE_LINK:shortcut},windowsHide:true,encoding:'utf8'});
    const [target,args,cwd,icon]=JSON.parse(output.trim());
    assert.equal(target.toLowerCase(),expected.toLowerCase());assert.equal(args,'--dingdong-client');assert.equal(cwd.toLowerCase(),path.dirname(expected).toLowerCase());
    if(folder==='desktop-items'){
      const iconFile=path.join(path.dirname(expected),'resources','app','assets','dingdong-icon.ico');
      assert.ok(fs.existsSync(iconFile));assert.equal(icon.replace(/,\s*0$/,'').toLowerCase(),iconFile.toLowerCase());
    }
  }
  const setupAdmin=await http('/login',{username:'qa',password:'Fixture-native-123'});
  const firstAccount=await http('/admin/users',{username:'password-check',name:'비밀번호 시험',department:'교무부',password:'Temp1234'},setupAdmin.token);
  assert.equal(firstAccount.status,201);
  await evaluate("document.querySelector('#login-name').value='password-check';document.querySelector('#login-password').value='Temp1234';document.querySelector('#login-form').requestSubmit();true");
  for(let i=0;i<300&&!await evaluate("!!document.querySelector('#password-form')");i++)await sleep(100);
  assert.equal(await evaluate("document.querySelector('#new-password')?.minLength"),8);
  await evaluate("document.querySelector('#current-password').value='Temp1234';document.querySelector('#new-password').value='New!1234';document.querySelector('#confirm-password').value='New!1234';document.querySelector('#password-form').requestSubmit();true");
  for(let i=0;i<100&&await evaluate("!!document.querySelector('#password-form')");i++)await sleep(100);
  assert.equal(await evaluate("!!document.querySelector('#password-form')"),false);
  assert.equal((await http('/login',{username:'password-check',password:'New!1234'})).user.mustChange,false);
  await evaluate("window.dingdongDesktop.request('/logout',{})");
  for(let i=0;i<100&&!await evaluate("!!document.querySelector('#login-name')");i++)await sleep(100);
  await evaluate("document.querySelector('#login-name').value='qa';document.querySelector('#login-password').value='Fixture-native-123';document.querySelector('#login-form').requestSubmit();true");
  let security;for(let i=0;i<100;i++){security=await evaluate("window.dingdongDesktop.privacy('security')");if(security.fingerprint)break;await sleep(100);}
  assert.ok(security.fingerprint,JSON.stringify(security));
  const login=await http('/login',{username:'qa',password:'Fixture-native-123'}),created=await http('/admin/users',{username:'receiver',name:'수신 시험 교사',department:'교무부',password:'Fixture-native-123'},login.token);
  const recipient=await http('/login',{username:'receiver',password:'Fixture-native-123'});await http('/password',{current:'Fixture-native-123',password:'Fixture-native-123'},recipient.token);
  const client=new PrivateClient({root:path.join(run,'receiver'),server:server.connection.fingerprint,user:recipient.user,request:(r,p)=>http(r,p,recipient.token),protector:{encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()}});
  await client.initialize();await evaluate("window.dingdongDesktop.request('/bootstrap')");
  const op={type:'mail.send',value:{id:'native-private-message',title:'PC 보관 시험',body:'서버에서 삭제된 후에도 이 PC에서 볼 수 있습니다.',html:'<p>암호화 송수신 시험</p>',to:[created.id],cc:[],files:[],workRequest:{kind:'submission'}}};
  const sent=await evaluate('window.dingdongDesktop.request("/sync",'+JSON.stringify({operations:[op]})+')');assert.equal(sent.ok,true,JSON.stringify(sent));
  const openMail=async (id,compose=false)=>{
    await evaluate(compose?'window.dingdongDesktop.openCompose({})':'window.dingdongDesktop.openWorkspace("inbox",'+JSON.stringify({kind:'mail',id})+')');
    let target;for(let i=0;i<80&&!target;i++){target=(await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json()).find(p=>p.url.includes(compose?'compose=1':'workspace=inbox'));if(!target)await sleep(100);}assert.ok(target);
    const socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});let n=0;const jobs=new Map();
    socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=jobs.get(m.id);jobs.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}};
    socket.onclose=()=>{for(const job of jobs.values())job.reject(new Error('Test window closed'));jobs.clear();};
    const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++n;jobs.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
    const run=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
    const wait=async(expression,attempts=100)=>{for(let i=0;i<attempts;i++){if(await run(expression))return;await sleep(100);}throw new Error('UI timeout: '+expression+' / '+await run('document.body.innerText'));};
    const shot=async name=>{await run("window.dingdongDesktop.windowAction('show')");const out=await cmd('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(runPath,name+'.png'),Buffer.from(out.data,'base64'));};
    const runPath=path.dirname(profile);return {run,wait,shot,cmd,close:()=>socket.close()};
  };
  const counts=(stored,read,done)=>`Array.from(document.querySelectorAll('.mail-delivery-status .mail-progress-count'),el=>el.textContent).join('|')===${JSON.stringify('상대 PC 저장 완료 '+stored+'/1명|읽음 '+read+'/1명|제출 완료 '+done+'/1명')}`;
  let ui=await openMail(op.value.id);await ui.wait(counts(0,0,0));
  const received=await client.request('/bootstrap');assert.equal(received.data.mails.find(m=>m.id===op.value.id).body,op.value.body);
  const snapshot=await evaluate("window.dingdongDesktop.request('/bootstrap')");assert.equal(snapshot.data.mails.find(m=>m.id===op.value.id).body,op.value.body);
  await ui.cmd('Page.reload');await ui.wait(counts(1,0,0));
  assert.ok(await ui.run("document.querySelector('.mail-person')?.innerText.includes('상대 PC 저장 완료 · 읽음 확인 전')"));await ui.shot('stored-unread');
  await ui.run("document.querySelector('[data-action=work-detail]').click();true");
  await ui.wait("document.querySelector('.work-table tbody')?.innerText.includes('제출 미완료')");
  await ui.run("window.fixtureWorkDialog=document.querySelector('[data-work-detail]');true");
  await client.request('/sync',{operations:[{type:'mail.work.respond',id:op.value.id,value:{done:true,note:'요청 목록에서 완료'}}]});
  await ui.wait("document.querySelector('.work-table tbody')?.innerText.includes('제출 완료')");
  assert.ok(await ui.run("document.querySelector('.work-table tbody').innerText.includes('읽음 확인 전') && window.fixtureWorkDialog===document.querySelector('[data-work-detail]')"));
  await ui.shot('submitted-unread');await ui.run("document.querySelector('[data-action=close-modal]').click();true");
  await ui.wait(counts(1,0,1));ui.close();
  await evaluate("window.dingdongDesktop.request('/logout',{})");
  assert.equal((await evaluate("window.dingdongDesktop.request('/bootstrap')")).status,401);
  await client.request('/sync',{operations:[{type:'mail.update',id:op.value.id,read:true}]});
  assert.ok(server.stats().messages>0,'offline sender read notice must wait on server');
  for(let i=0;i<50&&!await evaluate("!!document.querySelector('#login-form')");i++)await sleep(100);
  await evaluate("document.querySelector('#login-name').value='qa';document.querySelector('#login-password').value='Fixture-native-123';document.querySelector('#login-form').requestSubmit();true");
  for(let i=0;i<100;i++){if((await evaluate("window.dingdongDesktop.privacy('security')")).fingerprint)break;await sleep(100);}
  const restored=await evaluate("window.dingdongDesktop.request('/bootstrap')");assert.equal(restored.data.mails.find(m=>m.id===op.value.id).body,op.value.body);
  assert.equal(restored.data.mails.find(m=>m.id===op.value.id).receipts[0],'read');
  ui=await openMail(op.value.id);await ui.wait(counts(1,1,1));await ui.shot('read');
  const {DatabaseSync:FixtureDB}=require('node:sqlite'),fixtureDb=new FixtureDB(path.join(run,'server','dingdong.sqlite'));
  for(const action of ['settings','class-teachers']){
    const control='document.querySelector('+JSON.stringify('[data-action='+action+']')+')';
    for(let i=0;i<100&&!await evaluate('!!'+control);i++)await sleep(100);
    assert.ok(await evaluate('!!'+control),'missing settings action '+action);
    await evaluate(control+'.click();true');
  }
  await evaluate("document.querySelector('[data-class-teacher]').value="+JSON.stringify(created.id)+";true");
  fixtureDb.prepare('UPDATE users SET admin=0 WHERE id=?').run(login.user.id);
  await evaluate("document.querySelector('#classes-form').requestSubmit();true");
  for(let i=0;i<100&&!await evaluate("!!document.querySelector('#classes-error')?.textContent");i++)await sleep(100);
  assert.match(await evaluate("document.querySelector('#classes-error').textContent"),/관리자/);
  assert.equal(await evaluate("document.querySelector('[data-class-teacher]').value"),created.id);
  fixtureDb.prepare('UPDATE users SET admin=1 WHERE id=?').run(login.user.id);
  await evaluate("document.querySelector('#classes-form').requestSubmit();true");
  for(let i=0;i<100&&await evaluate("!!document.querySelector('#classes-form')");i++)await sleep(100);
  const savedClasses=JSON.parse(fixtureDb.prepare("SELECT value FROM metadata WHERE key='classTeachers'").get().value);
  assert.ok(savedClasses.some(row=>row.teacher===created.id));
  fixtureDb.prepare('UPDATE users SET disabled=1 WHERE id=?').run(created.id);
  const failedOp={...op,value:{...op.value,id:'native-send-failure',title:'발송 실패 복구 시험'}};
  const failed=await evaluate('window.dingdongDesktop.request("/sync",'+JSON.stringify({operations:[failedOp]})+')');assert.equal(failed.delivery[failedOp.value.id],'failed');
  ui.close();ui=await openMail(failedOp.value.id);await ui.cmd('Page.reload');await ui.wait("!!document.querySelector('[data-action=open-mail][data-mail=native-send-failure]')");await ui.run("document.querySelector('[data-action=open-mail][data-mail=native-send-failure]').click();true");
  await ui.wait("!!document.querySelector('[data-action=retry-send-mail]')");assert.ok(await ui.run("document.querySelector('.mail-delivery-status.error').innerText.includes('발송 실패')"));await ui.shot('send-failed');
  fixtureDb.prepare('UPDATE users SET disabled=0 WHERE id=?').run(created.id);fixtureDb.close();
  await ui.run("document.querySelector('[data-action=retry-send-mail]').click();true");
  await ui.wait("document.querySelector('.mail-delivery-status')?.innerText.includes('PC 저장 완료 0/1명') && !document.querySelector('[data-action=retry-send-mail]')");
  assert.ok((await client.request('/bootstrap')).data.mails.some(m=>m.id===failedOp.value.id));await evaluate("window.dingdongDesktop.request('/bootstrap')");
  await ui.cmd('Page.reload');await ui.wait("!!document.querySelector('[data-action=open-mail][data-mail=native-send-failure]')");await ui.run("document.querySelector('[data-action=open-mail][data-mail=native-send-failure]').click();true");await ui.wait(counts(1,0,0));await ui.shot('retry-delivered');
  diskShortage=true;
  const spaceFile=await evaluate("(async()=>{const api=window.dingdongDesktop;const f=await api.stageAttachment('begin',{name:'수업자료.txt',bytes:3,mime:'text/plain'});await api.stageAttachment('chunk',{localFile:f.localFile,offset:0,data:new Uint8Array([65,66,67])});return api.stageAttachment('finish',f);})()");
  const spaceOp={type:'mail.send',value:{id:'native-storage-shortage',title:'첨부 공간 부족 시험',body:'시험 파일',to:[created.id],cc:[],files:[spaceFile]}};
  const queued=await evaluate('window.dingdongDesktop.request("/sync",'+JSON.stringify({operations:[spaceOp]})+')');assert.ok(queued.ok);
  ui.close();ui=await openMail(spaceOp.value.id);
  await ui.cmd('Page.reload');await ui.wait("!!document.querySelector('[data-action=open-mail][data-mail=native-storage-shortage]')");
  await ui.run("document.querySelector('[data-action=open-mail][data-mail=native-storage-shortage]').click();true");
  await ui.wait("document.querySelector('.mail-delivery-status.error')?.innerText.includes('서버 저장 공간이 부족') && !!document.querySelector('[data-action=retry-send-mail]')");
  await ui.shot('attachment-space-shortage');diskShortage=false;
  await ui.run("document.querySelector('[data-action=retry-send-mail]').click();true");
  await ui.wait("document.querySelector('.mail-delivery-status')?.innerText.includes('PC 저장 완료 0/1명')");
  assert.ok((await client.request('/bootstrap')).data.mails.some(m=>m.id===spaceOp.value.id));
  const spaceDownload=await client.request('/attachment',{mail:spaceOp.value.id,index:0});assert.equal(spaceDownload.file.sha256,spaceFile.sha256);
  await evaluate("window.dingdongDesktop.request('/bootstrap')");
  await ui.run("document.querySelector('#mail-folder-select').value='inbox';document.querySelector('#mail-folder-select').dispatchEvent(new Event('change',{bubbles:true}));true");
  const due=Date.now()+6000;
  const scheduled={type:'mail.send',value:{id:'native-scheduled-inbox',title:'예약 도착 시험',body:'열린 수신함에 자동 표시',html:'',to:[login.user.id],cc:[],files:[],scheduled:new Date(due).toISOString()}};
  const submitted=await client.request('/sync',{operations:[scheduled]});assert.equal(submitted.delivery[scheduled.value.id],'sent');
  const visible="!!document.querySelector('[data-action=open-mail][data-mail=native-scheduled-inbox]')";
  assert.ok(Date.now()<due);assert.equal(await ui.run(visible),false);
  // From submission until arrival, the recipient only observes the open inbox DOM.
  await ui.wait(visible,150);
  const scheduledDelayMs=Date.now()-due;assert.ok(scheduledDelayMs>=0);
  assert.equal(await ui.run("document.querySelectorAll('[data-action=open-mail][data-mail=native-scheduled-inbox]').length"),1);
  await client.request('/bootstrap');ui.close();
  await evaluate("document.querySelector('[data-action=\"settings\"]').click();true");
  await evaluate("document.querySelector('[data-action=\"privacy-settings\"]').click();true");
  for(let i=0;i<50&&!await evaluate("!!document.querySelector('#privacy-person')");i++)await sleep(100);
  assert.ok(await evaluate("!!document.querySelector('#privacy-person')"));
  assert.ok(await evaluate("document.body.innerText.includes('상대 PC의 저장 확인 후 서버에서 삭제')"));
  const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(path.join(run,'server','dingdong.sqlite'));
  const serverRows=Object.fromEntries(['relay_packets','relay_targets','mails','recipients','private_content','private_deliveries'].map(table=>[table,db.prepare('SELECT count(*) n FROM '+table).get().n]));db.close();for(const n of Object.values(serverRows))assert.equal(n,0);
  const screenshot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(run,'security.png'),Buffer.from(screenshot.data,'base64'));
  const inspector=stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[\w-]+)/);
  assert.ok(inspector,'isolated Electron main inspector not found');
  await require('./helpers/archive-ui.cjs')({evaluate,inspector:inspector[1],run,profile});
  const blocked=client.stage({type:'unknown-native-fixture'},[login.user.id]);await client.request('/bootstrap');assert.equal((await evaluate("window.dingdongDesktop.request('/bootstrap')")).incomingFailures,1);
  await evaluate("document.querySelector('[data-action=close-modal]').click();true");await evaluate("document.querySelector('[data-action=settings]').click();true");
  for(let i=0;i<100&&!await evaluate("!!document.querySelector('[data-action=privacy-settings]')");i++)await sleep(100);await evaluate("document.querySelector('[data-action=privacy-settings]').click();true");
  for(let i=0;i<100&&!await evaluate("!!document.querySelector('[data-action=privacy-retry-incoming]')");i++)await sleep(100);
  assert.ok(await evaluate("document.body.innerText.includes('수신 확인 필요 1건')"));const recoveryShot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(run,'incoming-recovery.png'),Buffer.from(recoveryShot.data,'base64'));
  const repairDB=new DatabaseSync(path.join(run,'server','dingdong.sqlite')),packet=repairDB.prepare('SELECT * FROM relay_packets WHERE id=?').get(blocked),privateCrypto=require('../privacy/crypto.cjs'),fixed=await privateCrypto.encrypt({type:'room.leave',room:'synthetic-missing-room'},JSON.parse(packet.context),client.identity,await client.keys());repairDB.prepare('UPDATE relay_packets SET sealed=?,digest=? WHERE id=?').run(fixed,privateCrypto.digest(fixed),blocked);repairDB.close();
  await evaluate("document.querySelector('[data-action=privacy-retry-incoming]').click();true");for(let i=0;i<100&&(await evaluate("window.dingdongDesktop.privacy('security')")).incomingFailed;i++)await sleep(100);assert.equal((await evaluate("window.dingdongDesktop.privacy('security')")).incomingFailed,0);
  assert.equal(await evaluate('document.title'),'띵동 · 학교를 잇는 작은 공간');
  ui=await openMail(null,true);await ui.wait("!!document.querySelector('#mail-files')");
  await ui.run("(()=>{const data=new DataTransfer();for(let i=0;i<21;i++)data.items.add(new File(['fixture'],'file-'+i+'.txt',{type:'text/plain'}));const input=document.querySelector('#mail-files');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()");
  await ui.wait("document.querySelectorAll('#compose-files .chip').length===20 && document.querySelector('#compose-error').innerText.includes('20개')");await ui.shot('attachment-count');
  await ui.run("(async()=>{let item;while(item=document.querySelector('[data-action=remove-file]')){item.click();await new Promise(r=>setTimeout(r,0));}return true;})()");
  const setFile=async file=>{const doc=await ui.cmd('DOM.getDocument'),input=await ui.cmd('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#mail-files'});await ui.cmd('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[file]});};
  const oversize=path.join(run,'oversize-fixture.bin');fs.writeFileSync(oversize,'');fs.truncateSync(oversize,500*1024*1024+1);await setFile(oversize);
  await ui.wait("document.querySelectorAll('#compose-files .chip').length===0 && document.querySelector('#compose-error').innerText.includes('500 MB')");fs.unlinkSync(oversize);
  let largeFileUI=null;
  if(process.env.DINGDONG_TEST_LARGE_FILE==='1'){
    const large=path.join(run,'500MB-ui-fixture.bin');fs.writeFileSync(large,'');fs.truncateSync(large,500*1024*1024);
    const probe="window.__fileProbe={last:performance.now(),maxDelay:0,maxHeap:0,ticks:0};window.__fileProbeTimer=setInterval(()=>{const p=window.__fileProbe,n=performance.now();p.maxDelay=Math.max(p.maxDelay,n-p.last-50);p.maxHeap=Math.max(p.maxHeap,performance.memory?.usedJSHeapSize||0);p.last=n;p.ticks++;},50);true";
    await ui.run(probe);await evaluate(probe);const began=performance.now();await setFile(large);
    await ui.wait("document.querySelectorAll('#compose-files .chip').length===1 && document.querySelector('#compose-error').innerText===''",600);const stagingMs=performance.now()-began,composeProbe=await ui.run('clearInterval(window.__fileProbeTimer);window.__fileProbe');await ui.shot('large-file-ready');
    await ui.run("document.querySelector('#recipient-input').value='수신 시험 교사';document.querySelector('#recipient-input').dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#recipient-suggestions button').click();true");
    await ui.wait("document.querySelectorAll('#recipient-values .chip').length===1");
    await ui.run("document.querySelector('#mail-title').value='대용량 실제 화면 시험';document.querySelector('#mail-editor').innerText='500 MB 합성 파일';document.querySelector('#compose-form').requestSubmit();true");ui.close();
    let mail;for(let i=0;i<1800&&!mail;i++){const r=await client.request('/bootstrap');mail=r.data?.mails.find(m=>m.title==='대용량 실제 화면 시험');if(!mail)await sleep(100);}assert.ok(mail,'500 MB UI send did not complete');
    const transmittedMs=performance.now()-began-stagingMs,downloaded=await client.request('/attachment',{mail:mail.id,index:0}),hash=await require('../privacy/file-io.cjs').hashFile(client.files.path(downloaded.file.localFile));assert.equal(hash,mail.files[0].sha256);
    const mainProbe=await evaluate('clearInterval(window.__fileProbeTimer);window.__fileProbe');await evaluate("window.dingdongDesktop.request('/bootstrap')");
    largeFileUI={bytes:mail.files[0].bytes,stagingMs,transmittedMs,composeProbe,mainProbe,sha256:hash};fs.unlinkSync(large);
  }else ui.close();
  const measurement={ok:true,version:require('../package.json').version,brand:'띵동',incomingRecoveryUI:true,scheduledDelayMs,attachmentLimitsUI:true,largeFileUI,run,profile,fingerprint:security.fingerprint,serverBodyPurged:server.stats().messages===0,serverRows,offlineReadReceiptDelivered:true,deliveryStatusUI:true,retryButtonDelivered:true,electron:await evaluate('navigator.userAgent')};
  fs.writeFileSync(path.join(run,'result.json'),JSON.stringify(measurement,null,2));console.log(JSON.stringify(measurement));
  if(process.argv.includes('--hold')){console.log('Holding isolated Electron window for visual QA. Create '+path.join(run,'stop')+' to close.');while(!fs.existsSync(path.join(run,'stop')))await sleep(500);}
  client.close();ws.close();child.kill();await server.close();
}
function http(route,payload,token){return new Promise((resolve,reject)=>{const raw=payload===undefined?null:JSON.stringify(payload),req=https.request({hostname:'127.0.0.1',port:server.port,path:route,method:raw?'POST':'GET',ca:server.connection.certificate,headers:{...(raw?{'content-type':'application/json','content-length':Buffer.byteLength(raw)}:{}),...(token?{authorization:'Bearer '+token}:{})}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve({...JSON.parse(data),status:res.statusCode}));});req.on('error',reject);if(raw)req.write(raw);req.end();});}
main().catch(async e=>{console.error(e);child?.kill();if(server)await server.close();process.exitCode=1;});
