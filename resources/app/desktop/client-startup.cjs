'use strict';
const fs=require('node:fs/promises'),path=require('node:path');
const execFile=require('node:util').promisify(require('node:child_process').execFile);
const samePath=(a,b)=>path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();

async function windowsStartupDirectory(){
  // A school's Windows policy can redirect the current user's Startup folder.
  const powershell=path.join(process.env.SystemRoot,'System32','WindowsPowerShell','v1.0','powershell.exe');
  const command='[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; [Environment]::GetFolderPath([Environment+SpecialFolder]::Startup,[Environment+SpecialFolderOption]::Create)';
  const {stdout}=await execFile(powershell,['-NoProfile','-NonInteractive','-Command',command],{windowsHide:true,timeout:10000,encoding:'utf8'});
  const folder=stdout.trim();
  if(!path.isAbsolute(folder))throw Error('Windows 시작프로그램 폴더를 찾을 수 없습니다.');
  return folder;
}

async function isClientLink(link,executable,previous){
  if(!link.target)return false;
  const args=(link.args||'').trim(),name=path.win32.basename(link.target).toLowerCase();
  if(name!=='dingdong.exe'&&name!=='start-client.cmd')return false;
  if(args&&args!=='--dingdong-client'&&args!=='--ieum-client')return false;
  const known=[executable,previous].some(target=>target&&samePath(path.win32.dirname(target),path.win32.dirname(link.target)));
  if(previous&&!known)return false;
  if(known&&(args||name==='start-client.cmd'))return true;
  // A bare Dingdong.exe can start either role. Check its package before adopting a manual shortcut.
  try{
    const pkg=JSON.parse(await fs.readFile(path.join(path.dirname(link.target),'resources','app','package.json'),'utf8'));
    return pkg.name==='dingdong-school-messenger'&&(pkg.dingdongRole==='client'||!!args||name==='start-client.cmd');
  }catch{return false;}
}

async function registerClientShortcut(shell,marker,executable,getFolder,desktopIcon){
  let previous;
  try{previous=await fs.readFile(marker,'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}
  if(previous&&samePath(previous,executable))return;

  const folder=await getFolder();
  await fs.mkdir(folder,{recursive:true});
  const entries=await fs.readdir(folder,{withFileTypes:true});
  let existing;
  for(const entry of entries){
    if(!entry.isFile()||!entry.name.toLowerCase().endsWith('.lnk'))continue;
    const file=path.join(folder,entry.name);
    let link;
    try{link=shell.readShortcutLink(file);}catch{continue;}
    if(await isClientLink(link,executable,previous)){existing={file,link};break;}
  }
  const details={target:executable,args:'--dingdong-client',cwd:path.dirname(executable)};
  if(existing){
    // Move our desktop icon with the executable, preserving a manually chosen icon.
    if(desktopIcon&&previous&&existing.link.icon&&samePath(existing.link.icon,clientIcon(previous))){
      details.icon=desktopIcon;details.iconIndex=0;
    }
    const needsUpdate=!samePath(existing.link.target,executable)||existing.link.args!==details.args;
    if(needsUpdate&&!shell.writeShortcutLink(existing.file,'update',details))
      throw Error('기존 띵동 바로 가기를 갱신할 수 없습니다.');
  }else if(!previous){
    const names=new Set(entries.map(entry=>entry.name.toLowerCase()));
    let name='띵동 메신저.lnk';
    for(let n=2;names.has(name);n++)name='띵동 메신저 ('+n+').lnk';
    if(desktopIcon){details.icon=desktopIcon;details.iconIndex=0;}
    if(!shell.writeShortcutLink(path.join(folder,name),'create',details))
      throw Error('띵동 바로 가기를 만들 수 없습니다.');
  }
  // If the user removed the shortcut, moving the app must not recreate it.
  await fs.writeFile(marker+'.tmp',executable,'utf8');
  await fs.rename(marker+'.tmp',marker);
}
function clientIcon(executable){return path.join(path.dirname(executable),'resources','app','assets','dingdong-icon.ico');}
function registerClientStartup(shell,profile,executable,getFolder=windowsStartupDirectory){
  return registerClientShortcut(shell,path.join(profile,'startup-client-path.txt'),executable,getFolder);
}
function registerClientDesktop(shell,profile,executable,getFolder){
  return registerClientShortcut(shell,path.join(profile,'desktop-client-path.txt'),executable,getFolder,clientIcon(executable));
}
module.exports={registerClientStartup,registerClientDesktop};
