'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const archive=require('../../privacy/archive.cjs');

module.exports=async function verifyArchiveUI({evaluate,inspector,run,profile}){
  const target=path.join(run,'ui-export.dingdong'),copy=path.join(run,'ui-copy.dingdong');
  // Substitute only the OS picker in this test-owned Electron instance. The
  // renderer, IPC, account checks, archive reader/writer and safeStorage run normally.
  const socket=new WebSocket(inspector);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  try{
    const installed=new Promise((resolve,reject)=>{socket.onmessage=event=>{
      const m=JSON.parse(event.data);if(m.id!==1)return;
      if(m.result?.result?.value===true)resolve();else reject(Error(JSON.stringify(m)));
    };});
    socket.send(JSON.stringify({id:1,method:'Runtime.evaluate',params:{expression:`(()=>{
      const {app,dialog}=process.getBuiltinModule('module').createRequire(process.execPath)('electron');
      if(app.getPath('userData')!==${JSON.stringify(profile)})throw Error('not the test profile');
      dialog.showSaveDialog=async(_w,o)=>{if(o.title!=='PC 이전 파일 저장')throw Error('unexpected picker');return {filePath:${JSON.stringify(target)}};};
      dialog.showOpenDialog=async(_w,o)=>{if(o.title!=='기존 PC의 기록 가져오기')throw Error('unexpected picker');return {filePaths:[${JSON.stringify(copy)}]};};
      return true;
    })()`}}));await installed;
  }finally{socket.close();}

  const wait=async expression=>{
    for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}
    throw Error('PC transfer UI timeout: '+expression+' / '+await evaluate("document.querySelector('#privacy-archive-error')?.innerText"));
  };
  const click=async action=>{const q=JSON.stringify('[data-action="'+action+'"]');await wait('!!document.querySelector('+q+')');await evaluate('document.querySelector('+q+').click();true');};
  const security=async()=>{await click('settings');await click('privacy-settings');await wait("!!document.querySelector('#privacy-person')");};
  const submit="document.querySelector('#privacy-archive-form').requestSubmit();true";
  await click('privacy-export');
  assert.equal(await evaluate("document.querySelector('#privacy-archive-form input[type=password]')===null"),true);
  await evaluate(submit);await wait("!document.querySelector('#privacy-archive-form')");
  await fs.copyFile(target,copy);
  await security();await click('privacy-import');
  assert.equal(await evaluate("document.querySelector('#privacy-archive-form input[type=password]')===null"),true);
  await evaluate(submit);await wait("!document.querySelector('#privacy-archive-form')");

  const bytes=await fs.readFile(target),header=bytes.indexOf(10)+1,length=bytes.readUInt32BE(header);
  const manifest=JSON.parse(bytes.subarray(header+4,header+4+length)).manifest;
  const password='Fixture-legacy-archive-123';
  await fs.writeFile(copy,await archive.seal(manifest,password));
  await security();await click('privacy-import');await evaluate(submit);
  await wait("!!document.querySelector('#privacy-password')");
  await evaluate("document.querySelector('#privacy-password').value='incorrect-password';"+submit);
  await wait("document.querySelector('#privacy-archive-error')?.innerText.includes('비밀번호')");
  await evaluate("document.querySelector('#privacy-password').value="+JSON.stringify(password)+";"+submit);
  await wait("!document.querySelector('#privacy-archive-form')");
  await security();
};
