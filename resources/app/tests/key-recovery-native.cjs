'use strict';
// Run on Windows with the server and client executables, in that order.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),https=require('node:https'),{spawn}=require('node:child_process');
const {debuggerSession,until}=require('./helpers/electron-debug.cjs'),crypto=require('../privacy/crypto.cjs');
const {startServer}=require('../server/index.cjs'),{PrivateClient}=require('../desktop/private-client.cjs');
const run=path.resolve(__dirname,'../../../.artifacts/key-recovery',String(Date.now())),children=[],sockets=[];
const serverProfile=path.join(run,'server'),newPC=path.join(run,'new-pc'),password='Fixture-recovery-123';
let seed,connection,peer;
const wait=(fn,label)=>until(fn,label,25000);
async function open(exe,profile){
  const child=spawn(path.resolve(exe),['--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{env:{...process.env,DINGDONG_TEST_DATA_DIR:profile},windowsHide:true,stdio:['ignore','ignore','pipe']});
  children.push(child);let log='';child.stderr.on('data',buf=>{log+=buf;});
  const port=await wait(()=>log.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1],'launch '+profile);
  return async suffix=>{
    const page=await wait(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(p=>p.url.endsWith(suffix)),suffix);
    return debuggerSession(page.webSocketDebuggerUrl,sockets);
  };
}
function api(route,p,token){
  return new Promise((resolve,reject)=>{
    const req=https.request(new URL(route,connection.url),{ca:connection.certificate,method:p?'POST':'GET',headers:{...(token?{authorization:'Bearer '+token}:{}),'content-type':'application/json'}},res=>{
      let body='';res.on('data',v=>{body+=v;});res.on('end',()=>resolve({...JSON.parse(body),status:res.statusCode}));
    });req.on('error',reject);req.end(p?JSON.stringify(p):undefined);
  });
}
async function main(){
  fs.mkdirSync(newPC,{recursive:true});
  seed=await startServer({dataDir:path.join(serverProfile,'server-data'),host:'127.0.0.1',address:'https://localhost:8443',port:0,admin:{username:'admin',password}});
  connection=seed.connection;const admin=await api('/login',{username:'admin',password});
  const teacher=await api('/admin/users',{username:'teacher',name:'복구 시험 교사',department:'교무부',password},admin.token);
  const first=await api('/login',{username:'teacher',password});await api('/password',{current:password,password},first.token);
  const old=crypto.publicIdentity(await crypto.newIdentity());assert.equal((await api('/privacy/register',old,first.token)).ok,true);
  peer=new PrivateClient({root:path.join(run,'peer'),server:connection.fingerprint,user:admin.user,request:(r,p)=>api(r,p,admin.token),protector:{encrypt:s=>Buffer.from(s),decrypt:b=>b.toString()}});
  await peer.request('/bootstrap');await peer.verify(teacher.id,await crypto.fingerprint(old));
  fs.writeFileSync(path.join(serverProfile,'server-config.json'),JSON.stringify({url:connection.url,port:seed.port}));
  fs.writeFileSync(path.join(newPC,'connection.json'),JSON.stringify(connection));await seed.close();seed=null;
  const serverPage=await open(process.argv[2],serverProfile),operator=await serverPage('/desktop/server.html');
  await wait(async()=>(await operator('window.dingdongDesktop.serverStatus()')).running,'packaged server');
  await operator('window.dingdongDesktop.openAdmin()');
  const manage=await serverPage('/desktop/admin.html');
  await wait(()=>manage("!!document.querySelector('#admin-login-form')?.onsubmit"),'operator login form');
  await manage("document.querySelector('#login-user').value='admin';document.querySelector('#login-pass').value="+JSON.stringify(password)+";document.querySelector('#admin-login-form').requestSubmit();true");
  const select="[data-action=key-recovery][data-user='"+teacher.id+"']";
  await wait(()=>manage('!!document.querySelector('+JSON.stringify(select)+')'),'account management');
  const clientPage=await open(process.argv[3],newPC),user=await clientPage('/index.html');
  const login=async()=>{await wait(()=>user("!!document.querySelector('#login-form')"),'client login');await user("document.querySelector('#login-name').value='teacher';document.querySelector('#login-password').value="+JSON.stringify(password)+";document.querySelector('#login-form').requestSubmit();true");};
  await login();
  await wait(()=>user("document.querySelector('[data-action=request-key-recovery]')?.hidden===false"),'new PC recovery button');
  await user("document.querySelector('[data-action=request-key-recovery]').click();true");
  await wait(()=>user("!!document.querySelector('#recovery-loss')"),'loss consent form');
  await user("document.querySelector('#recovery-loss').click();document.querySelector('[data-action=issue-recovery-code]').click();true");
  const code=await wait(()=>user("document.querySelector('#recovery-result')?.textContent.match(/[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}/)?.[0]"),'one-time recovery code');
  await manage('document.querySelector('+JSON.stringify(select)+').click();true');
  await manage("document.querySelector('#recovery-code').value="+JSON.stringify(code)+";document.querySelector('#recovery-password').value="+JSON.stringify(password)+";document.querySelector('#recovery-confirmed').click();document.querySelector('#recovery-form').requestSubmit();true");
  await wait(()=>manage("document.querySelector('#feedback')?.textContent.includes('새 보안 키를 등록')"),'operator approval');
  assert.equal((await api('/privacy/keys',null,first.token)).status,401);
  await user("document.querySelector('[data-action=close-modal]')?.click();true");await login();
  await wait(()=>user("!!document.querySelector('#connection-status')&&!document.querySelector('#login-form')"),'same account signed in again');
  const security=await user("window.dingdongDesktop.privacy('security')");assert.notEqual(security.fingerprint,await crypto.fingerprint(old));
  await peer.verify(teacher.id,security.fingerprint);
  const mail={id:'after-recovery-native',title:'복구 후 송수신',body:'새 키로 수신',to:[teacher.id],cc:[],files:[]};
  assert.equal((await peer.request('/sync',{operations:[{type:'mail.send',value:mail}]})).delivery[mail.id],'sent');
  await wait(()=>user("window.dingdongDesktop.request('/bootstrap').then(r=>r.data?.mails.some(m=>m.id==='after-recovery-native'&&m.body==='새 키로 수신'))"),'decrypted new message');
  console.log(JSON.stringify({ok:true,version:require('../package.json').version,requestUI:true,approvalUI:true,newPClogin:true,receivedAfterVerification:true}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{for(const ws of sockets)ws.close();for(const child of children)child.kill();peer?.close();if(seed)await seed.close();});
