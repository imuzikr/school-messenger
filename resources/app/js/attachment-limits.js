(function(root){
 'use strict';
 const maxCount=20,maxFileBytes=500*1024*1024,maxTotalBytes=2*1024*1024*1024;
 function dataBytes(data){const encoded=String(data||'').split(',')[1]||'';return Math.max(0,encoded.length*3/4-(encoded.endsWith('==')?2:encoded.endsWith('=')?1:0));}
 function validate(sizes){
  if(sizes.length>maxCount)return '본문 이미지와 첨부 파일은 합쳐서 최대 20개까지 넣을 수 있습니다.';
  if(sizes.some(n=>!Number.isSafeInteger(n)||n<0||n>maxFileBytes))return '파일은 각각 500 MB 이하로 첨부해 주세요.';
  if(sizes.reduce((n,v)=>n+v,0)>maxTotalBytes)return '본문 이미지와 첨부 파일은 합쳐서 총 2 GB 이하로 넣어 주세요.';
  return '';
 }
 const api={maxCount,maxFileBytes,maxTotalBytes,dataBytes,validate};if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongAttachmentLimits=api;
})(typeof window==='object'?window:globalThis);
