'use strict';
// Compatibility identifiers are persisted in existing installations and must
// remain readable. New product names, IPC names and exports use Dingdong.
const fs=require('node:fs'),path=require('node:path');
const rendererScheme='ieum',rendererOrigin=rendererScheme+'://app';
const legacyProfiles={demo:'IeumDemo',client:'IeumClient',server:'IeumServer'};
function roleFor(argv,pkg={},env={},packaged=true){
  for(const role of ['client','server','demo'])if(argv.includes('--dingdong-'+role)||argv.includes('--ieum-'+role))return role;
  return packaged?(pkg.dingdongRole||pkg.ieumRole||'client'):(env.DINGDONG_ROLE||env.IEUM_ROLE||'client');
}
function profileDirectory(appData,role){
  const old=path.join(appData,legacyProfiles[role]);
  return fs.existsSync(old)?old:path.join(appData,'Dingdong'+role[0].toUpperCase()+role.slice(1));
}
function serverDirectory(home){const old=path.join(home,'.ieum-server');return fs.existsSync(old)?old:path.join(home,'.dingdong-server');}
function databaseFile(dir){const old=path.join(dir,'ieum.sqlite');return fs.existsSync(old)?old:path.join(dir,'dingdong.sqlite');}
function loginTarget(role,executable){return {path:executable,args:['--dingdong-'+role]};}
function loginSettings(enabled,role,executable){return {openAtLogin:!!enabled,...loginTarget(role,executable)};}
function loginEnabled(app,role,executable){
  const target=loginTarget(role,executable),settings=app.getLoginItemSettings(target);
  if(!settings.openAtLogin||!Array.isArray(settings.launchItems))return settings.openAtLogin;
  return settings.launchItems.some(item=>item.enabled&&typeof item.path==='string'&&Array.isArray(item.args)&&path.win32.normalize(item.path).toLowerCase()===path.win32.normalize(target.path).toLowerCase()&&
    item.args.length===1&&item.args[0]===target.args[0]);
}
module.exports={rendererScheme,rendererOrigin,roleFor,profileDirectory,serverDirectory,databaseFile,loginSettings,loginEnabled};
