'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {registerClientStartup,registerClientDesktop}=require('../desktop/client-startup.cjs');

function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dingdong-startup-test-'));
  t.after(()=>{assert.equal(path.dirname(dir),os.tmpdir());assert.ok(path.basename(dir).startsWith('dingdong-startup-test-'));fs.rmSync(dir,{recursive:true,force:true});});
  const startup=path.join(dir,'Startup'),desktop=path.join(dir,'교직원 폴더','Desktop'),profile=path.join(dir,'profile'),writes=[];
  fs.mkdirSync(startup);fs.mkdirSync(profile);
  const shell={
    readShortcutLink:file=>JSON.parse(fs.readFileSync(file,'utf8')),
    writeShortcutLink(file,operation,details){
      if(operation==='update')assert.ok(fs.existsSync(file));
      const value=operation==='update'?{...shell.readShortcutLink(file),...details}:details;
      fs.writeFileSync(file,JSON.stringify(value),{flag:operation==='create'?'wx':'w'});
      writes.push({file,operation,details});return true;
    }
  };
  const exe=folder=>path.join(dir,folder,'Dingdong.exe');
  const install=executable=>registerClientStartup(shell,profile,executable,()=>startup);
  const installDesktop=executable=>registerClientDesktop(shell,profile,executable,()=>desktop);
  return {startup,desktop,profile,shell,exe,install,installDesktop,writes};
}

test('first run creates one client startup link, keeps its name on move and respects removal',async t=>{
  const {exe,install,writes,shell}=fixture(t),first=exe('교무실 설치'),moved=exe('업데이트');
  await install(first);await install(first);
  assert.equal(writes.length,1);
  const file=writes[0].file;assert.equal(path.basename(file),'띵동 메신저.lnk');
  assert.deepEqual(shell.readShortcutLink(file),{target:first,cwd:path.dirname(first),args:'--dingdong-client'});
  await install(moved);assert.equal(writes[1].operation,'update');assert.equal(writes[1].file,file);
  assert.equal(shell.readShortcutLink(file).target,moved);
  fs.unlinkSync(file);await install(moved);await install(exe('다음 버전'));
  assert.equal(writes.length,2);assert.ok(!fs.existsSync(file));
});

test('adopts a manual shortcut in place and leaves a co-located server startup link alone',async t=>{
  const {startup,exe,install,writes,shell}=fixture(t),client=exe('설치'),pkg=path.join(path.dirname(client),'resources','app');
  fs.mkdirSync(pkg,{recursive:true});fs.writeFileSync(path.join(pkg,'package.json'),JSON.stringify({name:'dingdong-school-messenger',dingdongRole:'client'}));
  const manual=path.join(startup,'교무실 메신저.lnk'),server=path.join(startup,'서버.lnk');
  fs.writeFileSync(manual,JSON.stringify({target:client,args:''}));fs.writeFileSync(server,JSON.stringify({target:client,args:'--dingdong-server'}));
  await install(client);assert.equal(writes.length,1);assert.equal(writes[0].file,manual);assert.equal(writes[0].operation,'update');
  fs.unlinkSync(path.join(pkg,'package.json'));await install(exe('새 폴더'));assert.equal(writes[1].file,manual);
  assert.equal(shell.readShortcutLink(server).args,'--dingdong-server');
});

test('does not overwrite unrelated shortcuts or mark a failed registration as complete',async t=>{
  const {startup,exe,install,shell,writes}=fixture(t),client=exe('학교'),other=path.join(startup,'띵동 메신저.lnk');
  const original=JSON.stringify({target:path.join(startup,'other.exe'),args:''});fs.writeFileSync(other,original);
  const write=shell.writeShortcutLink;shell.writeShortcutLink=()=>false;
  await assert.rejects(install(client),/바로 가기/);
  shell.writeShortcutLink=write;await install(client);
  assert.equal(fs.readFileSync(other,'utf8'),original);assert.equal(writes.length,1);
  assert.equal(path.basename(writes[0].file),'띵동 메신저 (2).lnk');
});

test('upgrade adds the desktop icon once, independently of a removed startup link',async t=>{
  const {exe,install,installDesktop,desktop,shell,writes}=fixture(t);
  const first=exe('원래 위치'),moved=exe('새 위치'),desktopFile=path.join(desktop,'띵동 메신저.lnk');
  await install(first);const startupFile=writes[0].file;fs.unlinkSync(startupFile);
  await installDesktop(first);await installDesktop(first);
  assert.equal(writes.length,2);
  for(const program of [first,moved]){
    await install(program);await installDesktop(program);
    assert.ok(!fs.existsSync(startupFile));
    assert.deepEqual(shell.readShortcutLink(desktopFile),{target:program,cwd:path.dirname(program),args:'--dingdong-client',icon:path.join(path.dirname(program),'resources','app','assets','dingdong-icon.ico'),iconIndex:0});
  }
  assert.equal(writes.length,3);
  fs.unlinkSync(desktopFile);await installDesktop(moved);await installDesktop(exe('다음 버전'));
  assert.ok(!fs.existsSync(desktopFile));assert.equal(writes.length,3);
});

test('desktop registration keeps a manual client link name and custom icon',async t=>{
  const {exe,desktop,installDesktop,shell,writes}=fixture(t),first=exe('교무실 설치');
  fs.mkdirSync(desktop,{recursive:true});
  const appDir=path.join(path.dirname(first),'resources','app');
  fs.mkdirSync(appDir,{recursive:true});fs.writeFileSync(path.join(appDir,'package.json'),JSON.stringify({name:'dingdong-school-messenger',dingdongRole:'client'}));
  const manual=path.join(desktop,'내 메신저.lnk'),custom=path.join(desktop,'교무실.ico');
  fs.writeFileSync(manual,JSON.stringify({target:first,args:'',icon:custom,iconIndex:0}));
  await installDesktop(first);await installDesktop(exe('업데이트'));
  assert.deepEqual(fs.readdirSync(desktop),['내 메신저.lnk']);
  assert.equal(shell.readShortcutLink(manual).icon,custom);
  assert.deepEqual(writes.map(w=>w.operation),['update','update']);
});

test('a desktop failure can retry without overwriting a same-named file or disturbing startup',async t=>{
  const {exe,startup,desktop,install,installDesktop,shell}=fixture(t),client=exe('학교');
  fs.mkdirSync(desktop,{recursive:true});const other=path.join(desktop,'띵동 메신저.lnk');
  fs.writeFileSync(other,'other file');
  const write=shell.writeShortcutLink;
  shell.writeShortcutLink=(file,operation,details)=>path.dirname(file)===desktop?false:write(file,operation,details);
  const [startupResult,result]=await Promise.allSettled([install(client),installDesktop(client)]);
  assert.equal(startupResult.status,'fulfilled');assert.equal(result.status,'rejected');
  shell.writeShortcutLink=write;await installDesktop(client);
  assert.equal(fs.readFileSync(other,'utf8'),'other file');
  const desktopFile=path.join(desktop,'띵동 메신저 (2).lnk');
  assert.equal(shell.readShortcutLink(desktopFile).target,client);
  fs.unlinkSync(desktopFile);await installDesktop(client);await install(client);
  assert.ok(!fs.existsSync(desktopFile));
  assert.equal(shell.readShortcutLink(path.join(startup,'띵동 메신저.lnk')).target,client);
});
