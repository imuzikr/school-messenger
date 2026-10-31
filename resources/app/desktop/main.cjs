'use strict';
const {app,screen,BrowserWindow,ipcMain,protocol,net:electronNet,dialog,Menu,Tray,Notification,shell,safeStorage,clipboard,nativeImage}=require('electron');
const path=require('node:path');const fs=require('node:fs');const https=require('node:https');const crypto=require('node:crypto');const os=require('node:os');const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..');
const branding=require('./branding.cjs'),APP_ORIGIN=branding.rendererOrigin;
protocol.registerSchemesAsPrivileged([{scheme:branding.rendererScheme,privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
let mainWindow,tray,connection,token=null,stream=null,reconnect=null,localServer=null,quitting=false;
let privateClient=null,liveUser=null,loggingOut=false;
const role=branding.roleFor(process.argv,require('../package.json'),process.env,app.isPackaged);
app.setName(role==='demo'?'DingdongDemo':role==='server'?'DingdongServer':'DingdongClient');
const testProfile=process.env.DINGDONG_TEST_DATA_DIR||process.env.IEUM_TEST_DATA_DIR;
app.setPath('userData',testProfile?path.resolve(testProfile):branding.profileDirectory(app.getPath('appData'),role));
const {RememberedLogin}=require('./remembered-login.cjs');
const rememberedLogin=new RememberedLogin(app.getPath('userData'),safeStorage);
let pendingRemember=false,authQueue=Promise.resolve();
function authChange(action){
 const job=authQueue.then(action);
 authQueue=job.catch(()=>{});
 return job;
}
const windows=new Set();
let todaySide='left',todayAnimation=null,memoAnimation=null,todayOpen=false,memoOpen=false,minimalState=null,briefingBounds=null;
let TODAY_WIDTH=330;
const MEMO_TAB_WIDTH=12, WING_DURATION=420;
const connectionPath=()=>path.join(app.getPath('userData'),'connection.json');
const configPath=()=>path.join(app.getPath('userData'),'server-config.json');
function readJSON(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}
async function waitForWindowsProtection(){
 if(process.platform!=='win32')return;
 if(!safeStorage.isEncryptionAvailable())throw Error('이 PC의 안전한 저장소를 사용할 수 없습니다.');
 // Chromium writes its first DPAPI-wrapped key asynchronously. A committed SQLite
 // record cannot survive a forced exit until this profile preference is on disk.
 safeStorage.encryptString('dingdong-storage-check');
 const file=path.join(app.getPath('userData'),'Local State'),deadline=Date.now()+30000;
 while(!readJSON(file)?.os_crypt?.encrypted_key){
  if(Date.now()>=deadline)throw Error('PC 보관용 보호 키를 저장하지 못했습니다. 디스크 여유 공간과 폴더 권한을 확인한 뒤 다시 로그인해 주세요.');
  await new Promise(resolve=>setTimeout(resolve,100));
 }
}
function validateConnection(value){
 if(!value||value.version!==1||typeof value.certificate!=='string'||value.certificate.length>20000)throw new Error('띵동 서버 연결 파일이 올바르지 않습니다.');
 const u=new URL(value.url);if(u.protocol!=='https:'||u.username||u.password||u.pathname!=='/'||u.search||u.hash)throw new Error('HTTPS 서버 주소만 사용할 수 있습니다.');
 const cert=new crypto.X509Certificate(value.certificate);if(value.fingerprint&&cert.fingerprint256!==value.fingerprint)throw new Error('인증서 지문이 일치하지 않습니다.');
 return {version:1,url:u.origin,certificate:value.certificate,fingerprint:cert.fingerprint256,schoolName:String(value.schoolName||'우리 학교').slice(0,60)};
}
function trustedSender(event){if(!event.senderFrame?.url?.startsWith(APP_ORIGIN+'/'))throw new Error('허용되지 않은 화면 요청입니다.');}
const expose=(name,handler)=>ipcMain.handle(name,async(event,...args)=>{trustedSender(event);try{return await handler(event,...args);}catch(error){return {error:error.message||'요청을 처리하지 못했습니다.',...(error.code==='KEY_REGISTRATION_CONFLICT'?{code:error.code}:{})};}});
expose('dingdong:capture-screen',async()=>{
 if(process.platform!=='win32')return {manual:true};
 const {spawn}=require('node:child_process');
 await new Promise((resolve,reject)=>{const child=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','SnippingTool.exe'),['/clip'],{stdio:'ignore',windowsHide:true});child.once('error',reject);child.once('spawn',()=>{child.unref();resolve();});});
 return {ok:true};
});
expose('dingdong:clipboard-image',async()=>{
 let image;
 if(typeof clipboard.readImage==='function')image=clipboard.readImage();
 else for(const item of await clipboard.read()){
  const type=item.types.find(type=>/^image\/(png|jpeg|webp|gif)$/.test(type));
  if(type){const blob=await item.getType(type);if(blob.size>2*1024*1024)throw new Error('이미지는 2 MB 이하로 캡처해 주세요.');image=nativeImage.createFromBuffer(Buffer.from(await blob.arrayBuffer()));break;}
 }
 if(!image||image.isEmpty())throw new Error('캡처하거나 복사한 이미지가 없습니다.');
 const png=image.toPNG();if(png.length>2*1024*1024)throw new Error('이미지는 2 MB 이하로 캡처해 주세요.');
 return {data:'data:image/png;base64,'+png.toString('base64')};
});
const emit=data=>{for(const w of windows)if(!w.isDestroyed())w.webContents.send('dingdong:update',data);};
function request(route,payload,credential=token){return new Promise((resolve,reject)=>{
 if(role==='demo')return reject(new Error('창 체험 데모는 실제 서버에 연결하지 않습니다.'));
 if(!connection)return reject(new Error('관리자에게 받은 서버 연결 파일을 먼저 가져오세요.'));
 if(!/^\/(health|login|logout|session|password|bootstrap(?:\?privacy=[12])?|sync|attachment|message-source|search|privacy\/(register|keys|ack|localize|recovery)|relay\/(state|pull(?:\?after=\d+)?|send|upload|file|ack|cancel|migrate|blob\/(start|chunk|finish|info|read))|admin\/users|admin\/user|admin\/staff-import|admin\/key-recovery)$/.test(route))return reject(new Error('지원하지 않는 요청입니다.'));
 const body=payload===undefined?null:JSON.stringify(payload);const url=new URL(route,connection.url);
 const req=https.request(url,{method:body?'POST':'GET',ca:connection.certificate,minVersion:'TLSv1.2',headers:{...(body?{'content-type':'application/json','content-length':Buffer.byteLength(body)}:{}),...(credential?{authorization:'Bearer '+credential}:{})},timeout:route==='/admin/staff-import'?120000:20000},res=>{let bytes=0,raw='';res.on('data',chunk=>{bytes+=chunk.length;if(bytes>16*1024*1024){res.destroy(new Error('서버 응답이 너무 큽니다.'));return}raw+=chunk});res.on('error',reject);res.on('end',()=>{let result;try{result=JSON.parse(raw);}catch{return reject(new Error('서버 응답을 읽을 수 없습니다.'));}if(res.statusCode>=400){if(res.statusCode===401&&route!=='/login'&&route!=='/session'&&credential&&credential===token){token=null;stopStream();emit({kind:'expired'});}resolve({...result,status:res.statusCode});}else resolve(result);});});
 req.on('timeout',()=>req.destroy(new Error('서버 연결 시간이 초과되었습니다.')));req.on('error',error=>reject(new Error(error.code?.startsWith('CERT')||['DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','ERR_TLS_CERT_ALTNAME_INVALID'].includes(error.code)?'서버 인증서를 확인할 수 없습니다. 올바른 연결 파일과 서버 주소를 확인하세요.':'교내 서버에 연결할 수 없습니다. 서버 PC와 네트워크를 확인하세요.')));if(body)req.write(body);req.end();
 });}
function stopStream(){clearTimeout(reconnect);reconnect=null;if(stream){stream.destroy();stream=null;}}
function connectStream(){
 stopStream();if(!token||!connection)return;let activeToken=token;
 const req=https.get(new URL('/events',connection.url),{ca:connection.certificate,headers:{authorization:'Bearer '+token},minVersion:'TLSv1.2'},res=>{
  if(res.statusCode!==200){if(res.statusCode===401&&token===activeToken){token=null;emit({kind:'expired'});}res.resume();return;}
  emit({kind:'connected'});let raw='';res.setEncoding('utf8');res.on('data',chunk=>{raw+=chunk;let at;while((at=raw.indexOf('\n\n'))>=0){const frame=raw.slice(0,at);raw=raw.slice(at+2);const data=frame.split('\n').find(line=>line.startsWith('data: '));if(data){try{emit(JSON.parse(data.slice(6)));}catch{}}}if(raw.length>100000)raw='';});res.on('error',()=>{});res.on('end',retry);
 });stream=req;req.on('error',retry);
 function retry(){if(activeToken!==token||!token)return;emit({kind:'disconnected'});if(!reconnect)reconnect=setTimeout(()=>{reconnect=null;connectStream()},3000);}
}
function createWindow(url,options={}){
 const window=new BrowserWindow({width:options.width||430,height:options.height||830,minWidth:options.minWidth||390,minHeight:600,show:false,frame:false,backgroundColor:'#f6f8f4',title:'띵동',...options,webPreferences:{preload:path.join(__dirname,'preload.cjs'),additionalArguments:[...(role==='demo'?['--dingdong-demo']:[]),...(options.mainHost?['--dingdong-main-host','--dingdong-wing-width='+TODAY_WIDTH]:[])],contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 windows.add(window);window.once('ready-to-show',()=>{window.show();});window.on('closed',()=>windows.delete(window));
 window.webContents.setWindowOpenHandler(({url})=>{try{if(['https:','http:'].includes(new URL(url).protocol))shell.openExternal(url);}catch{}return {action:'deny'};});
 window.webContents.on('will-navigate',(e,target)=>{if(!target.startsWith(APP_ORIGIN+'/'))e.preventDefault();});
 window.loadURL(url);return window;
}
function setMinimalMain(open){
 if(!mainWindow||mainWindow.isDestroyed()||role==='server')throw new Error('메신저 본창에서만 미니멀 모드를 사용할 수 있습니다.');
 const w=mainWindow;
 if(open){
  if(minimalState)return {minimal:true};
  const bounds=w.getBounds(),area=screen.getDisplayMatching(bounds).workArea;
  const x=Math.max(area.x,Math.min(bounds.x+TODAY_WIDTH,area.x+area.width-360));
  const y=Math.max(area.y,Math.min(bounds.y,area.y+area.height-56));
  minimalState={bounds,minimum:w.getMinimumSize(),maximum:w.getMaximumSize(),resizable:w.isResizable(),topmost:w.isAlwaysOnTop(),initial:{x,y}};
  clearTimeout(todayAnimation);clearTimeout(memoAnimation);todayAnimation=null;memoAnimation=null;
  w.setMinimumSize(360,56);w.setMaximumSize(360,56);w.setResizable(false);
  w.setBounds({x,y,width:360,height:56},false);w.setAlwaysOnTop(true);applyMainShape();
 }else{
  if(!minimalState)return {minimal:false};
  const saved=minimalState,current=w.getBounds(),bounds={...saved.bounds};
  if(current.x!==saved.initial.x||current.y!==saved.initial.y){
   const area=screen.getDisplayMatching(current).workArea,orgWidth=bounds.width-2*TODAY_WIDTH-MEMO_TAB_WIDTH;
   const orgX=Math.max(area.x,Math.min(current.x,area.x+Math.max(0,area.width-orgWidth)));
   bounds.x=orgX-TODAY_WIDTH;bounds.y=Math.max(area.y,Math.min(current.y,area.y+Math.max(0,area.height-bounds.height)));
  }
  minimalState=null;
  w.setResizable(saved.resizable);w.setMaximumSize(...saved.maximum);w.setMinimumSize(...saved.minimum);
  w.setBounds(bounds,false);w.setAlwaysOnTop(saved.topmost);applyMainShape();
 }
 emit({kind:'minimal-main',open:!!minimalState});
 if(!minimalState){emit({kind:'today-panel',open:todayOpen,side:todaySide});emit({kind:'memo-panel',open:memoOpen});}
 return {minimal:!!minimalState};
}
function bringMain(){if(mainWindow&&!mainWindow.isDestroyed()){if(minimalState)setMinimalMain(false);if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}}
function serverDataDir(){return path.join(app.getPath('userData'),'server-data');}
async function startLocal(config,admin){
 if(localServer)return {ok:true};
 if(role==='demo')throw new Error('화면 체험 앱은 서버를 실행하지 않습니다.');
 const {startServer}=require('../server/index.cjs');
 const parsed={port:Number(config.port)||8443,address:config.url,schoolName:config.schoolName,dataDir:serverDataDir(),admin,onChange:()=>emit({kind:'server-stats'}),onError:error=>console.error('Server operation failed:',error.name)};
 localServer=await startServer(parsed);fs.writeFileSync(configPath(),JSON.stringify({url:config.url,port:parsed.port,schoolName:config.schoolName}),{mode:0o600});
 connection=validateConnection({...localServer.connection,url:`https://localhost:${localServer.port}`});
 emit({kind:'server-started'});return {ok:true};
}
app.on('second-instance',bringMain);
if(!app.requestSingleInstanceLock())app.quit();
else app.whenReady().then(async()=>{
 app.setAppUserModelId(role==='server'?'kr.dingdong.server':'kr.dingdong.client');
 if(process.platform==='win32'&&app.isPackaged&&role==='client'){
  const profile=app.getPath('userData');
  // Isolated test profiles keep both Windows shortcuts inside the test directory.
  const testStartup=testProfile?()=>path.join(profile,'startup-items'):undefined;
  const desktopFolder=()=>testProfile?path.join(profile,'desktop-items'):app.getPath('desktop');
  const {registerClientStartup,registerClientDesktop}=require('./client-startup.cjs');
  registerClientStartup(shell,profile,process.execPath,testStartup).catch(()=>{
   if(Notification.isSupported())new Notification({title:'띵동 자동 실행',body:'시작프로그램에 등록하지 못했습니다. Windows 시작프로그램 폴더를 확인해 주세요.'}).show();
  });
  registerClientDesktop(shell,profile,process.execPath,desktopFolder).catch(()=>{
   if(Notification.isSupported())new Notification({title:'띵동 바탕화면 바로 가기',body:'바로 가기를 만들지 못했습니다. 바탕화면 폴더에 쓸 수 있는지 확인해 주세요.'}).show();
  });
 }
 protocol.handle(branding.rendererScheme,request=>{const url=new URL(request.url);let decoded;try{decoded=decodeURIComponent(url.pathname);}catch{return new Response('Bad path',{status:400})}const file=path.resolve(ROOT,'.'+decoded);if(!file.startsWith(ROOT+path.sep)||decoded.includes('\0'))return new Response('Forbidden',{status:403});const rel=path.relative(ROOT,file).split(path.sep);if(!['index.html','css','js','assets','data','desktop'].includes(rel[0])||rel.some(v=>v.endsWith('.cjs'))||!fs.existsSync(file)||!fs.statSync(file).isFile())return new Response('Not found',{status:404});return electronNet.fetch(pathToFileURL(file).href);});
 connection=role==='demo'?null:readJSON(connectionPath());if(connection){try{connection=validateConnection(connection)}catch{connection=null}}
 Menu.setApplicationMenu(null);
 const area=screen.getPrimaryDisplay().workArea,host=role!=='server';
 TODAY_WIDTH=Math.max(120,Math.min(330,Math.floor((area.width-430-MEMO_TAB_WIDTH)/2)));
 mainWindow=createWindow(role==='server'?APP_ORIGIN+'/desktop/server.html':APP_ORIGIN+'/index.html',host?{mainHost:true,transparent:true,backgroundColor:'#00000000',hasShadow:false,thickFrame:false,width:430+2*TODAY_WIDTH+MEMO_TAB_WIDTH,height:Math.min(830,area.height),minWidth:390+2*TODAY_WIDTH+MEMO_TAB_WIDTH,x:area.x+Math.round((area.width-430-2*TODAY_WIDTH-MEMO_TAB_WIDTH)/2),y:area.y+Math.max(0,Math.round((area.height-830)/2))}:{width:760,height:760,minWidth:650});
 if(host){mainWindow.on('resize',()=>applyMainShape());applyMainShape();}
 // One native window owns the organization and both wings: focus, move, minimize and restore are atomic.
 mainWindow.on('close',e=>{if(!quitting){e.preventDefault();mainWindow.hide();}});
 const {nativeImage}=require('electron');const trayImage=nativeImage.createFromPath(path.join(ROOT,'assets','dingdong-icon.png'));tray=new Tray(trayImage.resize({width:20,height:20}));tray.setToolTip(role==='server'?'띵동 교내 서버':'띵동 학교 메신저');tray.on('double-click',bringMain);tray.setContextMenu(Menu.buildFromTemplate([{label:role==='server'?'서버 관리 열기':'메신저 열기',click:bringMain},{type:'separator'},{label:'띵동 종료',click:()=>{quitting=true;app.quit()}}]));
 if(role==='server'){const cfg=readJSON(configPath());if(cfg){try{await startLocal(cfg);}catch{emit({kind:'server-start-error'});}}}
});
async function endLocalSession(){
 stopStream();
 if(privateClient){await privateClient.queue;privateClient.close();privateClient=null;}
 token=null;liveUser=null;pendingRemember=false;
}
async function activateSession(credential,user){
 await endLocalSession();
 if(!safeStorage.isEncryptionAvailable()||(process.platform==='linux'&&safeStorage.getSelectedStorageBackend()==='basic_text'))throw Error('이 PC의 안전한 저장소를 사용할 수 없습니다. Windows 사용자 계정으로 다시 로그인해 주세요.');
 const {PrivateClient}=require('./private-client.cjs');
 const server=connection;
 const sessionRequest=(route,payload)=>{
  if(credential!==token||server!==connection)return Promise.resolve({error:'다시 로그인해 주세요.',status:401});
  return request(route,payload,credential);
 };
 privateClient=new PrivateClient({root:path.join(app.getPath('userData'),'private-history'),server:server.fingerprint,user,request:sessionRequest,onTransfer:value=>emit({kind:'file-transfer',...value}),protector:{encrypt:value=>safeStorage.encryptString(value),decrypt:value=>safeStorage.decryptString(value)}});
 token=credential;liveUser=user;
}
function saveRememberedLogin(result){
 pendingRemember=false;
 try{rememberedLogin.save(connection.fingerprint,token);}
 catch{result.loginWarning='이 PC에 자동 로그인 정보를 저장하지 못했습니다. 다음 실행 때 다시 로그인해 주세요.';}
}
async function restoreSession(){
 if(token||role!=='client'||!connection)return;
 const credential=rememberedLogin.read(connection.fingerprint);
 if(!credential)return;
 let result;
 try{result=await request('/session',undefined,credential);}
 catch(error){return {error:error.message,retryAutoLogin:true};}
 if(result.error){
  if([401,403].includes(result.status))rememberedLogin.clear();
  return {error:result.error,retryAutoLogin:result.status>=500};
 }
 await activateSession(credential,result.user);connectStream();
}
expose('dingdong:connection',()=>connection?{url:connection.url,schoolName:connection.schoolName,fingerprint:connection.fingerprint}:null);
expose('dingdong:import',async()=>{if(role==='server')throw new Error('서버 관리 앱에서는 연결 파일을 가져오지 않습니다.');const result=await dialog.showOpenDialog(mainWindow,{title:'관리자에게 받은 띵동 서버 연결 파일 선택',filters:[{name:'띵동 연결 파일',extensions:['json']}],properties:['openFile']});if(result.canceled)return null;const file=result.filePaths[0];if(fs.statSync(file).size>50000)throw new Error('연결 파일 크기가 올바르지 않습니다.');const value=validateConnection(readJSON(file));const choice=await dialog.showMessageBox(mainWindow,{type:'question',title:'교내 서버 연결 확인',message:value.schoolName+' 서버에 연결할까요?',detail:value.url+'\n\n인증서 지문:\n'+value.fingerprint+'\n\n관리자가 안내한 주소와 지문이 일치하는지 확인하세요. 이 파일에는 비밀번호가 없습니다.',buttons:['취소','확인 후 연결'],defaultId:0,cancelId:0});if(choice.response!==1)return null;
 return authChange(async()=>{
  rememberedLogin.clear();await endLocalSession();fs.writeFileSync(connectionPath(),JSON.stringify(value),{mode:0o600});connection=value;
  return {url:value.url,schoolName:value.schoolName,fingerprint:value.fingerprint};
 });
});
expose('dingdong:request',async(event,route,payload)=>{
 if(route==='/admin/key-recovery'&&(role!=='server'||event.senderFrame.url!==APP_ORIGIN+'/desktop/admin.html'))throw Error('서버의 교직원 계정 관리 창에서 승인해 주세요.');
 if(route==='/logout')return authChange(async()=>{
  loggingOut=true;
  try{
   if(role==='client')rememberedLogin.clear();
   if(privateClient)await privateClient.queue;
   try{await request('/logout',{});}catch{}
   return {ok:true};
  }finally{await endLocalSession();loggingOut=false;emit({kind:'logout'});}
 });
 if(loggingOut)return {error:'로그아웃 처리 중입니다.',status:401};
 if(route==='/login')return authChange(async()=>{
  await waitForWindowsProtection();
  const remember=role==='client'&&payload?.remember===true;
  const result=await request('/login',{username:payload?.username,password:payload?.password,remember},null);
  if(!result.token)return result;
  if(role==='client')rememberedLogin.clear();
  await activateSession(result.token,result.user);
  const clean={user:result.user};
  pendingRemember=remember&&result.remembered===true;
  if(remember&&!pendingRemember)clean.loginWarning='자동 로그인을 사용하려면 교내 서버를 0.2.130 이상으로 업데이트해 주세요.';
  if(!liveUser.mustChange){if(pendingRemember)saveRememberedLogin(clean);connectStream();}
  return clean;
 });
 if(route==='/password')return authChange(async()=>{
  const result=await request(route,payload);
  if(!result.error){liveUser.mustChange=false;if(pendingRemember)saveRememberedLogin(result);connectStream();}
  return result;
 });
 if(route==='/bootstrap'&&!token){
  const failure=await authChange(restoreSession);
  if(failure)return failure;
  if(!token)return {error:'먼저 로그인해 주세요.',status:401};
 }
 if(['/bootstrap','/sync','/attachment','/message-source','/search'].includes(route)&&token&&privateClient)return privateClient.request(route,payload);
 return request(route,payload);
});
expose('dingdong:stage-attachment',async(event,action,value)=>{if(!token||!privateClient||loggingOut)throw Error('먼저 로그인해 주세요.');return privateClient.stageAttachment(action,value);});
expose('dingdong:save-attachment',async(event,value)=>{
 if(!token||!privateClient||loggingOut)throw Error('먼저 로그인해 주세요.');const client=privateClient;
 const name=await client.queueTask(()=>client.store.get('mail-history',value.mail)?.files.find(f=>f.index===value.index)?.name);if(!name)throw Error('첨부 파일을 찾을 수 없습니다.');
 const selected=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'첨부 파일 저장',defaultPath:path.basename(name)});if(selected.canceled)return {canceled:true};
 const result=await client.request('/attachment',value),temporary=selected.filePath+'.'+crypto.randomUUID()+'.part';
 try{if(result.file.localFile)await fs.promises.copyFile(client.files.path(result.file.localFile),temporary);else await fs.promises.writeFile(temporary,Buffer.from(result.file.data.split(',')[1],'base64'),{flag:'wx'});const handle=await fs.promises.open(temporary,'r+');try{await handle.sync();}finally{await handle.close();}await fs.promises.rename(temporary,selected.filePath);return {ok:true};}finally{await fs.promises.rm(temporary,{force:true});}
});
const archiveSelections=new WeakMap();
expose('dingdong:privacy',async(event,action,value={})=>{
 if(!token||!privateClient||loggingOut)throw new Error('먼저 로그인해 주세요.');
 const client=privateClient;await client.queue;
 if(action==='security')return client.security();
 if(action==='request-key-recovery')return client.requestKeyRecovery(value.acceptLoss);
 if(action==='retry-incoming')return client.retryIncoming();
 if(action==='verify')return client.queueTask(async()=>{
   const result=await client.verify(value.id,value.fingerprint);
   client.store.remove('state','relay-pull-after');return result;
 });
 if(action==='export'){
  const result=await dialog.showSaveDialog(BrowserWindow.fromWebContents(event.sender),{title:'PC 이전 파일 저장',defaultPath:'dingdong-my-history-'+new Date().toISOString().slice(0,10)+'.dingdong',filters:[{name:'띵동 PC 이전 파일',extensions:['dingdong']}]});if(result.canceled)return {canceled:true};
  if(client!==privateClient||!token||loggingOut)throw Error('다시 로그인해 주세요.');
  return client.exportArchiveFile(result.filePath);
 }
 if(action==='import'){
  let selection;
  if(value.selection){
   selection=archiveSelections.get(client);
   if(!selection||selection.id!==value.selection||selection.sender!==event.sender.id)throw Error('가져올 파일을 다시 선택해 주세요.');
  }else{
   archiveSelections.delete(client);
   const result=await dialog.showOpenDialog(BrowserWindow.fromWebContents(event.sender),{title:'기존 PC의 기록 가져오기',filters:[{name:'띵동 PC 이전 파일 (이전 버전 포함)',extensions:['dingdong','ieum']}],properties:['openFile']});
   if(result.canceled)return {canceled:true};
   selection={file:result.filePaths[0],id:crypto.randomUUID(),sender:event.sender.id};
  }
  if(client!==privateClient||!token||loggingOut)throw Error('다시 로그인해 주세요.');
  const imported=await client.importArchiveFile(selection.file,value.selection?value.password:undefined);
  if(imported.needsPassword){archiveSelections.set(client,selection);return {needsPassword:true,selection:selection.id};}
  if(archiveSelections.get(client)===selection)archiveSelections.delete(client);
  return imported;
 }
 throw new Error('지원하지 않는 보관 기능입니다.');
});
expose('dingdong:window-state',event=>({minimal:BrowserWindow.fromWebContents(event.sender)===mainWindow&&!!minimalState,memo:BrowserWindow.fromWebContents(event.sender)===mainWindow&&memoOpen,today:BrowserWindow.fromWebContents(event.sender)===mainWindow&&todayOpen,side:todaySide}));
expose('dingdong:window',(event,action)=>{const w=BrowserWindow.fromWebContents(event.sender);if(action==='minimal'||action==='restore-main'){if(w!==mainWindow)throw new Error('메신저 본창에서만 사용할 수 있습니다.');return setMinimalMain(action==='minimal');}if(action==='minimize')w.minimize();else if(action==='close')w.close();else if(action==='maximize')w.isMaximized()?w.unmaximize():w.maximize();else if(action==='show')w.show();});
function applyMainShape(){
 if(!mainWindow||mainWindow.isDestroyed()||role==='server')return;
 const b=mainWindow.getContentBounds();
 // Closed reserve is absent from the native hit/paint region, so it cannot block another app.
 const orgX=TODAY_WIDTH,orgWidth=b.width-2*TODAY_WIDTH-MEMO_TAB_WIDTH,tab={x:orgX+orgWidth+((memoOpen||memoAnimation!==null)&&todaySide==='left'?TODAY_WIDTH:0),y:29,width:MEMO_TAB_WIDTH,height:49};
 const calendar=todayOpen||todayAnimation!==null,memo=memoOpen||memoAnimation!==null,left=todaySide==='left'?calendar:memo,right=todaySide==='left'?memo:calendar;
 const region=minimalState?[{x:0,y:0,width:b.width,height:b.height}]:briefingBounds?[briefingBounds]:[{x:left?0:orgX,y:0,width:orgWidth+(left?TODAY_WIDTH:0)+(right?TODAY_WIDTH:0),height:b.height},...(todaySide==='left'?[tab]:[])];
 mainWindow.setShape(region);return region;
}
expose('dingdong:briefing-shape',(event,bounds)=>{
 if(BrowserWindow.fromWebContents(event.sender)!==mainWindow||role==='server')throw new Error('본창의 브리핑에서만 사용할 수 있습니다.');
 if(bounds==null)briefingBounds=null;
 else {
  if(!['x','y','width','height'].every(key=>typeof bounds[key]==='number'&&Number.isFinite(bounds[key]))||bounds.width<=0||bounds.height<=0)throw new Error('브리핑 창 크기가 올바르지 않습니다.');
  const b=mainWindow.getContentBounds(),x=Math.max(0,Math.min(b.width-1,Math.floor(bounds.x))),y=Math.max(0,Math.min(b.height-1,Math.floor(bounds.y)));
  briefingBounds={x,y,width:Math.max(1,Math.min(b.width-x,Math.ceil(bounds.width))),height:Math.max(1,Math.min(b.height-y,Math.ceil(bounds.height)))};
 }
 return {region:applyMainShape()};
});
function sourceTarget(target){
 if(target==null)return null;
 if(!target||!['mail','message','event','deadline','exchange'].includes(target.kind)||typeof target.id!=='string'||!target.id||target.id.length>100)throw new Error('연결된 항목이 올바르지 않습니다.');
 return {kind:target.kind,id:target.id};
}
function targetQuery(target){return target?'&source='+encodeURIComponent(target.kind)+'&item='+encodeURIComponent(target.id):'';}
expose('dingdong:resize',()=>({ok:true}));
function fitMainWings(){
 const b=mainWindow.getBounds(),org={x:b.x+TODAY_WIDTH,y:b.y,width:b.width-2*TODAY_WIDTH-MEMO_TAB_WIDTH,height:b.height},area=screen.getDisplayMatching(org).workArea;
 const left=todaySide==='left'?todayOpen:memoOpen,right=todaySide==='left'?memoOpen:todayOpen;
 const visibleLeft=left?0:TODAY_WIDTH,visibleRight=b.width-(memoOpen&&todaySide==='left'?0:MEMO_TAB_WIDTH)-(right?0:TODAY_WIDTH);
 const x=Math.max(area.x-visibleLeft,Math.min(b.x,area.x+area.width-visibleRight));if(x!==b.x)mainWindow.setBounds({...b,x},false);
}
expose('dingdong:today',(event,open,position)=>{
 if(BrowserWindow.fromWebContents(event.sender)!==mainWindow||role==='server')throw new Error('본창에서만 오늘 일정을 열 수 있습니다.');
 if(minimalState)return {ok:true};
 const wasOpen=todayOpen;clearTimeout(todayAnimation);todayAnimation=null;
 todaySide=position==='right'?'right':position==='left'?'left':todaySide;todayOpen=!!open;
 if(!todayOpen&&wasOpen)todayAnimation=setTimeout(()=>{todayAnimation=null;applyMainShape();},WING_DURATION+40);
 if(todayOpen)fitMainWings();applyMainShape();
 emit({kind:'today-panel',open:todayOpen,side:todaySide});return {ok:true};
});
expose('dingdong:memo',(event,open)=>{
 if(BrowserWindow.fromWebContents(event.sender)!==mainWindow||role==='server')throw new Error('메신저 본창에서만 메모장을 열 수 있습니다.');
 if(minimalState)return {ok:true};
 const wasOpen=memoOpen;clearTimeout(memoAnimation);memoAnimation=null;memoOpen=!!open;
 if(!memoOpen&&wasOpen)memoAnimation=setTimeout(()=>{memoAnimation=null;applyMainShape();},WING_DURATION+40);
 if(memoOpen)fitMainWings();applyMainShape();
 emit({kind:'memo-panel',open:memoOpen});return {ok:true};
});
expose('dingdong:workspace',(event,page,value)=>{
 if(!['inbox','calendar','announcements','links','staff','search','requests'].includes(page))throw new Error('지원하지 않는 작업 창입니다.');
 const target=sourceTarget(value);
 if(page==='staff'&&target)throw new Error('교직원 정보 창에서는 항목 이동을 지원하지 않습니다.');
 if(target&&(target.kind==='message'||(target.kind==='mail'?page!=='inbox':page!=='calendar')))throw new Error('이 항목을 열 수 없는 작업 창입니다.');
 const previous=[...windows].find(w=>!w.isDestroyed()&&w.dingdongPage===page);
 if(previous){previous.show();previous.focus();if(target)previous.webContents.send('dingdong:update',{kind:'briefing-target',target});return {ok:true};}
 if(page==='staff'){const area=screen.getDisplayMatching(BrowserWindow.fromWebContents(event.sender).getBounds()).workArea;const width=Math.min(1400,area.width),height=Math.min(860,area.height);const w=createWindow(APP_ORIGIN+'/index.html?workspace=staff',{width,height,minWidth:Math.min(760,width),minHeight:Math.min(600,height),x:area.x+Math.round((area.width-width)/2),y:area.y+Math.round((area.height-height)/2)});w.dingdongPage=page;return {ok:true};}
 const w=createWindow(APP_ORIGIN+'/index.html?workspace='+page+targetQuery(target),{width:page==='calendar'?1180:1080,height:800,minWidth:page==='inbox'?1000:700});w.dingdongPage=page;return {ok:true};
});
expose('dingdong:compose',(event,draft={})=>{if(!draft||typeof draft!=='object'||JSON.stringify(draft).length>4*1024*1024)throw new Error('작성 내용이 너무 큽니다.');const w=createWindow(APP_ORIGIN+'/index.html?compose=1',{width:720,height:820,minWidth:620});w.dingdongComposeDraft=draft;return {ok:true};});
expose('dingdong:compose-draft',event=>BrowserWindow.fromWebContents(event.sender).dingdongComposeDraft||BrowserWindow.fromWebContents(event.sender).dingdongEventDraft||{});
expose('dingdong:homeroom-memo',(event,target)=>{
 if(role==='server'||!mainWindow||mainWindow.isDestroyed())throw new Error('메신저 본창을 먼저 열어 주세요.');
 if(!target||typeof target.id!=='string'||!/^[-\w]{1,100}$/.test(target.id)||typeof target.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(target.date))throw new Error('메모 연결이 올바르지 않습니다.');
 if(minimalState)setMinimalMain(false);mainWindow.show();mainWindow.focus();mainWindow.webContents.send('dingdong:update',{kind:'homeroom-memo',target:{id:target.id,date:target.date}});return {ok:true};
});
expose('dingdong:memo-schedule',(event,note)=>{
 if(BrowserWindow.fromWebContents(event.sender)!==mainWindow||role==='server')throw new Error('메신저 본창의 메모에서만 등록할 수 있습니다.');
 if(!note||typeof note.id!=='string'||!/^[-\w]{1,100}$/.test(note.id)||typeof note.text!=='string'||note.text.length>4000)throw new Error('메모 내용이 올바르지 않습니다.');
 const draft={memoId:note.id,text:note.text},previous=[...windows].find(w=>!w.isDestroyed()&&w.dingdongMemoId===note.id);
 if(previous){previous.show();previous.focus();previous.webContents.send('dingdong:update',{kind:'memo-schedule',draft});return {ok:true};}
 const w=createWindow(APP_ORIGIN+'/index.html?workspace=calendar&eventDraft=1',{width:1180,height:800,minWidth:700});w.dingdongPage='calendar';w.dingdongMemoId=note.id;w.dingdongEventDraft=draft;return {ok:true};
});
expose('dingdong:compose-sent',(event,linked)=>{const w=BrowserWindow.fromWebContents(event.sender);if(!w.dingdongComposeDraft)throw new Error('작성 창에서만 완료할 수 있습니다.');emit({kind:'changed'});w.close();bringMain();if(linked&&typeof linked.title==='string'&&typeof linked.mail==='string'){const calendar=createWindow(APP_ORIGIN+'/index.html?workspace=calendar&eventDraft=1',{width:1180,height:800,minWidth:700});calendar.dingdongEventDraft={title:linked.title.slice(0,150),mail:linked.mail,date:linked.date};}return {ok:true};});
expose('dingdong:chat',(event,room,value)=>{
 if(typeof room!=='string'||!/^[-A-Za-z0-9]{1,100}$/.test(room))throw new Error('대화방 식별자가 올바르지 않습니다.');
 const target=sourceTarget(value);if(target&&target.kind!=='message')throw new Error('대화 메시지만 열 수 있습니다.');
 const old=[...windows].find(w=>!w.isDestroyed()&&w.dingdongRoom===room);
 if(old){old.show();old.focus();if(target)old.webContents.send('dingdong:update',{kind:'briefing-target',target});return {ok:true};}
 const w=createWindow(APP_ORIGIN+'/index.html?chat='+encodeURIComponent(room)+targetQuery(target),{width:420,height:680,minWidth:350});w.dingdongRoom=room;return {ok:true};
});
expose('dingdong:admin',()=>{if(role!=='server')throw new Error('서버 관리 앱에서 사용할 수 있습니다.');const w=createWindow(APP_ORIGIN+'/desktop/admin.html',{width:1000,height:780,minWidth:750});return {ok:true};});
expose('dingdong:server-status',()=>{if(role!=='server')throw new Error('서버 관리 앱에서 사용할 수 있습니다.');const cfg=readJSON(configPath());return {running:!!localServer,configured:!!cfg,url:cfg?.url||'',schoolName:cfg?.schoolName||'',dataDir:serverDataDir(),fingerprint:localServer?.connection.fingerprint||'',stats:localServer?.stats()||null,addresses:Object.values(os.networkInterfaces()).flat().filter(i=>i&&i.family==='IPv4'&&!i.internal).map(i=>i.address),autoStart:branding.loginEnabled(app,role,process.execPath)};});
expose('dingdong:start-server',async(event,config)=>{if(role!=='server')throw new Error('서버 관리 앱에서 사용할 수 있습니다.');const admin=readJSON(configPath())?undefined:{username:config.username,password:config.password,name:config.name};return startLocal(config,admin);});
expose('dingdong:export',async()=>{if(role!=='server'||!localServer)throw new Error('서버를 먼저 실행해 주세요.');const result=await dialog.showSaveDialog(mainWindow,{title:'교직원에게 전달할 서버 연결 파일',defaultPath:'dingdong-server.json',filters:[{name:'띵동 연결 파일',extensions:['json']}]});if(result.canceled)return null;fs.writeFileSync(result.filePath,JSON.stringify(localServer.connection,null,2));return {ok:true};});
expose('dingdong:backup',async()=>{if(role!=='server'||!localServer)throw new Error('서버를 먼저 실행해 주세요.');const result=await dialog.showSaveDialog(mainWindow,{title:'설정·계정 백업 (메시지 본문·첨부 제외)',defaultPath:'dingdong-backup-'+new Date().toISOString().slice(0,10)+'.sqlite',filters:[{name:'띵동 데이터베이스',extensions:['sqlite']}]});if(result.canceled)return null;localServer.backup(result.filePath);return {ok:true};});
expose('dingdong:auto-start',(event,enabled)=>{
 if(role!=='server')throw Error('서버 관리 앱에서 설정해 주세요.');
 app.setLoginItemSettings(branding.loginSettings(enabled,role,process.execPath));
 const autoStart=branding.loginEnabled(app,role,process.execPath);
 return autoStart===enabled?{ok:true,autoStart}:{error:'Windows 시작 프로그램 설정을 확인해 주세요.',autoStart};
});
expose('dingdong:notify',(event,value)=>{const title=String(value?.title||'띵동').slice(0,100),body=String(value?.body||'새 소식이 도착했습니다.').slice(0,250),target=sourceTarget(value?.target);if(Notification.isSupported()){const notice=new Notification({title,body,silent:false});if(target)notice.on('click',()=>{const previous=[...windows].find(w=>!w.isDestroyed()&&w.dingdongPage==='calendar');if(previous){previous.show();previous.focus();previous.webContents.send('dingdong:update',{kind:'briefing-target',target});}else{const w=createWindow(APP_ORIGIN+'/index.html?workspace=calendar'+targetQuery(target),{width:1180,height:800,minWidth:700});w.dingdongPage='calendar';}});notice.show();}});
app.on('before-quit',e=>{if(localServer){e.preventDefault();const running=localServer;localServer=null;quitting=true;stopStream();running.close().finally(()=>app.quit());}else{quitting=true;stopStream();}});
app.on('window-all-closed',()=>{});
