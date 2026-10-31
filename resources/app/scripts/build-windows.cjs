'use strict';
// Build a portable Windows package from the local Electron runtime.
// No downloads, registry changes, signing, installation or deployment.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const appDir=path.resolve(__dirname,'..'),root=path.resolve(appDir,'../..'),pkg=require('../package.json');
const role=process.argv[2]||'demo';if(!['demo','client','server'].includes(role))throw new Error('Role must be demo, client or server.');
const runtime=['Dingdong.exe','chrome_100_percent.pak','chrome_200_percent.pak','d3dcompiler_47.dll','dxcompiler.dll','dxil.dll','ffmpeg.dll','icudtl.dat','libEGL.dll','libGLESv2.dll','resources.pak','snapshot_blob.bin','v8_context_snapshot.bin','vk_swiftshader.dll','vk_swiftshader_icd.json','vulkan-1.dll','LICENSE','LICENSES.chromium.html','version','locales'].filter(name=>!['libEGL.dll','libGLESv2.dll'].includes(name)||fs.existsSync(path.join(root,name)));
for(const name of runtime)if(!fs.existsSync(path.join(root,name)))throw new Error('Missing Electron runtime file: '+name);
for(const name of ['desktop/main.cjs','desktop/preload.cjs','index.html','node_modules/jose/package.json'])if(!fs.existsSync(path.join(appDir,name)))throw new Error('Missing application file: '+name);
if(process.argv.includes('--check')){console.log(JSON.stringify({ok:true,role,version:pkg.version,runtimeFiles:runtime.length}));process.exit(0);}
const dist=path.join(root,'dist'),name='Dingdong-'+role+'-'+pkg.version+'-'+Date.now(),destination=path.join(dist,name);
if(path.dirname(destination)!==dist||fs.existsSync(destination))throw new Error('Output directory must be a new directory inside dist.');
fs.mkdirSync(destination,{recursive:true});
for(const name of runtime)fs.cpSync(path.join(root,name),path.join(destination,name),{recursive:true,errorOnExist:true,force:false});
const targetApp=path.join(destination,'resources','app');fs.mkdirSync(targetApp,{recursive:true});
for(const entry of fs.readdirSync(appDir,{withFileTypes:true})){
 if(['tests','benchmarks','scripts'].includes(entry.name))continue;
 fs.cpSync(path.join(appDir,entry.name),path.join(targetApp,entry.name),{recursive:true,errorOnExist:true,force:false});
}
const shipped={...pkg,dingdongRole:role};delete shipped.scripts;
fs.writeFileSync(path.join(targetApp,'package.json'),JSON.stringify(shipped,null,2)+'\n');
for(const file of ['START-CLIENT.cmd','START-SERVER.cmd','START-DEMO.cmd','READ-ME.txt'])fs.copyFileSync(path.join(root,file),path.join(destination,file));
fs.writeFileSync(path.join(destination,'BUILD-INFO.json'),JSON.stringify({product:'띵동',role,version:pkg.version,createdAt:new Date().toISOString(),signed:false},null,2));
// Environment values avoid embedding paths as shell code. Compress only this
// freshly created package, never the workspace or any personal profile.
const archive=destination+'.zip';
const zipped=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::CreateFromDirectory($env:DINGDONG_BUILD_SOURCE,$env:DINGDONG_BUILD_ARCHIVE,[System.IO.Compression.CompressionLevel]::Fastest,$true)"],{env:{...process.env,DINGDONG_BUILD_SOURCE:destination,DINGDONG_BUILD_ARCHIVE:archive},windowsHide:true,stdio:'inherit'});
if(zipped.error)throw zipped.error;if(zipped.status!==0)throw new Error('ZIP packaging failed; the portable directory is preserved at '+destination);
console.log(JSON.stringify({ok:true,role,version:pkg.version,directory:destination,archive}));
