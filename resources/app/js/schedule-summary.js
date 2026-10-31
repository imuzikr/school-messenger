/* Bounded, offline extraction. Calendar values are authoritative after edits. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongScheduleSummary=api;})(globalThis,()=>{
  'use strict';
  const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
  const shorten=value=>clean(value).slice(0,100);
  const location=/(?:[가-힣A-Za-z0-9-]+\s*)?(?:도서관|교무실|회의실|시청각실|체육관|컴퓨터실|운동장|강당|[0-9]+학년\s*[0-9]+반\s*교실|[가-힣A-Za-z-]*교실|[0-9]+층|[0-9]+호(?:실)?)(?=에서|으로|로|에|\s|[.,!?]|$)/;
  function placeIn(text){
    // Prefer a named location without absorbing an adjacent date or time.
    const m=String(text||'').match(/(?:도서관|교무실|회의실|시청각실|체육관|컴퓨터실|운동장|강당|[0-9]+학년\s*[0-9]+반\s*교실|[가-힣A-Za-z-]*교실|[0-9]+층|[0-9]+호(?:실)?)(?=에서|으로|로|에|\s|[.,!?]|$)/);
    return m?m[0]:'';
  }
  function taskIn(text){
    let value=clean(text)
      .replace(/(?:\d{4}년\s*)?\d{1,2}월\s*\d{1,2}일|\d{4}-\d{2}-\d{2}|(?:이번|다음)\s*주\s*[월화수목금토일]요일|[월화수목금토일]요일|오늘|내일|모레|\d{1,2}일/g,' ')
      .replace(/(?:오전|오후|아침|저녁|밤)?\s*\d{1,2}(?:시(?:\s*\d{1,2}분|\s*반)?|:\d{2})\s*(?:까지|부터|에서|에)?|오전\s*중|점심시간\s*전까지|[~～–—]/g,' ')
      .replace(/\d{1,2}\s*교시\s*(?:부터|에)?/g,' ')
      .replace(location,' ')
      .replace(/(?:^|\s)(?:에서|으로|로|까지|전에|전까지)(?=\s|$)/g,' ')
      .replace(/(?:해\s*주세요|해주시기\s*바랍니다|해주십시오|해주세요|해요|하세요|부탁드립니다|있습니다)[.!?]*$/,'')
      .replace(/모여\s*주세요|모이겠습니다|모입니다|뵙겠습니다|뵙겠어요|뵈어요|뵐게요|봅시다|오세요|오십시오|와\s*주세요|와\s*주십시오/g,'모임')
      .replace(/[.!?]+$/,'');
    value=shorten(value).replace(/([가-힣])(?:을|를) (?=(?:미리 )?(?:제출|회신|신청|확인|준비|검토))/g,'$1 ').replace(/(?:가|이)$/,'');
    return value;
  }
  function summarize(item,sourceText=''){
    const own=String(item.note||item.title||'').slice(0,5000);
    const sentences=own.split(/\n+|[!?。]+|\.(?=\s|$)/).map(clean).filter(Boolean);
    const primary=sentences.find(s=>/제출|회신|신청|회의|협의회|연수|상담|모여|모임|수업|행사|마감/.test(s)&&!/미리|지참/.test(s));
    const task=taskIn(primary||item.title)||shorten(item.title)||'할 일 미기재';
    const preparationSentences=[...sentences,...String(sourceText||'').slice(0,10000).split(/\n+|[!?。]+|\.(?=\s|$)/).map(clean).filter(s=>/미리|지참|준비|확인|검토/.test(s)&&!/(?:오늘|내일|모레|\d+시|\d+:\d+|요일|\d+일)/.test(s))];
    const preparation=[...new Set(preparationSentences)].filter(s=>/미리|지참|준비|확인|검토/.test(s)&&s!==primary).map(taskIn).filter(Boolean).slice(0,2).join(' · ');
    // Avoid using another appointment's place from the full source message.
    const place=shorten(item.place)||placeIn(primary||own)||(!item.source?placeIn(sourceText):'')||'미기재';
    return {task,date:clean(item.date),time:item.dueTime?`${item.dueTime}까지 (마감)`:item.start?`${item.start} – ${item.end||'종료 미기재'}`:'시간 미기재',place,preparation:preparation||'별도 안내 없음'};
  }
  function calendarTitle(item){
    if(item.titleFromMail)return String(item.title||'');
    if(!['mail','message'].includes(item.source?.kind))return String(item.title||'');
    return taskIn(item.title)||(item.dueTime?'마감':'일정');
  }
  return {summarize,calendarTitle};
});
