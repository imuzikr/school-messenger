(async()=>{
'use strict';const api=window.dingdongDesktop,$=s=>document.querySelector(s);const feedback=message=>$('#feedback').textContent=message||'';
document.querySelectorAll('[data-window]').forEach(b=>b.onclick=()=>api.windowAction(b.dataset.window));
let status;
function attachmentSpaceText(space){
  if(!space)return '';
  if(space.available===null)return '디스크 여유 공간을 확인할 수 없어 새 첨부 업로드를 제한하고 있습니다.';
  const format=bytes=>bytes>=1024**3?(bytes/1024**3).toFixed(1)+' GB':Math.floor(bytes/1024**2)+' MB';
  const label=space.available>0?'새 첨부에 쓸 수 있는 공간 '+format(space.available):'저장 공간 부족으로 새 첨부 업로드를 제한하고 있습니다.';
  return label+' · 전송 중 예약 '+format(space.reserved)+' · 메시지용 여유 공간 '+format(space.reserve);
}
async function refresh(){status=await api.serverStatus();if(status.error){feedback(status.error);return;}$('#setup').hidden=status.configured;$('#running').hidden=!status.configured;$('#server-url').value||= 'https://'+(status.addresses[0]||'localhost')+':8443';if(status.configured){$('#running-school').textContent=status.schoolName;$('#running-address').textContent=status.url;$('#running-state').textContent=status.running?'실행 중':'중지됨';$('#running-state').classList.toggle('off',!status.running);$('#user-count').textContent=status.stats?.users||0;$('#online-count').textContent=status.stats?.online||0;$('#message-count').textContent=status.stats?.messages||0;$('#attachment-space').textContent=attachmentSpaceText(status.stats?.attachmentSpace);$('#data-path').textContent='저장 위치: '+status.dataDir;$('#fingerprint').textContent='인증서 SHA-256: '+status.fingerprint;$('#auto-start').checked=status.autoStart;if(!status.running)feedback('서버를 실행하지 못했습니다. 서버 PC 주소·포트와 실행 로그를 확인하고 앱을 다시 실행하세요.');}}
$('#setup-form').onsubmit=async e=>{e.preventDefault();feedback('인증서와 데이터베이스를 준비하고 있습니다…');const button=e.target.querySelector('button');button.disabled=true;let url;try{url=new URL($('#server-url').value);if(url.protocol!=='https:')throw new Error('HTTPS 주소를 입력해 주세요.');}catch{feedback('https://서버PC주소:8443 형식으로 입력해 주세요.');button.disabled=false;return;}const result=await api.startServer({schoolName:$('#school-name').value,url:url.origin,port:Number(url.port)||443,username:$('#admin-username').value,name:$('#admin-name').value,password:$('#admin-password').value});if(result.error)feedback(result.error);else{$('#admin-password').value='';feedback('서버가 준비되었습니다. 교직원 계정을 만들고 연결 파일을 전달하세요.');await refresh();}button.disabled=false;};
$('#open-admin').onclick=()=>api.openAdmin();
$('#export-connection').onclick=async()=>{const result=await api.exportConnection();if(result?.error)feedback(result.error);else if(result?.ok)feedback('서버 연결 파일을 저장했습니다. 교직원 PC로 전달해 주세요.');};
$('#backup').onclick=async()=>{const result=await api.backupServer();if(result?.error)feedback(result.error);else if(result?.ok)feedback('설정·계정 백업을 저장했습니다. 메시지 본문과 첨부 파일은 포함하지 않습니다. 개인 기록은 각 PC에서 보관해 주세요.');};
$('#auto-start').onchange=async e=>{
 const input=e.target;input.disabled=true;
 try{const result=await api.autoStart(input.checked);if(typeof result.autoStart==='boolean')input.checked=result.autoStart;await refresh();feedback(result.error||'자동 실행 설정을 반영했습니다.');}
 catch{await refresh();feedback('Windows 자동 실행 설정을 확인할 수 없습니다.');}finally{input.disabled=false;}
};
api.subscribe(e=>{if(['server-stats','server-started','server-start-error'].includes(e.kind))refresh();});await refresh();setInterval(refresh,5000);
})();
