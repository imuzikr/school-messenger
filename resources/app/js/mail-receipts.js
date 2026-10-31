/* Receipt events are notifications, never automatic reply messages. */
(function(root){
 'use strict';
 const key=(receipt,owner)=>JSON.stringify([owner,receipt.mail,receipt.recipient,receipt.readAt||0]);
 function changes(before,after){
  const previous=new Map((before||[]).filter(m=>m.from==='me').map(m=>[m.id,m])),result=[],seen=new Set();
  for(const mail of after||[]){const old=previous.get(mail.id);if(mail.from!=='me'||!old)continue;const statuses=new Map((old.to||[]).map((id,i)=>[id,old.receipts?.[i]]));
   for(const [i,recipient] of (mail.to||[]).entries()){const id=JSON.stringify([mail.id,recipient]);if(recipient==='me'||seen.has(id)||mail.receipts?.[i]!=='read'||!['unread','scheduled'].includes(statuses.get(recipient)))continue;seen.add(id);result.push({mail:mail.id,recipient,subject:mail.title||'기타'});}
  }return result;
 }
 function message(receipt){const name=String(receipt.name||'수신자'),suffix=name.endsWith('님')?'이':'님이';return {title:'메시지 읽음 확인',body:`${name}${suffix} 메시지를 읽었습니다. · ${receipt.subject||'기타'}`};}
 const work=typeof module==='object'&&module.exports?require('./work-tools.js'):root.DingdongWorkTools;
 function dispatch(mail){
  if(mail.sendError)return {label:'발송 실패',detail:mail.sendError.message,tone:'error'};
  if(mail.restoreReview)return {label:'발송 여부 확인 필요',detail:mail.restoreReview.message,tone:'review'};
  if(mail.pendingDelivery)return {label:'발송 대기',detail:'내 PC에 보관 중이며 아직 서버의 발송 확인을 받지 못했습니다.',tone:'pending'};
  return null;
 }
 function recipient(mail,id,{native=true,now=Date.now(),self}={}){
  const receipt=work.deliveryReceipt(mail,id,now),read=receipt==='read';
  if((id==='me'||id===self)&&receipt!=='recalled')return {receipt,stored:true,read,storageLabel:'내 PC 보관',readLabel:'해당 없음'};
  const stored=read||!!mail.storedReceipts?.[id];
  let storageLabel;
  if(receipt==='recalled')storageLabel='회수됨';
  else if(stored)storageLabel='상대 PC 저장 완료';
  else storageLabel=dispatch(mail)?.label||(receipt==='scheduled'?'예약 발송 대기':mail.recallRequested?'회수 확인 대기':native?'상대 PC 저장 대기':'저장 확인 전');
  const readLabel=read?'읽음':receipt==='recalled'?'해당 없음':'읽음 확인 전';
  return {receipt,stored,read,storageLabel,readLabel};
 }
 function delivery(mail,id,options){
  const r=recipient(mail,id,options);
  return r.stored&&r.readLabel!=='해당 없음'?`${r.storageLabel} · ${r.readLabel}`:r.storageLabel;
 }
 function summary(mail,{native=true,now=Date.now(),self}={}){
  const targets=[...new Set(mail.to||[])],others=targets.filter(id=>id!=='me'&&id!==self);
  const people=others.map(id=>recipient(mail,id,{native,now}));
  const active=people.filter(r=>r.receipt!=='recalled');
  if(people.length&&!active.length)return {label:'회수됨',detail:'모든 수신자의 회수가 완료되었습니다.',tone:'normal'};
  const sending=dispatch(mail);
  if(sending)return sending;
  if(!people.length&&targets.length)return {label:'내 PC 보관',detail:'나에게 보낸 메시지입니다.',tone:'normal'};
  if(active.length&&active.every(r=>r.receipt==='scheduled')&&!mail.recallRequested)return {label:'예약 발송 대기',detail:'예약 시간에 전달을 시작합니다.',tone:'pending'};
  const stored=active.filter(r=>r.stored).length,read=active.filter(r=>r.read).length;
  const metrics=[{label:'상대 PC 저장 완료',count:stored,total:active.length},{label:'읽음',count:read,total:active.length}];
  if(mail.workRequest){
   const {done,total}=work.summary(mail,now);
   metrics.push({label:mail.workRequest.kind==='reply'?'회신 완료':'제출 완료',count:done,total});
  }
  const waiting=mail.recallRequested&&active.some(r=>!r.read);
  const label=waiting?'회수 확인 대기':native?(stored?'전달 현황':'상대 PC 저장 대기'):'체험 메시지 현황';
  const detail=waiting?'수신자의 회수 확인을 기다리고 있습니다.':people.length>active.length?`회수된 수신자 ${people.length-active.length}명은 집계에서 제외했습니다.`:'';
  return {label,metrics,detail,tone:waiting?'pending':'normal'};
 }
 const api={key,changes,message,recipient,delivery,summary};if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongMailReceipts=api;
})(typeof window==='object'?window:globalThis);
