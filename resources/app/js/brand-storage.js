/* Preserve existing preferences/demo history before using the new key prefix.
   Keep the old copy for recovery; only mark complete after every write succeeds. */
(function(root){
 'use strict';
 function migrate(storage){
  const marker='dingdong-brand-storage-v1';if(storage.getItem(marker))return;
  const keys=Array.from({length:storage.length},(_,i)=>storage.key(i));
  for(const key of keys){if(!/^ieum[-:]/.test(key||''))continue;const next='dingdong'+key.slice(4);if(storage.getItem(next)===null)storage.setItem(next,storage.getItem(key));}
  storage.setItem(marker,'1');
 }
 if(typeof module==='object'&&module.exports)module.exports={migrate};else{try{migrate(root.localStorage);migrate(root.sessionStorage);}catch{ /* Retry on next launch if storage is temporarily unavailable. */ }}
})(typeof window==='object'?window:globalThis);
