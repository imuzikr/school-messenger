/* Personal, device-local sticky notes. Never part of the messenger's server sync. */
(function(root){
  'use strict';
  const colors=['yellow','green','pink','blue'];
  const blank=()=>({version:1,view:'grid',notes:[]});
  function validate(value){
    if(!value||value.version!==1||!['list','grid'].includes(value.view)||!Array.isArray(value.notes)||value.notes.length>200)throw Error('저장된 메모를 읽을 수 없습니다.');
    const seen=new Set();
    for(const n of value.notes){if(!n||typeof n.id!=='string'||!/^[-\w]{1,100}$/.test(n.id)||seen.has(n.id)||typeof n.text!=='string'||n.text.length>4000||(n.html!==undefined&&(typeof n.html!=='string'||n.html.length>64000))||!colors.includes(n.color)||!Number.isFinite(n.createdAt)||!Number.isFinite(n.updatedAt))throw Error('저장된 메모를 읽을 수 없습니다.');seen.add(n.id);}
    for(const n of value.notes)if(n.schedule!==undefined){const s=n.schedule;if(!s||typeof s.id!=='string'||!/^[-\w]{1,160}$/.test(s.id)||typeof s.title!=='string'||s.title.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(s.date)||!/^\d{2}:\d{2}$/.test(s.start)||!/^\d{2}:\d{2}$/.test(s.end))throw Error('일정 메모 정보를 읽을 수 없습니다.');}
    for(const n of value.notes)if(n.schedule?.kind!==undefined&&(n.schedule.kind!=='deadline'||typeof n.schedule.dueTime!=='string'||n.schedule.dueTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(n.schedule.dueTime)))throw Error('마감 메모 정보를 읽을 수 없습니다.');
    for(const n of value.notes)if(n.mail!==undefined){const m=n.mail;if(!m||typeof m.id!=='string'||!/^[-\w]{1,160}$/.test(m.id)||typeof m.title!=='string'||m.title.length>200||typeof m.from!=='string'||m.from.length>200||!/^\d{4}-\d{2}-\d{2}$/.test(m.date)||typeof m.time!=='string'||m.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(m.time))throw Error('메시지 메모 정보를 읽지 못했습니다.');}
    for(const n of value.notes)if(n.mail?.viewDate!==undefined&&(typeof n.mail.viewDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(n.mail.viewDate)))throw Error('담임 업무 날짜를 읽지 못했습니다.');
    return value;
  }
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const plainMarkup=text=>escape(text).replace(/\n/g,'<br>');
  function cleanHTML(html){
    const template=document.createElement('template');template.innerHTML=String(html);
    const allowed=new Set(['B','STRONG','I','EM','U','UL','OL','LI','P','DIV','BR']),blocked=new Set(['SCRIPT','STYLE','IFRAME','OBJECT','SVG','MATH','IMG','VIDEO','AUDIO','TEMPLATE']);
    function clean(node,depth=0){if(node.nodeType===3)return escape(node.data);if(node.nodeType!==1||blocked.has(node.tagName))return '';if(depth>80)return escape(node.textContent);const body=[...node.childNodes].map(n=>clean(n,depth+1)).join('');return allowed.has(node.tagName)?'<'+node.tagName.toLowerCase()+'>'+body+(node.tagName==='BR'?'':'</'+node.tagName.toLowerCase()+'>'):body;}
    return [...template.content.childNodes].map(n=>clean(n)).join('');
  }
  const markup=note=>note.html===undefined?plainMarkup(note.text):cleanHTML(note.html);
  class Store{
    constructor(storage,user){if(typeof user!=='string'||!user)throw Error('메모를 사용할 계정을 확인해 주세요.');this.storage=storage;this.key='dingdong-sticky-v1:'+encodeURIComponent(user);}
    load(){const raw=this.storage.getItem(this.key);return raw===null?blank():validate(JSON.parse(raw));}
    save(value){this.storage.setItem(this.key,JSON.stringify(validate(value)));if(root.dispatchEvent&&root.CustomEvent)root.dispatchEvent(new CustomEvent('dingdong-sticky-change',{detail:{key:this.key,store:this}}));}
    setMail(mail){
      const data=this.load();let note=data.notes.find(n=>n.mail?.id===mail.id);
      if(note){note.mail=mail;note.updatedAt=Date.now();}
      else{if(data.notes.length>=200)throw Error('메모장이 가득 찼습니다.');const now=Date.now();note={id:crypto.randomUUID(),text:'',mail,color:'yellow',createdAt:now,updatedAt:now};data.notes.unshift(note);}
      this.save(data);return note.id;
    }
    setSchedule(schedule,text){
      const data=this.load(),existing=data.notes.find(n=>n.schedule?.id===schedule.id);
      if(!text.trim()){data.notes=data.notes.filter(n=>n!==existing);this.save(data);return;}
      if(text.length>4000)throw Error('메모는 4,000자까지 입력할 수 있습니다.');
      if(existing){existing.text=text;delete existing.html;existing.schedule=schedule;existing.updatedAt=Date.now();}
      else{if(data.notes.length>=200)throw Error('메모장이 가득 찼습니다. 메모를 정리한 후 다시 저장해 주세요.');const now=Date.now();data.notes.unshift({id:crypto.randomUUID(),text,schedule,color:'yellow',createdAt:now,updatedAt:now});}
      this.save(data);
    }
  }
  class Board{
    constructor({onClose,onSchedule,onScheduleInfo,onScheduleSave,hasSchedule,onMail,onHomeroom,tabHTML}){
      const tabTemplate=document.createElement('template');tabTemplate.innerHTML=tabHTML||'';this.tab=tabTemplate.content.firstElementChild;
      this.onClose=onClose;this.onSchedule=onSchedule;this.user=null;this.data=blank();this.undo=[];this.drag=null;this.expanded=null;this.failed=false;this.readError=false;
      this.onHomeroom=onHomeroom;this.onMail=onMail;this.hasSchedule=hasSchedule;this.onScheduleInfo=onScheduleInfo;this.onScheduleSave=onScheduleSave;this.scheduleSaving=false;
      this.root=document.createElement('aside');this.root.id='memo-panel';this.root.className='memo-drawer';this.root.setAttribute('aria-label','개인 메모장');this.root.setAttribute('aria-hidden','true');this.root.inert=true;
      this.root.innerHTML='<header class="memo-head"><div><span class="memo-eyebrow">나만의 작은 기록</span><h2>메모장 <small id="memo-count">0</small></h2></div><button type="button" class="icon-btn" data-memo-close aria-label="메모장 닫기">×</button></header><div class="memo-tools"><div class="memo-views" role="group" aria-label="메모 보기 방식"><button type="button" data-memo-view="list" aria-pressed="false" title="목록 보기">☰ <span>목록</span></button><button type="button" data-memo-view="grid" aria-pressed="true" title="그리드 보기">▦ <span>그리드</span></button></div><button type="button" class="btn memo-add" data-memo-add>＋ 새 메모</button></div><p class="memo-hint">점 손잡이를 잡아 이동하거나 아래에 놓아 삭제하세요.</p><div class="memo-cards" id="memo-cards"></div><div class="memo-trash" data-memo-trash hidden>여기에 놓아 삭제</div><footer class="memo-foot"><div class="memo-undo" hidden><span>메모를 삭제했습니다.</span><button type="button" data-memo-undo>되돌리기</button></div><div class="memo-save-line"><span id="memo-save-status" role="status" aria-live="polite">이 PC에 자동 저장됩니다.</span><button type="button" data-memo-retry hidden>다시 저장</button></div><span class="memo-announcement sr-only" aria-live="polite"></span></footer>';
      this.list=this.root.querySelector('.memo-cards');
      this.root.addEventListener('click',e=>this.click(e));
      document.addEventListener('selectionchange',()=>{const input=this.editor?.querySelector('.memo-rich'),selection=getSelection();if(input&&selection.rangeCount&&input.contains(selection.anchorNode)&&input.contains(selection.focusNode)){this.editorRange=selection.getRangeAt(0).cloneRange();this.updateFormat();}});
      this.root.addEventListener('pointerdown',e=>this.pointerDown(e));
      this.root.addEventListener('keydown',e=>this.key(e));
      this.root.addEventListener('contextmenu',e=>{if(e.target.closest('[data-memo-grip]'))e.preventDefault();});
      window.addEventListener('storage',e=>{if(!this.store||e.key!==this.store.key)return;if(this.failed){this.status('다른 창에서 메모가 변경되었습니다. 현재 내용을 먼저 저장해 주세요.',true);return;}try{const focus=this.focusState();this.data=this.store.load();this.render();this.restoreFocus(focus);}catch{this.status('변경된 메모를 읽지 못했습니다. 현재 메모는 유지됩니다.',true);}});
      window.addEventListener('dingdong-sticky-change',e=>{if(!this.store||e.detail.key!==this.store.key||e.detail.store===this.store)return;try{if(this.failed)return;const focus=this.focusState();this.data=this.store.load();this.render();this.restoreFocus(focus);}catch{this.status('변경된 메모를 읽지 못했습니다.',true);}});
      window.addEventListener('blur',()=>{this.cancelDrag();if(!this.editor?.querySelector('.memo-schedule-form:not([hidden])'))this.collapseEditor();});
      document.addEventListener('pointerdown',e=>{if(this.expanded&&!this.editor.contains(e.target))this.collapseEditor();},true);
      window.addEventListener('resize',()=>this.position());
    }
    mount(host,user){
      if(this.user!==user){this.collapseEditor();this.cancelDrag();this.user=user;this.undo=[];this.failed=false;this.readError=false;this.store=user?new Store(localStorage,user):null;this.data=blank();if(this.store){try{this.data=this.store.load();}catch{this.readError=true;}}this.render();if(!this.readError)this.status('이 PC에 자동 저장됩니다.');}
      if(this.host!==host){this.observer?.disconnect();this.host=host;if(host){this.observer=new ResizeObserver(()=>this.position());this.observer.observe(host);}}
      if(host&&user){if(this.root.parentElement!==document.body)document.body.append(this.root);if(this.tab&&this.tab.parentElement!==document.body)document.body.append(this.tab);this.position();this.updateScheduleMarks();}else{this.root.remove();this.tab?.remove();}
    }
    position(){if(!this.host?.isConnected)return;const r=this.host.getBoundingClientRect(),native=document.body.classList.contains('unified-main'),width=native?(window.dingdongDesktop?.wingWidth||330):330,overlay=!native&&innerWidth<780,left=native&&document.body.dataset.hostSide==='right';this.root.classList.toggle('left',left);Object.assign(this.root.style,{position:'fixed',left:(overlay?Math.max(r.left,r.right-width):left?r.left-width:r.right)+'px',right:'auto',top:r.top+'px',bottom:'auto',height:r.height+'px',width:Math.min(width,overlay?r.width:width)+'px'});if(this.tab){this.tab.classList.toggle('left',left||overlay);this.tab.style.setProperty('--memo-travel',((left||overlay)?-Math.min(width,overlay?r.width:width):width)+'px');Object.assign(this.tab.style,{left:(left?r.left:r.right-17)+'px',top:(r.top+29)+'px'});}this.positionEditor();}
    setOpen(open){
      const changed=this.open!==!!open;this.open=!!open;this.root.inert=!open;this.root.setAttribute('aria-hidden',String(!open));this.tab?.setAttribute('aria-expanded',String(!!open));
      if(!open){cancelAnimationFrame(this.openFrame);this.collapseEditor();this.cancelDrag();if(this.root.contains(document.activeElement))this.tab?.focus({preventScroll:true});this.root.classList.remove('open');this.tab?.classList.remove('open');}
      else if(changed){this.root.getBoundingClientRect();this.openFrame=requestAnimationFrame(()=>{if(this.open){this.root.classList.add('open');this.tab?.classList.add('open');}this.root.querySelectorAll('.memo-rich').forEach(el=>this.fit(el));});}
    }
    positionEditor(){if(!this.expanded||!this.editor)return;const width=Math.min(520,innerWidth-32),height=Math.min(560,innerHeight-64),r=this.root.getBoundingClientRect();Object.assign(this.editor.style,{width:width+'px',height:height+'px',left:Math.max(16,Math.min(innerWidth-width-16,r.left+r.width/2-width/2))+'px',top:Math.max(16,Math.min(innerHeight-height-16,80))+'px'});}
    openEditor(id){
      const note=this.data.notes.find(n=>n.id===id);if(!note||this.readError)return;this.cancelDrag();this.collapseEditor();this.expanded=id;
      this.editor=document.createElement('section');this.editor.className='memo-editor '+note.color;this.editor.setAttribute('role','dialog');this.editor.setAttribute('aria-label','메모 크게 쓰기');
      this.editor.innerHTML='<header class="memo-editor-head"><span class="memo-editor-title">나의 메모'+this.scheduleMark(note)+'</span><div class="memo-editor-actions"><button type="button" class="memo-delete-editor" data-memo-delete-editor>메모 삭제</button><button type="button" data-memo-collapse aria-label="메모 최소화" title="작게 보기">_</button></div></header><div class="memo-format" role="group" aria-label="메모 서식">'+[['bold','굵게 (Ctrl+B)','<b>B</b>'],['italic','기울임 (Ctrl+I)','<i>I</i>'],['underline','밑줄 (Ctrl+U)','<u>U</u>'],['insertUnorderedList','글머리 기호','• 목록'],['insertOrderedList','번호 목록','1. 목록']].map(([command,label,content])=>'<button type="button" data-memo-format="'+command+'" aria-label="'+label+'" title="'+label+'" aria-pressed="false">'+content+'</button>').join('')+'</div><div class="memo-rich" contenteditable="true" role="textbox" aria-label="확대한 메모" aria-multiline="true" data-placeholder="생각을 편하게 적어 두세요…" spellcheck="false"></div><footer class="memo-editor-foot"><span role="status">이 PC에 자동 저장됩니다.</span><button type="button" data-memo-retry hidden>다시 저장</button></footer>';
      const input=this.editor.querySelector('.memo-rich');this.bindRich(input,note);
      if(note.schedule||note.mail)this.editor.querySelector('.memo-format').insertAdjacentHTML('afterend',note.mail?this.mailHeader(note):this.scheduleHeader(note));
      this.editor.querySelector('.memo-format').insertAdjacentHTML('beforeend','<button type="button" class="memo-schedule" data-memo-schedule>일정 등록</button>');
      if(note.schedule||note.mail)this.editor.querySelector('[data-memo-schedule]').textContent=note.mail?'메시지 보기':'일정 보기';
      this.editor.querySelector('[data-memo-schedule]').onclick=()=>{this.commitRich(input);this.schedule(note.id);};
      if(note.mail){this.editor.querySelector('[data-memo-schedule]').insertAdjacentHTML('afterend','<button type="button" class="memo-homeroom" data-memo-homeroom>담임 업무 보기</button>');this.editor.querySelector('[data-memo-homeroom]').onclick=async()=>{this.commitRich(input);if(this.failed)return;this.collapseEditor();try{await this.onHomeroom?.(note.mail);}catch(error){this.status('담임 업무를 열지 못했습니다. '+error.message,true);}};}
      this.editor.querySelectorAll('[data-memo-format]').forEach(button=>{button.onpointerdown=e=>e.preventDefault();button.onclick=()=>this.format(button.dataset.memoFormat,input);});
      this.editor.querySelector('[data-memo-delete-editor]').onclick=()=>{this.commitRich(input);this.remove(note.id);};
      this.editor.querySelector('[data-memo-collapse]').onclick=()=>this.collapseEditor(true);this.editor.querySelector('[data-memo-retry]').onclick=()=>this.persist();this.editor.onkeydown=e=>{if(e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopPropagation();this.collapseEditor(true);}};
      document.body.append(this.editor);this.updateScheduleMarks();this.positionEditor();input.focus();const range=document.createRange();range.selectNodeContents(input);range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range);this.editorRange=range.cloneRange();this.updateFormat();
    }
    bindRich(input,note){
      input.dataset.memoText=note.id;input.innerHTML=markup(note);input.contentEditable=String(!this.readError);input.setAttribute('aria-readonly',String(this.readError));
      input.oninput=e=>this.commitRich(input,e.isComposing);input.oncompositionend=()=>this.commitRich(input);
      input.onpaste=e=>{e.preventDefault();const html=e.clipboardData.getData('text/html'),text=e.clipboardData.getData('text/plain');document.execCommand('insertHTML',false,html&&html.length<1000000?cleanHTML(html):plainMarkup(text));this.commitRich(input);};
      input.ondrop=e=>e.preventDefault();
      input.onkeydown=e=>{if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.isComposing&&['b','i','u'].includes(e.key.toLowerCase())){e.preventDefault();e.stopPropagation();this.format({b:'bold',i:'italic',u:'underline'}[e.key.toLowerCase()],input);}};
    }
    commitRich(input,composing=false){
      const note=this.data.notes.find(n=>n.id===input.dataset.memoText);if(!note)return;
      const text=input.innerText.replace(/\r\n?/g,'\n'),html=cleanHTML(input.innerHTML);
      if(text.length>4000||html.length>64000){if(composing)return;input.innerHTML=markup(note);const range=document.createRange();range.selectNodeContents(input);range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range);this.status('메모는 4,000자까지 입력할 수 있습니다.',true);return;}
      if(note.text===text&&note.html===html){this.updateFormat();return;}
      note.text=text;note.html=html;note.updatedAt=Date.now();
      const small=this.list.querySelector(`[data-memo-text="${note.id}"]`);if(small&&small!==input){small.innerHTML=html;this.fit(small);}if(this.root.contains(input))this.fit(input);this.persist();this.updateFormat();
    }
    format(command,input){
      if(!input?.isConnected)return;const selection=getSelection(),range=selection.rangeCount&&input.contains(selection.anchorNode)&&input.contains(selection.focusNode)?selection.getRangeAt(0).cloneRange():this.editorRange;input.focus({preventScroll:true});
      if(range&&input.contains(range.commonAncestorContainer)){selection.removeAllRanges();selection.addRange(range.cloneRange());}
      document.execCommand('styleWithCSS',false,false);document.execCommand(command,false,null);this.commitRich(input);
      if(this.editor?.contains(input)&&selection.rangeCount)this.editorRange=selection.getRangeAt(0).cloneRange();this.updateFormat();
    }
    updateFormat(){if(!this.editor)return;this.editor.querySelectorAll('[data-memo-format]').forEach(button=>button.setAttribute('aria-pressed',String(document.queryCommandState(button.dataset.memoFormat))));}
    collapseEditor(focus=false){if(!this.expanded)return;const id=this.expanded;this.expanded=null;this.editorRange=null;this.editor?.remove();this.editor=null;if(focus)this.list.querySelector(`[data-memo-id="${id}"] [data-memo-expand]`)?.focus();}
    async schedule(id){
      const note=this.data.notes.find(n=>n.id===id);if(!note||this.readError)return;
      if(note.mail){this.collapseEditor();try{await this.onMail?.(note.mail.id);}catch(error){this.status('메시지를 열지 못했습니다. '+error.message,true);}return;}
      if(!note.schedule){this.toggleScheduleForm(id);return;}
      if(this.expanded===id)this.collapseEditor();
      try{await this.onSchedule?.({id:note.id,text:note.text,...(note.schedule?{eventId:note.schedule.id,kind:note.schedule.kind}:{})});}catch(error){this.status('일정 입력창을 열지 못했습니다. '+error.message,true);}
    }
    async toggleScheduleForm(id){
      if(this.scheduleSaving||this.scheduleOpening)return;
      if(this.expanded!==id)this.openEditor(id);
      if(!this.editor)return;
      const previous=this.editor.querySelector('.memo-schedule-form');
      if(previous&&!previous.hidden){previous.hidden=true;this.editor.querySelector('[data-memo-schedule]').setAttribute('aria-expanded','false');return;}
      previous?.remove();
      const editor=this.editor;let info;this.scheduleOpening=true;
      try{info=await this.onScheduleInfo?.(id)||{};}catch(e){this.status(e.message,true);return;}finally{this.scheduleOpening=false;}
      if(editor!==this.editor||this.expanded!==id)return;
      const form=document.createElement('form');form.className='memo-schedule-form';
      form.innerHTML='<fieldset><div class="memo-schedule-fields"><label>날짜<input type="date" data-memo-date required value="'+escape(info.date||'')+'"></label><label>시작 시간<input type="time" data-memo-start required value="'+escape(info.start||'09:00')+'"></label><label>종료 시간<input type="time" data-memo-end required value="'+escape(info.end||'10:00')+'"></label></div><p class="memo-schedule-error" role="alert"></p><div class="memo-schedule-actions"><span class="memo-schedule-result" role="status"></span><button type="button" data-memo-schedule-cancel>취소</button><button type="submit">일정 저장</button></div></fieldset>';
      this.editor.querySelector('.memo-editor-head').insertAdjacentElement('afterend',form);
      this.editor.querySelector('[data-memo-schedule]').setAttribute('aria-expanded','true');
      form.querySelector('[data-memo-schedule-cancel]').onclick=()=>{form.hidden=true;this.editor?.querySelector('[data-memo-schedule]')?.setAttribute('aria-expanded','false');};
      form.oninput=()=>{form.querySelector('.memo-schedule-result').textContent='';form.querySelector('[role=alert]').textContent='';};
      form.onsubmit=async event=>{
        event.preventDefault();if(this.scheduleSaving)return;
        const note=this.data.notes.find(n=>n.id===id);if(!note)return;
        const error=form.querySelector('[role=alert]'),result=form.querySelector('.memo-schedule-result');error.textContent='';result.textContent='';
        this.commitRich(this.editor.querySelector('.memo-rich'));
        const payload={id,text:note.text,date:form.querySelector('[data-memo-date]').value,start:form.querySelector('[data-memo-start]').value,end:form.querySelector('[data-memo-end]').value};
        this.scheduleSaving=true;form.querySelector('fieldset').disabled=true;
        try{if(!this.onScheduleSave)throw Error('일정 저장을 사용할 수 없습니다.');await this.onScheduleSave(payload);result.textContent='캘린더에 저장했습니다.';}
        catch(e){error.textContent=e.message;}
        finally{this.scheduleSaving=false;form.querySelector('fieldset').disabled=false;}
      };
      form.querySelector('[data-memo-date]').focus({preventScroll:true});
    }
    scheduleMark(note){return '<span class="memo-calendar-mark" data-memo-calendar="'+escape(note.id)+'" role="img" aria-label="연결된 일정 있음" title="연결된 일정 있음" hidden><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2M8 18h2"/></svg></span>';}
    updateScheduleMarks(){for(const host of [this.root,this.editor])host?.querySelectorAll('[data-memo-calendar]').forEach(mark=>{const note=this.data.notes.find(n=>n.id===mark.dataset.memoCalendar);mark.hidden=!note||!(this.hasSchedule?this.hasSchedule(note):note.schedule);});}
    mailHeader(note){const m=note.mail;return '<div class="memo-schedule-header"><strong>'+escape(m.title)+'</strong><small>'+escape(m.from+' · '+m.date+(m.time?' · '+m.time:''))+'</small></div>';}
    scheduleHeader(note){const s=note.schedule;return '<div class="memo-schedule-header"><strong>'+escape(s.title)+'</strong><small>'+escape(s.date+(s.kind==='deadline'?(s.dueTime?' · '+s.dueTime+'까지':' · 날짜 마감'):' · '+s.start+'–'+s.end))+'</small></div>';}
    focusState(){const el=document.activeElement;if(!this.root.contains(el))return null;const selection=getSelection(),range=selection.rangeCount?selection.getRangeAt(0).cloneRange():null;return {el,id:el.dataset.memoText,range,scroll:this.list.scrollTop};}
    restoreFocus(s){if(s?.id&&!s.el.isConnected)s.el=this.list.querySelector(`[data-memo-text="${s.id}"]`);if(s?.el?.isConnected&&this.open){if(document.activeElement!==s.el)s.el.focus({preventScroll:true});if(s.range&&s.range.startContainer.isConnected&&(!getSelection().rangeCount||!getSelection().getRangeAt(0).isPointInRange(s.range.startContainer,s.range.startOffset))){getSelection().removeAllRanges();getSelection().addRange(s.range);}this.list.scrollTop=s.scroll;}}
    status(message,error=false){const el=this.root.querySelector('#memo-save-status');if(el.textContent!==message)el.textContent=message;if(this.editor){this.editor.querySelector('[role=status]').textContent=message;this.editor.querySelector('[data-memo-retry]').hidden=!this.failed;}el.classList.toggle('memo-error',error);this.root.querySelector('[data-memo-retry]').hidden=!this.failed||this.readError;}
    announce(message){this.root.querySelector('.memo-announcement').textContent=message;}
    persist(){try{this.store.save(this.data);this.failed=false;this.status('이 PC에 저장됨');return true;}catch{this.failed=true;this.status('저장하지 못했습니다. 현재 내용을 유지하고 다시 저장해 주세요.',true);return false;}}
    fit(input){const grid=this.data.view==='grid';input.style.height='auto';input.style.height=Math.min(grid?80:56,Math.max(grid?64:40,input.scrollHeight))+'px';}
    render(){
      this.cancelDrag();this.list.dataset.view=this.data.view;this.list.replaceChildren();
      for(const [i,note] of this.data.notes.entries()){
        const card=document.createElement('article');card.className='sticky-note '+note.color;card.dataset.memoId=note.id;
        card.innerHTML='<div class="sticky-note-tools"><button type="button" class="memo-grip" data-memo-grip aria-label="메모 순서 이동" title="잡아서 바로 이동 · Alt+방향키로 순서 이동">⠿</button><span class="memo-order"></span>'+this.scheduleMark(note)+'<button type="button" class="memo-expand" data-memo-expand aria-label="메모 확대" title="크게 쓰기">↗</button><button type="button" class="memo-delete" data-memo-delete aria-label="메모 삭제" title="메모 삭제">삭제</button></div><div class="memo-rich" data-memo-text contenteditable="true" role="textbox" aria-multiline="true" spellcheck="false" data-placeholder="잊기 전에 적어 두세요…"></div>';
        card.querySelector('.memo-order').textContent=String(i+1).padStart(2,'0');
        const input=card.querySelector('.memo-rich');input.setAttribute('aria-label',(i+1)+'번째 메모');this.bindRich(input,note);
        if(note.schedule||note.mail)input.insertAdjacentHTML('beforebegin',note.mail?this.mailHeader(note):this.scheduleHeader(note));
        card.insertAdjacentHTML('beforeend','<button type="button" class="memo-schedule" data-memo-schedule>'+(note.mail?'메시지 보기':note.schedule?'일정 보기':'일정 등록')+'</button>');
        this.list.append(card);this.fit(input);
      }
      this.updateScheduleMarks();
      if(!this.data.notes.length){const empty=document.createElement('div');empty.className='memo-empty';empty.innerHTML='<span aria-hidden="true">✎</span><strong>생각이 떠오르면 가볍게</strong><p>새 메모를 눌러 첫 기록을 남겨 보세요.</p>';this.list.append(empty);}
      this.root.querySelector('#memo-count').textContent=this.data.notes.length;
      this.root.querySelectorAll('[data-memo-view]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.memoView===this.data.view)));
      this.root.querySelector('[data-memo-add]').disabled=this.readError||this.data.notes.length>=200;
      this.root.querySelector('.memo-undo').hidden=!this.undo.length;
      if(this.readError)this.status('저장된 메모를 읽지 못했습니다. 기존 기록을 보호하기 위해 편집을 멈췄습니다.',true);
    }
    click(e){
      const button=e.target.closest('button');
      if(!button){const card=e.target.closest('[data-memo-id]');if(card&&this.list.contains(card)&&!this.readError&&!this.drag)this.openEditor(card.dataset.memoId);return;}
      if(!this.root.contains(button))return;
      if(button.hasAttribute('data-memo-close')){this.onClose();return;}
      if(this.readError)return;
      if(button.hasAttribute('data-memo-add')){
        if(this.data.notes.length>=200)return;
        const now=Date.now(),note={id:crypto.randomUUID(),text:'',color:colors[this.data.notes.length%colors.length],createdAt:now,updatedAt:now};this.data.notes.unshift(note);this.persist();this.render();this.list.scrollTop=0;this.openEditor(note.id);
      }else if(button.dataset.memoView){const focused=this.focusState();this.data.view=button.dataset.memoView;this.persist();this.render();this.restoreFocus(focused);}
      else if(button.hasAttribute('data-memo-expand'))this.openEditor(button.closest('[data-memo-id]').dataset.memoId);
      else if(button.hasAttribute('data-memo-schedule'))this.schedule(button.closest('[data-memo-id]').dataset.memoId);
      else if(button.hasAttribute('data-memo-delete'))this.remove(button.closest('[data-memo-id]').dataset.memoId);
      else if(button.hasAttribute('data-memo-undo')){
        if(this.data.notes.length>=200){this.status('메모를 하나 지운 뒤 되돌릴 수 있습니다.',true);return;}const last=this.undo.pop();if(!last)return;this.data.notes.splice(Math.min(last.index,this.data.notes.length),0,last.note);this.persist();this.render();this.list.querySelector(`[data-memo-text="${last.note.id}"]`)?.focus();this.announce('삭제한 메모를 복원했습니다.');
      }else if(button.hasAttribute('data-memo-retry'))this.persist();
    }
    remove(id){if(this.readError)return;const index=this.data.notes.findIndex(n=>n.id===id);if(index<0)return;const note=this.data.notes.splice(index,1)[0];if(!this.persist()){this.data.notes.splice(index,0,note);this.render();return;}if(this.expanded===id)this.collapseEditor();this.undo.push({index,note});if(this.undo.length>20)this.undo.shift();this.render();this.root.querySelector('[data-memo-undo]').focus();this.announce('메모를 삭제했습니다. 되돌리기로 복원할 수 있습니다.');}
    move(id,target,after){const note=this.data.notes.find(n=>n.id===id);if(!note||id===target)return;this.data.notes=this.data.notes.filter(n=>n.id!==id);let index=this.data.notes.findIndex(n=>n.id===target);if(index<0){this.data.notes.push(note);return;}this.data.notes.splice(index+(after?1:0),0,note);this.persist();this.render();this.announce('메모 순서를 변경했습니다.');}
    key(e){
      if(e.key==='Escape'&&this.drag){e.preventDefault();e.stopPropagation();this.cancelDrag();return;}
      const grip=e.target.closest('[data-memo-grip]');if(!grip||!e.altKey||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
      e.preventDefault();e.stopPropagation();const id=grip.closest('[data-memo-id]').dataset.memoId,index=this.data.notes.findIndex(n=>n.id===id),delta=['ArrowUp','ArrowLeft'].includes(e.key)?-1:1,target=this.data.notes[index+delta];if(!target)return;this.move(id,target.id,delta>0);this.list.querySelector(`[data-memo-id="${id}"] [data-memo-grip]`)?.focus();
    }
    pointerDown(e){
      const grip=e.target.closest('[data-memo-grip]');if(!grip||this.readError||e.button!==0)return;e.preventDefault();this.cancelDrag();
      const d={id:grip.closest('[data-memo-id]').dataset.memoId,grip,pointer:e.pointerId,x:e.clientX,y:e.clientY,initialX:e.clientX,initialY:e.clientY,active:false,target:null,after:false};this.drag=d;
      grip.setPointerCapture(e.pointerId);
      d.move=e=>{if(e.pointerId!==d.pointer)return;d.x=e.clientX;d.y=e.clientY;if(!d.active&&Math.hypot(d.x-d.initialX,d.y-d.initialY)>8){this.cancelDrag();return;}if(d.active){e.preventDefault();this.paintDrag(d);}};
      d.finish=e=>{if(e.pointerId!==d.pointer)return;d.x=e.clientX;d.y=e.clientY;if(d.active)this.paintDrag(d);const active=d.active,trash=d.trash,target=d.target,after=d.after;this.cancelDrag();if(!active)return;if(trash)this.remove(d.id);else if(target){this.move(d.id,target,after);this.list.querySelector(`[data-memo-id="${d.id}"] [data-memo-grip]`)?.focus();}};
      d.cancel=()=>this.cancelDrag();d.escape=e=>{if(e.key==='Escape'){e.preventDefault();this.cancelDrag();}};
      grip.addEventListener('pointermove',d.move);grip.addEventListener('pointerup',d.finish);grip.addEventListener('pointercancel',d.cancel);grip.addEventListener('lostpointercapture',d.cancel);document.addEventListener('keydown',d.escape);
      (()=>{if(this.drag!==d)return;d.active=true;this.root.classList.add('memo-organizing');this.list.querySelector(`[data-memo-id="${d.id}"]`).classList.add('is-moving');this.root.querySelector('[data-memo-trash]').hidden=false;d.ghost=document.createElement('div');d.ghost.className='memo-drag-ghost';d.ghost.textContent=this.data.notes.find(n=>n.id===d.id)?.text.slice(0,60)||'빈 메모';document.body.append(d.ghost);this.announce('메모 이동을 시작합니다. 다른 메모 옆에 놓거나 삭제 영역에 놓으세요.');const tick=()=>{if(this.drag!==d)return;const r=this.list.getBoundingClientRect();if(d.y>=r.top&&d.y<=r.bottom){if(d.y<r.top+35)this.list.scrollTop-=7;else if(d.y>r.bottom-35)this.list.scrollTop+=7;}this.paintDrag(d);d.frame=requestAnimationFrame(tick);};tick();})();
    }
    paintDrag(d){
      d.ghost.style.left=d.x+12+'px';d.ghost.style.top=d.y+12+'px';const trash=this.root.querySelector('[data-memo-trash]'),r=trash.getBoundingClientRect();d.trash=d.x>=r.left&&d.x<=r.right&&d.y>=r.top&&d.y<=r.bottom;trash.classList.toggle('over',d.trash);
      this.list.querySelectorAll('.drop-before,.drop-after').forEach(el=>el.classList.remove('drop-before','drop-after'));d.target=null;
      const card=document.elementFromPoint(d.x,d.y)?.closest('[data-memo-id]');if(d.trash||!card||!this.list.contains(card)||card.dataset.memoId===d.id)return;
      const b=card.getBoundingClientRect();d.target=card.dataset.memoId;d.after=this.data.view==='grid'?d.x>b.left+b.width/2:d.y>b.top+b.height/2;card.classList.add(d.after?'drop-after':'drop-before');
    }
    cancelDrag(){const d=this.drag;if(!d)return;this.drag=null;clearTimeout(d.timer);cancelAnimationFrame(d.frame);d.ghost?.remove();d.grip.removeEventListener('pointermove',d.move);d.grip.removeEventListener('pointerup',d.finish);d.grip.removeEventListener('pointercancel',d.cancel);d.grip.removeEventListener('lostpointercapture',d.cancel);document.removeEventListener('keydown',d.escape);if(d.grip.hasPointerCapture(d.pointer))d.grip.releasePointerCapture(d.pointer);this.root.classList.remove('memo-organizing');this.root.querySelector('[data-memo-trash]').hidden=true;this.root.querySelector('[data-memo-trash]').classList.remove('over');this.list.querySelectorAll('.is-moving,.drop-before,.drop-after').forEach(el=>el.classList.remove('is-moving','drop-before','drop-after'));}
  }
  const api={Store,Board,validate,blank};if(typeof module==='object'&&module.exports)module.exports=api;else root.DingdongStickyNotes=api;
})(typeof window==='object'?window:globalThis);
