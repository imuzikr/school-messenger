'use strict';
// Launch a built server package without a role argument; synthetic local setup.
const fs=require('node:fs'),path=require('node:path'),net=require('node:net'),https=require('node:https'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'../../..'),run=path.join(root,'.artifacts','server-package',String(Date.now()));fs.mkdirSync(run,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let child,socket;
async function testStartupSwitch(stderr,evaluate){
 const address=stderr.match(/Debugger listening on (ws:\/\/127\.0\.0\.1:\d+\/[\w-]+)/)?.[1];assert.ok(address);
 const main=new WebSocket(address);await new Promise((resolve,reject)=>{main.onopen=resolve;main.onerror=reject;});
 const inspect=expression=>new Promise((resolve,reject)=>{
   main.onmessage=event=>{const r=JSON.parse(event.data);if(!r.id)return;r.result?.exceptionDetails||r.error?reject(Error(JSON.stringify(r))):resolve(r.result.result.value);};
   main.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression,returnByValue:true}}));
 });
 try{
   await inspect(`(()=>{
     const {app}=process.getBuiltinModule('module').createRequire(process.execPath)('electron');
     if(app.getPath('userData')!==${JSON.stringify(run)})throw Error('Unexpected profile');
     let entry=null;globalThis.blockStartup=false;
     app.setLoginItemSettings=value=>{entry=value;};
     app.getLoginItemSettings=target=>{
       if(target.path!==process.execPath||target.args?.join(' ')!=='--dingdong-server')throw Error('Wrong startup target');
       return {openAtLogin:!!entry?.openAtLogin,launchItems:entry?[{...entry,enabled:!globalThis.blockStartup}]:[]};
     };return true;
   })()`);
   const click=async checked=>{
     await evaluate("document.querySelector('#auto-start').click();true");
     for(let i=0;i<100&&await evaluate("document.querySelector('#auto-start').disabled");i++)await sleep(50);
     assert.equal(await evaluate("document.querySelector('#auto-start').checked"),checked);
   };
   await click(true);await click(false);await inspect('globalThis.blockStartup=true');await click(false);
   assert.match(await evaluate("document.querySelector('#feedback').textContent"),/Windows/);
 }finally{main.close();}
}
async function main(){
 const executable=path.resolve(process.argv[2]||'');assert.ok(executable.startsWith(path.join(root,'dist')+path.sep)&&fs.existsSync(executable));
 const listener=net.createServer();await new Promise(r=>listener.listen(0,'127.0.0.1',r));const port=listener.address().port;await new Promise(r=>listener.close(r));
 child=spawn(executable,['--inspect=127.0.0.1:0','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'],{env:{...process.env,DINGDONG_TEST_DATA_DIR:run},windowsHide:true,stdio:['ignore','pipe','pipe']});let stderr='',debug;
 child.stderr.on('data',v=>{stderr+=v;debug=stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)?.[1];});
 for(let i=0;i<100&&!debug;i++)await sleep(100);assert.ok(debug,stderr);
 let page;for(let i=0;i<100&&!page;i++){page=(await(await fetch('http://127.0.0.1:'+debug+'/json/list')).json()).find(p=>p.url.includes('/desktop/server.html'));if(!page)await sleep(100);}assert.ok(page,'Package did not open server mode by default');
 socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j;});let seq=0;const jobs=new Map();
 socket.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const job=jobs.get(m.id);jobs.delete(m.id);m.error?job.reject(m.error):job.resolve(m.result);}};
 const command=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;jobs.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
 for(let i=0;i<100&&!await evaluate("!!document.querySelector('#setup-form')");i++)await sleep(100);
 assert.equal(await evaluate("document.querySelector('#admin-password').minLength"),8);
 await evaluate("document.querySelector('#school-name').value='띵동 시험 학교';document.querySelector('#server-url').value='https://localhost:"+port+"';document.querySelector('#admin-username').value='fixture';document.querySelector('#admin-password').value='Test!123';document.querySelector('#setup-form').requestSubmit();true");
 let status;for(let i=0;i<100;i++){status=await evaluate("window.dingdongDesktop.serverStatus()");if(status.running)break;await sleep(100);}assert.equal(status.running,true,JSON.stringify(status));assert.equal(status.stats.users,1);
 const connection=JSON.parse(fs.readFileSync(path.join(run,'server-data','dingdong-server.json'),'utf8'));
 const health=await new Promise((resolve,reject)=>{const req=https.get({hostname:'localhost',port,path:'/health',ca:connection.certificate},res=>{let body='';res.on('data',v=>body+=v);res.on('end',()=>resolve(JSON.parse(body)));});req.on('error',reject);});assert.equal(health.version,require('../package.json').version);
 assert.equal(await evaluate('document.title'),'띵동 · 교내 서버');await sleep(200);
 assert.equal(status.stats.attachmentSpace.reserve,2*1024**3);
 assert.ok(Number.isFinite(status.stats.attachmentSpace.available));
 assert.match(await evaluate("document.querySelector('#attachment-space').textContent"),/메시지용 여유 공간/);
 await testStartupSwitch(stderr,evaluate);
 assert.ok(!fs.existsSync(path.join(run,'startup-items')),'server never registers the client shortcut');
 assert.ok(!fs.existsSync(path.join(run,'desktop-items')),'server never creates the client desktop shortcut');
 const shot=await command('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(run,'server.png'),Buffer.from(shot.data,'base64'));
 const result={ok:true,version:health.version,defaultServerRole:true,syntheticServerStarted:true,run,executable};fs.writeFileSync(path.join(run,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{socket?.close();child?.kill();});
