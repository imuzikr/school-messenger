(function () {
  'use strict';
  window.DingdongWorkToolsUI = {create};
  function create(ctx) {
    const {esc, button, icon} = ctx, rules = window.DingdongWorkTools;
    const state = () => ctx.state(), self = () => ctx.self();
    const title = m => m.title || '제목 없는 메시지';
    const label = m => m.workRequest?.kind === 'reply' ? '회신' : '제출';
    const stamp = value => value ? new Date(value).toLocaleString('ko-KR', {timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}) : '—';
    const person = id => ctx.person(id);
    const mine = m => m.from === 'me' || m.from === self();
    let searchFilters = {query: '', kind: 'all', sender: '', from: '', until: '', offset: 0};
    let searchResult = null, searchError = '', searching = false, searchVersion = 0;
    let requestScope = 'sent', requestStatus = 'all', busy = false;

    function meta(m) {
      const due = m.workRequest?.dueDate;
      return `${label(m)} 요청${due ? ' · ' + due + '까지' : ' · 마감일 없음'}`;
    }
    function myResponseLabel(m) {
      const r=m.workResponses?.[self()];
      if(r?.sendError)return '응답 발송 실패';
      if(r?.restoreReview)return '응답 발송 여부 확인 필요';
      if(r?.pendingDelivery)return '응답 발송 대기';
      return label(m)+(r?.done?' 완료':' 미완료');
    }
    function counts(m) {
      const s = rules.summary(m);
      return `<div class="work-counts"><div><strong>${s.total}</strong><span>대상</span></div><div><strong>${s.done}</strong><span>${label(m)} 완료</span></div><div><strong>${s.pending.length}</strong><span>${label(m)} 미완료</span></div></div><progress class="work-progress" value="${s.done}" max="${s.total || 1}" aria-label="완료 ${s.done}명 / 대상 ${s.total}명"></progress>${s.excluded ? `<small class="muted">예약 대기·회수 ${s.excluded}명은 집계에서 제외됩니다.</small>` : ''}`;
    }
    function mailCard(m) {
      if (m.workReminderOf) return `<section class="work-card work-reminder"><strong>완료 요청 재안내</strong><p>원 요청에서 완료 여부를 알려 주세요.</p>${button('work-source', '원 요청 보기', 'arrow', '', `data-id="${esc(m.workReminderOf)}"`)}</section>`;
      if (!m.workRequest) return '';
      const summary = rules.summary(m), row = summary.rows.find(r => r.id === self()),response=m.workResponses?.[self()],pending=response?.pendingDelivery,problem=response?.sendError||response?.restoreReview;
      if (mine(m)) return `<section class="work-card"><div class="work-card-head"><div><small>${esc(meta(m))}</small><h3>회신·제출 현황</h3></div>${button('work-detail', '수신자별 현황', 'users', '', `data-id="${esc(m.id)}"`)}</div>${counts(m)}</section>`;
      if (!row) return `<section class="work-card"><strong>${esc(meta(m))}</strong><p>참조로 받은 메시지입니다. 완료 요청 대상에는 포함되지 않습니다.</p></section>`;
      return `<section class="work-card"><div class="work-card-head"><div><small>${esc(meta(m))}</small><h3>${problem||pending?myResponseLabel(m):row.done ? label(m) + ' 완료 응답 저장됨' : label(m) + ' 후 완료를 알려 주세요'}</h3></div>${button('work-respond', row.done ? '응답 수정' : label(m) + ' 완료 알리기', 'check', row.done ? '' : 'btn-primary', `data-id="${esc(m.id)}" ${!row.active || m.folder === 'trash' ? 'disabled' : ''}`)}</div><p>${problem?esc(problem.message)+' 응답 수정에서 다시 저장해 주세요.':pending?'이 PC에 저장했습니다. 연결이 복구되면 발신자에게 전달합니다.':row.done ? esc(row.note || '발신자 PC가 접속하면 완료 응답이 전달됩니다.') : '읽음 상태와 별도로 기록됩니다. 자료와 답변은 메시지 답장으로 보내 주세요.'}</p>${row.done ? `<small class="muted">${esc(stamp(row.updatedAt))}</small>` : ''}</section>`;
    }
    function requestsPage() {
      const relevant = state().data.mails.filter(m => m.workRequest && m.folder !== 'trash' && (requestScope === 'sent' ? mine(m) : !mine(m) && m.workRequest.targets.includes(self())));
      const pending = m => requestScope === 'sent' ? rules.summary(m).pending.length > 0 : rules.summary(m).rows.some(r => r.id === self() && r.active && !r.done);
      const overdue = m => pending(m) && m.workRequest.dueDate && m.workRequest.dueDate < ctx.today();
      const filtered = relevant.filter(m => requestStatus === 'all' || (requestStatus === 'pending' ? pending(m) : requestStatus === 'overdue' ? overdue(m) : !pending(m) && rules.summary(m).total > 0));
      const sorted = [...filtered].sort((a, b) => (b.workRequest.dueDate || '').localeCompare(a.workRequest.dueDate || '') || ((b.date || '') + (b.time || '')).localeCompare((a.date || '') + (a.time || '')));
      return `<div class="work-page"><div class="work-page-heading"><div><p class="work-eyebrow">작은 확인, 놓치지 않는 업무</p><h1>회신·제출 현황</h1><p class="muted">메시지마다 요청한 일의 완료 여부를 확인하세요.</p></div>${button('nav-inbox', '메시지함', 'mail')}</div><div class="work-overview"><div><strong>${relevant.length}</strong><span>전체 요청</span></div><div><strong>${relevant.filter(pending).length}</strong><span>미완료 요청</span></div><div><strong>${relevant.filter(overdue).length}</strong><span>마감 지남</span></div></div><div class="work-toolbar"><div class="segmented" role="group" aria-label="요청 구분">${[['sent','보낸 요청'],['received','받은 요청']].map(([v,n]) => `<button class="btn ${requestScope === v ? 'btn-primary' : ''}" data-action="work-scope" data-scope="${v}" aria-pressed="${requestScope === v}">${n}</button>`).join('')}</div><label>상태 <select id="work-status-filter" class="input">${[['all','전체'],['pending','미완료'],['overdue','마감 지남'],['done','완료']].map(([v,n]) => `<option value="${v}" ${requestStatus === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div><div class="work-request-list">${sorted.length ? sorted.map(m => `<article class="work-request-item"><div class="work-card-head"><div><small>${esc(meta(m))}${overdue(m) ? ' · <b class="work-late">마감 지남</b>' : ''}</small><h2><button class="work-title-link" data-action="work-source" data-id="${esc(m.id)}">${esc(title(m))}</button></h2><small class="muted">${esc(person(m.from).name)} · ${esc(m.date || '')}</small></div>${button(requestScope === 'sent' ? 'work-detail' : 'work-respond', requestScope === 'sent' ? '수신자별 현황' : '내 응답', requestScope === 'sent' ? 'users' : 'arrow', '', `data-id="${esc(m.id)}"`)}</div>${requestScope === 'sent' ? counts(m) : `<p>${esc(myResponseLabel(m))}</p>`}</article>`).join('') : `<div class="work-empty">${icon('checklist', 32)}<h2>${relevant.length ? '이 상태의 요청이 없습니다' : '아직 완료 요청이 없습니다'}</h2><p>새 메시지에서 ‘회신·제출 완료 요청’을 켜면 이곳에서 확인할 수 있어요.</p>${button('compose-mail', '새 요청 작성', 'plus', 'btn-primary')}</div>`}</div>${!ctx.native ? `<div class="work-demo-note"><span>체험 데이터는 이 PC에만 저장되며 실제로 발송되지 않습니다.</span>${button('work-demo', '체험 요청 추가', 'plus')}</div>` : ''}</div>`;
    }
    let lastDetailRows='';
    function detail(m, current) {
      if (!m || !mine(m) || !m.workRequest) return;
      const summary = rules.summary(m);
      const canRemind=!m.sendError&&!m.restoreReview&&!m.pendingDelivery&&!m.recallRequested;
      const rows = summary.rows.map(row => {
        const status=window.DingdongMailReceipts.recipient(m,row.id,{native:!!ctx.native});
        return `<tr><td><input type="checkbox" data-work-target="${esc(row.id)}" aria-label="${esc(person(row.id).name)} 재안내 대상" ${canRemind && row.active && !row.done ? 'checked' : 'disabled'}></td><th scope="row">${esc(person(row.id).name)}<small>${esc(person(row.id).department || '')}</small></th><td>${esc(status.storageLabel)}</td><td>${esc(status.readLabel)}</td><td><span class="work-state ${row.active && row.done ? 'done' : ''}">${!row.active ? '대상 제외' : label(m) + (row.done ? ' 완료' : ' 미완료')}</span><small>${esc(stamp(row.updatedAt))}</small></td><td class="work-response-note">${esc(row.note || '—')}</td></tr>`;
      }).join('');
      if(current){
        if(rows===lastDetailRows)return;
        const selected=new Set([...current.querySelectorAll('[data-work-target]:checked')].map(input=>input.dataset.workTarget));
        const focused=document.activeElement?.dataset.workTarget;
        current.querySelector('tbody').innerHTML=rows;
        current.querySelector('[data-work-counts]').innerHTML=counts(m);
        for(const input of current.querySelectorAll('[data-work-target]')){
          input.checked=!input.disabled&&selected.has(input.dataset.workTarget);
          if(!input.disabled&&input.dataset.workTarget===focused)input.focus({preventScroll:true});
        }
        current.closest('.modal').querySelector('[data-action="work-remind"]').disabled=!canRemind||!summary.pending.length;
        lastDetailRows=rows;
        return;
      }
      lastDetailRows=rows;
      ctx.openModal('회신·제출 현황', `<div data-work-detail="${esc(m.id)}"><p class="work-eyebrow">${esc(meta(m))}</p><h3>${esc(title(m))}</h3><div data-work-counts>${counts(m)}</div><p class="muted">PC 저장·읽음·회신 또는 제출 완료는 각각 별도입니다. 재안내할 미완료자를 선택하세요.</p><div class="work-table-scroll"><table class="work-table"><thead><tr><th>선택</th><th>받는 사람</th><th>발송·PC 저장</th><th>읽음 상태</th><th>${label(m)} 상태</th><th>응답 메모</th></tr></thead><tbody>${rows}</tbody></table></div><p id="work-detail-error" class="form-error" role="alert"></p></div>`, button('close-modal', '닫기') + (!ctx.native ? button('work-demo-response', '수신자 체험', 'users', '', `data-id="${esc(m.id)}"`) : '') + button('work-remind', '선택한 미완료자 재안내', 'mail', 'btn-primary', `data-id="${esc(m.id)}" ${canRemind && summary.pending.length ? '' : 'disabled'}`), 'work-modal');
    }
    function response(m, actor = self()) {
      const row = rules.summary(m).rows.find(r => r.id === actor);
      if (!row?.active || m.folder === 'trash' || (ctx.native && (mine(m) || actor !== self()))) {ctx.toast('응답할 수 없습니다', '요청이 회수되었거나 완료 요청 대상이 아닙니다.');return;}
      ctx.openModal(label(m) + ' 완료 알리기', `<div data-work-response="${esc(m.id)}" data-actor="${esc(actor)}"><p class="work-eyebrow">${esc(meta(m))}</p><h3>${esc(title(m))}</h3>${!ctx.native && mine(m) ? `<label>체험할 수신자<select id="work-demo-actor" class="input">${rules.summary(m).rows.filter(r=>r.active).map(r=>`<option value="${esc(r.id)}" ${r.id===actor?'selected':''}>${esc(person(r.id).name)}</option>`).join('')}</select></label>` : ''}<p>완료 여부와 메모가 발신자에게 공유됩니다. 개인 일정의 완료 체크는 바뀌지 않습니다.</p><label for="work-response-note">응답 메모 (선택)</label><textarea id="work-response-note" class="input" rows="3" maxlength="500" placeholder="예: 자료를 답장으로 보냈습니다.">${esc(row.note)}</textarea><p class="muted">자료·첨부파일은 원 메시지의 답장 기능으로 보내 주세요.</p><p id="work-response-error" class="form-error" role="alert"></p></div>`,button('close-modal','취소')+(row.done ? button('work-save-response','미완료로 변경','','', 'data-done="false"') : '')+button('work-save-response',row.done?'완료 내용 저장':label(m)+' 완료 알리기','check','btn-primary','data-done="true"'),'work-response-modal');
    }
    function mountCompose(request, reminderOf) {
      const form = document.getElementById('compose-form');
      if (!form) return;
      const editor = form.querySelector('.compose-editor');
      editor.insertAdjacentHTML('beforebegin', reminderOf ? `<div class="work-compose-options" data-work-reminder="${esc(reminderOf)}"><strong>미완료자 재안내</strong><p>원 요청의 완료 현황을 유지합니다. 보낼 내용을 확인한 후 보내세요.</p></div>` : `<section class="work-compose-options"><label class="work-toggle"><input type="checkbox" id="work-request-enabled" ${request ? 'checked' : ''}> 회신·제출 완료 요청</label><div id="work-request-fields" ${request ? '' : 'hidden'}><label>요청 종류<select id="work-request-kind" class="input"><option value="submission">제출 요청</option><option value="reply" ${request?.kind==='reply'?'selected':''}>회신 요청</option></select></label><label>마감일 (선택)<input id="work-request-due" class="input" type="date" value="${esc(request?.dueDate || '')}"></label><small>받는 사람에게 완료 버튼이 표시됩니다. 참조와 본인은 대상에서 제외됩니다.</small></div></section>`);
    }
    function readCompose(to, cc) {
      if (!document.getElementById('work-request-enabled')?.checked) return null;
      return rules.request({kind:document.getElementById('work-request-kind').value,dueDate:document.getElementById('work-request-due').value},to,cc,self());
    }
    function searchResults() {
      if (searching) return '<p role="status" class="work-empty">검색하고 있습니다…</p>';
      if (searchError) return `<p class="form-error" role="alert">${esc(searchError)}</p>`;
      if (!searchResult) return '<div class="work-empty"><h2>필요한 내용을 한 번에 찾아보세요</h2><p>메시지 본문, 대화, 일정과 첨부파일 이름을 검색합니다.<br>휴지통은 제외하며, 열람할 수 있는 내용만 표시합니다.</p></div>';
      return `<p class="work-result-count" role="status">검색 결과 <strong>${searchResult.total}건</strong> · ${searchResult.total ? searchFilters.offset + 1 : 0}–${Math.min(searchFilters.offset + 50,searchResult.total)}<small>일정은 일정 날짜와 등록자, 메시지·첨부는 발송 날짜와 발신자를 기준으로 검색합니다.</small></p>${searchResult.results.length ? `<div class="work-search-results">${searchResult.results.map((r,i)=>`<button class="work-search-result" data-action="work-search-open" data-index="${i}"><span class="work-result-icon">${icon({mail:'mail',message:'chat',event:'calendar',file:'file'}[r.kind],22)}</span><span class="work-result-content"><small>${esc({mail:'메시지',message:'대화',event:'일정',file:'첨부파일'}[r.kind])} · ${esc(r.context)}</small><strong>${esc(r.title)}</strong><span>${esc(r.text)}</span><small>${esc(r.senderName)} · ${esc(r.date)} ${esc(r.time)}</small></span>${icon('arrow',16)}</button>`).join('')}</div>` : '<div class="work-empty"><h2>검색 결과가 없습니다</h2><p>다른 검색어를 입력하거나 발신자·기간 조건을 넓혀 보세요.</p></div>'}<div class="work-pagination">${button('work-search-prev','이전','left','',searchFilters.offset ? '' : 'disabled')}${button('work-search-next','다음','arrow','',searchResult.hasMore ? '' : 'disabled')}</div>`;
    }
    function searchPage() {
      const f = searchFilters;
      return `<div class="work-page"><div class="work-page-heading"><div><p class="work-eyebrow">흩어진 정보를 한곳에서</p><h1>통합 검색</h1><p class="muted">메시지 · 대화 · 일정 · 첨부파일 이름</p></div><span class="work-key-hint">Ctrl + K</span></div><form id="work-search-form" class="work-search-form"><div class="work-search-box">${icon('search',23)}<input id="work-search-query" type="search" maxlength="150" placeholder="제목, 내용, 파일 이름으로 검색" aria-label="통합 검색어" value="${esc(f.query)}"><button class="btn btn-primary" type="submit">검색</button></div><div class="work-search-filters"><label>유형<select class="input" name="kind">${[['all','전체'],['mail','메시지'],['message','대화'],['event','일정'],['file','첨부파일']].map(([v,n])=>`<option value="${v}" ${f.kind===v?'selected':''}>${n}</option>`).join('')}</select></label><label>발신자 / 등록자<select class="input" name="sender"><option value="">전체</option><option value="me" ${f.sender==='me'?'selected':''}>나</option>${state().data.people.filter(p=>p.id!==self()).map(p=>`<option value="${esc(p.id)}" ${f.sender===p.id?'selected':''}>${esc(p.name)} · ${esc(p.department)}</option>`).join('')}</select></label><label>시작일<input class="input" type="date" name="from" value="${esc(f.from)}"></label><label>종료일<input class="input" type="date" name="until" value="${esc(f.until)}"></label>${button('work-search-reset','초기화')}</div></form><div id="work-search-results">${searchResults()}</div></div>`;
    }
    async function runSearch(offset = 0) {
      const form = document.getElementById('work-search-form');
      if (!form) return;
      const values = {query:form.querySelector('#work-search-query').value,kind:form.elements.kind.value,sender:form.elements.sender.value,from:form.elements.from.value,until:form.elements.until.value};
      if (Object.keys(values).some(key => values[key] !== searchFilters[key])) offset = 0;
      searchFilters = {...values,offset};
      const version = ++searchVersion;
      searching = true; searchError = ''; document.getElementById('work-search-results').innerHTML = searchResults();
      try {
        const filters = rules.filters(searchFilters);
        const result = ctx.native ? await ctx.native.request('/search',filters) : rules.search(state().data,filters,{id:self(),name:state().user});
        if (result.error) throw new Error(result.error);
        if (version !== searchVersion) return;
        searchResult = result;
      } catch (error) {if (version === searchVersion) {searchError=error.message;searchResult=null;}}
      finally {if (version === searchVersion) {searching=false;const target=document.getElementById('work-search-results');if(target)target.innerHTML=searchResults();}}
    }
    async function handleAction(action, target) {
      if (!action.startsWith('work-')) return false;
      const d = target.dataset, mail = state().data.mails.find(m=>m.id===d.id);
      if (action === 'work-scope') {requestScope=d.scope;ctx.renderPage();}
      if (action === 'work-detail') detail(mail);
      if (action === 'work-source') await ctx.openItem('mail',d.id);
      if (action === 'work-respond' && mail) response(mail);
      if (action === 'work-demo-response' && !ctx.native && mail) {const row=rules.summary(mail).rows.find(r=>r.active);if(row)response(mail,row.id);}
      if (action === 'work-remind' && mail && mine(mail)) {
        const pending = rules.summary(mail).pending, selected = [...document.querySelectorAll('[data-work-target]:checked')].map(el=>el.dataset.workTarget).filter(id=>pending.includes(id));
        if (!selected.length) document.getElementById('work-detail-error').textContent='재안내할 미완료자를 선택해 주세요.';
        else {ctx.closeModal();ctx.compose({to:selected,title:'[재안내] '+title(mail),body:`${title(mail)} 관련하여 다시 안내드립니다.\n${mail.workRequest.dueDate ? '마감일: '+mail.workRequest.dueDate+'\n' : ''}\n${label(mail)} 후 원 요청에서 완료를 알려 주세요.\n이미 처리하셨다면 완료 여부를 확인해 주세요.`,workReminderOf:mail.id});}
      }
      if (action === 'work-save-response' && !busy) {
        const form=document.querySelector('[data-work-response]');if(!form)return true;
        busy=true;const id=form.dataset.workResponse,actor=form.dataset.actor,done=d.done==='true',note=document.getElementById('work-response-note').value;
        document.querySelectorAll('[data-action="work-save-response"]').forEach(el=>el.disabled=true);
        try {const result=await ctx.respond(id,actor,done,note);ctx.closeModal();ctx.render();ctx.toast(done?'완료 응답을 저장했습니다':'미완료로 변경했습니다',result?.queued?'이 PC에 발송 대기 중입니다. 연결이 복구되면 자동으로 전송합니다.':'발신자 PC가 접속하면 현황에 반영됩니다.');}
        catch(error) {const errorEl=document.getElementById('work-response-error');if(errorEl)errorEl.textContent=error.message;document.querySelectorAll('[data-action="work-save-response"]').forEach(el=>el.disabled=false);}
        finally {busy=false;}
      }
      if (action === 'work-demo' && !ctx.native) {await ctx.seedDemo();ctx.renderPage();}
      if (action === 'work-search-next') await runSearch(searchFilters.offset+50);
      if (action === 'work-search-prev') await runSearch(Math.max(0,searchFilters.offset-50));
      if (action === 'work-search-reset') {searchVersion++;searching=false;searchFilters={query:'',kind:'all',sender:'',from:'',until:'',offset:0};searchResult=null;searchError='';ctx.renderPage();document.getElementById('work-search-query')?.focus();}
      if (action === 'work-search-open') {const r=searchResult?.results[Number(d.index)];if(r)await ctx.openItem(r.source,r.id,r.room);}
      return true;
    }
    document.addEventListener('submit',event=>{if(event.target.id==='work-search-form'){event.preventDefault();runSearch();}});
    document.addEventListener('change',event=>{
      if(event.target.id==='work-request-enabled')document.getElementById('work-request-fields').hidden=!event.target.checked;
      if(event.target.id==='work-status-filter'){requestStatus=event.target.value;ctx.renderPage();}
      if(event.target.id==='work-demo-actor'){const id=document.querySelector('[data-work-response]').dataset.workResponse;response(state().data.mails.find(m=>m.id===id),event.target.value);}
    });
    document.addEventListener('keydown',event=>{if(state().user&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!document.querySelector('#modal-root').firstChild){event.preventDefault();ctx.navigate('search');}});
    return {mailCard,requestsPage,searchPage,handleAction,mountCompose,readCompose,preserveSearchForm(){
      const form=document.getElementById('work-search-form');
      if(!form)return ()=>{};
      const fields=[...form.querySelectorAll('input,select')].map(el=>({selector:el.id?'#'+el.id:'[name="'+el.name+'"]',value:el.value,focused:el===document.activeElement,start:el.selectionStart,end:el.selectionEnd}));
      return ()=>{const next=document.getElementById('work-search-form');if(!next)return;for(const field of fields){const el=next.querySelector(field.selector);if(!el)continue;el.value=field.value;if(field.focused){el.focus({preventScroll:true});if(field.start!==null&&field.start!==undefined)el.setSelectionRange(field.start,field.end);}}};
    },refreshDetail(){
      const el=document.querySelector('[data-work-detail]');
      if(el)detail(state().data.mails.find(m=>m.id===el.dataset.workDetail),el);
    },clearSearch(){searchVersion++;searchResult=null;searchError='';searching=false;searchFilters={query:'',kind:'all',sender:'',from:'',until:'',offset:0};}};
  }
})();
