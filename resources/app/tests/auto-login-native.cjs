'use strict';
// Run with the packaged client executable and server app directory. Only test profiles are used.
const fs=require('node:fs'),path=require('node:path'),https=require('node:https');
const assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{once}=require('node:events');
const {until,debuggerSession}=require('./helpers/electron-debug.cjs');
const executable=path.resolve(process.argv[2]),{startServer}=require(path.resolve(process.argv[3],'server/index.cjs'));
const run=path.resolve(__dirname,'../../../.artifacts/auto-login',String(Date.now()));
const profile=path.join(run,'client'),file=path.join(profile,'remembered-login.bin');
const options={dataDir:path.join(run,'server'),port:0,host:'127.0.0.1',address:'https://localhost:8443',schoolName:'자동 로그인 시험 학교',admin:{username:'fixture-admin',password:'Fixture-admin-123'}};
const wait=(fn,name)=>until(fn,name,40000);
const signedIn="!!document.querySelector('#connection-status') && !document.querySelector('#login-form')";
const signedOut="document.querySelector('.connection-row span')?.textContent==='자동 로그인 시험 학교' && !!document.querySelector('#login-form')";
let server;
async function client(test){
 const child=spawn(executable,['--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{env:{...process.env,DINGDONG_TEST_DATA_DIR:profile},windowsHide:true,stdio:['ignore','ignore','pipe']});
 const exited=once(child,'exit'),sockets=[];let stderr='';
 child.stderr.on('data',chunk=>{stderr+=chunk;});
 try{
  const port=await wait(()=>stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/)?.[1],'client launch');
  const page=await wait(async()=>(await(await fetch('http://127.0.0.1:'+port+'/json/list')).json()).find(p=>p.url.includes('/index.html')),'client page');
  const evaluate=await debuggerSession(page.webSocketDebuggerUrl,sockets);
  await test(evaluate);
 }finally{for(const socket of sockets)socket.close();child.kill();await exited;}
}
function api(route,payload,token){
 return new Promise((resolve,reject)=>{
  const request=https.request(new URL(route,server.connection.url),{method:'POST',ca:server.connection.certificate,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})}},res=>{
   let body='';res.on('data',chunk=>{body+=chunk;});res.on('end',()=>{if(res.statusCode>=400)reject(Error(route+' '+res.statusCode));else resolve(JSON.parse(body));});
  });request.on('error',reject);request.end(JSON.stringify(payload));
 });
}
async function login(evaluate,password,remember){
 await wait(()=>evaluate(signedOut),'login screen');assert.equal(await evaluate("document.querySelector('#remember-login').checked"),false);
 await evaluate("document.querySelector('#login-name').value='teacher';document.querySelector('#login-password').value="+JSON.stringify(password)+";document.querySelector('#remember-login').checked="+remember+";document.querySelector('#login-form').requestSubmit();true");
}
async function main(){
 fs.mkdirSync(profile,{recursive:true});server=await startServer(options);
 options.port=server.port;options.address=server.connection.url;
 fs.writeFileSync(path.join(profile,'connection.json'),JSON.stringify(server.connection));
 const admin=await api('/login',options.admin),teacher=await api('/admin/users',{username:'teacher',name:'시험 교사',department:'교무부',password:'Temp1234'},admin.token);
 await client(async evaluate=>{
  await login(evaluate,'Temp1234',true);
  await wait(()=>evaluate("!!document.querySelector('#password-form')"),'required password change');
  assert.ok(!fs.existsSync(file));
  await evaluate("document.querySelector('#current-password').value='Temp1234';document.querySelector('#new-password').value='New!1234';document.querySelector('#confirm-password').value='New!1234';document.querySelector('#password-form').requestSubmit();true");
  await wait(()=>evaluate(signedIn),'first login');
  const sealed=fs.readFileSync(file);assert.ok(sealed.length>0);assert.doesNotMatch(sealed.toString(),/Temp1234|New!1234|fingerprint|[a-f0-9]{64}/);
 });
 await server.close();server=null;
 await client(async evaluate=>{
  await wait(()=>evaluate("document.querySelector('#login-error')?.textContent.includes('자동 로그인 대기')"),'server offline');
  server=await startServer(options);
  await wait(()=>evaluate(signedIn),'unattended login after both processes restart');
  assert.equal(await evaluate("(async()=>(await window.dingdongDesktop.request('/bootstrap')).user.username)()"),'teacher');
  await evaluate("document.querySelector('[data-action=logout]').click();true");
  await wait(()=>evaluate(signedOut),'explicit logout');assert.ok(!fs.existsSync(file));
 });
 await client(async evaluate=>{
  await login(evaluate,'New!1234',false);await wait(()=>evaluate(signedIn),'login without remembering');assert.ok(!fs.existsSync(file));
 });
 await client(async evaluate=>{
  await login(evaluate,'New!1234',true);await wait(()=>evaluate(signedIn),'opt in again');assert.ok(fs.existsSync(file));
 });
 await api('/admin/user',{id:teacher.id,password:'Reset1234'},admin.token);
 await client(async evaluate=>{
  await wait(async()=>!fs.existsSync(file)&&await evaluate(signedOut),'admin reset rejects remembered login');
 });
 console.log('PASS: opt-in, first password change, encrypted local credential, process restart, late server, logout, unchecked login and admin reset.');
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(server)await server.close();});
