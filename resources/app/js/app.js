/* Compact installed messenger; browser mode remains an isolated UI demonstration. */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const icons = {
    users:
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    homeroom: "M10 3a3 3 0 1 0 0 6a3 3 0 0 0 0-6Z M3 21v-5a6 6 0 0 1 12 0v5 M18 10a2 2 0 1 0 0 4a2 2 0 0 0 0-4Z M15 21v-3a3 3 0 0 1 6 0v3",
    chat: "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z",
    mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M22 6l-10 7L2 6",
    calendar:
      "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01",
    bell: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2l2 3 3-.4.6 3.4 2.8 2-2.8 2 .6 3.4-3-.4-2 3-2-3-3 .4-.6-3.4-2.8-2 2.8-2-.6-3.4 3 .4z",
    search: "M21 21l-4.35-4.35 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
    plus: "M12 5v14 M5 12h14",
    minimal: "M4 8h16v8H4z M7 12h10",
    x: "M18 6L6 18 M6 6l12 12",
    left: "M15 18l-6-6 6-6",
    right: "M9 18l6-6-6-6",
    down: "M6 9l6 6 6-6",
    arrow: "M7 17L17 7 M7 7h10v10",
    send: "M22 2L9 15 M22 2l-7 20-6-7-7-6 20-7",
    check: "M20 6L9 17l-5-5",
    school: "M3 10l9-7 9 7 M5 9v12h14V9 M9 21v-7h6v7 M10 8h4",
    leaf: "M20 4c-5-2-13 1-14 7-1 7 5 11 10 7 4-3 3-8 4-14z M5 21L16 10",
    link: "M10 13a5 5 0 0 0 7 .3l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7-.3l-3 3a5 5 0 0 0 7 7l2-2",
    notice: "M3 10v4h4l11 5V5L7 10H3 M7 14l1 7h4l-2-6 M21 9v6",
    star: "M12 3l2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2L3 9.6l6.3-.9L12 3z",
    clip: "M21 11l-8 8a6 6 0 0 1-8-8l9-9a4 4 0 0 1 6 6l-9 9a2 2 0 0 1-3-3l8-8",
    file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z M14 2v6h6 M8 13h8 M8 17h6",
    clock: "M12 8v4l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
    more: "M5 12h.01 M12 12h.01 M19 12h.01",
    menu: "M4 6h16 M4 12h16 M4 18h16",
    heart:
      "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z",
    reply: "M9 10l-5 5 5 5 M4 15h10a6 6 0 0 0 0-12h-3",
    cycle: "M20 11a8.1 8.1 0 0 0-15.5-2 M4 4v5h5 M4 13a8.1 8.1 0 0 0 15.5 2 M20 20v-5h-5",
    trash: "M3 6h18 M9 6V4h6v2 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
    print:
      "M6 9V3h12v6 M6 17H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2 M6 14h12v8H6z",
    download: "M12 3v12 M7 10l5 5 5-5 M5 17v4h14v-4",
    lock: "M7 11V7a5 5 0 0 1 10 0v4 M5 11h14v11H5z",
    briefcase: "M3 7h18v13H3z M8 7V3h8v4 M3 12c5 3 13 3 18 0 M10 13h4v3h-4z",
    checklist: "M9 6h12 M9 12h12 M9 18h12 M3 6h.01 M3 12h.01 M3 18h.01",
    logout: "M9 21H3V3h6 M15 8l4 4-4 4 M7 12h12",
    mute: "M11 5L6 9H3v6h3l5 4V5z M17 9l5 6 M22 9l-5 6",
    sun: "M12 3v1 M12 20v1 M3 12h1 M20 12h1 M5.6 5.6l.7.7 M17.7 17.7l.7.7 M5.6 18.4l.7-.7 M17.7 6.3l.7-.7 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
    moon: "M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10",
    popout: "M14 3h7v7 M21 3l-9 9 M10 3H3v18h18v-7",
    pin: "M9 3h6l-1 6 4 4v2h-5v6h-2v-6H6v-2l4-4-1-6z",
    note: "M4 3h16v14l-5 4H4V3z M15 21v-5h5 M8 7h8 M8 11h6",
  };
  const icon = (name, size = 20) =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name] || icons.file}"/></svg>`;
  const button = (action, label, name = "", cls = "", extra = "") =>
    `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${name ? icon(name, 16) : ""}${esc(label)}</button>`;
  const ib = (action, label, name, extra = "") =>
    `<button type="button" class="icon-btn ${extra.includes("mobile-back") ? "mobile-back" : ""}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra.replace(/class="[^"]*"/g, "")}>${icon(name, 18)}</button>`;
  const uid = (p) =>
    `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const dateKey = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseDate = (s) => new Date(s + "T12:00:00");
  const addDays = (date, n) => {
    const d = parseDate(date);
    d.setDate(d.getDate() + n);
    return dateKey(d);
  };
  const fmtDate = (
    date,
    options = { month: "long", day: "numeric", weekday: "long" },
  ) => parseDate(date).toLocaleDateString("ko-KR", options);
  const currentTime = () =>
    new Date().toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  const weekStart = (date) => {
    const d = parseDate(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return dateKey(d);
  };
  const minutes = (s) => Number(s.split(":")[0]) * 60 + Number(s.split(":")[1]);
  const windowApi = window.dingdongDesktop || null;
  const desktopDemo = windowApi?.mode === "demo";
  const native = desktopDemo ? null : windowApi;
  const params = new URLSearchParams(location.search);
  const requestedWorkspace = params.get("workspace");
  const requestedStaff=requestedWorkspace==="staff";
  let staffStarted=false;
  const requestedChat = params.get("chat");
  const requestedToday=params.get("todayPanel")==="1";
  const requestedCompose=params.get("compose")==="1";
  let mailHeaderObserver=null;
  let composeStarted=false,mailSending=false,eventWindowStarted=false,eventSaving=false,demoRefreshPending=false;
  let mainHostSynced=false,briefingTargetStarted=false,memoBoard=null;
  let network = null;
  let connectionStatus = native ? "서버 연결 필요" : "화면 데모";
  const state = {
    page: requestedChat ? "chat" : ["inbox", "calendar", "announcements", "links", "search", "requests"].includes(requestedWorkspace) ? requestedWorkspace : "people",
    user: null,
    group: "department",
    search: "",
    collapsed: new Set(),
    selected: new Set(),
    room: requestedChat || "r0",
    chatQuery: "",
    chatSearch: false,
    members: false,
    reply: null,
    floating: null,
    folder: "inbox",
    mail: null,
    mailSearch: "",
    mailSearchBy: "name",
    today: Mock.today,
    week: weekStart(Mock.today),
    calendarView: "week",
    expanded: null,
    showToday: false,
    minimal: false,
    mobileList: false,
    settings: {
      calendarPosition: "left",
      showCompletedDeadlines: true,
      orgFont: 14,
      mailFont: 17,
      chatFont: 14,
      autoLogin: false,
      dark: false,
    },
    data: JSON.parse(JSON.stringify(Mock)),
  };
  let storageWorks = true;
  try {
    const saved = JSON.parse(localStorage.getItem(native ? "dingdong-preferences" : "dingdong-v1") || "null");
    if (saved) {
      Object.assign(state.settings, saved.settings);
      if (!native && saved.seedDate === Mock.today && saved.data) state.data = saved.data;
      else if (!native && saved.data) {
        ["rooms", "mails", "events", "notes", "deadlines", "tasks"].forEach(
          (key) => {
            state.data[key].push(
              ...(saved.data[key] || []).filter((item) =>
                item.id.startsWith("user-") || item.id.startsWith("auto-") || item.id.startsWith("duty-") || key==="mails"&&item.category==="homeroom",
              ),
            );
          },
        );
        state.data.rooms.forEach((room) => {
          const old = saved.data.rooms?.find((r) => r.id === room.id);
          if (old) {
            room.messages.push(
              ...old.messages.filter((m) => m.id.startsWith("user-")),
            );
            room.pinned = old.pinned;
            room.muted = old.muted;
          }
        });
        if (saved.data.deadlineDefaultPeriodsChanged!==undefined) state.data.deadlineDefaultPeriodsChanged=saved.data.deadlineDefaultPeriodsChanged;
        if (saved.data.autoDeadlineSources) state.data.autoDeadlineSources=saved.data.autoDeadlineSources;
        if (saved.data.bellSchedules) state.data.bellSchedules=saved.data.bellSchedules;
        if (saved.data.dutySettings) state.data.dutySettings=saved.data.dutySettings;
        if (saved.data.dutyExchanges) state.data.dutyExchanges=saved.data.dutyExchanges;
        if (saved.data.classTeachers) state.data.classTeachers=saved.data.classTeachers;
        if(saved.data.staffDirectoryPeople){state.data.staffDirectoryPeople=saved.data.staffDirectoryPeople;const imported=new Map(saved.data.staffDirectoryPeople.map(p=>[p.id,p]));state.data.people=state.data.people.map(p=>imported.get(p.id)||p).concat(saved.data.staffDirectoryPeople.filter(p=>!state.data.people.some(old=>old.id===p.id)));state.data.departments=[...new Set(state.data.people.map(p=>p.department))];}
        if (saved.data.defaultPeriods) state.data.defaultPeriods=saved.data.defaultPeriods;
        if (saved.data.shortcuts) state.data.shortcuts = saved.data.shortcuts;
      }
      if (!native && saved.settings?.autoLogin) state.user = saved.user || null;
    }
  } catch {
    storageWorks = false;
  }
  if(!native)DingdongHomeroom.seedDemo(state.data,Mock.today);
  if(!native) state.data.people.forEach(p=>{if(p.role==="교직원"){const sample=Mock.people.find(item=>item.id===p.id);if(sample)p.role=sample.role;}});
  function save(onResult) {
    if (!native) {window.DingdongDeadlines.applyDemo(state.data);if(state.data.dutyExchanges?.length)state.data.dutyExchanges=DingdongDutyExchanges.reconcile(state.data.dutyExchanges,exchangeContext());}
    if (native) {
      try { localStorage.setItem("dingdong-preferences", JSON.stringify({ settings: state.settings })); } catch {}
      return network?.active ? network.sync(state.data,onResult) : Promise.resolve(false);
    }
    try { localStorage.setItem("dingdong-v1", JSON.stringify({seedDate:Mock.today,data:state.data,settings:state.settings,user:state.user})); }
    catch { if(storageWorks) toast("저장 공간을 사용할 수 없어요", "저장 공간을 확보한 뒤 다시 시도해 주세요.");storageWorks=false;return Promise.resolve(false); }
    return Promise.resolve(true);
  }
  function acceptServerData(result) {
    const restoreWorkSearch=workUI.preserveSearchForm();
    if(state.profile?.id!==result.user?.id){inlineMailEpoch++;inlineMailCache.clear();inlineMailLoading.clear();inlineMailErrors.clear();}
    const previous=state.data;
    const drafts=$$("[data-chat-input]").map(el=>({room:el.dataset.chatInput,value:el.value}));
    const focus=document.activeElement;
    const focusRoom=focus?.dataset?.chatInput;
    const orgScroll=$("#org-tree")?.scrollTop||0;
    const currentScroll=$("#main-content")?.scrollTop||0;
    const activeProfile=result.user;
    const hadUser=!!state.user;
    state.user=activeProfile.name;state.profile=activeProfile;state.data=result.data;
    DingdongDuties.normalizeTitles(state.data.events);
    Mock.today=state.data.today;
    if(hadUser) {
      for(const event of state.data.events.filter(e=>["makeup","lessonChange"].includes(e.type)&&e.readonly&&!previous.events.some(old=>old.id===e.id))){toast("보강 안내",event.title,"calendar");native.notify("보강 안내 · 캘린더에 등록되었습니다",event.title);}
      const oldMails=new Set(previous.mails.map(m=>m.id));
      const incoming=state.data.mails.filter(m=>m.from!=="me"&&m.folder==="inbox"&&!oldMails.has(m.id));
      for(const mail of incoming){toast("새 메시지 · "+mailSubject(mail),mailSenderName(mail),"message");native.notify("새 메시지가 도착했습니다",mailSubject(mail));}
      for(const room of state.data.rooms){const before=previous.rooms.find(r=>r.id===room.id),oldIds=new Set((before?.messages||[]).map(m=>m.id));const fresh=room.messages.filter(m=>m.sender!=="me"&&!oldIds.has(m.id));if(fresh.length&&!room.muted){toast(room.name,fresh.at(-1).text,"message");native.notify(room.name,fresh.at(-1).text);}}
    }
    render();restoreWorkSearch();refreshHomeroom();refreshDutyDetail();workUI.refreshDetail();notifyPendingReceipts();notifyExchangeUpdates();
    refreshExchangeDialog();
    for(const draft of drafts)$$(`[data-chat-input="${draft.room}"]`).forEach(el=>{el.value=draft.value;el.closest("form").querySelector("button[type=submit]").disabled=!draft.value.trim();});
    if(focusRoom)$(`[data-chat-input="${focusRoom}"]`)?.focus();
    if($("#org-tree"))$("#org-tree").scrollTop=orgScroll;
    if($("#main-content"))$("#main-content").scrollTop=currentScroll;
  }
  let briefingQueued=false;
  function koreanToday(){const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const get=key=>parts.find(p=>p.type===key).value;return `${get("year")}-${get("month")}-${get("day")}`;}
  function maybeShowBriefing(){
    if(!state.user||requestedWorkspace||requestedChat||requestedCompose||requestedToday||briefingQueued)return;
    const key="dingdong-briefing:"+(state.profile?.id||state.user);
    if(sessionStorage.getItem(key))return;
    briefingQueued=true;
    setTimeout(()=>{briefingQueued=false;if(!state.user||$("#modal-root").firstChild)return;sessionStorage.setItem(key,"shown");showBriefing();},0);
  }
  function briefingRow(kind,item,content){
    return '<li><button type="button" class="briefing-entry" data-action="briefing-open" data-kind="'+kind+'" data-item="'+esc(item.id)+'">'+content+'</button></li>';
  }
  function showBriefing(){
    const date=koreanToday(),events=state.data.events.filter(e=>e.date===date).sort((a,b)=>a.start.localeCompare(b.start));
    const deadlines=state.data.deadlines.filter(d=>d.date===date&&!d.done).sort((a,b)=>(a.dueTime||"24:00").localeCompare(b.dueTime||"24:00"));
    const list=(items,emptyText)=>items.length?'<ul>'+items.join("")+'</ul>':'<p class="muted">'+emptyText+'</p>';
    const rows=events.map(event=>{const summary=window.DingdongScheduleSummary.summarize(event,sourceText(event));return briefingRow("event",event,eventMemoIcon(event)+'<strong>'+esc(event.start)+'–'+esc(event.end)+' · '+esc(summary.task)+'</strong><small>'+esc(summary.place)+(summary.preparation!=="별도 안내 없음"?' · '+esc(summary.preparation):'')+'</small>');});
    const body='<article class="today-briefing"><p class="briefing-date">'+esc(fmtDate(date))+'</p><p>오늘의 일정과 마감을 확인하세요.</p><div class="briefing-counts">일정 '+events.length+' · 마감 '+deadlines.length+'</div><h3>오늘의 일정</h3>'+list(rows,"오늘 등록된 일정이 없습니다.")+'<h3>오늘의 마감</h3>'+list(deadlines.map(d=>briefingRow("deadline",d,homeroomDeadlineIcon(d)+'<strong>'+esc(d.dueTime||"오늘까지")+' · '+esc(calendarTitle(d))+'</strong>')),"오늘 남은 마감이 없습니다.")+'</article>';
    openModal("오늘의 브리핑",body,button("close-modal","하루 시작하기","check","btn-primary"),"briefing-modal");
  }
  async function revealBriefingTarget(target){
    if(!state.user||!target)return;
    if(target.kind==='exchange'){
      if(!native)state.exchangeDemoActor=null;
      state.page='calendar';state.calendarView='duty';render();
      if(target.id.startsWith('inbox-'))exchangeListForm();else exchangeDetailForm(target.id);
      return;
    }
    if(target.kind==="mail"){
      const mail=state.data.mails.find(m=>m.id===target.id);
      if(!mail){toast("관련 메시지를 찾을 수 없어요","삭제되거나 회수된 메시지일 수 있습니다.");return;}
      state.page="inbox";state.folder=mail.folder;state.mail=mail.id;state.mailSearch="";state.mailSearchBy="name";mail.unread=false;
      await save();render();$(".mail-workspace")?.classList.add("show-detail");return;
    }
    if(target.kind==="message"){
      let historicalMessage=null;
      let room=state.data.rooms.find(r=>r.messages.some(m=>m.id===target.id));
      if(!room&&native){
        const result=await native.request("/message-source",{id:target.id});
        if(result.error){toast("관련 대화를 찾을 수 없어요",result.error);return;}
        room=state.data.rooms.find(r=>r.id===result.room);
        if(room&&!room.messages.some(m=>m.id===target.id))historicalMessage=result.message;
      }
      if(!room){toast("관련 대화를 찾을 수 없어요","삭제되었거나 참여 중인 대화방이 아닙니다.");return;}
      state.page="chat";state.room=room.id;state.chatQuery="";state.chatSearch=false;state.mobileList=false;room.unread=0;
      await save();
      if(historicalMessage){room=state.data.rooms.find(r=>r.id===room.id);if(room&&!room.messages.some(m=>m.id===target.id))room.messages.unshift(historicalMessage);}
      render();$(".chat-layout")?.classList.add("conversation-open");
      const row=$$('article[data-message]').find(el=>el.dataset.message===target.id);row?.classList.add("briefing-target");row?.setAttribute("tabindex","-1");row?.scrollIntoView({block:"center"});row?.focus({preventScroll:true});return;
    }
    const collection={event:"events",deadline:"deadlines"}[target.kind];
    const item=collection&&state.data[collection].find(item=>item.id===target.id);
    if(!item){toast("항목을 찾을 수 없어요","이미 삭제된 항목입니다.");return;}
    state.page="calendar";state.today=item.date||koreanToday();state.week=weekStart(state.today);monthAnchor=state.today;render();
    if(target.kind==="event")viewEvent(item.id);
    else if(target.kind==="deadline")viewDeadline(item.id);

  }
  async function openBriefingEntry(kind,id){
    const collection={event:"events",deadline:"deadlines"}[kind],item=collection&&state.data[collection].find(item=>item.id===id);
    if(!item)return;
    const source=relatedSource(item);
    let target=source?{kind:source.kind,id:source.id}:{kind,id};
    if(source?.kind==="message"){
      let room=state.data.rooms.find(r=>r.messages.some(m=>m.id===source.id));
      if(!room&&native){const result=await native.request("/message-source",{id:source.id});if(!result.error)room=state.data.rooms.find(r=>r.id===result.room);}
      if(!room){closeModal();toast("관련 대화를 찾을 수 없어요","삭제되었거나 참여 중인 대화방이 아닙니다.");return;}
      target.room=room.id;
    }
    closeModal();
    if(windowApi){
      const result=target.kind==="message"?await windowApi.openChat(target.room,target):await windowApi.openWorkspace(target.kind==="mail"?"inbox":"calendar",target);
      if(result?.error)toast("관련 내용을 열지 못했어요",result.error);
    }else await revealBriefingTarget(target);
  }
  function changePasswordModal(required=false) {
    openModal(required?"임시 비밀번호 변경":"비밀번호 변경", `<form id="password-form" class="event-form"><p class="muted">${required?"처음 로그인할 때는 8자 이상의 새 비밀번호를 설정해 주세요.":"새 비밀번호는 8자 이상이어야 합니다."}</p><label>현재 비밀번호<input class="input" id="current-password" type="password" autocomplete="current-password" required></label><label>새 비밀번호<input class="input" id="new-password" type="password" autocomplete="new-password" minlength="8" maxlength="128" required></label><label>새 비밀번호 확인<input class="input" id="confirm-password" type="password" autocomplete="new-password" required></label><div id="password-error" class="form-error" role="alert"></div></form>`, '<button class="btn btn-primary" type="submit" form="password-form">비밀번호 변경</button>');
    $("#password-form").onsubmit=async e=>{e.preventDefault();if($("#new-password").value!==$("#confirm-password").value){$("#password-error").textContent="새 비밀번호가 일치하지 않습니다.";return;}try{await network.changePassword($("#current-password").value,$("#new-password").value);closeModal();toast("비밀번호를 변경했어요");}catch(error){$("#password-error").textContent=error.message;}};
  }
  if(!native)state.data.people=state.data.people.map(p=>{const example=Mock.people.find(person=>person.id===p.id);return {...p,grade:p.grade??example?.grade??"",otherGroup:p.otherGroup??example?.otherGroup??""};});
  function applySettings() {
    document.documentElement.style.setProperty(
      "--org-font",
      state.settings.orgFont + "px",
    );
    document.documentElement.style.setProperty(
      "--mail-font",
      state.settings.mailFont + "px",
    );
    document.documentElement.style.setProperty(
      "--chat-font",
      state.settings.chatFont + "px",
    );
    document.body.classList.toggle(
      "dark",
      state.settings.dark && state.page === "calendar",
    );
  }
  const mailSenderName=m=>m.announcement?.department||person(m.from).name;
  const mailSubject=m=>m.title?.trim()||m.body?.split("\n").find(line=>line.trim())?.slice(0,45)||"제목 없음";
  const person = (id) =>
    (state.profile?.id===id?state.profile:state.data.people.find((p) => p.id === id)) || {
      id,
      name: id === "me" ? state.user || "교사A" : "교직원",
      department: "교무기획부",
      status: "online",
    };
  const avatar = (p, size = "", i = 0) =>
    `<span class="avatar ${["", "blue", "peach", "purple"][i % 4]} ${size}" aria-hidden="true">${esc(p.name.slice(0, 1))}<i class="status ${p.status || "online"}"></i></span>`;
  const toast = (title, body = "", type = "message") =>
    Notify.create({ title, bodyHtml: esc(body), type });
  const shownReceipts=new Set();let receiptAckBusy=false;
  function showReceiptNotifications(receipts,owner){
    if(windowApi&&!windowApi.mainHost)return;
    for(const receipt of receipts){const key=DingdongMailReceipts.key(receipt,owner);if(shownReceipts.has(key))continue;shownReceipts.add(key);const text=DingdongMailReceipts.message({...receipt,name:receipt.name||person(receipt.recipient).name});toast(text.title,text.body,'readreceipt');windowApi?.notify(text.title,text.body);}
  }
  function notifyPendingReceipts(){
    if(!native||!windowApi.mainHost||!state.profile||briefingQueued||$('.briefing-overlay'))return;
    const owner=state.profile.id,receipts=state.data.readReceipts||[];showReceiptNotifications(receipts,owner);if(!receipts.length||receiptAckBusy)return;
    receiptAckBusy=true;let acknowledged=false;
    Promise.resolve(network.queue).then(async()=>{if(state.profile?.id!==owner)return;const result=await native.request('/sync',{operations:receipts.map(r=>({type:'mail.receipt.ack',id:r.mail,value:{recipient:r.recipient}}))});acknowledged=!result.error;}).catch(()=>{}).finally(()=>{receiptAckBusy=false;if(state.profile&&(acknowledged||state.profile.id!==owner))network.refresh();});
  }
  const unreadMails = () =>
    state.data.mails.filter((m) => m.folder === "inbox" && m.unread).length;
  const unreadChats = () => state.data.rooms.reduce((n, r) => n + r.unread, 0);
  function login() {
    document.body.classList.remove("dark");
    $("#app").innerHTML =
      `<main class="login-page"><section class="login-story"><div class="brand"><span class="brand-symbol"><i></i><i></i></span>띵동</div><div><div class="eyebrow">A LITTLE SPACE, A BETTER SCHOOL</div><h1>선생님의 하루가<br><span>조금 더 가벼워지도록.</span></h1><p>오가는 이야기, 함께하는 일정.<br>우리 학교의 모든 연결을 한곳에 담았어요.</p><div class="art" aria-hidden="true"><div class="art-lines"></div><div class="art-card"><span class="chip">함께하는 이야기</span><b>회의 자료, 확인했어요.</b><p>작은 대화가 모여 더 좋은 학교가 됩니다.</p></div><div class="art-card second"><span class="eyebrow">TODAY'S MOMENT</span><b>15:00 · 교과협의회</b><p>도서관에서 만나요.</p></div></div></div><div class="story-bottom"><span>학교를 잇는 작은 공간, 띵동</span><span>TEACH · CONNECT · GROW</span></div></section><section class="login-area"><form id="login-form" class="login-form"><div class="eyebrow">WELCOME TO DINGDONG</div><h2>반가워요, 선생님.</h2><p>오늘도 함께 만들어 갈 학교의 하루를 시작해요.</p><label for="login-name">이름</label><input id="login-name" class="input" autocomplete="username" placeholder="선생님의 이름을 입력해 주세요" required maxlength="30"><label for="login-password">비밀번호</label><input id="login-password" type="password" class="input" autocomplete="current-password" placeholder="예시 화면에서는 입력하지 않아도 돼요"><div style="display:flex;align-items:center;gap:7px;margin-top:15px;font-size:11px;color:var(--muted)"><input type="checkbox" id="remember-login" ${state.settings.autoLogin ? "checked" : ""}><label for="remember-login" style="margin:0;font-weight:400">다음에도 바로 들어오기 (이 브라우저)</label></div><div id="login-error" class="login-error" role="alert"></div><button class="btn btn-primary" type="submit">띵동 시작하기 ${icon("arrow", 17)}</button>${button("demo-login", "먼저 둘러보기", "users", "demo-btn")}<p class="login-note">교직원용 화면 체험 버전입니다.<br>실제 계정으로 로그인하거나 메시지를 전송하지 않습니다.<br>비밀번호는 저장하지 않습니다.</p></form></section></main>`;
    document.body.classList.add("compact-mode");
    document.body.classList.toggle("installed",!!windowApi);
    $("#app").innerHTML='<div class="desktop-frame no-today"><div class="shell">'+$("#app").innerHTML+'</div></div>';
    $(".login-form").insertAdjacentHTML("afterbegin",'<div class="brand login-brand"><span class="brand-symbol"><i></i><i></i></span>띵동</div>');
    if(native){
      windowApi?.toggleToday(false);
      $("label[for=login-name]").textContent="교직원 아이디";
      $("#login-name").placeholder="관리자가 발급한 아이디";
      $("#login-password").placeholder="비밀번호";$("#login-password").required=true;
      $("[data-action=demo-login]").remove();
      $("#remember-login").checked=false;
      $("label[for=remember-login]").textContent="이 PC에서 자동 로그인";
      $(".login-note").textContent="자동 로그인은 본인 전용 Windows 계정에서 선택하세요. 비밀번호는 저장하지 않습니다.";
      if(network?.waitingForServer)$("#login-error").textContent="자동 로그인 대기 중입니다. 교내 서버에 연결되면 다시 시도합니다.";
      $(".login-note").insertAdjacentHTML("beforebegin",button("privacy-import","기존 PC 보관 파일 가져오기","folder"));
      $("#login-form").insertAdjacentHTML("afterbegin",`<div class="connection-row"><span>${esc(network?.connection?.schoolName||"서버 연결 파일이 필요합니다")}</span>${button("import-server","서버 연결","link")}</div>`);
    }
  }

    
  function render({persist=true}={}) {
    const memoFocus=memoBoard?.focusState();
    if (!native&&persist) save();
    applySettings();
    loadScheduleMemos();
    syncScheduleMemoMetadata();
    document.body.classList.toggle("installed",!!windowApi);
    if(windowApi?.mainHost){
      document.body.classList.add("unified-main","compact-mode");
      document.body.style.setProperty('--wing-width',windowApi.wingWidth+'px');
      if(!mainHostSynced){mainHostSynced=true;windowApi.windowState().then(value=>{state.minimal=!!value.minimal;state.showToday=!!value.today;state.showMemo=!!value.memo;document.body.dataset.hostSide=value.side;document.body.classList.toggle("minimal-main",state.minimal);document.body.classList.toggle('today-expanded',state.showToday);const drawer=$('.today-drawer');if(drawer){drawer.classList.toggle('left',value.side==='left');drawer.classList.toggle('right',value.side==='right');drawer.classList.toggle('open',state.showToday);drawer.inert=!state.showToday;drawer.setAttribute('aria-hidden',String(!state.showToday));}if(state.user)syncMemoPanel();});}
      document.body.classList.toggle("minimal-main",state.minimal);
    }
    if(!state.user){if(state.showMemo){state.showMemo=false;if(windowApi?.mainHost)windowApi.toggleMemo(false);}memoBoard?.mount(null,null);document.body.classList.remove("memo-expanded");if(windowApi?.mainHost&&state.minimal)windowApi.windowAction("restore-main");if(windowApi?.mainHost&&state.showToday){state.showToday=false;windowApi.toggleToday(false,state.settings.calendarPosition);}login();return;}
    if(requestedStaff){document.body.classList.add("staff-window");document.body.classList.remove("compact-mode");$("#app").innerHTML="";if(!staffStarted){staffStarted=true;staffImportForm();}return;}
    if(requestedCompose){
      document.body.classList.add("compose-window");document.body.classList.remove("compact-mode");
      $("#app").innerHTML='<div class="compose-window-background"></div>';
      if(!composeStarted){composeStarted=true;Promise.resolve(windowApi?.composeDraft?.()||{}).then(draft=>composeMail(draft));}
      return;
    }
    if(requestedToday){document.body.classList.add('today-panel-window');document.body.dataset.panelSide=document.body.dataset.panelSide||params.get('side')||'left';$("#app").innerHTML=compactAgenda();syncTimelineResizeTarget();return;}
    const workspace=!!requestedWorkspace||!!requestedChat||!["people","chat"].includes(state.page);
    document.body.classList.toggle("compact-mode",!workspace);
    const labels={people:"교직원",chat:"대화",inbox:"메시지함",calendar:"내 캘린더",announcements:"학교 소식",links:"바로가기",search:"통합 검색",requests:"회신·제출 현황"};
    const nav=[["people","users","조직도"],["inbox","mail","메시지함"],["chat","chat","대화"],["search","search","통합검색"],["calendar","calendar","내 캘린더"],["school-work","checklist","교무업무"],["other-work","briefcase","기타 업무"],["announcements","notice","학교소식"],["links","link","바로가기"]];
    const controls=`<div class="compact-window-controls">${windowApi?ib("window-minimize","최소화","left")+(windowApi.mainHost?ib("window-minimal","미니멀","minimal"):"")+ib("window-close","닫기","x"):workspace?ib("back-main","메신저 본창으로","x"):""}</div>`;
    const header=`<header class="compact-header">${avatar({name:state.user,status:"online"})}<div class="compact-profile"><div class="school-heading"><button class="btn-quiet" data-action="back-main" title="조직도로 돌아가기" style="padding:0;text-align:left"><strong>${esc(state.data.schoolName||"○○고등학교")}</strong></button><span class="school-population" aria-label="전체 ${state.data.people.length}명, 접속 ${state.data.people.filter(p=>p.status==='online').length}명"><span>전체 ${state.data.people.length}</span><span class="population-online">접속 ${state.data.people.filter(p=>p.status==='online').length}</span></span></div><small>${esc(state.user)} · ${esc(state.profile?.department||"교무기획부")}</small></div><button class="icon-btn" data-action="nav-inbox" aria-label="메시지함">${icon("mail",20)}${unreadMails()?`<span class="badge">${unreadMails()}</span>`:""}</button>${ib("nav-chat","대화 목록","chat")}<button class="icon-btn exchange-inbox-button" data-action="exchange-inbox" aria-label="업무 교환 요청함${exchangeCount()?` · ${exchangeCount()}건`:""}" title="업무 교환 요청함">${icon("cycle",20)}${exchangeCount()?`<span class="badge">${exchangeCount()}</span>`:""}</button>${controls}</header>`;
    const rail=`<nav class="rail" aria-label="주 메뉴">${nav.map(([p,i,l])=>`<button class="nav-item ${state.page===p?"active":""}" data-action="nav-${p}" ${state.page===p?'aria-current="page"':''}>${icon(i,23)}<span>${l}</span>${p==="calendar"&&exchangeCount()?`<b class="badge">${exchangeCount()}</b>`:p==="chat"&&unreadChats()?`<b class="badge">${unreadChats()}</b>`:p==="inbox"&&unreadMails()?`<b class="badge">${unreadMails()}</b>`:""}</button>`).join("")}<div class="rail-bottom">${ib("settings","설정","settings")}${ib("logout","로그아웃","logout")}<button class="nav-item" data-action="toggle-today" aria-pressed="${state.showToday}">${icon("calendar",20)}<span>오늘 일정</span></button></div></nav>`;
    const status=`<footer class="connection-status" id="connection-status"><span>${esc(connectionStatus)}</span><span>${native?"교내 서버":"화면 체험"}</span></footer>`;
    $("#app").innerHTML=workspace?`<div class="workspace-frame ${requestedChat?'chat-only':''}"><div class="shell"><div class="workspace"><header class="topbar"><strong>${esc(labels[state.page]||"대화")} · 띵동</strong><div class="top-actions">${button("nav-search","통합 검색","search")}${!windowApi?button("back-main","본창으로","left"):""}${windowApi?ib("window-minimize","최소화","left")+ib("window-maximize","최대화","popout")+ib("window-close","닫기","x"):""}</div></header><main class="page" id="main-content"></main>${status}</div></div></div>`:`<div class="desktop-frame no-today"><div class="shell">${header}<div class="compact-body">${rail}<div class="workspace"><main class="page" id="main-content"></main>${status}</div></div></div>${!windowApi||windowApi.mainHost?`<div class="today-drawer ${(windowApi?.mainHost?document.body.dataset.hostSide:state.settings.calendarPosition)==='right'?'right':'left'} ${state.showToday?'open':''}" aria-hidden="${!state.showToday}" ${state.showToday?'':'inert'}>${compactAgenda()}</div>`:''}</div>`;
    if(windowApi?.mainHost){
      $("#app").insertAdjacentHTML("beforeend",`<aside class="minimal-bar" aria-label="띵동 미니멀 패널"><span class="minimal-grip" title="끌어서 이동" aria-label="끌어서 이동">⠿</span><button type="button" class="minimal-restore" data-action="window-restore-main" aria-label="메신저 본체 펼치기"><span class="minimal-school" title="${esc(state.data.schoolName||"○○고등학교")}">${esc(state.data.schoolName||"○○고등학교")}</span><span class="minimal-count" title="안 읽은 메시지" aria-label="안 읽은 메시지 ${unreadMails()}개">${icon("mail",15)}<b data-minimal-mails>${unreadMails()}</b></span><span class="minimal-count" title="새 대화" aria-label="새 대화 ${unreadChats()}개">${icon("chat",15)}<b data-minimal-chats>${unreadChats()}</b></span></button><div class="minimal-actions">${ib("window-minimize","최소화","left")}${ib("window-close","닫기","x")}</div></aside>`);
    }
    syncMemoPanel();memoBoard?.restoreFocus(memoFocus);
    renderPage();renderFloating();
    maybeShowBriefing();
    if(params.get("source")&&!briefingTargetStarted){briefingTargetStarted=true;queueMicrotask(()=>revealBriefingTarget({kind:params.get("source"),id:params.get("item"),room:requestedChat}).catch(error=>toast("관련 내용을 열지 못했어요",error.message)));}
    if(params.get("eventDraft")==="1"&&!eventWindowStarted&&(!native||network?.active)){eventWindowStarted=true;windowApi.composeDraft().then(draft=>draft.memoId?memoScheduleForm(draft):eventForm(draft));}

  }
  function memoTab(){return `<button type="button" class="memo-tab" data-action="toggle-memo" aria-label="개인 메모장" aria-expanded="${!!state.showMemo}" aria-controls="memo-panel" title="개인 메모장">${icon('note',15)}<span>메모</span></button>`;}
  function syncMemoPanel(){
    const host=$('.desktop-frame');if(!host||!state.user||windowApi&&!windowApi.mainHost){memoBoard?.mount(null,null);return;}
    if(!memoBoard)memoBoard=new DingdongStickyNotes.Board({onClose:()=>toggleMemo(false),onSchedule:openMemoSchedule,onScheduleInfo:memoScheduleInfo,onScheduleSave:saveMemoSchedule,onMail:openHomeroomSource,onHomeroom:openHomeroomFromMemo,hasSchedule:note=>!!calendarMemoItem(note.schedule?.id||'user-memo-'+note.id),tabHTML:memoTab()});
    memoBoard.mount(host,native?'account:'+state.profile.id:'demo:'+state.user);memoBoard.setOpen(!!state.showMemo);
    document.body.classList.toggle('memo-expanded',!!state.showMemo);$$('[data-action="toggle-memo"]').forEach(el=>el.setAttribute('aria-expanded',String(!!state.showMemo)));
  }
  async function toggleMemo(open=!state.showMemo){
    if(windowApi?.toggleMemo){const result=await windowApi.toggleMemo(open);if(result.error)toast('메모장을 열지 못했어요',result.error);return;}
    state.showMemo=open;
    syncMemoPanel();
  }
  function homeroomMemoStore(){return new DingdongStickyNotes.Store(localStorage,native?'account:'+state.profile.id:'demo:'+state.user);}
  function homeroomMemo(id){try{return homeroomMemoStore().load().notes.find(n=>n.mail?.id===id);}catch{return null;}}
  function openHomeroomFromMemo(mail){
    const date=DingdongHomeroom.validDay(mail.viewDate)?mail.viewDate:DingdongHomeroom.validDay(mail.date)?mail.date:koreanToday();
    homeroomModal({date});requestAnimationFrame(()=>{const entry=$$('#homeroom-feed [data-homeroom-mail]').find(el=>el.dataset.homeroomMail===mail.id);entry?.scrollIntoView({block:'nearest'});});
  }
  async function openHomeroomSource(id){closeModal();if(windowApi)await windowApi.openWorkspace('inbox',{kind:'mail',id});else await revealBriefingTarget({kind:'mail',id});}
  async function openHomeroomMemo(id,date=homeroomModalDate){
    if(windowApi&&!windowApi.mainHost){const result=await windowApi.openHomeroomMemo({id,date});if(result.error)toast('메모를 열지 못했어요',result.error);return;}
    if(!DingdongHomeroom.validDay(date))return;
    if(native)await network?.refresh();
    const mail=homeroomEntries(date).find(m=>m.id===id);if(!mail)return;
    try{const memoId=homeroomMemoStore().setMail({id:mail.id,title:DingdongHomeroom.preview(mail).title.slice(0,200),from:mailSenderName(mail).slice(0,200),date:mail.date,time:mail.time||'',viewDate:date});closeModal();await toggleMemo(true);state.showMemo=true;syncMemoPanel();memoBoard.openEditor(memoId);}
    catch(error){toast('메모를 열지 못했어요',error.message);}
  }
  let homeroomCardDate=koreanToday(),homeroomModalDate=koreanToday();
  function homeroomEntries(date=homeroomModalDate){const ids=native?[state.profile?.id]:['me',demoCalendarPerson()?.id].filter(Boolean);return DingdongHomeroom.dailyEntries(state.data.mails,ids,date);}
  function homeroomNavigation(date,scope){return `<div class="homeroom-date-nav">${ib('homeroom-prev','이전 날짜의 담임 업무','left',`data-scope="${scope}"`)}<strong>${esc(fmtDate(date,{year:'numeric',month:'long',day:'numeric',weekday:'short'}))}</strong>${ib('homeroom-next','다음 날짜의 담임 업무','right',`data-scope="${scope}"`)}${button('homeroom-today','오늘','','',`data-scope="${scope}"`)}</div>`;}
  function homeroomItems(date){
    const entries=homeroomEntries(date);
    return entries.length?entries.map(m=>{const preview=DingdongHomeroom.preview(m),attrs=`data-mail="${esc(m.id)}" data-date="${date}"`,carried=(m.homeroomDays||[]).some(d=>d.date===DingdongHomeroom.nextDay(date));return `<article class="homeroom-entry" data-homeroom-mail="${esc(m.id)}" data-homeroom-date="${date}"><header><strong>${esc(mailSenderName(m))}</strong>${button('homeroom-source','관련 메시지 보기','mail','',attrs)}<time>${esc(m.date)} ${esc(m.time||'')}</time>${button('homeroom-pin',state.data.deadlines.some(d=>d.homeroomMail===m.id)?'고정됨':'고정','pin','homeroom-pin',`${attrs} aria-pressed="${state.data.deadlines.some(d=>d.homeroomMail===m.id)}" title="완료 확인에 고정하거나 해제"`)}${button('homeroom-memo',homeroomMemo(m.id)?'메모 보기':'메모하기','note','',attrs)}${button('homeroom-defer',carried?'이월됨':'내일로','right','homeroom-defer',`${attrs} ${carried?'disabled':''}`)}<button type="button" class="icon-btn homeroom-dismiss" data-action="homeroom-dismiss" ${attrs} aria-label="이 날짜의 담임 업무에서 삭제" title="이 날짜의 담임 업무에서 삭제">${icon('x',16)}</button></header>${m.homeroomCarriedFrom?`<p class="homeroom-carried">${esc(fmtDate(m.homeroomCarriedFrom,{month:'numeric',day:'numeric'}))}에서 이월</p>`:''}<h3>${esc(preview.title)}</h3><div class="homeroom-content">${esc(preview.body)}</div></article>`;}).join(''):'<div class="empty"><p>이 날짜의 담임 업무가 없습니다.</p></div>';
  }
  function homeroomModal(options={}){
    if(options.date)homeroomModalDate=options.date;
    if($('#homeroom-feed'))refreshHomeroom();
    else openModal('담임 업무',homeroomNavigation(homeroomModalDate,'modal')+`<div id="homeroom-feed" data-homeroom-date="${homeroomModalDate}">${homeroomItems(homeroomModalDate)}</div>`,button('close-modal','닫기'),'wide homeroom-modal');
    requestAnimationFrame(()=>{const body=$('.homeroom-modal .modal-body');if(body)body.scrollTop=options.scroll??0;});
  }
  function homeroomCard(){return `<section class="panel homeroom-card" id="homeroom-card" aria-label="날짜별 담임 업무"><div class="panel-head"><h2>담임 업무</h2><small>${homeroomEntries(homeroomCardDate).length}건</small></div>${homeroomNavigation(homeroomCardDate,'card')}<div class="homeroom-card-body" data-homeroom-date="${homeroomCardDate}">${homeroomItems(homeroomCardDate)}</div></section>`;}
  function refreshHomeroom(){
    const feed=$('#homeroom-feed');
    if(feed){
      const modal=feed.closest('.homeroom-modal'),body=modal.querySelector('.modal-body'),scroll=body.scrollTop;
      // Keep the open dialog in place while entries are dismissed or refreshed.
      if(!modal.style.height)modal.style.height=modal.getBoundingClientRect().height+'px';
      body.querySelector('.homeroom-date-nav').outerHTML=homeroomNavigation(homeroomModalDate,'modal');
      feed.dataset.homeroomDate=homeroomModalDate;feed.innerHTML=homeroomItems(homeroomModalDate);
      body.scrollTop=scroll;
    }
    const card=$('#homeroom-card');if(card){const scroll=card.querySelector('.homeroom-card-body').scrollTop;card.outerHTML=homeroomCard();$('#homeroom-card .homeroom-card-body').scrollTop=scroll;}
  }
  function compactAgendaList() {
    const events=state.data.events.filter(e=>e.date===state.today).sort((a,b)=>a.start.localeCompare(b.start));
    const deadlines=state.data.deadlines.filter(d=>d.date===state.today).sort((a,b)=>(a.dueTime||"24:00").localeCompare(b.dueTime||"24:00"));
    return `<aside class="compact-today agenda-list-panel" aria-label="오늘 일정 목록"><header class="agenda-header"><div><h2>${ib("today-prev","이전 날짜","left")}${fmtDate(state.today,{month:"long",day:"numeric",weekday:"short"})}${ib("today-next","다음 날짜","right")}</h2><small>오늘의 일정 · 목록</small></div>${button("add-event","일정 추가","plus")}</header><div class="agenda-list" role="list">${deadlines.map(d=>`<div class="agenda-list-row ${d.done?"done":""}" role="listitem"><input type="checkbox" data-deadline="${d.id}" aria-label="${esc(calendarTitle(d))} 완료" ${d.done?"checked":""}><button data-action="deadline-detail" data-deadline="${d.id}"><span class="agenda-list-time">${d.dueTime?esc(d.dueTime)+"까지":"오늘 마감"}</span><strong>${homeroomDeadlineIcon(d)}${eventMemoIcon(d)}${esc(calendarTitle(d))}</strong><small>완료 확인${d.done?" · 완료":""}</small></button></div>`).join("")}${events.map(e=>`<div class="agenda-list-row" role="listitem"><button data-action="view-event" data-event="${e.id}"><span class="agenda-list-time">${esc(e.start)}–${esc(e.end)}</span><strong>${eventMemoIcon(e)}${esc(calendarTitle(e))}</strong><small>${esc(e.place || typeLabel(e.type))}</small></button></div>`).join("")}${!events.length&&!deadlines.length?'<p class="agenda-list-empty">이날 등록된 일정이 없어요.</p>':""}</div></aside>`;
  }
  let timelineResizeTarget=null;
  function syncTimelineResizeTarget(){
    const blocks=$$('[data-calendar-timeline] .event');
    const item=state.data.events.find(event=>event.id===timelineResizeTarget);
    if(!item||!canMoveEvent(item)||!blocks.some(block=>block.dataset.event===timelineResizeTarget))timelineResizeTarget=null;
    blocks.forEach(block=>block.classList.toggle('resize-target',block.dataset.event===timelineResizeTarget));
  }
  function setTimelineResizeTarget(id){timelineResizeTarget=id;syncTimelineResizeTarget();}
  function canMoveEvent(event){if(event.duty)return false;return !event.noticeMail&&!['makeup','lessonChange'].includes(event.type)&&(!event.readonly||event.canReschedule);}
  function eventHandles(event){return canMoveEvent(event)?'<span class="event-resize top" data-resize="start" title="시작 시간 조절"></span><span class="event-resize bottom" data-resize="end" title="종료 시간 조절"></span>':'';}
  function timelineRange(days,minimumEnd=1080){
    const events=state.data.events.filter(e=>days.includes(e.date)),points=state.data.deadlines.filter(d=>d.source&&d.dueTime&&days.includes(d.date));
    const start=Math.max(0,Math.min(480,...events.map(e=>Math.floor(minutes(e.start)/60)*60),...points.map(d=>Math.floor(minutes(d.dueTime)/60)*60)));
    const end=Math.min(1440,Math.max(minimumEnd,...events.map(e=>Math.ceil(minutes(e.end)/60)*60),...points.map(d=>(Math.floor(minutes(d.dueTime)/60)+1)*60)));
    return {start,end,hours:(end-start)/60};
  }
  const calendarTitle=item=>window.DingdongScheduleSummary.calendarTitle(item);
  function timelineSlots(date,scale){
    const entries=[...state.data.events.filter(e=>e.date===date).map(e=>({key:'event:'+e.id,start:minutes(e.start),end:Math.max(minutes(e.end),minutes(e.start)+14/scale)})),...state.data.deadlines.filter(d=>d.source&&d.date===date&&d.dueTime).map(d=>({key:'deadline:'+d.id,start:minutes(d.dueTime),end:minutes(d.dueTime)+28/scale}))].sort((a,b)=>a.start-b.start||b.end-a.end||a.key.localeCompare(b.key));
    const result=new Map();let group=[],end=-1;
    const place=()=>{const lanes=[];for(const item of group){let slot=0;while(lanes[slot]>item.start)slot++;lanes[slot]=item.end;result.set(item.key,{slot});}for(const item of group)result.get(item.key).count=lanes.length;};
    for(const item of entries){if(item.start>=end){place();group=[];end=-1;}group.push(item);end=Math.max(end,item.end);}place();return result;
  }
  function timelinePoints(date,start,scale){
    const points=state.data.deadlines.filter(d=>d.source&&d.date===date&&d.dueTime),layouts=timelineSlots(date,scale);
    return points.map(d=>{const {slot,count}=layouts.get('deadline:'+d.id);return `<button class="timeline-point ${slot<count-1?'timeline-divider':''} ${d.done?'done':''}" data-action="deadline-detail" data-deadline="${d.id}" data-time="${esc(d.dueTime)}" style="top:${(minutes(d.dueTime)-start)*scale}px;left:calc(${slot*100/count}% + 4px);width:calc(${100/count}% - 8px)" title="${esc(calendarTitle(d))} · ${esc(fmtDate(d.date))} · ${esc(d.dueTime)}"><strong>${homeroomDeadlineIcon(d)}${eventMemoIcon(d)}${esc(d.dueTime)} · ${esc(calendarTitle(d))}</strong></button>`;}).join('');
  }

  function compactAgenda() {
    const events=state.data.events.filter(e=>e.date===state.today).sort((a,b)=>a.start.localeCompare(b.start));
    const listedDeadlines=state.data.deadlines.filter(d=>state.settings.showCompletedDeadlines||!d.done).sort((a,b)=>a.date.localeCompare(b.date)||(a.dueTime||"24:00").localeCompare(b.dueTime||"24:00")),extracted=state.data.deadlines.filter(d=>d.source&&d.date===state.today);
    const academic=state.data.academic.filter(item=>item.date===state.today),layouts=timelineSlots(state.today,56/60);
    const range=timelineRange([state.today]),position=(minutes(new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit"}))-range.start)*56/60;
    return `<aside class="compact-today"><header class="agenda-header"><div><h2>${ib("today-prev","이전 날짜","left")}${fmtDate(state.today,{month:"long",day:"numeric",weekday:"short"})}${state.today!==Mock.today?button("today-reset","오늘로","","agenda-today-reset"):""}${ib("today-next","다음 날짜","right")}</h2><small>오늘의 일정</small></div>${ib("toggle-today","오늘 일정 닫기","x")}</header><section class="agenda-deadlines"><div class="deadline-section-head"><h3>완료 확인</h3><label class="completed-option"><input type="checkbox" data-show-completed-deadlines ${state.settings.showCompletedDeadlines?"checked":""}> 완료한 일 표시</label></div>${listedDeadlines.length?listedDeadlines.map(d=>{const diff=Math.round((parseDate(d.date)-parseDate(Mock.today))/86400000);return `<div class="task-row"><input type="checkbox" data-deadline="${d.id}" aria-label="${esc(calendarTitle(d))} 완료" ${d.done?'checked':''}><button class="deadline-content ${d.done?'done':''}" data-action="deadline-detail" data-deadline="${d.id}" title="마감 상세 보기">${homeroomDeadlineIcon(d)}${eventMemoIcon(d)}${esc(calendarTitle(d))}<small> · ${esc(fmtDate(d.date,{month:"numeric",day:"numeric"}))}${d.dueTime?` · ${esc(d.dueTime)}까지`:""}</small></button><span class="due">${d.done?'완료':diff<0?'기한 지남':diff===0?'D-Day':'D-'+diff}</span></div>`}).join(""):`<p class="muted">${state.settings.showCompletedDeadlines?'등록된':'미완료'} 완료 확인이 없어요.</p>`}</section><section class="agenda-academic" aria-label="학사일정"><h3>학사일정</h3>${academic.length?academic.map(item=>`<p>${esc(item.title)}</p>`).join(""):'<p class="muted">등록된 학사일정이 없습니다.</p>'}</section><section class="agenda-body"><h3>내 일정 ${events.length+extracted.length?'· '+(events.length+extracted.length):''}</h3><div class="agenda-timeline"><div class="agenda-hours">${Array.from({length:range.hours},(_,i)=>`<div class="agenda-hour">${String(i+range.start/60).padStart(2,'0')}</div>`).join("")}</div><div class="agenda-grid" style="height:${range.hours*56}px" data-timeline-start="${range.start}" data-timeline-end="${range.end}" data-calendar-timeline="${state.today}" aria-label="오늘 일정 시간대 드래그 선택">${events.map((e,i)=>{const {count:n,slot}=layouts.get('event:'+e.id);return `<button class="event ${e.type} ${slot<n-1?"timeline-divider":""} ${isPrivateEvent(e)?"private-schedule":""} ${canMoveEvent(e)?"movable":""} ${minutes(e.end)-minutes(e.start)<30?"short":""}" data-action="view-event" data-event="${e.id}" title="${esc(calendarTitle(e))} · ${esc(fmtDate(e.date))} · ${e.start}–${e.end}" style="top:${(minutes(e.start)-range.start)*56/60}px;height:${Math.max(14,(minutes(e.end)-minutes(e.start))*56/60)}px;left:calc(${slot*100/n}% + 4px);width:calc(${100/n}% - 8px);right:auto"><strong>${eventMemoIcon(e)}${esc(calendarTitle(e))}</strong><small>${e.start}–${e.end}</small><small>${esc(e.place)}</small>${eventHandles(e)}</button>`}).join("")}${timelinePoints(state.today,range.start,56/60)}${state.today===Mock.today&&position>=0&&position<=range.hours*56?`<div class="now-line" style="top:${position}px"></div>`:""}</div></div></section><footer class="agenda-footer">${button("add-personal-event","내 일정 등록","calendar")+button("homeroom-work","담임 업무","users")}</footer></aside>`;
  }
  function heading(eyebrow, title, desc, actions = "") {
    return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1><p>${esc(desc)}</p></div><div class="heading-actions">${actions}</div></div>`;
  }
  function renderPage() {
    mailHeaderObserver?.disconnect();
    const fn = {
      people: peoplePage,
      chat: chatPage,
      inbox: inboxPage,
      calendar: calendarPage,
      announcements: announcementsPage,
      links: linksPage,
      search: () => workUI.searchPage(),
      requests: () => workUI.requestsPage(),
    }[state.page];
    $("#main-content").innerHTML = fn();
    if (state.page === "chat") scrollMessages($("#main-content"));
    if (state.page === "inbox") initMailResize();
    const drawer=$(".today-drawer");
    if(drawer){const scroll=$(".agenda-body",drawer)?.scrollTop||0;drawer.innerHTML=compactAgenda();$(".agenda-body",drawer).scrollTop=scroll;}
    syncTimelineResizeTarget();
  }
  function peoplePage() {
    return (
      heading(
        "OUR SCHOOL, OUR PEOPLE",
        "함께하는 선생님들",
        "필요한 순간, 가까이 있는 동료와 이야기를 나눠요.",
        button(
          "toggle-today",
          state.showToday ? "오늘 일정 접기" : "오늘 일정 보기",
          "calendar",
        ) + button("compose-mail", "메시지 쓰기", "plus", "btn-primary"),
      ) +
      `<div class="people-layout"><section class="panel people-panel"><div class="panel-head"><h2>${icon("users", 18)}교직원 조직도 </h2><div class="segmented org-group-tabs" aria-label="조직도 분류">${[
        ["department", "부서별"],
        ["subject", "교과별"],
        ["grade", "학년별"],
        ["otherGroup", "기타"],
      ]
        .map(
          ([g, l]) =>
            `<button class="${state.group === g ? "active" : ""}" data-action="group" data-group="${g}" aria-pressed="${state.group === g}">${l}</button>`,
        )
        .join(
          "",
        )}</div></div><div class="search">${icon("search", 17)}<input class="input" id="people-search" aria-label="교직원 검색" placeholder="이름, 부서, 교과, 학년, 기타 그룹 검색" value="${esc(state.search)}"></div><div class="school-tools"><small class="muted">v0.2.122</small></div><div class="people-summary"><label class="select-label"><input id="select-all" type="checkbox" ${state.selected.size === state.data.people.length ? "checked" : ""}>전체 선택</label><span id="selected-count">${state.selected.size ? state.selected.size + "명 선택" : "이름을 더블클릭해 메시지를 보내세요"}</span></div><div class="org-tree" id="org-tree">${orgTree()}</div></section><aside class="side-stack">${todayPanel()}<div class="quiet-card">${icon("leaf", 28)}<div><strong style="font-size:12px">오늘도, 서로에게 든든한 동료.</strong><p>작은 인사가 하루를 바꿔요.</p></div></div><div class="welcome-strip">TEACH · CONNECT · GROW</div></aside></div>`
    );
  }
  const groupLabel=p=>String(p[state.group]||"").trim()||({grade:"학년 미지정",otherGroup:"기타 미지정"}[state.group]||"미지정");
  const matchesPersonSearch=p=>[p.name,p.department,p.subject,p.extension,p.position,p.grade,p.classNumber,p.work,p.specialRoom,p.club,p.otherGroup].filter(v=>v!=null).join(" ").toLowerCase().includes(state.search.toLowerCase());
  function orgTree() {
    const filtered = state.data.people.filter(matchesPersonSearch);
    const groups = [...new Set(filtered.map(groupLabel))];
    if (!groups.length)
      return empty(
        "검색 결과가 없어요",
        "다른 이름이나 부서로 검색해 보세요.",
        "search",
      );
    return groups
      .map((g, gi) => {
        const people = filtered.filter((p) => groupLabel(p) === g),
          closed = state.collapsed.has(state.group+":"+g) && !state.search;
        return `<section><div class="dept-head"><input type="checkbox" data-dept-select="${esc(g)}" aria-label="${esc(g)} 전체 선택" ${people.every((p) => state.selected.has(p.id)) ? "checked" : ""}><button class="dept-toggle" data-action="dept-toggle" data-dept="${esc(g)}" aria-expanded="${!closed}">${icon(closed ? "right" : "down", 13)}${esc(g)}<small>${people.length}</small></button></div>${!closed ? `<div class="org-members" role="group" aria-label="${esc(g)} 소속 교직원">${people.map((p, i) => personRow(p, gi + i)).join("")}</div>` : ""}</section>`;
      })
      .join("");
  }
  function personRow(p) {
    const presence=p.status==='online'?'online':['away','busy'].includes(p.status)?'away':'offline';
    const label={online:'접속 중',away:'부재 중',offline:'미접속 중'}[presence];

    const marker=presence==='online'?'<path d="m14.5 17 2.2 2.2 4-4"/>':presence==='away'?'<circle cx="18" cy="17" r="3.2"/><path d="M18 14.8V17l1.5 1"/>':'<path d="M15.5 17h5"/>';
    const presenceIcon=`<svg class="presence-image" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="5.5" r="4" fill="currentColor"/><path d="M1.5 20v-3.5a7.5 7.5 0 0 1 15 0V20Z" fill="currentColor"/><circle cx="18" cy="17" r="5.2" fill="currentColor" stroke="white" stroke-width="1.1"/><g fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${marker}</g></svg>`;
    const organization=p.department||'조직 미지정',extension=p.extension||'미등록';
    return `<div class="person" data-person="${p.id}"><input type="checkbox" aria-label="${esc(p.name)} 선택" data-person-check="${p.id}" ${state.selected.has(p.id) ? "checked" : ""}><span class="person-presence ${presence}" role="img" aria-label="${label}" title="${label}">${presenceIcon}</span><div class="person-main"><button class="btn-quiet person-line" data-action="person-select" data-person="${p.id}" title="${esc(p.name)} · ${esc(organization)} · 내선 ${esc(extension)} · ${label}"><strong>${esc(p.name)}</strong><span class="person-organization">${esc(organization)}</span><span class="person-extension">내선 ${esc(extension)}</span></button></div></div>`;
  }
  function statusLabel(s) {
    return (
      { online: "온라인", away: "자리비움", busy: "바쁨", offline: "오프라인" }[
        s
      ] || "온라인"
    );
  }
  function todayPanel() {
    const events = state.data.events
      .filter((e) => e.date === state.today)
      .sort((a, b) => a.start.localeCompare(b.start));
    return `<section class="today-hero"><div class="today-date"><div class="eyebrow">A DAY AT A GLANCE</div><div>${ib("today-prev", "이전 날짜", "left")}${ib("today-next", "다음 날짜", "right")}</div></div><h2>${fmtDate(state.today, { month: "long", day: "numeric" })}<span style="font-size:12px;font-weight:400;margin-left:8px">${fmtDate(state.today, { weekday: "long" })}</span></h2><p>${state.today === Mock.today ? "오늘의 작은 계획, 여유 있는 하루." : "이날의 일정을 미리 살펴보세요."}</p>${state.today !== Mock.today ? button("today-reset", "오늘로", "", "btn-quiet") : ""}${icon("leaf", 65).replace("<svg", '<svg class="leaf"')}</section><section class="panel"><div class="panel-head"><h2>오늘의 일정 <small>${events.length}</small></h2>${ib("add-event", "일정 추가", "plus")}</div>${state.data.academic
      .filter((a) => a.date === state.today)
      .map(
        (a) =>
          `<div class="academic-label">${icon("calendar", 14)}${esc(a.title)}</div>`,
      )
      .join(
        "",
      )}<div class="timeline">${events.length ? events.map((e) => `<div class="timeline-item"><time class="timeline-time">${e.start}</time><div class="timeline-card ${e.type} ${isPrivateEvent(e)?"private-schedule":""}"><button class="btn-quiet" style="padding:0;border:0;text-align:left;color:inherit" data-action="view-event" data-event="${e.id}"><strong>${eventMemoIcon(e)}${esc(calendarTitle(e))}</strong><small>${esc(e.place || "장소 미정")} · ${e.start}–${e.end}</small></button><span class="chip ${e.type === "personal" ? "" : e.type === "repeat" ? "orange" : "blue"}">${typeLabel(e.type)}</span></div></div>`).join("") : `<div class="empty" style="padding:24px 5px">${icon("sun", 26)}<p>등록된 일정이 없어요.<br>여유로운 하루를 계획해 보세요.</p></div>`}</div>${button("nav-calendar", "전체 일정 보기", "arrow", "panel-foot")}</section>`;
  }
  function isPrivateEvent(event) {return !!event&&event.type==="personal"&&!event.source&&!event.noticeMail&&!event.targets?.length;}
  let scheduleMemoNotes=new Map(),scheduleMemoStore=null;
  function loadScheduleMemos(){
    const user=state.user&&(native?state.profile?.id&&'account:'+state.profile.id:'demo:'+state.user);
    scheduleMemoStore=user?new DingdongStickyNotes.Store(localStorage,user):null;
    try{scheduleMemoNotes=new Map((scheduleMemoStore?.load().notes||[]).filter(n=>n.schedule).map(n=>[n.schedule.id,n]));}catch{scheduleMemoNotes=new Map();}
  }
  function scheduleMemoDirectionIcons(id){
    const directions=[];
    if(id.startsWith('user-memo-'))directions.push('in');
    if(scheduleMemoNotes.get(id)?.text.trim())directions.push('out');
    return directions.map(direction=>`<svg data-memo-direction="${direction}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M7 13h3M7 17h7"/><path d="${direction==='in'?'M22 2 12 12M12 6v6h6':'M12 12 22 2M16 2h6v6'}"/></svg>`).join('');
  }
  function homeroomDeadlineIcon(item){return item.homeroomMail?`<span class="homeroom-deadline-mark" role="img" aria-label="담임 업무" title="담임 업무">${icon('homeroom',14)}</span>`:'';}
  function eventMemoIcon(event){const marks=scheduleMemoDirectionIcons(event.id);return `<span class="calendar-note-mark" data-event-note-mark="${esc(event.id)}" aria-hidden="true" ${marks?'':'hidden'}>${marks}</span>`;}
  const calendarMemoItem=id=>calendarEvent(id)||state.data.deadlines.find(d=>d.id===id);
  function scheduleMetadata(event){const deadline=state.data.deadlines.some(d=>d.id===event.id);return {id:event.id,title:calendarTitle(event).slice(0,200),date:event.date,start:deadline?event.dueTime||'00:00':event.start,end:deadline?event.dueTime||'00:00':event.end,...(deadline?{kind:'deadline',dueTime:event.dueTime||''}:{})};}
  function syncScheduleMemoMetadata(){
    if(!scheduleMemoStore||!scheduleMemoNotes.size)return;
    try{const data=scheduleMemoStore.load();let changed=false;for(const note of data.notes){if(!note.schedule)continue;const event=calendarMemoItem(note.schedule.id);if(!event)continue;const metadata=scheduleMetadata(event);if(JSON.stringify(note.schedule)!==JSON.stringify(metadata)){note.schedule=metadata;changed=true;}}if(changed){scheduleMemoStore.save(data);loadScheduleMemos();}}catch{}
  }
  function personalMemoSection(event){const note=scheduleMemoNotes.get(event.id);return `<section class="schedule-personal-memo" data-personal-memo="${esc(event.id)}" ${note?.text.trim()?'':'hidden'}><h3>나의 메모</h3><p class="schedule-memo-content">${esc(note?.text||'')}</p></section>`;}
  function refreshScheduleMemoIcons(){
    loadScheduleMemos();
    $$('[data-event-note-mark]').forEach(el=>{const marks=scheduleMemoDirectionIcons(el.dataset.eventNoteMark);el.hidden=!marks;if(el.innerHTML!==marks)el.innerHTML=marks;});
    $$('[data-personal-memo]').forEach(el=>{const note=scheduleMemoNotes.get(el.dataset.personalMemo);if(!el.querySelector('form')){el.hidden=!note?.text.trim();el.querySelector('.schedule-memo-content').textContent=note?.text||'';}});
  }
  function editScheduleMemo(id){
    const event=calendarMemoItem(id),section=$$('[data-personal-memo]').find(el=>el.dataset.personalMemo===id);if(!event||!section)return;
    if(section.querySelector('form')){$('#schedule-memo-text').focus();return;}
    loadScheduleMemos();const text=scheduleMemoNotes.get(id)?.text||'';
    section.hidden=false;section.innerHTML=`<form id="schedule-memo-form"><label>나의 메모<textarea class="input" id="schedule-memo-text" rows="5" maxlength="4000" placeholder="이 일정에 필요한 내용을 기록하세요.">${esc(text)}</textarea></label><p class="form-error" role="alert" id="schedule-memo-error"></p><div class="schedule-memo-actions"><button type="button" class="btn" id="schedule-memo-cancel">취소</button><button type="submit" class="btn btn-primary">메모 저장</button></div></form>`;
    const restore=()=>{section.outerHTML=personalMemoSection(event);};
    $('#schedule-memo-cancel').onclick=restore;
    $('#schedule-memo-form').onsubmit=e=>{e.preventDefault();try{scheduleMemoStore.setSchedule(scheduleMetadata(calendarMemoItem(id)||event),$('#schedule-memo-text').value);loadScheduleMemos();restore();refreshScheduleMemoIcons();}catch(error){$('#schedule-memo-error').textContent='메모를 저장하지 못했습니다. '+error.message;}};
    $('#schedule-memo-text').focus();
  }
  function typeLabel(t) {
    return (
      {
        personal: "개인 일정",
        group: "단체 일정",
        repeat: "정기 업무",
        makeup: "보강 안내",
        lessonChange:"수업 변경 안내",
        note: "메모",
        deadline: "완료 확인",
      }[t] || t
    );
  }
  function empty(title, body, name = "chat") {
    return `<div class="empty">${icon(name, 35)}<h3>${esc(title)}</h3><p>${esc(body)}</p></div>`;
  }
  function chatPage() {
    const rooms = state.data.rooms
      .slice()
      .sort((a, b) => Number(b.pinned) - Number(a.pinned));
    let r = state.data.rooms.find((r) => r.id === state.room);
    if (!r && rooms.length) {
      state.room = rooms[0].id;
      r = rooms[0];
    }
    return (
      heading(
        "CONVERSATIONS THAT CONNECT",
        "우리의 이야기",
        "짧은 질문부터 함께하는 고민까지, 편하게 나눠요.",
        button("new-chat", "새 대화", "plus", "btn-primary"),
      ) +
      `<div class="chat-layout ${state.mobileList ? "mobile-list" : ""}"><section class="panel room-panel"><div class="panel-head"><h2>대화 목록 <small>${rooms.length}</small></h2>${ib("new-chat", "새 대화", "plus")}</div><div class="search">${icon("search", 17)}<input class="input" id="room-search" aria-label="대화방 검색" placeholder="대화방 검색"></div><div class="room-list">${rooms.map((room) => roomRow(room)).join("") || empty("아직 대화가 없어요", "새 대화를 시작해 보세요.")}</div></section><section class="panel conversation" id="main-conversation">${r ? conversationHTML(r) : empty("대화를 시작해 보세요", "선생님들을 초대해 이야기를 나눠요.")}</section></div>`
    );
  }
  function roomRow(r) {
    const last = r.messages.at(-1);
    return `<button class="room ${r.id === state.room ? "active" : ""}" data-action="open-room" data-room="${r.id}">${avatar({ name: r.name, status: "online" }, "large", Number(r.id.replace(/\D/g, "")) || 0)}<div class="room-info"><strong>${esc(r.name)} ${r.pinned ? `<span class="pinned">${icon("star", 12)}</span>` : ""} ${r.muted ? icon("mute", 12) : ""}</strong><p>${esc(last?.text || "새로운 대화를 시작해 보세요.")}</p></div><div class="room-meta">${last?.time || ""}${r.unread ? `<br><span class="badge">${r.unread}</span>` : ""}</div></button>`;
  }
  function conversationHTML(r, floating = false) {
    return `<div class="conversation-header" ${floating ? 'data-drag="chat"' : ""}>${!floating ? ib("chat-back", "대화 목록", "left", 'class="icon-btn mobile-back"') : ""}${avatar({ name: r.name, status: "online" })}<div class="conversation-title"><strong>${esc(r.name)}</strong><small>${r.members.length + 1}명 참여 · ${r.muted ? "알림 꺼짐" : "편안하게 이야기를 나눠요"}</small></div><div class="conversation-tools">${ib("chat-search", "대화 검색", "search", `data-room="${r.id}"`)}${ib("chat-members", "참여자 보기", "users", `data-room="${r.id}"`)}${!floating ? ib("pop-chat", "대화창 따로 열기", "popout", `data-room="${r.id}"`) : ib("close-chat", "대화창 닫기", "x")}</div></div>${r.notice ? `<div class="notice-strip">${icon("notice", 14)}${esc(r.notice)}</div>` : ""}<div class="chat-search" ${!state.chatSearch ? "hidden" : ""}>${icon("search", 16)}<input class="input" data-chat-search="${r.id}" aria-label="대화 내용 검색" placeholder="대화 내용 찾기" value="${esc(state.chatQuery)}"><small class="search-count">${searchCount(r)}개 결과</small></div><div class="messages" data-message-room="${r.id}" role="log" aria-label="대화 내용">${messagesHTML(r)}</div><form class="chat-compose" data-chat-form="${r.id}"><div class="reply-preview" ${!state.reply || state.reply.room !== r.id ? "hidden" : ""}><span>답장 · ${esc(state.reply?.text?.slice(0, 55) || "")}</span>${ib("cancel-reply", "답장 취소", "x")}</div><div class="chat-input-row"><textarea class="input" data-chat-input="${r.id}" aria-label="메시지 입력" placeholder="따뜻한 한마디를 건네 보세요." rows="1" maxlength="5000"></textarea><button class="btn btn-primary" type="submit" aria-label="메시지 보내기" disabled>${icon("send", 18)}</button></div><div class="compose-hint"><span>Enter 전송 · Shift + Enter 줄바꿈</span><span>${native ? "교내 서버 연결" : "이 대화는 예시 화면입니다"}</span></div></form>${state.members ? membersHTML(r) : ""}`;
  }
  function searchCount(r) {
    return state.chatQuery
      ? r.messages.filter((m) =>
          m.text.toLowerCase().includes(state.chatQuery.toLowerCase()),
        ).length
      : 0;
  }
  function highlight(text) {
    if (!state.chatQuery) return esc(text);
    const needle = state.chatQuery.toLowerCase(),
      lower = text.toLowerCase();
    let result = "",
      index = 0,
      pos;
    while ((pos = lower.indexOf(needle, index)) !== -1) {
      result +=
        esc(text.slice(index, pos)) +
        "<mark>" +
        esc(text.slice(pos, pos + needle.length)) +
        "</mark>";
      index = pos + needle.length;
    }
    return result + esc(text.slice(index));
  }
  function messagesHTML(r) {
    let last = "";
    return r.messages
      .map((m) => {
        let divider = "";
        if (m.date !== last) {
          last = m.date;
          divider = `<div class="date-divider">${fmtDate(m.date, { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</div>`;
        }
        const mine = m.sender === "me",
          p = person(m.sender);
        return (
          divider +
          `<article class="message ${mine ? "mine" : ""}" data-message="${m.id}">${!mine ? avatar(p, "small", r.members.indexOf(p.id)) : ""}<div class="message-body">${!mine ? `<div class="message-name">${esc(p.name)}</div>` : ""}<div class="bubble-wrap"><div class="bubble">${m.reply ? `<div class="reply-quote">${esc(m.reply)}</div>` : ""}${highlight(m.text)}</div><span class="bubble-meta">${mine ? native ? `<b>${esc(m.sendError?"발송 실패":m.restoreReview?"발송 여부 확인 필요":m.pendingDelivery?"발송 대기":"")}</b>` : "<b>1</b>" : ""}${m.time}</span></div>${m.likes ? `<button class="reaction ${m.liked ? "liked" : ""}" data-action="like-message" data-message="${m.id}" data-room="${r.id}" aria-pressed="${m.liked}">${icon("heart", 11)} ${m.likes}</button>` : ""}<div class="msg-actions">${button("reply-message", "답장", "reply", "btn-quiet", `data-message="${m.id}" data-room="${r.id}"`)}${button("like-message", "공감", "heart", "btn-quiet", `data-message="${m.id}" data-room="${r.id}"`)}</div></div></article>`
        );
      })
      .join("");
  }
  function membersHTML(r) {
    return `<aside class="members-drawer"><div class="panel-head"><h2>함께하는 선생님들</h2>${ib("chat-members", "참여자 닫기", "x", `data-room="${r.id}"`)}</div><div class="person">${avatar({ name: state.user, status: "online" })}<div><strong>${esc(state.user)}</strong><small class="muted" style="display:block">나</small></div></div>${r.members
      .map((id, i) => {
        const p = person(id);
        return `<div class="person">${avatar(p, "", i)}<div><strong style="font-size:12px">${esc(p.name)}</strong><small class="muted" style="display:block">${esc(p.department)}</small></div></div>`;
      })
      .join("")}</aside>`;
  }
  function scrollMessages(root) {
    $$(".messages", root).forEach((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }
  function renderFloating() {
    const root = $("#floating");
    if (!state.floating) {
      root.innerHTML = "";
      return;
    }
    const r = state.data.rooms.find((r) => r.id === state.floating);
    if (!r) {
      state.floating = null;
      root.innerHTML = "";
      return;
    }
    const old = $(".floating-chat");
    const pos = old
      ? {
          left: old.style.left,
          top: old.style.top,
          width: old.style.width,
          height: old.style.height,
        }
      : null;
    root.innerHTML = `<section class="floating-chat conversation" aria-label="별도 대화창">${conversationHTML(r, true)}</section>`;
    const panel = $(".floating-chat");
    if (pos) Object.assign(panel.style, pos);
    initChatDrag(panel);
    scrollMessages(root);
  }
  function updateChat(rid) {
    const r = state.data.rooms.find((r) => r.id === rid);
    if (!r) return;
    $$(`[data-message-room="${rid}"]`).forEach((el) => {
      const bottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      el.innerHTML = messagesHTML(r);
      if (bottom) el.scrollTop = el.scrollHeight;
    });
    $$(".search-count").forEach(
      (el) => (el.textContent = searchCount(r) + "개 결과"),
    );
  }
  function initChatDrag(panel) {
    const handle = $("[data-drag]", panel);
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest("button") || innerWidth < 600) return;
      const rect = panel.getBoundingClientRect(),
        dx = e.clientX - rect.left,
        dy = e.clientY - rect.top;
      handle.setPointerCapture(e.pointerId);
      panel.style.right = "auto";
      panel.style.left = rect.left + "px";
      panel.style.top = rect.top + "px";
      const move = (ev) => {
        panel.style.left =
          Math.max(
            0,
            Math.min(innerWidth - panel.offsetWidth, ev.clientX - dx),
          ) + "px";
        panel.style.top =
          Math.max(0, Math.min(innerHeight - 55, ev.clientY - dy)) + "px";
      };
      const end = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", end);
        handle.removeEventListener("pointercancel", end);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", end);
      handle.addEventListener("pointercancel", end);
    });
  }
  const mailColumns = [
    { key: "from", label: "보낸 사람", width: 24, min: 12 },
    { key: "title", label: "제목", width: 26, min: 12 },
    { key: "body", label: "내용", width: 32, min: 12 },
    { key: "date", label: "받은 날짜", width: 18, min: 12 },
  ];
  const savedMailWidths=state.settings.mailColumnWidths;
  if(savedMailWidths&&mailColumns.every(c=>Number.isFinite(savedMailWidths[c.key])&&savedMailWidths[c.key]>=c.min)&&Math.abs(mailColumns.reduce((sum,c)=>sum+savedMailWidths[c.key],0)-100)<.01){
    mailColumns.forEach(c=>c.width=savedMailWidths[c.key]);
  }
  function mailPreview(mail){
    let text=mail.body||"";
    if(!text&&mail.html){const doc=new DOMParser().parseFromString(safeRichHTML(mail.html),"text/html");text=doc.body.textContent||"";}
    return text.replace(/\s+/g," ").trim().slice(0,200);
  }
  function filteredMails() {
    const query=state.mailSearch.trim().toLocaleLowerCase();
    return state.data.mails
      .filter((m) =>
        state.folder === "important"
          ? m.important && m.folder !== "trash"
          : state.folder === "unread"
            ? m.unread && m.folder === "inbox"
            : m.folder === state.folder,
      )
      .filter(m=>{
        
        if(state.mailSearchBy==='important'&&!m.important)return false;
        if(state.mailSearchBy==='file'){
          return (m.files||[]).some(file=>String(file.name||'').toLocaleLowerCase().includes(query));
        }
        if(!query)return true;
        const text=state.mailSearchBy==='name'
          ?(m.from==='me'||m.folder==='sent'?m.to.map(id=>person(id).name).join(' '):mailSenderName(m))
          :((m.title||'')+' '+(m.body||'')+' '+(m.html?new DOMParser().parseFromString(safeRichHTML(m.html),'text/html').body.textContent:''));
        return text.toLocaleLowerCase().includes(query);
      });
  }
  function mailFolders(){return [
    ['inbox','받은 메시지함',state.data.mails.filter(m=>m.folder==='inbox').length],
    ['sent','보낸 메시지함',state.data.mails.filter(m=>m.folder==='sent').length],
    ['important','중요 메시지',state.data.mails.filter(m=>m.important&&m.folder!=='trash').length],
    ['unread','안 읽은 메시지',unreadMails()],
    ['trash','휴지통',state.data.mails.filter(m=>m.folder==='trash').length]
  ];}
  function mailFolderOptions(){return mailFolders().map(([value,label,count])=>`<option value="${value}" ${state.folder===value?'selected':''}>${label} · ${count}</option>`).join('');}

  function inboxPage() {
    const mails = filteredMails();
    const current = mails.find((m) => m.id === state.mail);
    return (
      `<div class="page-heading inbox-heading"><h1>차곡차곡, 메시지함</h1><div class="heading-actions">${button("nav-requests", "회신·제출 현황", "checklist")}${button("compose-mail", "새 메시지 쓰기", "plus", "btn-primary")}</div></div>` +
      `<div class="inbox-layout"><section class="panel mail-workspace ${current ? "show-detail" : ""}"><div class="mail-list-panel"><div class="mail-toolbar"><select id="mail-folder-select" class="input" aria-label="메시지함 선택">${mailFolderOptions()}</select><select id="mail-search-by" class="input" aria-label="메시지 검색 기준"><option value="name" ${state.mailSearchBy==='name'?'selected':''}>이름</option><option value="content" ${state.mailSearchBy==='content'?'selected':''}>내용</option><option value="important" ${state.mailSearchBy==='important'?'selected':''}>중요</option><option value="file" ${state.mailSearchBy==='file'?'selected':''}>파일</option></select><div class="search">${icon("search",17)}<input class="input" id="mail-search" placeholder="검색어 입력" aria-label="메시지 검색어" value="${esc(state.mailSearch)}"></div></div><div class="mail-list" id="mail-list">${mailListHTML(mails)}</div></div><div class="mail-resizer" role="separator" tabindex="0" aria-label="목록 너비 조절" aria-orientation="vertical"></div><article class="mail-detail" id="mail-detail">${current ? mailDetail(current) : empty("한 장의 메시지, 하나의 연결", "목록에서 메시지를 선택해 내용을 확인하세요.", "mail")}</article></section></div>`
    );
  }
  function mailProgressCounts(metrics) {
    return (metrics||[]).map(({label,count,total})=>`<span class="mail-progress-count" data-confirmed="${count>0}">${esc(label)} <b>${count}/${total}명</b></span>`).join('');
  }
  const mailPageSize=100;
  let mailListKey='',mailVisible=mailPageSize;
  function mailListHTML(mails=filteredMails()) {
    const key=JSON.stringify([state.folder,state.mailSearchBy,state.mailSearch]);
    if(key!==mailListKey){mailListKey=key;mailVisible=mailPageSize;}
    const remaining=mails.length-mailVisible;
    const more=remaining>0?button('mail-more',`메시지 ${Math.min(remaining,mailPageSize)}개 더 보기`):'';
    const header=mailColumns.map((c,i)=>`<span class="mail-column" data-column="${c.key}" style="width:${c.width}%"><span class="mail-column-label" title="${c.label}">${c.label}</span>${i<mailColumns.length-1?`<span class="column-grip" data-column-resize="${c.key}" role="separator" tabindex="0" aria-orientation="vertical" aria-label="${c.label} 열 너비 조절" aria-valuemin="${c.min}" aria-valuemax="${c.width+mailColumns[i+1].width-mailColumns[i+1].min}" aria-valuenow="${c.width}" title="드래그하거나 방향키로 열 너비 조절"></span>`:""}</span>`).join("");
    return `<div class="mail-list-header">${header}</div>${mails.length?mails.slice(0,mailVisible).map(m=>{
      const title=mailSubject(m),preview=mailPreview(m),sender=mailSenderName(m);
      const status=m.from==='me'?DingdongMailReceipts.summary(m,{native:!!native,self:workSelf()}):null;
      const statusLine=status?`<div class="mail-list-status ${status.tone}">${status.metrics&&status.label==='전달 현황'?'':`<span>${esc(status.label)}</span>`}${mailProgressCounts(status.metrics)}</div>`:'';
      return `<div class="mail-row mail-table-row ${m.unread?"unread":""} ${m.id===state.mail?"active":""}" data-action="open-mail" data-mail="${m.id}" role="button" tabindex="0" aria-label="${esc(sender)} · ${esc(title)}${status?` · ${esc(status.label)} ${(status.metrics||[]).map(v=>`${v.label} ${v.count}/${v.total}명`).join(" · ")}`:""}"><div class="mail-row-top">${mailColumns.map(c=>`<span class="mail-data-column mail-cell-${c.key}" style="width:${c.width}%">${c.key==="from"?`<button class="star-button ${m.important?"on":""}" data-action="star-mail" data-mail="${m.id}" aria-label="${m.important?"중요 표시 해제":"중요 표시"}" aria-pressed="${m.important}">${icon("star",13)}</button><span title="${esc(sender)}">${esc(sender)}</span>`:c.key==="title"?`<strong class="mail-row-title" title="${esc(title)}">${esc(title)}</strong>`:c.key==="body"?`<span class="mail-preview" title="${esc(preview)}">${esc(preview)}</span>`:`<time title="${esc(m.date)} ${esc(m.time||"")}">${fmtDate(m.date,{month:"numeric",day:"numeric"})}</time>${m.files.length?`<span class="mail-attachment-indicator" title="첨부 파일 ${m.files.length}개">${icon("clip",12)}</span>`:""}`}</span>`).join("")}</div>${statusLine}</div>`;
    }).join(""):empty("아직 메시지가 없어요", "새 메시지를 쓰거나 다른 폴더를 확인해 보세요.", "mail")}${more}`;
  }
  function safeRichHTML(html) {
    const doc = new DOMParser().parseFromString(String(html), "text/html");
    const allowed = new Set([
      "B",
      "STRONG",
      "I",
      "EM",
      "U",
      "BR",
      "P",
      "DIV",
      "UL",
      "OL",
      "LI",
      "TABLE","THEAD","TBODY","TR","TH","TD","SPAN","FONT",
    ]);
    const safeColor=value=>{
      value=String(value||"").trim().toLowerCase();
      if(/^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/.test(value)||/^(transparent|black|white|red|green|blue|yellow|orange|purple|gr[ae]y)$/.test(value))return value;
      const rgb=value.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/);
      return rgb&&rgb.slice(1,4).every(n=>Number(n)<=255)?value:"";
    };
    const fontSizes={"x-small":10,small:13,medium:16,large:18,"x-large":24,"xx-large":32,"xxx-large":48};
    const safeStyles=node=>{
      const out=[];
      for(const [property,value] of [["color",node.style.color||node.getAttribute("color")],["background-color",node.style.backgroundColor]]){const color=safeColor(value);if(color)out.push(property+":"+color);}
      const size=node.style.fontSize,legacy={1:10,2:13,3:16,4:18,5:24,6:32,7:48}[node.getAttribute("size")];
      const px=fontSizes[size]||(/^\d+(?:\.\d+)?px$/.test(size)?Number.parseFloat(size):legacy);
      if(px>=10&&px<=48)out.push("font-size:"+px+"px");
      if(/^(bold|normal|400|700)$/.test(node.style.fontWeight))out.push("font-weight:"+node.style.fontWeight);
      if(/^(italic|normal)$/.test(node.style.fontStyle))out.push("font-style:"+node.style.fontStyle);
      const decoration=node.style.textDecorationLine;
      if(/^(underline|line-through|none)$/.test(decoration))out.push("text-decoration-line:"+decoration);
      return out.length?' style="'+esc(out.join(';'))+'"':"";
    };
    const walk = (node) => {
      if (node.nodeType === 3) return esc(node.textContent);
      if (node.nodeType !== 1) return "";
      if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "SVG"].includes(node.tagName))
        return "";
      const content = Array.from(node.childNodes).map(walk).join("");
      if(node.tagName==="IMG"){
        const src=node.getAttribute("src")||"";
        const value=node.getAttribute("width")||"",width=/^\d{1,4}$/.test(value)&&Number(value)>=1&&Number(value)<=4096?Number(value):0;
        return imageBytes(src)?`<img src="${src}" alt="${esc(node.getAttribute("alt")||"캡처 이미지")}"${width?' width="'+width+'"':''}>`:"";
      }
      if(node.tagName==="A"){try{const url=new URL(node.getAttribute("href")||"");if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return content;return `<a href="${esc(url.href)}" target="_blank" rel="noopener noreferrer"${safeStyles(node)}>${content}</a>`;}catch{return content;}}

      if(!allowed.has(node.tagName))return content;
      const tag=node.tagName==="FONT"?"span":node.tagName.toLowerCase();
      return "<"+tag+safeStyles(node)+">"+content+(node.tagName==="BR"?"":"</"+tag+">");
    };
    return Array.from(doc.body.childNodes).map(walk).join("");
  }
  const inlineMailCache=new Map(),inlineMailLoading=new Map(),inlineMailErrors=new Set();
  let inlineMailEpoch=0;
  async function loadInlineMail(m){
    if(!native||!m.inlineStored)return m.html;
    if(inlineMailCache.has(m.id))return inlineMailCache.get(m.id);
    if(inlineMailLoading.has(m.id))return inlineMailLoading.get(m.id);
    const epoch=inlineMailEpoch;
    const pending=native.request("/attachment",{mail:m.id,inline:true}).then(result=>{if(epoch!==inlineMailEpoch)throw new Error("로그인 상태가 변경되었습니다.");if(result.error)throw new Error(result.error);const html=safeRichHTML(result.html);inlineMailCache.set(m.id,html);inlineMailErrors.delete(m.id);return html;}).finally(()=>{if(inlineMailLoading.get(m.id)===pending)inlineMailLoading.delete(m.id);});
    inlineMailLoading.set(m.id,pending);return pending;
  }
  function mailDetail(m) {
    if(native&&m.inlineStored&&!inlineMailCache.has(m.id)&&!inlineMailLoading.has(m.id)&&!inlineMailErrors.has(m.id))loadInlineMail(m).then(()=>{if(state.mail===m.id)refreshMail();}).catch(()=>{inlineMailErrors.add(m.id);if(state.mail===m.id)refreshMail();});
    const richHTML=inlineMailCache.get(m.id)||m.html;
    const inlineStatus=native&&m.inlineStored&&!inlineMailCache.has(m.id)?inlineMailErrors.has(m.id)?`<p role="status">본문 이미지를 불러오지 못했습니다. ${button("retry-inline-mail","다시 시도","","",`data-mail="${esc(m.id)}"`)}</p>`:'<p role="status">본문 이미지를 불러오고 있습니다…</p>':"";
    const cc=[...new Set(m.cc||[])],to=m.to.filter(id=>!cc.includes(id));
    const names=ids=>ids.length?ids.map(id=>{const receipt=m.receipts?.[m.to.indexOf(id)]||"unread",status=DingdongMailReceipts.delivery(m,id,{native:!!native,self:workSelf()});return `<span class="mail-person ${receipt}" title="${esc(person(id).name)}${m.from==='me'?' · '+esc(status):''}">${esc(person(id).name)}${m.from==='me'?`<small>${esc(status)}</small>`:''}</span>`;}).join(""):`<span class="muted">없음</span>`;
    const delivery=m.from==='me'?DingdongMailReceipts.summary(m,{native:!!native,self:workSelf()}):null;
    const deliveryPanel=delivery?`<section class="mail-delivery-status ${delivery.tone}" role="status"><div><strong>${esc(delivery.label)}</strong>${delivery.metrics?`<div class="mail-progress-counts">${mailProgressCounts(delivery.metrics)}</div>`:''}${delivery.detail?`<p>${esc(delivery.detail)}</p>`:''}</div>${native&&delivery.tone==='error'?button('retry-send-mail','다시 보내기','arrow','',`data-mail="${esc(m.id)}"`):native&&delivery.tone==='review'?button('redraft-mail','내용 확인 후 새로 작성','edit','',`data-mail="${esc(m.id)}"`):''}</section>`:'';
    const sender=m.announcement?.department||person(m.from).name+" 선생님";
    const linked=item=>item.source?.kind==="mail"&&item.source.id===m.id||item.noticeMail===m.id||item.deliveryMail===m.id||[m.calendarEvent,m.eventId].filter(Boolean).includes(item.id);
    const hasSchedule=!!m.scheduleAnnouncement||state.data.events.some(linked)||state.data.deadlines.some(linked);
    const tag=m.announcement?.department?`<span class="chip mail-department-tag">${esc(m.announcement.department)}</span>`:hasSchedule?`<span class="chip orange mail-schedule-tag">연결된 일정 있음</span>`:"";
    return `<header class="mail-detail-head"><div class="mail-from-line">${ib("mail-back", "메시지 목록으로", "left", 'class="icon-btn mobile-back"')}<span class="mail-meta-label">보내는 사람</span><span class="mail-sender" title="보낸 사람: ${esc(sender)}"><strong>${esc(sender)}</strong></span><time class="muted">${fmtDate(m.date,{month:"long",day:"numeric"})} ${esc(m.time)}</time>${ib("print-mail", "메시지 인쇄", "print")}</div><div class="mail-to-line"><span class="mail-meta-label">받는 사람</span><div class="mail-recipient-values" id="mail-to-values">${names(to)}</div><button type="button" class="mail-recipients-more" data-action="mail-recipients-more" aria-expanded="false" aria-controls="mail-to-values" hidden>더 보기</button></div><div class="mail-cc-line"><span class="mail-meta-label">참조</span><div class="mail-cc-values">${names(cc)}</div><div class="mail-head-actions">${m.scheduled?`<small class="mail-scheduled muted" title="${esc(m.scheduled)}">${native?"예약 발송":"예약 초안"} · ${esc(m.scheduled)}</small>`:""}${tag}</div></div></header>${deliveryPanel}<div class="mail-body">${workUI.mailCard(m)}${inlineStatus}${richHTML ? safeRichHTML(richHTML) : esc(m.body)}${m.files.map((f, i) => `<div class="attachment">${icon("file", 25)}<div><strong>${esc(f.name)}</strong><br><small>${esc(f.size)}${f.demo ? " · 예시 첨부 파일" : f.expired ? " · 서버 보관 기간 만료" : f.expiresAt ? " · "+fmtDate(new Date(f.expiresAt).toISOString().slice(0,10))+"까지 제공" : ""}</small></div>${ib("download-file", "첨부 다운로드", "download", `data-mail="${m.id}" data-file="${i}"`)}</div>`).join("")}</div><footer class="mail-detail-foot">${button(m.folder === "trash" ? "restore-mail" : "delete-mail", m.folder === "trash" ? "복원" : "삭제", "trash", "btn-danger", `data-mail="${m.id}"`)}${m.folder === "sent" && m.canRecall!==false && !m.sendError && !m.restoreReview && !m.recallRequested && m.receipts?.some(r=>r==="unread"||r==="scheduled") ? button("recall-mail", "회수", "", "", `data-mail="${m.id}"`) : ""}<span class="spacer"></span>${button("reply-mail", "답장", "reply", "", `data-mail="${m.id}"`)}${button("reply-all", "전체 답장", "", "", `data-mail="${m.id}"`)}${button("forward-mail", "전달", "arrow", "", `data-mail="${m.id}"`)}</footer>`;
  }
  function initMailHeader(){
    mailHeaderObserver?.disconnect();mailHeaderObserver=null;
    const workspace=$(".mail-workspace"),head=$(".mail-detail-head");
    if(!workspace)return;
    workspace.style.setProperty("--mail-header-height","100px");
    if(!head)return;
    const names=$("#mail-to-values",head),more=$("[data-action=mail-recipients-more]",head);
    const fit=()=>{
      more.hidden=true;
      const overflow=names.scrollHeight>23,expanded=more.getAttribute("aria-expanded")==="true";
      more.hidden=!overflow;more.textContent=expanded?"접기":"더 보기";
      names.classList.toggle("expanded",expanded);
      $$(".mail-person",names).forEach(name=>name.setAttribute("aria-hidden",String(!expanded&&name.offsetTop>0)));
      const height=Math.ceil(head.getBoundingClientRect().height);
      if(workspace.style.getPropertyValue("--mail-header-height")!==height+"px")workspace.style.setProperty("--mail-header-height",height+"px");
    };
    mailHeaderObserver=new ResizeObserver(fit);mailHeaderObserver.observe(head);mailHeaderObserver.observe(names);fit();
  }
  function initMailResize() {
    initMailHeader();
    const divider = $(".mail-resizer");
    if (divider) {
      const resize = (x) => {
        const panel = $(".mail-list-panel"),
          container = $(".mail-workspace"),
          rect = container.getBoundingClientRect();
        panel.style.width =
          Math.max(350, Math.min(rect.width - 250, x - rect.left)) + "px";
      };
      divider.onpointerdown = (e) => {
        divider.setPointerCapture(e.pointerId);
        const move = (ev) => resize(ev.clientX);
        const stop = () => {
          divider.removeEventListener("pointermove", move);
          divider.removeEventListener("pointerup", stop);
          divider.removeEventListener("pointercancel", stop);
        };
        divider.addEventListener("pointermove", move);
        divider.addEventListener("pointerup", stop);
        divider.addEventListener("pointercancel", stop);
      };
      divider.onkeydown = (e) => {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          const rect = divider.getBoundingClientRect();
          resize(rect.left + (e.key === "ArrowRight" ? 20 : -20));
        }
      };
    }
    initMailColumns();
  }
  function initMailColumns() {
    const paint=()=>{
      mailColumns.forEach((col,index)=>{
        const header=$(`[data-column="${col.key}"]`);if(!header)return;
        header.style.width=col.width+"%";
        const grip=header.querySelector('[data-column-resize]');
        if(grip){grip.setAttribute('aria-valuenow',String(Math.round(col.width*10)/10));grip.setAttribute('aria-valuemax',String(col.width+mailColumns[index+1].width-mailColumns[index+1].min));}
        $$('.mail-table-row .mail-row-top').forEach(row=>row.children[index].style.width=col.width+"%");
      });
    };
    const persist=()=>{state.settings.mailColumnWidths=Object.fromEntries(mailColumns.map(c=>[c.key,c.width]));save();};
    $$('[data-column-resize]').forEach(grip=>{
      const index=mailColumns.findIndex(c=>c.key===grip.dataset.columnResize),col=mailColumns[index],next=mailColumns[index+1];
      const adjust=(width,total)=>{col.width=Math.max(col.min,Math.min(total-next.min,width));next.width=total-col.width;paint();};
      grip.onpointerdown=e=>{
        if(e.button!==0)return;e.stopPropagation();e.preventDefault();grip.blur();
        const start=e.clientX,width=col.width,nextWidth=next.width,total=width+nextWidth;
        const available=$('.mail-list-header').getBoundingClientRect().width-parseFloat(getComputedStyle($('.mail-list-header')).paddingLeft)-parseFloat(getComputedStyle($('.mail-list-header')).paddingRight);
        grip.setPointerCapture(e.pointerId);
        grip.onpointermove=ev=>adjust(width+(ev.clientX-start)/available*100,total);
        const finish=cancel=>{grip.onpointermove=null;grip.onpointerup=null;grip.onpointercancel=null;grip.onlostpointercapture=null;grip.blur();if(cancel){col.width=width;next.width=nextWidth;paint();}else persist();};
        grip.onpointerup=()=>finish(false);grip.onpointercancel=()=>finish(true);grip.onlostpointercapture=()=>finish(false);
      };
      grip.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();e.stopPropagation();adjust(col.width+(e.key==='ArrowRight'?2:-2),col.width+next.width);persist();};
    });
  }
  let modalPreviousFocus = null,
    modalCleanup = null,
    composeDraft = null,
    eventDraft = null;
  let updateBriefingShape=null;
  function openModal(title, body, footer = "", cls = "") {
    cancelTimelineSelection?.();
    setTimelineResizeTarget(null);
    if (modalCleanup) {
      modalCleanup();
      modalCleanup = null;
    }
    if (!$("#modal-root").firstChild)
      modalPreviousFocus = document.activeElement;
    $("#modal-root").innerHTML =
      `<div class="overlay${cls==="briefing-modal"?" briefing-overlay":""}"><section class="modal ${cls}" role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="modal-title"><header class="modal-head"><h2 id="modal-title">${esc(title)}</h2>${ib("close-modal", "닫기", "x")}</header><div class="modal-body">${body}</div>${footer ? `<footer class="modal-foot">${footer}</footer>` : ""}</section></div>`;
    const closeButton=$(".modal-head [data-action=close-modal]");
    closeButton.onclick=event=>{event.preventDefault();event.stopPropagation();closeModal();};
    if(cls==="briefing-modal"&&windowApi?.mainHost&&windowApi.briefingShape){
      const modal=$(".briefing-modal");let frame=0,active=true;
      const fit=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!active||!modal.isConnected)return;const r=modal.getBoundingClientRect();windowApi.briefingShape({x:r.x,y:r.y,width:r.width,height:r.height});});};
      const observer=new ResizeObserver(fit);observer.observe(modal);window.addEventListener("resize",fit);updateBriefingShape=fit;fit();
      modalCleanup=()=>{active=false;cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("resize",fit);updateBriefingShape=null;windowApi.briefingShape(null);};
    }
    const dialog=$('#modal-root .modal');
    requestAnimationFrame(()=>{
      // Focus the dialog without drawing an automatic ring around its close icon.
      // Preserve an explicit focus choice made inside it before this frame.
      if(dialog?.isConnected&&!dialog.contains(document.activeElement))dialog.focus({preventScroll:true});
    });
  }
  function closeModal(keepStaffWindow=false) {
    $("#context-root").innerHTML = "";
    if(requestedStaff&&!keepStaffWindow&&windowApi){windowApi.windowAction("close");return;}
    if(requestedCompose&&composeDraft&&!mailSending&&windowApi){windowApi?.windowAction("close");return;}
    if (modalCleanup) {
      modalCleanup();
      modalCleanup = null;
    }
    $("#modal-root").innerHTML = "";
    if(!native&&state.exchangeDemoActor){state.exchangeDemoActor=null;demoRefreshPending=true;}
    modalPreviousFocus?.focus();
    composeDraft = null;
    eventDraft = null;
    if(demoRefreshPending){demoRefreshPending=false;render();}
    maybeShowBriefing();notifyPendingReceipts();notifyExchangeUpdates();
  }
  function composeMail({
    to = [],
    cc = [],
    title = "",
    body = "",
    files = [],
    forwarded = false,
    richBody = "",
    noticeType = "",
    mode = "general",
    workRequest = null,
    workReminderOf = "",
  } = {}) {
    if(windowApi?.openCompose&&!requestedCompose){windowApi.openCompose({to,cc,title,body,files,forwarded,richBody,noticeType,mode,workRequest,workReminderOf});return;}
    const lessonPeople=state.profile?.id&&!state.data.people.some(p=>p.id===state.profile.id)?[state.profile,...state.data.people]:state.data.people;
    composeDraft = {
      to: [...new Set(to)],
      cc: [...new Set(cc)],
      files: files.map((f) => ({ ...f })),
      forwarded,
      mode: "general",
      titleChoice: "기타",
      announcementScheduled: false,
      announcementEvent: false,
      workReminderOf,
    };
    openModal(
      "새 메시지 쓰기",
      `<form id="compose-form" class="compose-form"><div class="compose-mode-buttons" role="group" aria-label="메시지 작성 방식">${button("compose-mode","일반 메시지","mail","",'data-mode="general" aria-pressed="true"')}${button("compose-mode","공지 사항","notice","",'data-mode="announcement" aria-pressed="false"')}${button("compose-mode","예약 메시지","clock","",'data-mode="scheduled" aria-pressed="false"')}${button("compose-mode","일정 추가","calendar","",'data-mode="event" aria-pressed="false"')}</div><section id="compose-announcement" hidden><div class="announcement-fields"><label>수신 대상<select id="announcement-audience" class="input" disabled><option value="">선택하세요</option><option value="teachers">교사</option><option value="staff">교직원</option></select></label><label>발신 부서<select id="announcement-department" class="input" disabled>${state.data.departments.map(department=>`<option value="${esc(department)}" ${department===(state.profile?.department||person("me").department)?"selected":""}>${esc(department)}</option>`).join("")}</select></label></div><div class="announcement-options" role="group" aria-label="공지 사항 옵션">${button("announcement-option","예약 메시지","clock","",'data-option="scheduled" aria-pressed="false"')}${button("announcement-option","일정 추가","calendar","",'data-option="event" aria-pressed="false"')}</div></section><section id="compose-reservation" hidden><label>예약 날짜·시간<input type="datetime-local" id="mail-scheduled-at" class="input" disabled></label></section><section id="compose-event" hidden><div class="compose-event-fields"><label>날짜<input id="compose-event-date" class="input" type="date" value="${state.today}" disabled></label><label>장소<input id="compose-event-place" class="input" placeholder="장소 입력" maxlength="200" disabled></label><label>시작 시간<input id="compose-event-start" class="input" type="time" value="09:00" disabled></label><label>종료 시간<input id="compose-event-end" class="input" type="time" value="10:00" disabled></label></div></section><label ${noticeType?"":"hidden"}>안내 종류<select id="lesson-kind" class="input"><option value="">일반 메시지</option><option value="makeup">보강 안내</option><option value="lessonChange">수업 변경 안내</option></select></label><section id="lesson-assignment" hidden><label>수업 날짜<input id="lesson-date" class="input" type="date" value="${state.today}"></label><p class="muted">필요한 교시를 체크하고 담당 교사를 배정하세요. 보강에서 반을 선택하면 담임과 보강 교사에게 함께 발송합니다. 수업 변경은 기존·교체 교사에게 안내하고 캘린더에 자동 등록합니다.</p><div class="lesson-table-scroll"><table class="lesson-table"><thead><tr><th>교시</th><th>반</th><th class="lesson-original" hidden>기존 교사</th><th id="lesson-teacher-heading">보강 교사</th></tr></thead><tbody>${Array.from({length:7},(_,i)=>`<tr data-lesson-row="${i+1}"><td><label><input type="checkbox" data-lesson-period="${i+1}">${i+1}교시</label><small data-lesson-time="${i+1}"></small></td><td><input class="input" data-lesson-class="${i+1}" list="school-classes" placeholder="반 선택/입력" maxlength="40" aria-label="${i+1}교시 반"><small data-lesson-homeroom="${i+1}"></small></td><td class="lesson-original" hidden><select class="input" data-lesson-original="${i+1}" aria-label="${i+1}교시 기존 교사"><option value="">교사 선택</option>${lessonPeople.map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.department)}</option>`).join("")}</select></td><td><select class="input" data-lesson-teacher="${i+1}" aria-label="${i+1}교시 배정 교사"><option value="">교사 선택</option>${lessonPeople.map(p=>`<option value="${p.id}">${esc(p.name)} · ${esc(p.department)}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div><datalist id="school-classes">${[...new Set([...(state.data.classTeachers||[]).map(c=>c.className),...Array.from({length:36},(_,i)=>`${Math.floor(i/12)+1}학년 ${i%12+1}반`)])].map(name=>`<option value="${esc(name)}">`).join("")}</datalist></section><div class="field-row" id="compose-recipient-row"><label for="recipient-input">받는 사람</label><div class="recipient-box" id="recipient-box"><div class="recipient-values" id="recipient-values">${recipientChips()}</div><button type="button" class="recipient-more" data-action="recipient-more" data-kind="to" aria-expanded="false" aria-controls="recipient-values" hidden>더 보기</button><input id="recipient-input" autocomplete="off" placeholder="이름을 입력해 선택하세요" aria-label="받는 사람 검색"><div class="suggestions" id="recipient-suggestions" hidden></div></div></div><div class="field-row" id="compose-cc-row"><label for="cc-input">참조</label><div class="recipient-box" id="cc-box"><div class="recipient-values" id="cc-values"></div><button type="button" class="recipient-more" data-action="recipient-more" data-kind="cc" aria-expanded="false" aria-controls="cc-values" hidden>더 보기</button><input id="cc-input" autocomplete="off" placeholder="참조할 선생님 선택 (선택)" aria-label="참조 검색"><div class="suggestions" id="cc-suggestions" hidden></div></div></div><div class="field-row"><label for="mail-title">제목 (선택)</label><div class="compose-title-field"><input id="mail-title" class="input" placeholder="제목을 입력하거나 아래에서 선택하세요" value="${esc(title)}" maxlength="150"><div class="compose-title-options" role="group" aria-label="제목 선택">${["공지","담임","마감","연수","제출","행사","회의","행정실","기타"].map(label=>`<button type="button" class="btn" data-title-choice="${label}" aria-pressed="${label===composeDraft.titleChoice}">${label}</button>`).join("")}</div></div></div><div class="compose-editor"><div class="editor-tools" aria-label="본문 서식">${button("editor-bold", "B", "", "", 'aria-label="굵게"')}${button("editor-italic", "I", "", "", 'aria-label="기울임"')}${button("editor-underline", "U", "", "", 'aria-label="밑줄"')}${button("editor-list", "목록", "checklist")}${button("editor-clear", "서식 지우기")}<select id="editor-font-size" aria-label="글자 크기"><option value="">글자 크기</option><option value="2">13px</option><option value="3">16px</option><option value="4">18px</option><option value="5">24px</option><option value="6">32px</option></select>${button("editor-palette-toggle","글자 색상","","",'data-palette="text" aria-expanded="false" aria-controls="editor-text-palette"')}${button("editor-palette-toggle","형광펜","","",'data-palette="highlight" aria-expanded="false" aria-controls="editor-highlight-palette"')}${editorPaletteHTML("text")}${editorPaletteHTML("highlight")}</div><div class="rich-editor" id="mail-editor" contenteditable="true" role="textbox" aria-label="메시지 본문" aria-multiline="true" data-placeholder="선생님께 전할 이야기와 자료를 적어 주세요.">${richBody?safeRichHTML(richBody):esc(body).replace(/\n/g, "<br>")}</div></div><input type="file" id="mail-files" multiple hidden><p class="muted attachment-limit-note">${native?"파일당 500 MB · 합계 2 GB":"화면 체험: 파일당 2 MB · 합계 3 MB"} · 본문 이미지 포함 최대 20개 · 서버 보관 10일</p><div class="compose-files" id="compose-files">${composeFilesHTML()}</div><div id="compose-error" class="form-error" role="alert"></div></form>`,
      button("close-modal", "취소") + button("capture-mail", "캡처", "") + button("attach-mail", "파일 첨부", "clip") +
        `<button class="btn btn-primary" type="submit" form="compose-form">${icon("send", 16)} 보내기</button>`,
      "compose-modal",
    );
    workUI.mountCompose(workRequest,workReminderOf);
    initCompose();
    setComposeMode(mode);
    const refreshLesson=()=>{const kind=$("#lesson-kind").value;$("#lesson-assignment").hidden=!kind;$$('.lesson-original').forEach(el=>el.hidden=kind!=="lessonChange");$("#lesson-teacher-heading").textContent=kind==="lessonChange"?"교체 교사":"보강 교사";for(const period of Array.from({length:7},(_,i)=>i+1)){const slot=periodsForDate($("#lesson-date").value).find(p=>p.period===period);$(`[data-lesson-time="${period}"]`).textContent=slot?`${slot.start}–${slot.end}`:"미설정";}$$("[data-action=compose-mode]").forEach(button=>button.disabled=!!kind&&button.dataset.mode!=="general");if(kind) setComposeMode("general");};
    const updateHomeroom=()=>{const kind=$("#lesson-kind").value;for(let period=1;period<=7;period++){const name=$(`[data-lesson-class="${period}"]`).value.trim(),mapping=(state.data.classTeachers||[]).find(c=>c.className.replace(/\s+/g,"")===name.replace(/\s+/g,""));const label=$(`[data-lesson-homeroom="${period}"]`);label.textContent=kind==="makeup"&&name?(mapping?`담임: ${person(mapping.teacher).name} · 자동 수신`:"담임 미등록 · 관리자 설정 필요"):"";}};
    $$("[data-lesson-class]").forEach(el=>el.oninput=updateHomeroom);
    $("#lesson-kind").addEventListener("change",updateHomeroom);
    $("#lesson-kind").value=noticeType;$("#lesson-kind").onchange=refreshLesson;$("#lesson-date").onchange=refreshLesson;refreshLesson();updateHomeroom();
    if(native&&composeDraft.files.some(f=>f.stored&&!f.data)){
      const draft=composeDraft,button=$("button[form=compose-form]");button.disabled=true;
      Promise.all(draft.files.map(async file=>{if(file.stored&&!file.data&&!file.localFile){const result=await native.request("/attachment",{mail:file.sourceMail,index:file.index});if(result.error)throw new Error(result.error);Object.assign(file,result.file);}})).then(()=>{if(composeDraft===draft)button.disabled=false;}).catch(error=>{if(composeDraft===draft){$("#compose-error").textContent=error.message;button.disabled=false;}});
    }
  }
  function recipientChips(kind = "to") {
    return composeDraft[kind]
      .map(
        (id) =>
          `<span class="chip">${esc(person(id).name)}<button type="button" data-action="remove-recipient" data-person="${id}" data-kind="${kind}" aria-label="${esc(person(id).name)} 제외">×</button></span>`,
      )
      .join("");
  }
  function composeFilesHTML() {
    return composeDraft.files
      .map(
        (f, i) =>
          `<span class="chip">${icon("clip", 12)}${esc(f.name)}<button type="button" data-action="remove-file" data-file="${i}" aria-label="첨부 삭제">×</button></span>`,
      )
      .join("");
  }
  function initCompose() {
    $$("[data-title-choice]").forEach(option=>option.onclick=()=>{
      composeDraft.titleChoice=option.dataset.titleChoice;
      $$("[data-title-choice]").forEach(button=>button.setAttribute("aria-pressed",String(button===option)));
    });
    editorFormatRange=null;editorTypingFormats={};editorTypingAnchor=null;
    $(".editor-tools").onpointerdown=event=>{captureEditorFormat();if(event.target.closest("button"))event.preventDefault();};
    $("#editor-font-size").onchange=event=>{if(["2","3","4","5","6"].includes(event.target.value))applyEditorFormat("fontSize",event.target.value);};
    const drop = $("#mail-editor");
    drop.addEventListener("dragover", e=>{
      if(!Array.from(e.dataTransfer.types).includes("Files"))return;
      e.preventDefault();drop.classList.add("over");
    });
    drop.addEventListener("dragleave",()=>drop.classList.remove("over"));
    drop.addEventListener("drop", e=>{
      drop.classList.remove("over");
      if(!e.dataTransfer.files.length)return;
      e.preventDefault();addFiles(e.dataTransfer.files);
    });
    drop.addEventListener("paste",event=>{
      const images=Array.from(event.clipboardData?.items||[]).filter(item=>/^image\/(png|jpeg|webp|gif)$/.test(item.type));
      if(!images.length)return;
      event.preventDefault();captureEditorFormat();
      const draft=composeDraft;
      (async()=>{for(const item of images){const file=item.getAsFile();if(file)await insertImageFile(file,draft);}})().catch(()=>{if(composeDraft===draft)$("#compose-error").textContent="이미지를 읽을 수 없습니다.";});
    });
    $("#mail-files").onchange = (e) => addFiles(e.target.files);
    ["recipient-input", "cc-input"].forEach((id) => {
      const input = $("#" + id),
        kind = id === "recipient-input" ? "to" : "cc";
      input.oninput = () => recipientSuggestions(input, kind);
      input.onfocus = () => recipientSuggestions(input, kind);
      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          $(
            "#" + (kind === "to" ? "recipient" : "cc") + "-suggestions button",
          )?.click();
        }
        if (e.key === "Escape") {e.preventDefault();e.stopPropagation();hideRecipientSuggestions(kind);}
      };
    });
    const resize=new ResizeObserver(()=>{refreshRecipientFold("to");refreshRecipientFold("cc");});
    resize.observe($("#recipient-values"));resize.observe($("#cc-values"));
    const removeImageResize=DingdongImageResize.attach(drop);
    modalCleanup=()=>{resize.disconnect();removeImageResize();};
    $("#compose-form").onsubmit = sendMail;
  }
  function refreshRecipientFold(kind){
    const values=$(kind==="to"?"#recipient-values":"#cc-values");if(!values)return;
    const toggle=$(`[data-action=recipient-more][data-kind="${kind}"]`),chips=$$(".chip",values);
    const rows=[...new Set(chips.map(chip=>chip.offsetTop))].sort((a,b)=>a-b);
    const overflowing=rows.length>2,expanded=toggle.getAttribute("aria-expanded")==="true";
    toggle.hidden=!overflowing;toggle.textContent=expanded?"접기":"더 보기";
    values.style.maxHeight=overflowing&&!expanded?`${rows[1]+chips.find(chip=>chip.offsetTop===rows[1]).offsetHeight}px`:"none";
    chips.forEach(chip=>{const clipped=overflowing&&!expanded&&chip.offsetTop>rows[1];chip.setAttribute("aria-hidden",String(clipped));$("button",chip).tabIndex=clipped?-1:0;});
  }
  function setComposeMode(mode){
    if(!composeDraft||!["general","announcement","scheduled","event"].includes(mode))return;
    composeDraft.mode=mode;
    $$("[data-action=compose-mode]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.mode===mode)));
    const announcement=mode==="announcement";
    $("#compose-announcement").hidden=!announcement;
    $$("select",$("#compose-announcement")).forEach(input=>{input.disabled=!announcement;input.required=announcement;});
    $("#compose-recipient-row").hidden=announcement;$("#compose-cc-row").hidden=announcement;
    for(const kind of ["to","cc"])hideRecipientSuggestions(kind);
    for(const [id,selected] of [["compose-reservation",mode==="scheduled"||announcement&&composeDraft.announcementScheduled],["compose-event",mode==="event"||announcement&&composeDraft.announcementEvent]]){
      const section=$("#"+id);section.hidden=!selected;
      $$("input",section).forEach(input=>{input.disabled=!selected;input.required=selected&&input.id!=="compose-event-place";});
    }
    $("#compose-error").textContent="";
  }
  function hideRecipientSuggestions(kind){
    const target=$("#"+(kind==="to"?"recipient":"cc")+"-suggestions");
    if(target){target.hidden=true;target.innerHTML="";}
  }
  function recipientSuggestions(input, kind) {
    const target = $(
      "#" + (kind === "to" ? "recipient" : "cc") + "-suggestions",
    );
    if(!composeDraft||!input.value.trim()){hideRecipientSuggestions(kind);return;}
    const people = state.data.people
      .filter(
        (p) =>
          !composeDraft[kind].includes(p.id) &&
          (p.name + p.department).includes(input.value.trim()),
      )
      .slice(0, 6);
    target.hidden = !people.length;
    target.innerHTML = people
      .map(
        (p) =>
          `<button type="button" data-action="add-recipient" data-person="${p.id}" data-kind="${kind}">${avatar(p, "small")}<span>${esc(p.name)} <small class="muted">${esc(p.department)}</small></span></button>`,
      )
      .join("");
  }
  function imageBytes(data){
    if(!/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/.test(data))return 0;
    const encoded=data.slice(data.indexOf(",")+1);if(encoded.length%4)return 0;
    const bytes=encoded.length*3/4-(encoded.endsWith("==")?2:encoded.endsWith("=")?1:0);
    return bytes>0&&bytes<=2*1024*1024?bytes:0;
  }
  function composeAttachmentSizes(){return [...composeDraft.files.map(f=>f.data?DingdongAttachmentLimits.dataBytes(f.data):f.bytes||0),...$$("#mail-editor img").map(img=>DingdongAttachmentLimits.dataBytes(img.getAttribute("src")))];}
  async function insertImageFile(file,draft=composeDraft){
    if(file.size>2*1024*1024){$("#compose-error").textContent="이미지는 2 MB 이하로 넣어 주세요.";return;}
    if($$('#mail-editor img').reduce((sum,img)=>sum+imageBytes(img.getAttribute('src')),0)+file.size>3*1024*1024){$('#compose-error').textContent='본문 이미지는 합계 3 MB까지 넣을 수 있습니다. 큰 이미지는 파일로 첨부해 주세요.';return;}
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file);});
    if(composeDraft!==draft)return;
    const bytes=imageBytes(data);
    const problem=DingdongAttachmentLimits.validate([...composeAttachmentSizes(),bytes]);
    if(!bytes||problem){$("#compose-error").textContent=problem||"이미지를 읽을 수 없습니다.";return;}
    applyEditorFormat("insertHTML",`<img src="${data}" alt="캡처 이미지"><br>`);
    $("#compose-error").textContent="";
  }
  async function addFiles(files) {
    const draft=composeDraft;
    draft.preparing=(draft.preparing||0)+1;
    try{
    for (const file of files) {
      if(composeDraft!==draft)return;
      const problem=DingdongAttachmentLimits.validate([...composeAttachmentSizes(),file.size]);
      if(problem){$("#compose-error").textContent=problem;continue;}
      if(native){
        let prepared;
        try{
          prepared=await native.stageAttachment('begin',{name:file.name,bytes:file.size,mime:file.type});if(prepared.error)throw Error(prepared.error);
          for(let offset=0;offset<file.size;offset+=1024*1024){if(composeDraft!==draft)throw Error('작성이 종료되었습니다.');const data=new Uint8Array(await file.slice(offset,offset+1024*1024).arrayBuffer()),result=await native.stageAttachment('chunk',{localFile:prepared.localFile,offset,data});if(result.error)throw Error(result.error);$('#compose-error').textContent=`첨부 준비 중 · ${file.name} · ${Math.round(result.offset/file.size*100)}%`;}
          const result=await native.stageAttachment('finish',{localFile:prepared.localFile});if(result.error)throw Error(result.error);if(composeDraft!==draft)return;
          const after=DingdongAttachmentLimits.validate([...composeAttachmentSizes(),result.bytes]);if(after)throw Error(after);draft.files.push(result);$('#compose-error').textContent='';
        }catch(error){if(prepared?.localFile)await native.stageAttachment('cancel',{localFile:prepared.localFile});if(composeDraft===draft)$('#compose-error').textContent=error.message;}
        continue;
      }
      if(file.size>2*1024*1024||composeAttachmentSizes().reduce((a,b)=>a+b,0)+file.size>3*1024*1024){$('#compose-error').textContent='큰 파일 전송은 설치형 클라이언트에서 지원합니다. 화면 체험에서는 파일당 2 MB, 합계 3 MB까지 첨부해 주세요.';continue;}
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      }).catch(() => null);
      if(!data){if(composeDraft===draft)$("#compose-error").textContent='파일을 읽지 못했습니다. 다시 선택해 주세요.';continue;}
      if(composeDraft!==draft)return;
      const afterRead=DingdongAttachmentLimits.validate([...composeAttachmentSizes(),DingdongAttachmentLimits.dataBytes(data)]);
      if(afterRead){$("#compose-error").textContent=afterRead;continue;}
      if (data && composeDraft===draft)
        draft.files.push({
          name: file.name,
          size:
            file.size < 1024
              ? file.size + " B"
              : Math.ceil(file.size / 1024) + " KB",
          bytes: file.size,
          data,
        });
    }
    }finally{draft.preparing--;if (composeDraft===draft) $("#compose-files").innerHTML = composeFilesHTML();}
  }
  async function sendMail(e) {
    e.preventDefault();
    if(mailSending)return;
    const title = $("#mail-title").value.trim() || composeDraft.titleChoice || "기타",
      body = $("#mail-editor").innerText.trim() || ($("#mail-editor img")?"[이미지]":""),
      scheduled = (composeDraft.mode === "scheduled" || composeDraft.mode==="announcement"&&composeDraft.announcementScheduled)
        ? $("#mail-scheduled-at").value
        : "";
    const error = $("#compose-error");
    const isAnnouncement=composeDraft.mode==="announcement",withEvent=composeDraft.mode==="event"||isAnnouncement&&composeDraft.announcementEvent;
    let announcement=null;
    if(isAnnouncement){
      const audience=$("#announcement-audience").value,department=$("#announcement-department").value;
      const to=window.DingdongAnnouncements.recipients(state.data.people,audience);
      if(!to.length||!state.data.departments.includes(department)){error.textContent="수신 대상과 발신 부서를 선택해 주세요.";return;}
      announcement={audience,department};
    }
    const recipients=announcement?window.DingdongAnnouncements.recipients(state.data.people,announcement.audience):composeDraft.to;
    const cc=isAnnouncement?[]:composeDraft.cc;
    let notice=null;
    if($("#lesson-kind").value){const kind=$("#lesson-kind").value,date=$("#lesson-date").value;const rows=$$("[data-lesson-period]:checked").map(el=>{const period=Number(el.dataset.lessonPeriod);return {period,teacher:$(`[data-lesson-teacher="${period}"]`).value,className:$(`[data-lesson-class="${period}"]`).value.trim(),...(kind==="lessonChange"?{originalTeacher:$(`[data-lesson-original="${period}"]`).value}:{})};});
      if(!date||!rows.length||rows.some(row=>!row.teacher||kind==="lessonChange"&&(!row.className||!row.originalTeacher||row.teacher===row.originalTeacher)||!periodsForDate(date).some(p=>p.period===row.period))){error.textContent="교시와 배정 교사를 선택해 주세요. 수업 변경은 반과 서로 다른 기존·교체 교사가 필요합니다. 일과표에 없는 교시는 사용할 수 없습니다.";return;}
      if(kind==="makeup"){for(const row of rows){if(!row.className)continue;const mapping=(state.data.classTeachers||[]).find(c=>c.className.replace(/\s+/g,"")===row.className.replace(/\s+/g,""));if(!mapping){error.textContent=`${row.className}의 담임이 등록되지 않았습니다. 관리자에게 교직원 정보의 학년·반 등록을 요청하세요.`;return;}row.homeroomTeacher=mapping.teacher;}}
      notice={kind,date,rows};
    }
    if (!recipients.length&&!notice) {
      error.textContent = "받는 선생님을 한 명 이상 지정해 주세요.";
      return;
    }
    if (!body) {
      error.textContent = "본문을 입력해 주세요.";
      return;
    }
    if (
      (composeDraft.mode === "scheduled" || isAnnouncement&&composeDraft.announcementScheduled) &&
      (!scheduled || new Date(scheduled) <= new Date())
    ) {
      error.textContent = "예약 날짜·시간을 현재보다 이후로 지정해 주세요.";
      return;
    }
    if(withEvent){
      const date=$("#compose-event-date").value,start=$("#compose-event-start").value,end=$("#compose-event-end").value;
      if(!date||!start||!end||minutes(start)>=minutes(end)){error.textContent="일정 날짜와 시간을 확인해 주세요. 종료 시간은 시작 시간보다 늦어야 해요.";return;}
    }
    const attachmentProblem=DingdongAttachmentLimits.validate(composeAttachmentSizes());
    if(attachmentProblem){error.textContent=attachmentProblem;return;}
    if($$('#mail-editor img').reduce((sum,img)=>sum+imageBytes(img.getAttribute('src')),0)>3*1024*1024){error.textContent='본문 이미지는 합계 3 MB까지 넣을 수 있습니다. 큰 이미지는 파일로 첨부해 주세요.';return;}
    if(composeDraft.preparing){error.textContent='첨부 파일 준비가 끝난 뒤 보내 주세요.';return;}
    if(native&&composeDraft.files.some(f=>!f.data&&!f.localFile)){error.textContent="첨부 파일을 불러오지 못했습니다. 해당 파일을 제거한 뒤 다시 첨부해 주세요.";return;}
    let workRequest;
    try {workRequest=workUI.readCompose([...new Set([...recipients,...(notice?notice.rows.flatMap(r=>[r.teacher,r.originalTeacher,r.homeroomTeacher].filter(Boolean)):[])])],cc);}
    catch(problem){error.textContent=problem.message;return;}
    if(composeDraft.workReminderOf&&(scheduled||notice||announcement||workRequest||cc.length)){error.textContent="재안내는 참조·예약·새 요청 없이 보내 주세요.";return;}
    if(!native&&composeDraft.workReminderOf){const original=state.data.mails.find(m=>m.id===composeDraft.workReminderOf);const pending=original&&DingdongWorkTools.summary(original).pending;if(!pending||recipients.some(id=>!pending.includes(id))){error.textContent="완료 현황이 변경되었습니다. 현황판에서 재안내 대상을 다시 선택해 주세요.";return;}}
    const sentAt=Date.now();
    const m = {
      id: uid("user-mail"),
      from: "me",
      to: [...new Set([...recipients, ...cc,...(notice?notice.rows.flatMap(row=>[row.teacher,row.originalTeacher,row.homeroomTeacher].filter(Boolean)):[])])],
      cc,
      title,
      ...(composeDraft.titleChoice==="담임"?{category:"homeroom",titleProvided:!!$("#mail-title").value.trim()}:{}),
      body,
      html: safeRichHTML($("#mail-editor").innerHTML),
      folder: "sent",
      unread: false,
      important: false,
      createdAt: sentAt,
      date: window.DingdongDeadlines.sentDate(sentAt),
      time: new Date(sentAt).toLocaleTimeString("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit"}),
      files: composeDraft.files,
      receipts: [...new Set([...recipients, ...cc,...(notice?notice.rows.flatMap(row=>[row.teacher,row.originalTeacher,row.homeroomTeacher].filter(Boolean)):[])])].map(
        () => "unread",
      ),
      scheduled,
      ...(notice?{notice}:{}),
      ...(announcement?{announcement}:{}),
      ...(workRequest?{workRequest,workResponses:{}}:{}),
      ...(composeDraft.workReminderOf?{workReminderOf:composeDraft.workReminderOf}:{}),
    };
    if(notice){const summary=notice.rows.map(row=>`${row.period}교시 · ${row.className||"반 미지정"} · ${row.originalTeacher?person(row.originalTeacher).name+" → ":""}${person(row.teacher).name}${row.homeroomTeacher?" · 담임: "+person(row.homeroomTeacher).name:""}`).join("\n");m.body=`${body}\n\n${notice.date} ${typeLabel(notice.kind)}\n${summary}`;m.html=safeRichHTML(m.html+"<br><br>"+esc(`${notice.date} ${typeLabel(notice.kind)}\n${summary}`).replace(/\n/g,"<br>"));for(const row of notice.rows){const slot=periodsForDate(notice.date).find(p=>p.period===row.period);state.data.events.push({id:m.id+"-p"+row.period,title:`${typeLabel(notice.kind)} · ${row.period}교시${row.className?" · "+row.className:""}`,date:notice.date,start:slot.start,end:slot.end,type:notice.kind,period:row.period,targets:[...new Set([row.teacher,row.originalTeacher,row.homeroomTeacher].filter(Boolean))],note:m.body,place:row.className||"",assignment:row,noticeMail:m.id});}}
    if(withEvent){
      const id=uid("user-event"),date=$("#compose-event-date").value,start=$("#compose-event-start").value,end=$("#compose-event-end").value,place=$("#compose-event-place").value.trim();
      const summary=`일정: ${date} ${start}–${end}${place?"\n장소: "+place:""}`;
      state.data.events.push({id,title:title||body.split("\n")[0].slice(0,80),date,start,end,place,note:body,type:"group",targets:[...m.to],...(scheduled?{deliveryMail:m.id}:{})});
      m.eventId=id;m.calendarEvent=id;m.body=body+"\n\n"+summary;m.html=safeRichHTML(m.html+"<br><br>"+esc(summary).replace(/\n/g,"<br>"));
    }
    state.data.mails.unshift(m);
    mailSending=true;const submit=$('button[form="compose-form"]');if(submit)submit.disabled=true;
    const sent=await save();
    if(!sent){state.data.mails=state.data.mails.filter(item=>item.id!==m.id);state.data.events=state.data.events.filter(item=>item.noticeMail!==m.id&&item.id!==m.calendarEvent);mailSending=false;if(submit)submit.disabled=false;error.textContent="발송하지 못했습니다. 저장 공간과 연결을 확인하고 다시 보내 주세요.";return;}
    const delivery=native?network.lastSyncResult?.delivery?.[m.id]:null;
    if(delivery==='failed'){mailSending=false;if(submit)submit.disabled=false;error.textContent='발송하지 못했습니다. 보낸 메시지함에 실패 사유와 원문을 보관했습니다. 내용을 고쳐 보내거나 보낸함에서 다시 시도해 주세요.';return;}
    closeModal();mailSending=false;
    if(requestedCompose){await windowApi.composeSent();return;}

    render();
    toast(
      delivery==='queued'?"PC에 발송 대기 중입니다":scheduled ? "예약 메시지를 저장했어요" : "보낸 메시지함에 저장했어요",
      delivery==='queued'?"연결이 복구되면 자동으로 전송합니다. 아직 서버에 전달되지 않았습니다.":scheduled
        ? native ? "예약 시간에 서버가 자동으로 발송합니다." : "체험 버전에서는 자동 발송되지 않습니다."
        : native ? "이 PC에 보관했습니다. 서버를 통해 수신자에게 전달하며, 연결이 끊기면 재연결 후 다시 전송합니다." : "체험 데이터이며 실제 선생님에게 전송되지 않습니다.",
    );
  }
  async function downloadFile(m, i) {
    const f = m.files[i];
    if (!f) return;
    if(native&&f.stored){try{const result=await native.saveAttachment({mail:f.sourceMail||m.id,index:f.index??i});if(result.error)throw Error(result.error);if(!result.canceled)toast('첨부 파일을 저장했어요',f.name);}catch(error){toast('첨부 파일을 저장하지 못했어요',error.message);}return;}
    if(native&&f.stored&&!f.data){const result=await native.request("/attachment",{mail:f.sourceMail,index:f.index});if(result.error){toast("첨부 파일을 열 수 없어요",result.error);return;}Object.assign(f,result.file);}
    if (!f.data) {
      toast("예시 첨부 파일입니다", "직접 첨부한 파일만 다운로드할 수 있어요.");
      return;
    }
    const a = document.createElement("a");
    a.download = f.name;
    a.href = f.data;
    a.click();
  }
  function calendarHeading() {return heading(
        "MAKE ROOM FOR WHAT MATTERS",
        "나의 일정",
        "함께하는 약속도, 나만의 시간도 한눈에.",
        (!native ? button("demo-deadline", "메시지 일정 체험", "mail") : "") +
        button("weekly", "주간 달력", "calendar",state.calendarView==="week"?"btn-primary":"",`aria-pressed="${state.calendarView==="week"}"`) +
        button("monthly", "월간 달력", "calendar",state.calendarView==="month"?"btn-primary":"",`aria-pressed="${state.calendarView==="month"}"`) +
        button("duty-calendar", "업무 달력", "calendar",state.calendarView==="duty"?"btn-primary":"",`aria-pressed="${state.calendarView==="duty"}"`) +
          button("add-event", "일정 등록", "plus", "btn-primary"),
      );}
  function calendarPage() {
    if(state.calendarView==="duty")return calendarHeading()+exchangeDashboard()+`<div class="calendar-layout duty-calendar-layout"><section class="panel calendar-month-panel duty-calendar-panel" aria-label="업무 달력">${dutyMonthlyBody()}</section><aside class="calendar-aside homeroom-calendar-aside">${homeroomCard()}</aside></div>`;
    if(state.calendarView==="month")return calendarHeading()+exchangeDashboard()+`<section class="panel calendar-month-panel">${monthlyBody()}</section>`;
    const weekDays=Array.from({length:7},(_,i)=>addDays(state.week,i)),datedItems=[...state.data.events,...state.data.deadlines,...state.data.academic];
    const showDay=date=>state.today===date||datedItems.some(item=>item.date===date);
    const days=weekDays.slice(0,showDay(weekDays[6])?7:showDay(weekDays[5])?6:5),range=timelineRange(days,1320);
    return (
      calendarHeading() + exchangeDashboard() +
      `<div style="display:flex;align-items:center;justify-content:space-between;margin:-3px 0 18px;gap:10px"><span class="stat-line">${icon("calendar", 15)} 이번 주 ${state.data.events.filter((e) => days.includes(e.date)).length}개의 일정</span><div class="calendar-toolbar">${ib("week-prev", "이전 주", "left")}<h2>${fmtDate(days[0], { month: "numeric", day: "numeric" })} — ${fmtDate(days[days.length-1], { month: "numeric", day: "numeric" })}</h2>${ib("week-next", "다음 주", "right")}${button("week-reset", "이번 주")}</div></div><div class="calendar-layout"><section class="panel calendar-grid"><div class="time-column"><div class="calendar-top">일정</div><div class="academic-row">학사 일정</div><div class="deadline-row">완료 확인</div><div class="hours" style="height:${range.end-range.start}px">${Array.from({ length: range.hours }, (_, i) => `<div class="hour-label">${String(i + range.start/60).padStart(2, "0")}:00</div>`).join("")}<div class="timeline-end-label">${String(range.end/60).padStart(2,"0")}:00</div></div></div>${days.map((day) => dayColumn(day,range)).join("")}</section><aside class="calendar-aside"><section class="panel mini-calendar">${miniMonth()}</section><div class="panel legend"><span><i style="background:#7898bb"></i>단체 일정</span><span><i style="background:#d39a26"></i>개인 일정</span><span><i style="background:#be9c64"></i>정기 업무</span></div></aside></div>`
    );
  }
  function dayColumn(day,range=timelineRange([day])) {
    const events = state.data.events
      .filter((e) => e.date === day)
      .sort((a, b) => a.start.localeCompare(b.start));
    const layouts=timelineSlots(day,1);
    const nowMin=minutes(new Date().toLocaleTimeString("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit"}));
    return `<div class="day-column ${day === Mock.today ? "today" : ""} ${state.expanded === day ? "expanded" : state.expanded ? "dim" : ""}"><button class="calendar-top" data-action="expand-day" data-date="${day}" aria-pressed="${state.expanded === day}">${fmtDate(day, { weekday: "short" })}<b>${parseDate(day).getDate()}</b></button><div class="academic-row">${state.data.academic
      .filter((a) => a.date === day)
      .map((a) => esc(a.title))
      .join("<br>")}</div><div class="deadline-row">${state.data.deadlines
      .filter((d) => d.date === day&&!d.source)
      .map(
        (d) =>
          `<button class="deadline-pill ${d.done ? "done" : ""}" data-action="deadline-detail" data-deadline="${d.id}">${homeroomDeadlineIcon(d)}${eventMemoIcon(d)}${icon(d.done ? "check" : "clock", 10)}${esc(calendarTitle(d))}${d.dueTime ? ` · ${esc(d.dueTime)}까지` : ""}</button>`,
      )
      .join(
        "",
      )}</div><div class="hours" style="height:${range.end-range.start}px" data-timeline-start="${range.start}" data-timeline-end="${range.end}" data-day-hours="${day}" data-calendar-timeline="${day}" title="드래그로 시간대를 선택하거나 두 번 클릭해 일정을 등록하세요">${events
      .map((e) => {
        const top = minutes(e.start) - range.start,
          height = minutes(e.end) - minutes(e.start),
          {count:n,slot} = layouts.get('event:'+e.id);
        return `<button class="event ${e.type} ${slot<n-1?"timeline-divider":""} ${isPrivateEvent(e)?"private-schedule":""} ${canMoveEvent(e)?"movable":""} ${minutes(e.end)-minutes(e.start)<30?"short":""}" data-action="view-event" data-event="${e.id}" style="top:${Math.max(0, top)}px;height:${Math.max(14, Math.min(range.end-range.start - Math.max(0, top), height))}px;left:calc(${(slot * 100) / n}% + 5px);width:calc(${100 / n}% - 10px);right:auto" title="${esc(calendarTitle(e))} · ${esc(fmtDate(e.date))} · ${e.start}–${e.end}"><strong>${eventMemoIcon(e)}${esc(calendarTitle(e))}</strong><small>${e.start}–${e.end}</small><small>${esc(e.place)}</small>${eventHandles(e)}</button>`;
      })
      .join("")}${timelinePoints(day,range.start,1)}${day === Mock.today && nowMin >= range.start && nowMin <= range.end ? `<div class="now-line" style="top:${nowMin - range.start}px"></div>` : ""}</div></div>`;
  }
  function monthDates(anchor) {
    const d = parseDate(anchor);
    d.setDate(1);
    d.setDate(1 - d.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(dateKey(d), i));
  }
  function miniMonth() {
    const month = parseDate(state.week).getMonth();
    return `<div class="mini-calendar-header"><strong>${fmtDate(state.week, { year: "numeric", month: "long" })}</strong>${ib("monthly", "월간 달력 열기", "popout")}</div><div class="mini-grid">${["일", "월", "화", "수", "목", "금", "토"].map((d) => `<span class="day-label">${d}</span>`).join("")}${monthDates(
      state.week,
    )
      .map(
        (day) =>
          `<button data-action="calendar-jump" data-date="${day}" class="${parseDate(day).getMonth() !== month ? "other" : ""} ${day === Mock.today ? "current" : ""} ${day === state.today ? "selected" : ""}" aria-label="${fmtDate(day)}">${parseDate(day).getDate()}</button>`,
      )
      .join("")}</div>`;
  }
  let monthAnchor = Mock.today;
  function monthly() {
    state.calendarView="month";
    renderPage();
  }
  function monthlyBody() {
    const month = parseDate(monthAnchor).getMonth();
    return `<div class="calendar-toolbar" style="justify-content:center;margin-bottom:20px">${ib("month-prev", "이전 달", "left")}<h2 style="font-size:19px">${fmtDate(monthAnchor, { year: "numeric", month: "long" })}</h2>${ib("month-next", "다음 달", "right")}</div><div class="month-grid">${["일", "월", "화", "수", "목", "금", "토"].map((d) => `<div class="day-label">${d}</div>`).join("")}${monthDates(
      monthAnchor,
    )
      .map(
        (day, i) =>
          `<button class="month-cell ${i % 7 === 0 ? "sunday" : i % 7 === 6 ? "saturday" : ""} ${parseDate(day).getMonth() !== month ? "other" : ""} ${day === Mock.today ? "current" : ""}" data-action="month-date" data-date="${day}" aria-label="${fmtDate(day)} 일정 등록"><b>${parseDate(day).getDate()}</b>${state.data.academic
            .filter((a) => a.date === day)
            .map((a) => `<small class="academic">${esc(a.title)}</small>`)
            .join("")}${state.data.deadlines.filter(d=>d.date===day).map(d=>`<small class="deadline-pill">${homeroomDeadlineIcon(d)}${eventMemoIcon(d)}${esc(calendarTitle(d))}${d.dueTime?` · ${esc(d.dueTime)}까지`:" · 마감"}</small>`).join("")}${state.data.events
            .filter((e) => e.date === day)
            .slice(0, 3)
            .map((e) => `<small>${esc(e.start)} ${eventMemoIcon(e)}${esc(calendarTitle(e))}</small>`)
            .join("")}</button>`,
      )
      .join("")}</div>`;
  }
  function dutyCalendarEvents(){
    const events=new Map();
    for(const event of [...(state.data.dutyCalendar||[]),...state.data.events])if(Object.hasOwn(DingdongDuties.types,event.duty?.kind))events.set(event.id,event);
    return [...events.values()];
  }
  const calendarEvent=id=>state.data.events.find(e=>e.id===id)||dutyCalendarEvents().find(e=>e.id===id);
  function dutyMonthlyBody(){
    const month=parseDate(monthAnchor).getMonth(),events=dutyCalendarEvents(),actor=calendarActor(),order=['safety','lunch','study'];
    return `<div class="calendar-toolbar duty-month-toolbar">${ib('month-prev','이전 달','left')}<h2>${fmtDate(monthAnchor,{year:'numeric',month:'long'})}</h2>${ib('month-next','다음 달','right')}${button('duty-month-reset','이번 달')}</div><div class="duty-calendar-legend">${order.map(kind=>`<span class="duty-color-${kind}">${esc(DingdongDuties.types[kind].label)}</span>`).join('')}<span class="duty-border-key own">내 배정</span><span class="duty-border-key pending">교환 진행 중</span></div><div class="month-grid duty-month-grid">${['일','월','화','수','목','금','토'].map(day=>`<div class="day-label">${day}</div>`).join('')}${monthDates(monthAnchor).map((day,i)=>{
      const entries=events.filter(e=>e.date===day).sort((a,b)=>order.indexOf(a.duty.kind)-order.indexOf(b.duty.kind)||a.start.localeCompare(b.start));
      return `<article class="month-cell duty-month-cell ${i%7===0?'sunday':i%7===6?'saturday':''} ${parseDate(day).getMonth()!==month?'other':''} ${day===Mock.today?'current':''}" data-duty-date="${day}" aria-label="${fmtDate(day)} 업무"><b>${parseDate(day).getDate()}</b>${entries.map(e=>{
        const own=e.duty.assigned.includes(actor.id),pending=exchangeVisible().some(r=>DingdongDutyExchanges.active(r)&&[r.from.id,r.to.id].includes(e.id));
        const names=e.duty.assigned.map(id=>person(id).name).join(', ');
        return `<button type="button" class="duty-month-entry duty-color-${e.duty.kind} ${own?'own-assignment':''} ${pending?'exchange-pending':''}" data-action="view-event" data-event="${esc(e.id)}" aria-label="${esc(DingdongDuties.types[e.duty.kind].label+' · '+day+' · '+names+(own?' · 내 배정':'')+(pending?' · 교환 진행 중':''))}"><strong>${eventMemoIcon(e)}${esc(DingdongDuties.types[e.duty.kind].label)}</strong><span class="duty-month-teachers">${esc(names)}</span></button>`;
      }).join('')}${!entries.length?'<span class="duty-month-empty">배정 없음</span>':''}</article>`;
    }).join('')}</div>`;
  }
  const periodsForDate=date=>state.data.bellSchedules?.find(s=>s.date===date)?.periods||state.data.defaultPeriods||Mock.defaultPeriods;
  function classTeachersForm(){
    const editable=!native||state.profile?.admin,people=state.profile?.id?[state.profile,...state.data.people]:state.data.people;
    const existing=state.data.classTeachers||[];const names=[...new Set([...existing.map(c=>c.className),...Array.from({length:36},(_,i)=>`${Math.floor(i/12)+1}학년 ${i%12+1}반`)])];
    const row=name=>`<div class="two-fields" data-class-row><label>반<input class="input" data-class-name value="${esc(name)}" maxlength="40" ${editable?'':'disabled'}></label><label>담임<select class="input" data-class-teacher ${editable?'':'disabled'}><option value="">미등록</option>${people.map(p=>`<option value="${p.id}" ${existing.find(c=>c.className===name)?.teacher===p.id?'selected':''}>${esc(p.name)} · ${esc(p.department)}</option>`).join("")}</select></label></div>`;
    openModal("반·담임 설정",`<form id="classes-form" class="event-form"><p class="muted">${editable?"보강에서 반을 지정하면 등록된 담임에게도 함께 발송합니다. 미등록을 선택하면 연결을 해제합니다.":"학교 관리자가 지정한 반별 담임입니다. 변경은 관리자에게 요청하세요."}${native?'':' 예시 담임 배정이므로 학교의 실제 담임에 맞게 수정하세요.'}</p><div id="classes-rows">${names.map(row).join("")}</div>${editable?'<button type="button" id="class-add" class="btn">반 추가</button>':''}<div id="classes-error" class="form-error" role="alert"></div></form>`,button("close-modal","닫기")+(editable?'<button type="submit" class="btn btn-primary" form="classes-form">담임 설정 저장</button>':''));
    if(!editable)return;$("#class-add").onclick=()=>$("#classes-rows").insertAdjacentHTML("beforeend",row(""));
    $("#classes-form").onsubmit=async event=>{event.preventDefault();const classes=$$("[data-class-row]").filter(el=>el.querySelector("[data-class-teacher]").value).map(el=>({className:el.querySelector("[data-class-name]").value.trim(),teacher:el.querySelector("[data-class-teacher]").value}));const seen=new Set();if(classes.some(c=>{const key=c.className.replace(/\s+/g,"");if(!key||seen.has(key))return true;seen.add(key);return false;})){$("#classes-error").textContent="반 이름을 입력하고 같은 반을 중복 등록하지 마세요.";return;}
      const form=event.currentTarget,submit=$('button[form="classes-form"]');if(submit.disabled)return;
      submit.disabled=true;const data=state.data,old=data.classTeachers;let result;
      data.classTeachers=classes;
      try{
        if(!(await save(value=>{result=value;}))){
          if(state.data===data)data.classTeachers=old;
          if(form.isConnected)form.querySelector('#classes-error').textContent=result?.error||'저장 결과를 확인하지 못했습니다. 입력 내용을 확인한 뒤 다시 시도해 주세요.';
          return;
        }
        if(form.isConnected)closeModal();
        toast(result?.publicSave==='pending'?'담임 설정이 서버 반영을 기다리고 있어요':'반별 담임을 저장했어요');
      }finally{if(submit.isConnected)submit.disabled=false;}
    };
  }
  function bellScheduleForm({basic=false}={}){
    const editable=!native||state.profile?.admin||dutyConfig().managers.timetable?.includes(state.profile?.id);
    openModal(basic?"기본 일과 시간 설정":"학교 일과표",`<form id="bell-form" class="event-form"><p class="muted">${editable?(basic?"임시 일과표가 없는 날에 적용할 기본 시간을 저장합니다.":"수정 일과표는 지정한 날짜에만 적용되고 다음 날에는 설정의 기본 시간을 사용합니다. 저장하면 전체 교직원에게 메시지를 발송합니다."):"학교 일과표는 관리자에게 변경을 요청하세요."}</p>${basic&&editable?`<fieldset class="bell-quick"><legend>일과 시간 한 번에 채우기</legend><div class="two-fields"><label>1교시 시작<input id="bell-quick-start" class="input" type="time"></label><label>수업 시간<select id="bell-quick-duration" class="input">${[40,45,50].map(n=>`<option value="${n}">${n}분</option>`).join("")}</select></label></div><div class="two-fields"><label>총 교시<select id="bell-quick-count" class="input">${Array.from({length:12},(_,i)=>`<option value="${i+1}">${i+1}교시</option>`).join("")}</select></label><div class="bell-break">쉬는 시간<strong>10분</strong></div></div><div class="two-fields"><label>점심 시작<input id="bell-quick-lunch-start" class="input" type="time"></label><label>점심 종료<input id="bell-quick-lunch-end" class="input" type="time"></label></div><button type="button" id="bell-quick-fill" class="btn">일과 시간 채우기</button><small class="muted">아래 시간을 채운 뒤 교시별로 조정할 수 있습니다. 저장 버튼을 눌러야 적용됩니다.</small><div id="bell-quick-error" class="form-error" role="alert"></div></fieldset>`:""}${basic?"":`<label>제목<input id="bell-title" class="input" maxlength="150" required ${editable?"":"disabled"}></label><label>날짜<input id="bell-date" type="date" class="input" value="${state.today}" required></label>`}<div id="bell-rows"></div><p class="muted">${basic?"학교의 실제 일과에 맞게 기본 시간을 설정하세요.":"지정한 날짜에만 적용합니다. 다른 날짜에 등록된 임시 일과표와 기본 시간은 유지됩니다."}</p><div id="bell-error" class="form-error" role="alert"></div></form>`,button("close-modal","닫기")+(editable?(basic?"":button("bell-reset","임시 일과표 해제","trash"))+`<button class="btn btn-primary" type="submit" form="bell-form">${basic?"기본 일과표 저장":"저장 후 메시지 발송"}</button>`:""));
    const defaultTitle=date=>`${Number(date.slice(5,7))}월 ${Number(date.slice(8,10))}일 일과표`;
    const renderRows=slots=>{
      $("#bell-rows").innerHTML=Array.from({length:12},(_,i)=>{const slot=slots.find(p=>p.period===i+1);return `<div class="bell-row"><label><input type="checkbox" data-bell-period="${i+1}" ${slot?'checked':''} ${!editable?'disabled':''}> ${i+1}교시</label><input aria-label="${i+1}교시 시작" type="time" value="${slot?.start||''}" data-bell-start="${i+1}" ${!editable?'disabled':''}><span>~</span><input aria-label="${i+1}교시 종료" type="time" value="${slot?.end||''}" data-bell-end="${i+1}" ${!editable?'disabled':''}></div>`;}).join("");
      const before=slots.find(p=>p.period===4),after=slots.find(p=>p.period===5),lunch=slots.find(p=>p.period===4.5)||(before&&after&&before.end<after.start?{start:before.end,end:after.start}:null);
      const afternoon=slots.filter(p=>Number.isInteger(p.period)&&lunch&&p.start>=lunch.end).sort((a,b)=>a.period-b.period)[0];
      const last=slots.filter(p=>Number.isInteger(p.period)).sort((a,b)=>b.period-a.period)[0];
      const row=$(`[data-bell-period="${afternoon?.period||last?.period||4}"]`).closest('.bell-row');
      row.insertAdjacentHTML(afternoon?'beforebegin':'afterend',`<div class="bell-row"><label><input type="checkbox" data-bell-period="4.5" ${lunch?'checked':''} ${editable?'':'disabled'}>점심시간</label><input aria-label="점심시간 시작" type="time" value="${lunch?.start||''}" data-bell-start="4.5" ${editable?'':'disabled'}><span>~</span><input aria-label="점심시간 종료" type="time" value="${lunch?.end||''}" data-bell-end="4.5" ${editable?'':'disabled'}></div>`);
    };
    const load=()=>{if(!basic)$("#bell-title").value=state.data.bellSchedules?.find(s=>s.date===$("#bell-date").value)?.title||defaultTitle($("#bell-date").value);renderRows(basic?(state.data.defaultPeriods||Mock.defaultPeriods):periodsForDate($("#bell-date").value));const reset=$('[data-action="bell-reset"]');if(reset)reset.hidden=basic;};
    if(!basic)$("#bell-date").onchange=load;load();
    if(basic&&editable){
      const slots=state.data.defaultPeriods||Mock.defaultPeriods,first=slots.find(p=>p.period===1),length=first?minutes(first.end)-minutes(first.start):50;
      $("#bell-quick-start").value=first?.start||'08:00';$("#bell-quick-duration").value=String([40,45,50].includes(length)?length:50);$("#bell-quick-count").value=String(Math.max(1,...slots.filter(p=>Number.isInteger(p.period)).map(p=>p.period)));
      $("#bell-quick-lunch-start").value=$('[data-bell-start="4.5"]').value||'12:00';$("#bell-quick-lunch-end").value=$('[data-bell-end="4.5"]').value||'13:00';
      $("#bell-quick-fill").onclick=()=>{try{const slots=window.DingdongBellSchedule.generate({start:$("#bell-quick-start").value,duration:$("#bell-quick-duration").value,count:$("#bell-quick-count").value,lunchStart:$("#bell-quick-lunch-start").value,lunchEnd:$("#bell-quick-lunch-end").value});renderRows(slots);$("#bell-error").textContent='';$("#bell-quick-error").textContent='';}catch(error){$("#bell-quick-error").textContent=error.message;}};
    }
    let saving=false;
    const store=async remove=>{if(!editable||saving)return;const date=basic?"":$("#bell-date").value;if(!date&&remove)return;
      const title=basic?"기본 일과표":$("#bell-title").value.trim();if(!title){$("#bell-error").textContent="제목을 입력하세요.";return;}
      const slots=$$("[data-bell-period]:checked").map(el=>({period:Number(el.dataset.bellPeriod),start:$(`[data-bell-start="${el.dataset.bellPeriod}"]`).value,end:$(`[data-bell-end="${el.dataset.bellPeriod}"]`).value})).sort((a,b)=>a.start.localeCompare(b.start));
      let previous="08:00";if(!remove&&(!slots.length||slots.filter(p=>Number.isInteger(p.period)).some((p,i,list)=>i>0&&p.period<list[i-1].period)||slots.some(p=>{const bad=!p.start||!p.end||p.start<previous||p.start<"08:00"||p.end>"18:00"||p.start>=p.end;previous=p.end;return bad;}))){$("#bell-error").textContent="08:00~18:00 범위에서 교시 시간이 겹치지 않도록 입력하세요.";return;}
      const old=JSON.parse(JSON.stringify(state.data));state.data.bellSchedules=(state.data.bellSchedules||[]).filter(s=>s.date!==date);if(date&&!remove)state.data.bellSchedules.push({date,title,periods:slots});if(!date&&!remove){state.data.defaultPeriods=slots;state.data.deadlineDefaultPeriodsChanged=true;}
      for(const event of state.data.events.filter(e=>["makeup","lessonChange"].includes(e.type)&&(!date||e.date===date))){const slot=periodsForDate(event.date).find(p=>p.period===event.period);if(!slot){state.data=old;$("#bell-error").textContent="등록된 보강이 사용하는 교시는 삭제할 수 없습니다.";return;}if(!event.readonly){event.start=slot.start;event.end=slot.end;}}
      const noticeDate=date||state.today,periods=date?periodsForDate(date):(state.data.defaultPeriods||Mock.defaultPeriods);
      const rows=[1,2,3,4,4.5,5,6,7].map(period=>{let slot=periods.find(p=>p.period===period);if(period===4.5&&!slot){const before=periods.find(p=>p.period===4),after=periods.find(p=>p.period===5);if(before&&after&&before.end<after.start)slot={start:before.end,end:after.start};}return [period===4.5?'점심시간':period+'교시',slot?slot.start+' ~ '+slot.end:'미설정'];});
      const html='<p>적용 날짜: '+esc(noticeDate)+'</p><p>'+(remove?'임시 일과표를 해제하고 기본 시간을 적용합니다.':'이 날짜에만 적용하며 다음 날에는 설정의 기본 일과 시간을 사용합니다.')+'</p><table><thead><tr><th>구분</th><th>시간</th></tr></thead><tbody>'+rows.map(row=>`<tr><td>${esc(row[0])}</td><td>${esc(row[1])}</td></tr>`).join('')+'</tbody></table>',body=title+'\n적용 날짜: '+noticeDate+'\n'+(remove?'임시 일과표를 해제하고 기본 시간을 적용합니다.':'이 날짜에만 적용하며 다음 날에는 설정의 기본 일과 시간을 사용합니다.')+'\n'+rows.map(row=>row.join(' · ')).join('\n');const targets=state.data.people.map(p=>p.id);
      if(!basic)state.data.mails.unshift({id:uid('user-mail'),from:'me',to:targets,cc:[],title,body,html,folder:'sent',unread:false,important:true,date:Mock.today,time:currentTime(),files:[],receipts:targets.map(()=>"unread"),scheduled:'',scheduleAnnouncement:{date:noticeDate,scope:'temporary',restored:remove}});
      saving=true;const submit=$('button[form="bell-form"]');if(submit)submit.disabled=true;const edited=state.data;let result;const stored=await save(value=>{result=value;});saving=false;if(submit)submit.disabled=false;if(!stored){if(state.data===edited)state.data=old;const error=$('#bell-error');if(error)error.textContent=result?.error||'서버 저장을 확인하지 못했습니다.';return;}closeModal();render();toast(result?.publicSave==='pending'?'일과표 변경이 서버 반영을 기다리고 있어요':basic?"기본 일과 시간을 저장했어요":"일과표를 저장하고 전체 안내를 발송했어요",title,"calendar");
    };
    $("#bell-form").onsubmit=e=>{e.preventDefault();store(false);};const reset=$('[data-action="bell-reset"]');if(reset)reset.onclick=e=>{e.stopPropagation();store(true);};
  }
  let memoScheduleSaving=false;
  async function memoScheduleInfo(id){if(native)await network?.refresh();const event=state.data.events.find(e=>e.id==='user-memo-'+id);return event?{date:event.date,start:event.start,end:event.end}:{date:koreanToday(),start:'09:00',end:'10:00'};}
  async function saveMemoSchedule(note){
    if(memoScheduleSaving)throw Error('일정을 저장하고 있습니다.');
    if(!state.user||native&&!network?.active)throw Error('로그인과 서버 연결을 확인해 주세요.');
    if(typeof note.id!=='string'||!/^[-\w]{1,100}$/.test(note.id)||typeof note.text!=='string'||note.text.length>4000)throw Error('메모 내용이 올바르지 않습니다.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(note.date)||!Number.isFinite(parseDate(note.date).getTime())||dateKey(parseDate(note.date))!==note.date)throw Error('날짜를 확인해 주세요.');
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(note.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(note.end)||note.start>=note.end)throw Error('종료 시간은 시작 시간보다 늦어야 해요.');
    const id='user-memo-'+note.id,existing=state.data.events.find(e=>e.id===id),title=note.text.trim().split('\n')[0].slice(0,100);
    if(!existing&&!title)throw Error('일정 제목으로 사용할 메모 내용을 먼저 입력해 주세요.');
    if(existing&&(!isPrivateEvent(existing)||!canMoveEvent(existing)))throw Error('이 일정은 메모에서 수정할 수 없습니다.');
    const oldData=JSON.parse(JSON.stringify(state.data)),actor=native?state.profile.id:state.user;
    const event=existing?{...existing,date:note.date,start:note.start,end:note.end}:{id,title,date:note.date,start:note.start,end:note.end,type:'personal',targets:[],place:'',note:note.text.slice(0,1000)};
    if(existing)state.data.events=state.data.events.map(e=>e.id===id?event:e);else state.data.events.push(event);
    memoScheduleSaving=true;
    try{if(!await save()){if(!native)state.data=oldData;throw Error('일정을 저장하지 못했습니다. 입력한 날짜와 시간은 유지됩니다.');}if((native?state.profile?.id:state.user)!==actor)throw Error('로그인 계정이 바뀌었습니다.');render({persist:false});}
    finally{memoScheduleSaving=false;}
  }
  async function openMemoSchedule(note){
    if(note.eventId){const kind=note.kind==='deadline'?'deadline':'event';if(windowApi?.openWorkspace){const result=await windowApi.openWorkspace('calendar',{kind,id:note.eventId});if(result?.error)throw new Error(result.error);}else await revealBriefingTarget({kind,id:note.eventId});return;}
    if(windowApi?.openMemoSchedule){const result=await windowApi.openMemoSchedule(note);if(result?.error)throw new Error(result.error);}
    else{memoBoard?.collapseEditor();memoScheduleForm({memoId:note.id,text:note.text});}
  }
  function memoScheduleForm({memoId,text}){
    if(!state.user||typeof memoId!=='string'||!/^[-\w]{1,100}$/.test(memoId)||typeof text!=='string'||text.length>4000)return;
    const id='user-memo-'+memoId,existing=state.data.events.find(event=>event.id===id);
    eventForm(existing?{...existing,privateOnly:true}:{saveId:id,title:text.trim().split('\n')[0].slice(0,100),note:text.slice(0,1000),date:koreanToday(),privateOnly:true});
    eventDraft.memoSchedule=true;
    $('#event-form').insertAdjacentHTML('afterbegin','<p class="muted memo-schedule-hint">저장하면 내 캘린더에 등록됩니다. 메모를 수정하거나 삭제해도 등록한 일정은 유지됩니다.'+(!existing&&text.length>1000?' 일정 내용에는 메모의 앞 1,000자를 가져왔습니다.':'')+'</p>');
  }
  function eventForm({
    id = null,
    saveId = null,
    title = "",
    date = state.today,
    start = "09:00",
    end = "10:00",
    type = "group",
    place = "",
    note = "",
    mail = null,
    targets = [],
    period = 1,
    dueTime = "",
    done = false,
    privateOnly = false,
  } = {}) {
    privateOnly=privateOnly||!!(id&&isPrivateEvent(state.data.events.find(e=>e.id===id)));
    if(privateOnly){type="personal";targets=[];}
    if(!privateOnly&&!id&&["personal","group","repeat"].includes(type))type="group";
    eventDraft = { id, saveId, mail, done, type, privateOnly };
    openModal(
      id ? "일정 수정" : privateOnly ? "내 일정 등록" : "새로운 일정",
      `<form id="event-form" class="event-form"><label>제목 (선택)<input class="input" id="event-title" placeholder="비워 두면 내용으로 일정을 표시합니다" value="${esc(title)}" maxlength="100"></label><div class="two-fields"><label>날짜<input class="input" id="event-date" type="date" value="${date}" required></label><label id="event-place-label">장소<input class="input" id="event-place" placeholder="예: 도서관 세미나실" value="${esc(place)}" maxlength="100"></label></div><label id="makeup-period-box" hidden>보강 교시<select class="input" id="makeup-period"></select><small class="muted">해당 날짜의 일과표 시간을 적용합니다. 수신자 캘린더에 자동 등록됩니다.</small></label><div class="two-fields" id="event-time-range"><label>시작 시간<input class="input" id="event-start" type="time" value="${start}" required></label><label>종료 시간<input class="input" id="event-end" type="time" value="${end}" required></label></div><label id="event-deadline-time" hidden>마감 시간 (선택)<input class="input" id="event-due-time" type="time" value="${esc(dueTime)}"><small class="muted">예: 월요일 16:00까지 제출. 시작 시간 없이 마감 시각만 저장합니다. 시간을 비우면 날짜만 표시합니다.</small></label><div id="event-target-box" ${type !== "group" ? "hidden" : ""}><span>메시지 수신자 · 일정 공유</span><div id="event-targets" class="recipient-options">${state.data.people.map(p=>`<label><input type="checkbox" value="${p.id}" ${targets.includes(p.id)?"checked":""}><span>${esc(p.name)} · ${esc(p.department)}</span></label>`).join("")}</div><small class="muted">수신자가 없으면 내 개인 일정입니다. 선택하면 메시지를 발송하고 선택한 선생님들의 캘린더에도 공유합니다.</small></div><label>내용<textarea class="input" id="event-note" rows="3" placeholder="미리 기억해 둘 내용을 적어 주세요." maxlength="1000">${esc(note)}</textarea></label><div id="event-error" class="form-error" role="alert"></div></form>`,
      (id
        ? button(
            "delete-event",
            "삭제",
            "trash",
            "btn-danger",
            `data-event="${id}"`,
          )
        : "") +
        button("close-modal", "취소") +
        `<button class="btn btn-primary" type="submit" form="event-form">${icon("check", 16)} 일정 저장</button>`,
    );
    const updateEventFields=()=>{
      const deadline=type==="deadline";
      const makeup=type==="makeup";
      $("#event-target-box").hidden=privateOnly||["note","deadline"].includes(type);
      $$("#event-targets input").forEach(input=>input.disabled=privateOnly);
      $("#makeup-period-box").hidden=!makeup;
      $("#event-start").readOnly=makeup;$("#event-end").readOnly=makeup;
      if(makeup)updateMakeupPeriod();
      $("#event-time-range").hidden=deadline;
      $("#event-start").disabled=deadline; $("#event-end").disabled=deadline;
      $("#event-deadline-time").hidden=!deadline;
      $("#event-due-time").disabled=!deadline;
      $("#event-place-label").hidden=deadline;
    };
    const updateMakeupPeriod=()=>{
      const select=$("#makeup-period"),chosen=Number(select.value)||period;
      const slots=periodsForDate($("#event-date").value).filter(p=>Number.isInteger(p.period));
      select.innerHTML=slots.map(p=>`<option value="${p.period}" ${p.period===chosen?'selected':''}>${p.period}교시 · ${p.start}–${p.end}</option>`).join("");
      const slot=slots.find(p=>p.period===Number(select.value));if(slot){$("#event-start").value=slot.start;$("#event-end").value=slot.end;}
    };
    $("#makeup-period").onchange=updateMakeupPeriod;
    $("#event-date").onchange=()=>{if(type==="makeup")updateMakeupPeriod();};
    updateEventFields();
    $("#event-form").onsubmit = saveEvent;
  }
  async function saveEvent(e) {
    e.preventDefault();if(eventSaving)return;
    const messageTitle=$("#event-title").value.trim(),content=$("#event-note").value.trim();
    const title = messageTitle||content.split("\n")[0].slice(0,80)||"새 일정",
      date = $("#event-date").value,
      type = eventDraft.type,
      start = $("#event-start").value,
      end = $("#event-end").value;

    if(!messageTitle&&!content){$("#event-error").textContent="일정 제목 또는 내용을 입력해 주세요.";return;}
    if (type !== "deadline" && minutes(start) >= minutes(end)) {
      $("#event-error").textContent = "종료 시간은 시작 시간보다 늦어야 해요.";
      return;
    }
    if(type==="makeup"&&(!$$("#event-targets input:checked").length||!$("#event-note").value.trim())){$("#event-error").textContent="보강 수신자와 안내 내용을 입력해 주세요.";return;}
    eventSaving=true;const eventSubmit=$('button[form="event-form"]');if(eventSubmit)eventSubmit.disabled=true;
    const oldData=JSON.parse(JSON.stringify(state.data));
    const id = eventDraft.id || eventDraft.saveId || uid("user-event");
    if (eventDraft.id && ["note", "deadline"].includes(type))
      state.data.events = state.data.events.filter(
        (e) => e.id !== eventDraft.id,
      );
    state.data.notes=state.data.notes.filter(item=>item.id!==id);
    const previousDeadline=state.data.deadlines.find(item=>item.id===id);
    state.data.deadlines=state.data.deadlines.filter(item=>item.id!==id);
    if (type === "note") {
      state.data.notes.push({
        id,
        date,
        time: start,
        text:
          title +
          ($("#event-note").value ? " · " + $("#event-note").value : ""),
      });
    } else if (type === "deadline") {
      state.data.deadlines.push({ ...previousDeadline, id, title, date, dueTime: $("#event-due-time").value, note: $("#event-note").value.trim(), done: eventDraft.done });
    } else {
      const ev = {
        ...state.data.events.find(e=>e.id===id),
        id,
        title,
        date,
        start,
        end,
        type:["personal","group","repeat"].includes(type)?($$("#event-targets input:checked").length?"group":type==="group"?"personal":type):type,
        place: $("#event-place").value.trim(),
        note: $("#event-note").value.trim(),
        targets: eventDraft.privateOnly?[]:$$("#event-targets input:checked").map((o) => o.value),
        ...(type==="makeup"?{period:Number($("#makeup-period").value)}:{}),
      };
      const existing = state.data.events.findIndex((e) => e.id === id);
      if (existing >= 0) state.data.events[existing] = ev;
      else state.data.events.push(ev);
    }
    const sharedEvent=state.data.events.find(item=>item.id===id);
    if(sharedEvent?.targets.length){const body=`${content||title}\n\n일정: ${date} ${sharedEvent.start}–${sharedEvent.end}${sharedEvent.place?"\n장소: "+sharedEvent.place:""}`;state.data.mails.unshift({id:uid("user-mail"),from:"me",to:[...sharedEvent.targets],cc:[],title:messageTitle,body,html:safeRichHTML(esc(body).replace(/\n/g,"<br>")),folder:"sent",unread:false,important:false,date:Mock.today,time:currentTime(),files:[],receipts:sharedEvent.targets.map(()=>"unread"),scheduled:"",eventId:id,calendarEvent:id});}
    if (eventDraft.mail) {
      const mail = state.data.mails.find((m) => m.id === eventDraft.mail);
      if (mail) mail.eventId = id;
    }
    const stored=await save();eventSaving=false;if(eventSubmit)eventSubmit.disabled=false;
    if(!stored){state.data=oldData;return;}
    const memoSchedule=eventDraft.memoSchedule;
    closeModal();
    state.today = date;
    state.week = weekStart(date);
    if(memoSchedule){state.page='calendar';state.calendarView='week';}
    render();
    toast(sharedEvent?.targets.length?"일정을 공유하고 메시지를 보냈어요":"개인 일정을 저장했어요", fmtDate(date) + " · " + title, "calendar");
  }
  function relatedSource(item) {
    if (item.source && ["mail", "message"].includes(item.source.kind)) return item.source;
    const mail = state.data.mails.find(m=>m.id===item.noticeMail||m.id===item.deliveryMail||m.id===item.mail||m.eventId===item.id||m.calendarEvent===item.id);
    return mail ? {kind:"mail",id:mail.id} : null;
  }
  function sourceText(item) {
    const source=relatedSource(item);
    if(source?.kind==="mail") {const m=state.data.mails.find(m=>m.id===source.id);return m?.body||"";}
    return state.data.rooms.flatMap(r=>r.messages).find(m=>m.id===source?.id)?.text||"";
  }
  function openScheduleDetail(item,title,body,footer) {
    loadScheduleMemos();
    const extra=`data-schedule="${esc(item.id)}"`;
    openModal(title,body+(calendarMemoItem(item.id)?personalMemoSection(item):""),
      button("schedule-summary","일정 요약","down","",extra+' aria-expanded="false" aria-controls="schedule-summary-panel" title="일정 요약 펼치기"')+
      (calendarMemoItem(item.id)?button("schedule-memo","메모하기","note","",extra):"")+
      (relatedSource(item)?button("schedule-source","관련 메시지 보기","mail","",extra):"")+footer,"schedule-detail-modal");
    const summary=window.DingdongScheduleSummary.summarize(item,sourceText(item));
    const rows=[["할 일",summary.task,"checklist"],["날짜·시간",summary.date+" · "+summary.time,"clock"],["장소",summary.place,"school"],["준비·확인",summary.preparation,"note"]];
    $(".schedule-detail-modal").insertAdjacentHTML("beforeend",`<section class="summary-fold" id="schedule-summary-panel" aria-hidden="true" aria-label="일정 요약"><div class="summary-fold-clip"><article class="summary-page" inert><div class="summary-page-heading"><span>${icon("leaf",16)} 한눈에 보는 일정</span><small>로컬 규칙 요약</small></div><dl>${rows.map(([label,value,name])=>`<div><dt>${icon(name,16)} ${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl><small class="muted">날짜와 시간은 현재 캘린더 기준입니다.</small></article></div></section>`);
    const panel=$("#schedule-summary-panel"),page=$(".summary-page",panel);
    let progress=0,frame=0,closedHeight=0;
    const modal=panel.closest(".modal"),overlay=modal.parentElement;
    const paint=()=>{
      const angle=(1-progress)*Math.PI/2,height=page.offsetHeight;
      // Project the cover's height through the same perspective as the CSS camera.
      // The page rotates at the hinge rather than being revealed by a sliding clip.
      panel.style.height=(progress?height*Math.cos(angle)/(1+height*Math.sin(angle)/900):0)+"px";
      page.style.transform=`rotateX(${(progress-1)*90}deg)`;
      page.style.setProperty("--cover-shade",String((1-progress)*.22));
      if(closedHeight){
        const base=Math.min(closedHeight,innerHeight-24);
        const closedTop=Math.max(12,(innerHeight-base)/2);
        const openedTop=Math.max(12,(innerHeight-base-height)/2);
        // Move the whole modal with the same clock as the hinged cover.
        // Explicit placement avoids flex centering jumping as its height changes.
        const top=closedTop+(openedTop-closedTop)*progress;
        overlay.style.paddingTop=top+"px";
        modal.style.maxHeight=`calc(100dvh - ${top+12}px)`;
      }
    };
    panel.openCover=open=>{
      if(!closedHeight){
        closedHeight=modal.offsetHeight;
        const top=modal.getBoundingClientRect().top;
        overlay.style.paddingTop=top+"px";
        overlay.classList.add("schedule-anchored");
      }
      cancelAnimationFrame(frame);
      const from=progress,to=open?1:0,start=performance.now();
      const duration=760*Math.abs(to-from);
      const step=now=>{
        const t=duration?Math.min(1,(now-start)/duration):1;
        const eased=(1-Math.cos(Math.PI*t))/2;
        progress=from+(to-from)*eased;paint();
        if(t<1)frame=requestAnimationFrame(step);
      };
      if(matchMedia("(prefers-reduced-motion: reduce)").matches){progress=to;paint();}
      else frame=requestAnimationFrame(step);
    };
    const observer=new ResizeObserver(paint);observer.observe(page);
    window.addEventListener("resize",paint);
    modalCleanup=()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("resize",paint);};
    paint();
  }
  function toggleScheduleSummary(button) {
    const modal=$(".schedule-detail-modal"), panel=$("#schedule-summary-panel");if(!modal||!panel)return;
    const open=button.getAttribute("aria-expanded")!=="true";
    panel.classList.toggle("is-open",open);panel.setAttribute("aria-hidden",String(!open));
    $(".summary-page",panel).inert=!open;
    button.setAttribute("aria-expanded",String(open));
    button.title=open?"일정 요약 접기":"일정 요약 펼치기";
    panel.openCover(open);
  }
  let sourceReaderToken=0;
  async function showScheduleSource(item) {
    const source=relatedSource(item);
    const token=++sourceReaderToken;
    const back=button("schedule-return","일정으로 돌아가기","left","",`data-schedule="${esc(item.id)}"`)+button("close-modal","닫기");
    const renderSource=(body)=>openModal("관련 메시지",body,back,"schedule-source-modal");
    if(!source){renderSource('<p class="muted">직접 등록한 마감 일정에는 연결된 메시지가 없습니다.</p>');return;}
    if(source.kind==="mail"){
      const m=state.data.mails.find(m=>m.id===source.id);
      if(!m){renderSource('<p class="muted">원본 메시지가 삭제·회수되었거나 현재 계정에서 볼 수 없습니다.</p>');return;}
      let richHTML=m.html;
      if(m.inlineStored&&native){renderSource('<p role="status">본문 이미지를 불러오고 있습니다…</p>');try{richHTML=await loadInlineMail(m);if(token!==sourceReaderToken)return;}catch{renderSource('<p role="status">본문 이미지를 불러오지 못했습니다. 다시 열어 주세요.</p>');return;}}
      renderSource(`<div class="source-meta"><span class="chip">원본 메시지</span><strong>${esc(mailSenderName(m))}</strong><time>${fmtDate(m.date)} ${esc(m.time)}</time></div><h3>${esc(mailSubject(m))}</h3><div class="source-recipients">받는 사람: ${(m.to||[]).map(id=>esc(person(id).name)).join(", ")}${m.cc?.length?" · 참조: "+m.cc.map(id=>esc(person(id).name)).join(", "):""}</div><div class="source-message-body">${richHTML?safeRichHTML(richHTML):esc(m.body)}</div>${(m.files||[]).map((file,i)=>`<div class="attachment">${icon("file",22)}<div><strong>${esc(file.name)}</strong><small>${esc(file.size)}</small></div>${ib("download-file","첨부 다운로드","download",`data-mail="${esc(m.id)}" data-file="${i}"`)}</div>`).join("")}`);
      return;
    }
    let room=state.data.rooms.find(r=>r.messages.some(m=>m.id===source.id));
    let message=room?.messages.find(m=>m.id===source.id);
    if(!message&&native){
      renderSource('<p role="status">원본 대화를 확인하고 있습니다…</p>');
      const reader=$(".schedule-source-modal");
      try{
        const result=await native.request("/message-source",{id:source.id});
        if(token!==sourceReaderToken||reader!==$(".schedule-source-modal"))return;
        if(result.error)throw new Error(result.error);
        message=result.message;room=state.data.rooms.find(r=>r.id===result.room)||{name:result.roomName};
      }catch{if(token===sourceReaderToken&&reader===$(".schedule-source-modal"))renderSource('<p class="muted">원본 대화가 삭제되었거나 대화방 참여 권한이 없습니다.</p>');return;}
    }
    if(!message){renderSource('<p class="muted">원본 대화가 없거나 대화방에서 나간 상태입니다.</p>');return;}
    renderSource(`<div class="source-meta"><span class="chip blue">원본 대화</span><strong>${esc(person(message.sender).name)}</strong><time>${message.date?fmtDate(message.date):""} ${esc(message.time)}</time></div><h3>${esc(room.name||"대화")}</h3><div class="source-message-body source-chat-highlight">${esc(message.text)}</div><p class="muted">이 일정이 추출된 대화 메시지입니다.</p>`);
  }
  function viewDeadline(id) {
    const deadline = state.data.deadlines.find(n=>n.id===id);
        if (deadline)
          openScheduleDetail(deadline,
            calendarTitle(deadline),
            `<p>완료 기한: ${fmtDate(deadline.date)}${deadline.dueTime ? ` ${esc(deadline.dueTime)}까지` : " · 시간 미지정"}</p>${deadline.note ? `<p style="white-space:pre-wrap">${deadline.source?`<small style="display:block">원문 안내</small>`:""}${esc(deadline.note)}</p>` : ""}<p class="muted" style="margin-top:12px">${deadline.done ? "완료한 업무입니다." : "업무를 마친 뒤 완료로 표시해 주세요."}</p>`,
            button("close-modal", "닫기") + button("edit-deadline", "수정", "note", "", `data-deadline="${deadline.id}"`) +
              button(
                "toggle-deadline",
                deadline.done ? "미완료로 변경" : "완료로 표시",
                "check",
                "btn-primary",
                `data-deadline="${deadline.id}"`,
              ),
          );
  }
  function refreshDutyDetail(){
    const modal=$('.schedule-detail-modal'),id=modal?.querySelector('[data-action="schedule-summary"]')?.dataset.schedule;
    if(!id||modal.dataset.dutyDetail!=='true')return;
    const event=calendarEvent(id);
    if(!event){closeModal();return;}
    const version=JSON.stringify([event.date,event.start,event.end,event.duty,exchangeVisible().filter(r=>[r.from.id,r.to.id].includes(id)).map(r=>[r.id,exchangeVersion(r)])]);
    if(modal.dataset.dutyVersion!==version)viewEvent(id,true);
  }
  function viewEvent(id,keepDemoActor=false,showInfo=false) {
    if(!native&&!keepDemoActor)state.exchangeDemoActor=null;
    const e = calendarEvent(id);
    if (!e) return;
    loadScheduleMemos();
    const exchange=e.duty?dutyExchangeAvailability(e):null;
    if(e.duty&&!showInfo){
      const request=exchangeVisible().find(r=>DingdongDutyExchanges.active(r)&&[r.from.id,r.to.id].includes(e.id));
      if(request){exchangeDetailForm(request.id);return;}
      if(exchange.allowed){exchangeRequestForm(id);return;}
    }
    openScheduleDetail(e,
      calendarTitle(e),
      `<div class="chip ${e.type === "personal" ? "" : e.type === "repeat" ? "orange" : "blue"}">${esc(e.duty?DingdongDuties.types[e.duty.kind]?.tag||typeLabel(e.type):e.id.startsWith("user-memo-")?"메모 일정":typeLabel(e.type))}</div><div style="margin-top:22px;display:grid;gap:16px;font-size:13px"><p>${icon("calendar", 16)} ${fmtDate(e.date)}</p><p>${icon("clock", 16)} ${e.start} – ${e.end}</p><p>${icon("school", 16)} ${esc(e.place || "장소 미정")}</p>${e.targets?.length ? `<p>${icon("users", 16)} ${e.targets.map((id) => esc(person(id).name)).join(", ")}</p>` : ""}<p class="muted" style="white-space:pre-wrap">${e.source&&e.note?`<small style="display:block">원문 안내</small>`:""}${esc(e.note || (e.duty?"배정 교사: "+e.duty.assigned.map(id=>person(id).name).join(", "):"등록된 메모가 없습니다."))}</p>${e.duty?dutyExchangeInfo(e,exchange):''}${canMoveEvent(e)?`<p class="muted">블록을 드래그해 이동하고 위·아래 가장자리로 시간을 조절하세요.${e.source||e.targets?.length?" 함께 등록된 사람들의 일정 시간도 같이 바뀝니다.":""}</p>`:""}</div>`,
      button("close-modal", "닫기") +
        (e.duty?button("exchange-new","교환 요청하기","cycle",exchange.allowed?"btn-primary":"",`data-event="${esc(id)}" aria-describedby="duty-exchange-info" ${exchange.allowed?'':'disabled'}`):"")+
        (e.duty&&exchangeVisible().some(r=>[r.from.id,r.to.id].includes(id))?button("exchanges","교환 요청 확인","cycle","",`data-event="${esc(id)}"`):"")+
        (canEditDuty(e)?button("edit-duty","편집","note","btn-primary",`data-event="${esc(id)}"`):"") +
        (e.readonly||e.noticeMail ? "" : button(
          "edit-event",
          "일정 수정",
          "note",
          "btn-primary",
          `data-event="${id}"`,
        )),
    );
    if(e.duty){const modal=$('.schedule-detail-modal');modal.dataset.dutyDetail='true';modal.dataset.dutyVersion=JSON.stringify([e.date,e.start,e.end,e.duty,exchangeVisible().filter(r=>[r.from.id,r.to.id].includes(id)).map(r=>[r.id,exchangeVersion(r)])]);}
  }
  function announcementsPage() {
    const mails=state.data.mails.filter(m=>m.announcement&&m.folder!=="trash"&&(!m.scheduled||native&&new Date(m.scheduled)<=new Date()));
    return heading("A SCHOOL WE BUILD TOGETHER","우리 학교 소식","같이 알아두면 좋은 이야기들을 모았어요.",button("compose-announcement","공지 사항 쓰기","plus","btn-primary"))+
      `<div class="announcement-list">${mails.length?mails.map(m=>`<button class="panel announcement-card" data-action="announcement-open" data-mail="${m.id}"><span class="chip">${esc(m.announcement.department)}</span><h2>${esc(mailSubject(m))}</h2><p>${esc(m.body)}</p><footer><span>${m.announcement.audience==="teachers"?"교사":"교직원"}</span><span>${fmtDate(m.date,{month:"long",day:"numeric"})} ${icon("arrow",13)}</span></footer></button>`).join(""):empty("등록된 공지 사항이 없어요","새 공지는 이곳에서 함께 확인할 수 있어요.","notice")}</div>`;
  }
  function linksPage() {
    return (
      heading(
        "YOUR EVERYDAY SHORTCUTS",
        "자주 찾는 곳",
        "선생님의 하루에 필요한 서비스로 빠르게 이동해요.",
        button("add-shortcut", "바로가기 추가", "plus", "btn-primary"),
      ) +
      `<div class="link-list">${(
        state.data.shortcuts || [
          {
            id: "s0",
            title: "나이스 대국민서비스",
            desc: "교육 행정 관련 서비스",
            url: "https://www.neis.go.kr",
            icon: "school",
          },
          {
            id: "s1",
            title: "에듀넷 · 티클리어",
            desc: "수업과 연구를 위한 교육 자료",
            url: "https://www.edunet.net",
            icon: "file",
          },
          {
            id: "s2",
            title: "학교알리미",
            desc: "학교의 주요 정보를 살펴보세요",
            url: "https://www.schoolinfo.go.kr",
            icon: "users",
          },
        ]
      )
        .map(
          (s) =>
            `<a class="link-card" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${icon(s.icon || "link", 28)}<h3>${esc(s.title)} ${icon("arrow", 15)}</h3><p>${esc(s.desc)}</p><small class="muted" style="display:block;margin-top:18px">외부 사이트에서 열립니다</small></a>`,
        )
        .join("")}</div>`
    );
  }
  const dutyConfig=()=>state.data.dutySettings||DingdongDuties.defaults(state.data.people);
  async function dutyOperation(type,value,apply){
    if(native){await network.queue;const result=await native.request('/sync',{operations:[{type,value}]});if(result.error){await network.refresh();throw Error(result.error);}await network.refresh();return result;}
    else{const previous=JSON.parse(JSON.stringify(state.data));apply();if(!(await save())){state.data=previous;throw Error('저장하지 못했습니다.');}}
  }
  function demoCalendarPerson(){
    const people=state.data.people.filter(p=>!p.disabled),exact=people.filter(p=>p.name===state.user);
    if(exact.length)return exact.length===1?exact[0]:null;
    const key=String(state.user||'').replace(/\s/g,''),matches=key?people.filter(p=>String(p.name||'').replace(/\s/g,'')===key):[];
    return matches.length===1?matches[0]:null;
  }
  function calendarActor(){return native?{id:state.profile?.id,admin:!!state.profile?.admin}:demoCalendarPerson()||{id:'me',name:state.user};}
  function exchangeActor(){return native?{id:state.profile?.id,admin:!!state.profile?.admin}:{...(state.data.people.find(p=>p.id===state.exchangeDemoActor&&!p.disabled)||demoCalendarPerson()||{id:'me',name:state.user}),admin:false};}
  function exchangeChoicesForTarget(target,actor=exchangeActor()){
    if(!target?.duty||target.duty.assigned.includes(actor.id)||!DingdongDutyExchanges.remainingMonth(target.date,Mock.today))return [];
    const roster=native?(state.data.dutyRoster||[]):state.data.events,ctx=exchangeContext(),choices=[];
    for(const from of roster.filter(e=>e.duty?.assigned.includes(actor.id)&&DingdongDutyExchanges.remainingMonth(e.date,Mock.today)))for(const partner of target.duty.assigned){
      try{DingdongDutyExchanges.pair(from,target,actor.id,partner,ctx);if(!ctx.requests.some(r=>DingdongDutyExchanges.active(r)&&[r.from.id,r.to.id].some(id=>id===from.id||id===target.id)))choices.push({from,partner});}catch{}
    }
    return choices.sort((a,b)=>a.from.date.localeCompare(b.from.date)||exchangeName(a.partner).localeCompare(exchangeName(b.partner)));
  }
  function dutyExchangeAvailability(event){
    const actor=exchangeActor(),own=event.duty.assigned.includes(actor.id),pending=exchangeVisible().some(r=>DingdongDutyExchanges.active(r)&&[r.from.id,r.to.id].includes(event.id));
    const choices=exchangeChoicesForTarget(event,actor);
    const reason=!state.data.people.some(p=>p.id===actor.id&&!p.disabled)?'현재 사용자와 일치하는 교직원을 하나로 확인할 수 없습니다. 교직원 이름의 중복·등록 여부를 확인해 주세요.':own?'본인 일정입니다. 교환할 상대 교사의 일정을 클릭해 요청하세요.':event.date<Mock.today?'지난 날짜의 업무는 교환할 수 없습니다.':!DingdongDutyExchanges.remainingMonth(event.date,Mock.today)?'상대 일정은 오늘부터 이번 달 말일까지 선택할 수 있습니다.':pending?'이 일정에 진행 중인 교환 요청이 있습니다. 교환 요청 확인에서 처리해 주세요.':!dutyConfig().managers[event.duty.kind]?.length?'이 업무의 담당자가 등록되어 있지 않습니다. 설정에서 담당자를 지정해 주세요.':!choices.length?'이 상대와 교환 가능한 내 배정이 이번 달에 없습니다.':'교환 요청하기를 누르면 내 배정을 자동으로 연결합니다. 여러 날짜가 있으면 내 날짜만 선택하세요.';
    return {allowed:!own&&choices.length>0&&!pending,reason};
  }
  function dutyExchangeInfo(event,availability){
    const actual=calendarActor(),assigned=event.duty.assigned.map(id=>person(id).name).join(', ');
    return `<section class="duty-exchange-info" id="duty-exchange-info" aria-label="업무 교환 안내"><p><strong>현재 사용자: ${esc(actual.name||state.user)}</strong></p><p>배정 교사: ${esc(assigned)}</p><p role="status">${esc(availability.reason)}</p></section>`;
  }
  function exchangeContext(){return {people:state.data.people,events:state.data.events,requests:state.data.dutyExchanges||[],config:dutyConfig(),today:Mock.today,now:Date.now()};}
  function exchangeVisible(){const ctx=exchangeContext();return ctx.requests.filter(r=>DingdongDutyExchanges.visible(r,exchangeActor(),ctx));}
  const exchangeVersion=r=>DingdongDutyExchanges.version(r);
  const exchangeReadKey=r=>exchangeActor().id+':'+r.id;
  const shownExchangeNotices=new Set();let exchangeAckBusy=false;
  function notifyExchangeUpdates(){
    if(!state.user||windowApi&&!windowApi.mainHost||briefingQueued||$('.briefing-overlay'))return;
    const actor=exchangeActor(),pending=native?(state.data.exchangeNotifications||[]):exchangeVisible().filter(r=>(state.settings.exchangeNotified||{})[exchangeReadKey(r)]!==exchangeVersion(r));
    for(const r of pending){const key=actor.id+':'+r.id+':'+exchangeVersion(r);if(shownExchangeNotices.has(key))continue;shownExchangeNotices.add(key);const message=DingdongDutyExchanges.notification(r,actor,exchangeContext()),target={kind:'exchange',id:r.id};const notice=Notify.create({title:message.title,bodyHtml:esc(message.body),type:'calendar exchange-notice',duration:12000,footerHtml:`<button type="button" class="btn btn-primary" data-exchange-notice="${esc(r.id)}">요청 바로 보기</button>`});const card=document.getElementById(notice),open=async()=>{Notify.remove(notice,true);if(windowApi)await windowApi.openWorkspace('calendar',target);else await revealBriefingTarget(target);};card.querySelector('[data-exchange-notice]').onclick=open;card.onclick=e=>{if(!e.target.closest('button'))open();};windowApi?.notify(message.title,message.body,target);}
    if(!native){if(pending.length){state.settings.exchangeNotified={...(state.settings.exchangeNotified||{})};for(const r of pending)state.settings.exchangeNotified[exchangeReadKey(r)]=exchangeVersion(r);save();}return;}
    if(!pending.length||exchangeAckBusy)return;
    exchangeAckBusy=true;let acknowledged=false;
    Promise.resolve(network.queue).then(async()=>{if(state.profile?.id!==actor.id)return;const result=await native.request('/sync',{operations:pending.map(r=>({type:'duty.exchange.ack',id:r.id,value:{version:exchangeVersion(r)}}))});acknowledged=!result.error;}).catch(()=>{}).finally(()=>{exchangeAckBusy=false;if(state.profile&&(acknowledged||state.profile.id!==actor.id))network.refresh();});
  }
  function exchangeCount(){return exchangeVisible().filter(r=>DingdongDutyExchanges.active(r)||(state.settings.exchangeRead||{})[exchangeReadKey(r)]!==exchangeVersion(r)).length;}
  function markExchangeRead(requests){state.settings.exchangeRead={...(state.settings.exchangeRead||{})};for(const r of requests)state.settings.exchangeRead[exchangeReadKey(r)]=exchangeVersion(r);if(native){try{localStorage.setItem('dingdong-preferences',JSON.stringify({settings:state.settings}));}catch{}}else save();}
  const exchangeName=id=>id==='system'?'자동 확인':person(id).name;
  function exchangeComparison(r){
    const names=[r.requesterName||exchangeName(r.requester),r.partnerName||exchangeName(r.partner)],slots=[r.from,r.to];
    const months=[...new Set(slots.map(slot=>slot.date.slice(0,7)))].sort();
    const calendars=months.map(month=>{
      const [year,number]=month.split('-').map(Number),first=new Date(year,number-1,1).getDay(),count=new Date(year,number,0).getDate();
      const cells=Array.from({length:Math.ceil((first+count)/7)*7},(_,index)=>{
        const day=index-first+1;if(day<1||day>count)return '<span class="exchange-mini-empty" aria-hidden="true"></span>';
        const date=month+'-'+String(day).padStart(2,'0'),selected=slots.findIndex(slot=>slot.date===date);
        return `<div class="exchange-mini-day ${selected>=0?'exchange-person-'+selected:''}" ${selected>=0?`data-exchange-date="${esc(date)}" aria-label="${esc(date+' 교환 전 배정: '+names[selected])}"`:''}><span>${day}</span>${selected>=0?`<strong title="${esc(names[selected])}">${esc(names[selected])}</strong>`:''}</div>`;
      }).join('');
      return `<section class="exchange-mini-month" aria-label="${year}년 ${number}월 교환 날짜"><h4>${year}년 ${number}월</h4><div class="exchange-mini-grid">${['일','월','화','수','목','금','토'].map(day=>`<span class="exchange-mini-weekday">${day}</span>`).join('')}${cells}</div></section>`;
    }).join('');
    return `<section class="exchange-comparison" aria-label="업무 교환 전후 비교"><div class="exchange-mini-calendars"><h3>교환 전 배정</h3>${calendars}</div><div class="exchange-flows"><h3>교환 전 <span aria-hidden="true">→</span> 교환 후</h3>${slots.map((from,index)=>{const to=slots[1-index];return `<section class="exchange-flow exchange-person-${index}" aria-label="${esc(names[index]+'의 교환 전후 일정')}"><strong class="exchange-flow-name"><span class="exchange-person-dot" aria-hidden="true"></span>${esc(names[index])}</strong><div class="exchange-flow-dates"><div><span class="exchange-flow-label">교환 전</span><time datetime="${esc(from.date)}">${esc(from.date)}</time><small>${esc(from.start)}–${esc(from.end)}</small></div><span class="exchange-flow-arrow" aria-label="변경 후">→</span><div><span class="exchange-flow-label">교환 후</span><time datetime="${esc(to.date)}">${esc(to.date)}</time><small>${esc(to.start)}–${esc(to.end)}</small></div></div></section>`;}).join('')}</div></section>`;
  }
  async function exchangeOperation(type,value){
    await dutyOperation(type,value,()=>{const ctx=exchangeContext();ctx.requests=DingdongDutyExchanges.reconcile(ctx.requests,ctx);if(type==='duty.exchange.create')ctx.requests.unshift(DingdongDutyExchanges.create(value,exchangeActor(),ctx));else {const result=DingdongDutyExchanges.act(ctx.requests.find(r=>r.id===value.id),value.action,value.note,exchangeActor(),ctx);ctx.requests=ctx.requests.map(r=>r.id===result.request.id?result.request:r);for(const event of result.events)Object.assign(state.data.events.find(e=>e.id===event.id),event);}state.data.dutyExchanges=DingdongDutyExchanges.reconcile(ctx.requests,exchangeContext());});
  }
  function exchangeActions(r){
    const actor=exchangeActor(),actions=[];
    if(DingdongDutyExchanges.active(r)&&r.requester===actor.id)actions.push(['cancel','요청 취소']);
    if(DingdongDutyExchanges.active(r)&&r.partner===actor.id)actions.push(['decline','거절'],['accept','수락']);
    return actions;
  }
  let exchangeBusy=false;
  function exchangeActionButtons(r){return exchangeActions(r).map(([action,label])=>`<button type="button" class="btn ${action==='accept'?'btn-primary':''}" data-action="exchange-act" data-exchange="${esc(r.id)}" data-exchange-action="${action}" ${exchangeBusy?'disabled':''}>${label}</button>`).join('');}
  function exchangeDashboard(){return `<div class="exchange-entry"><button class="btn" data-action="exchange-inbox">${icon('cycle',15)} 교환 요청${exchangeCount()?` <b>${exchangeCount()}</b>`:''}</button></div>`;}
  function exchangeDemoControl(){return !native?`<details class="exchange-extra exchange-demo-tools"><summary>데모 체험 역할</summary><label>체험할 교사<select class="input" id="exchange-demo-role">${state.data.people.filter(p=>!p.disabled&&DingdongAnnouncements.isTeacher(p)).map(p=>`<option value="${esc(p.id)}" ${exchangeActor().id===p.id?'selected':''}>${esc(p.name)} · ${esc(p.department)}</option>`).join('')}</select></label></details>`:'';}

  function exchangeQueue(eventId=null){return exchangeVisible().filter(r=>!eventId||[r.from.id,r.to.id].includes(eventId)).sort((a,b)=>Number(exchangeActions(b).length>0)-Number(exchangeActions(a).length>0)||b.updatedAt-a.updatedAt);}
  function exchangeNavigator(id,eventId=null){
    const requests=exchangeQueue(eventId),index=requests.findIndex(r=>r.id===id);
    if(requests.length<2||index<0)return '';
    return `<nav class="exchange-request-nav" aria-label="다른 교환 요청 보기"><button type="button" class="icon-btn" data-action="exchange-prev" data-exchange="${esc(requests[index-1]?.id||'')}" aria-label="이전 교환 요청" ${index===0?'disabled':''}>${icon('left',17)}</button><span class="exchange-request-position" role="status">요청 ${index+1} / ${requests.length}</span><button type="button" class="icon-btn" data-action="exchange-next" data-exchange="${esc(requests[index+1]?.id||'')}" aria-label="다음 교환 요청" ${index===requests.length-1?'disabled':''}>${icon('right',17)}</button></nav>`;
  }
  function exchangeListForm(eventId=null){
    const requests=exchangeQueue(eventId);
    if(requests.length){exchangeDetailForm(requests[0].id,eventId);return;}
    openModal('교환 요청',`<div id="exchange-list" data-event="${esc(eventId||'')}" class="empty"><p>교환 요청이 없습니다.</p></div>${exchangeDemoControl()}`,button('close-modal','닫기'),'wide');
    if(!native)$('#exchange-demo-role').onchange=e=>{state.exchangeDemoActor=e.target.value;exchangeListForm(eventId);};
  }
  function refreshExchangeDialog(){
    const detail=$('#exchange-detail'),empty=$('#exchange-list');
    if(detail){const eventId=detail.dataset.eventScope||null,r=exchangeVisible().find(r=>r.id===detail.dataset.exchange);if(!r){exchangeListForm(eventId);return;}if(r.status!==detail.dataset.status)exchangeDetailForm(r.id,eventId);else $('#exchange-request-nav').innerHTML=exchangeNavigator(r.id,eventId);}
    else if(empty)exchangeListForm(empty.dataset.event||null);
  }
  function exchangeEditTools(event){return canEditDuty(event)?`<details class="exchange-schedule-info"><summary>담당자 배정 편집</summary>${button('edit-duty','배정 교사 편집','note','',`data-event="${esc(event.id)}"`)}</details>`:'';}
  function exchangeRequestForm(id){
    const actor=exchangeActor(),target=calendarEvent(id),choices=exchangeChoicesForTarget(target,actor);
    if(!choices.length){toast('교환 요청을 시작할 수 없어요',target?.duty?dutyExchangeAvailability(target).reason:'업무 일정을 다시 선택해 주세요.');return;}
    const own=[...new Map(choices.map(c=>[c.from.id,c.from])).values()];
    openModal('교환 요청하기',`<form id="exchange-request-form"><div id="exchange-preview"></div><p hidden id="exchange-target-event" data-event="${esc(target.id)}"><strong>선택한 상대 일정</strong><br>${esc(DingdongDuties.types[target.duty.kind].label)} · ${esc(target.date)}</p><label class="${own.length===1?'exchange-fixed-choice':''}">교환할 내 배정 일정<select class="input" id="exchange-from" required ${own.length===1?'disabled':''}>${own.map(e=>`<option value="${esc(e.id)}">${esc(e.date)} · ${esc(actor.name||state.user)}</option>`).join('')}</select></label><div id="exchange-partner-field"></div><p class="muted">${own.length===1?'교환 가능한 내 일정을 자동으로 연결했습니다.':'교환할 내 날짜를 선택하세요.'} 상대 교사가 수락하면 교환이 완료됩니다.</p><label class="exchange-reason-field">요청 사유 (선택)<textarea class="input" id="exchange-reason" maxlength="500" rows="3" placeholder="교환을 요청하는 이유를 입력해 주세요."></textarea></label>${exchangeEditTools(target)}<p class="form-error" id="exchange-error" role="alert"></p></form>`,button('close-modal','닫기')+'<button class="btn btn-primary" type="submit" form="exchange-request-form" id="exchange-submit">요청 보내기</button>','wide');
    const updatePreview=()=>{const from=own.find(e=>e.id===$('#exchange-from').value),partner=$('#exchange-target').value;$('#exchange-preview').innerHTML=from&&partner?exchangeComparison({requester:actor.id,partner,from,to:target}):'';};
    const updatePartners=()=>{const available=choices.filter(c=>c.from.id===$('#exchange-from').value);$('#exchange-partner-field').innerHTML=available.length===1?`<p>상대 교사<br><strong id="exchange-target-name">${esc(exchangeName(available[0].partner))}</strong></p><input type="hidden" id="exchange-target" value="${esc(available[0].partner)}">`:`<label>상대 교사<select class="input" id="exchange-target" required>${available.map(c=>`<option value="${esc(c.partner)}">${esc(exchangeName(c.partner))}</option>`).join('')}</select></label>`;$('#exchange-partner-field').hidden=available.length===1;$('#exchange-target').onchange=updatePreview;updatePreview();};
    $('#exchange-from').onchange=updatePartners;updatePartners();
    $('#exchange-request-form').onsubmit=async e=>{e.preventDefault();const fromEvent=$('#exchange-from').value,partner=$('#exchange-target').value,submit=$('#exchange-submit'),error=$('#exchange-error');if(submit.disabled||!choices.some(c=>c.from.id===fromEvent&&c.partner===partner))return;submit.disabled=true;try{const requestId=uid('exchange');await exchangeOperation('duty.exchange.create',{id:requestId,fromEvent,toEvent:target.id,partner,reason:$('#exchange-reason').value});exchangeDetailForm(requestId);render();toast('교환 요청을 보냈어요','상대 교사가 수락하면 캘린더에 바로 반영됩니다.');}catch(e){if(error.isConnected){error.textContent=e.message;submit.disabled=false;}}};
  }
  function exchangeDetailForm(id,eventId=null){
    const r=exchangeVisible().find(r=>r.id===id);if(!r){exchangeListForm(eventId);return;}markExchangeRead([r]);
    const active=DingdongDutyExchanges.active(r),actions=exchangeActions(r);
    openModal(DingdongDuties.types[r.kind].label+' · 교환 요청',`<div id="exchange-detail" data-exchange="${esc(id)}" data-status="${esc(r.status)}" data-event-scope="${esc(eventId||'')}"><div class="exchange-detail-status"><span class="chip">${esc(DingdongDutyExchanges.labels[r.status])}</span><div id="exchange-request-nav">${exchangeNavigator(id,eventId)}</div></div>${exchangeComparison(r)}<p class="exchange-reason"><strong>요청 사유</strong><br>${esc(r.reason||'입력하지 않았습니다.')}</p>${active?'<p class="muted">상대가 수락하면 두 교사와 업무 담당자의 캘린더에 바로 반영됩니다. 수락 전에는 요청자가 취소할 수 있습니다.</p>':''}${actions.length?'<details class="exchange-extra"><summary>응답 메모 (선택)</summary><label>응답 메모<textarea class="input" id="exchange-response-note" maxlength="500" rows="2"></textarea></label></details>':''}<p id="exchange-error" class="form-error" role="alert"></p><details class="exchange-history"><summary>변경 이력 ${r.history.length}건</summary><ol>${r.history.map(h=>`<li><strong>${esc(DingdongDutyExchanges.labels[h.status])}</strong> · ${esc(h.actorName||exchangeName(h.actor))}<small>${esc(new Date(h.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}))}</small>${h.note?`<p>${esc(h.note)}</p>`:''}</li>`).join('')}</ol></details>${exchangeEditTools(calendarEvent(r.to.id))}${exchangeDemoControl()}</div>`,button('close-modal','닫기')+exchangeActionButtons(r),'wide exchange-detail-modal');
    if(!native)$('#exchange-demo-role').onchange=e=>{state.exchangeDemoActor=e.target.value;exchangeDetailForm(id,eventId);};
  }
  async function exchangeRespond(id,action){
    const buttons=$$('[data-action="exchange-act"]'),eventId=$('#exchange-detail')?.dataset.eventScope||null;
    if(exchangeBusy)return;exchangeBusy=true;buttons.forEach(b=>b.disabled=true);
    try{await exchangeOperation('duty.exchange.act',{id,action,note:$('#exchange-response-note')?.value||''});exchangeBusy=false;exchangeDetailForm(id,eventId);render();toast(action==='accept'?'업무 교환이 완료됐어요':action==='cancel'?'교환 요청을 취소했어요':'교환 요청을 거절했어요',action==='accept'?'요청자·수락자·업무 담당자의 캘린더에 반영했습니다.':'기존 배정은 그대로 유지됩니다.');}
    catch(e){exchangeBusy=false;const latest=$('#exchange-error');if(latest){latest.textContent=e.message;$$('[data-action="exchange-act"]').forEach(b=>b.disabled=false);}}
  }
  function otherWorkMenu(){
    openModal('기타 업무',`<div class="school-work-menu">${Object.entries(DingdongDuties.types).map(([kind,t])=>button('duty-import-'+kind,t.label,'calendar')).join('')}</div>`,button('close-modal','닫기'));
  }
  function canEditDuty(event){return !!event?.duty&&(!native||state.profile?.admin||dutyConfig().managers[event.duty.kind]?.includes(state.profile?.id));}
  function dutyAssignmentForm(id){
    const event=calendarEvent(id);if(!canEditDuty(event))return;
    const config=dutyConfig(),kind=event.duty.kind,type=DingdongDuties.types[kind],teachers=state.data.people.filter(p=>!p.disabled&&DingdongAnnouncements.isTeacher(p));
    const expectedAssigned=[...event.duty.assigned];
    const group=(label,list)=>`<fieldset class="duty-manager-group"><legend>${esc(label)}</legend><div class="duty-manager-list">${list.map(p=>`<label><input type="checkbox" data-duty-assignee value="${esc(p.id)}" ${expectedAssigned.includes(p.id)?'checked':''}> ${esc(p.name)} <small>${esc(p.department)}</small></label>`).join('')}</div></fieldset>`;
    const isSafety=p=>p.department.replace(/\s+/g,'')===config.safetyDepartment.replace(/\s+/g,'');
    openModal(type.label+' · 배정 교사 편집',`<form id="duty-assignment-form"><p><strong>${esc(event.date)}</strong> · ${event.start}–${event.end}</p><p class="muted">선택에서 제외한 교사의 배정은 취소되고, 새로 선택한 교사의 캘린더에 이 일정이 등록됩니다. 업무 담당자는 계속 받습니다.</p>${kind==='safety'?group(config.safetyDepartment,teachers.filter(isSafety))+group('그 외 교사',teachers.filter(p=>!isSafety(p))):group('배정 교사',teachers)}<p id="duty-assignment-error" role="alert"></p></form>`,button('duty-edit-cancel','취소','','',`data-event="${esc(id)}"`)+'<button class="btn btn-primary" type="submit" form="duty-assignment-form">저장</button>','wide');
    const form=$('#duty-assignment-form'),errorLabel=$('#duty-assignment-error'),submit=$('[form="duty-assignment-form"]');
    form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{
      const assigned=$$('[data-duty-assignee]:checked',form).map(el=>el.value),updated=DingdongDuties.reassign(event,assigned,config,state.data.people);
      await dutyOperation('duty.update',{id,assigned,expectedAssigned},()=>{const current=state.data.events.find(e=>e.id===id);if(!current||!DingdongDuties.sameAssignment(current.duty.assigned,expectedAssigned))throw Error('배정이 변경되었습니다. 상세 화면을 다시 열어 주세요.');Object.assign(current,updated);});
      closeModal();render();viewEvent(id,false,true);toast('배정 교사를 수정했어요','해당 교사들의 캘린더에 반영되었습니다.');
    }catch(error){if(errorLabel.isConnected){errorLabel.textContent=error.message;submit.disabled=false;}}};
  }
  function dutySettingsForm(){
    const config=dutyConfig(),editable=!native||state.profile?.admin,people=state.data.people.filter(p=>!p.disabled),departments=[...new Set(people.map(p=>p.department))];
    openModal('기타 업무 담당자',`<form id="duty-settings-form"><p class="muted">메신저에서 업무 일정을 등록하고 관리할 담당자를 선택합니다.</p><label>담당자 선택 부서<select class="input" id="duty-department">${departments.map(d=>`<option ${d===config.safetyDepartment?'selected':''}>${esc(d)}</option>`).join('')}</select></label>${Object.entries(DingdongDuties.managementTypes).map(([kind,t])=>`<fieldset class="duty-manager-group" data-manager-kind="${kind}"><legend>${t.label}</legend><div class="duty-manager-list">${people.map(p=>`<label data-manager-department="${esc(p.department)}"><input type="checkbox" data-duty-manager="${kind}" value="${esc(p.id)}" ${(config.managers[kind]||[]).includes(p.id)?'checked':''} ${editable?'':'disabled'}> ${esc(p.name)} <small>${esc(p.department)}</small></label>`).join('')}</div><p class="duty-selected-managers" data-selected-managers="${kind}" aria-live="polite"></p></fieldset>`).join('')}<p id="duty-department-empty" class="muted" hidden>이 부서에는 지정할 관리 업무가 없습니다.</p><p id="duty-settings-error" role="alert"></p>${editable?'':'<p class="muted">관리자만 담당자를 변경할 수 있습니다.</p>'}</form>`,button('close-modal','닫기')+(editable?'<button class="btn btn-primary" type="submit" form="duty-settings-form">저장</button>':''),'wide');
    const form=$('#duty-settings-form'),department=$('#duty-department');
    const filter=()=>{const kinds=DingdongDuties.departmentKinds(department.value);$$('[data-manager-kind]',form).forEach(card=>card.hidden=!kinds.includes(card.dataset.managerKind));$$('[data-manager-department]',form).forEach(label=>label.hidden=label.dataset.managerDepartment!==department.value);$('#duty-department-empty').hidden=!!kinds.length;};
    const selected=()=>Object.keys(DingdongDuties.managementTypes).forEach(kind=>{const ids=$$(`[data-duty-manager="${kind}"]:checked`,form).map(el=>el.value);$(`[data-selected-managers="${kind}"]`,form).textContent='선택한 담당자: '+(ids.length?ids.map(id=>{const p=people.find(p=>p.id===id);return p.name+' · '+p.department;}).join(', '):'없음');});
    department.onchange=filter;$$('[data-duty-manager]',form).forEach(input=>input.onchange=selected);filter();selected();
    form.onsubmit=async e=>{e.preventDefault();const submit=$('[form="duty-settings-form"]');submit.disabled=true;try{const next={...config,managers:Object.fromEntries(Object.keys(DingdongDuties.managementTypes).map(k=>[k,$$(`[data-duty-manager="${k}"]:checked`,form).map(el=>el.value)]))};DingdongDuties.settings(next,people);const result=await dutyOperation('duty.settings',next,()=>{state.data.dutySettings=next;state.data.events.filter(e=>e.duty).forEach(e=>e.targets=[...new Set([...next.managers[e.duty.kind],...e.duty.assigned,...(e.owner?[e.owner]:[])])]);});closeModal();render();toast(result?.publicSave==='pending'?'업무 담당자 설정이 서버 반영을 기다리고 있어요':'업무 담당자를 저장했어요');}catch(error){$('#duty-settings-error').textContent=error.message;submit.disabled=false;}};
  }
  async function readDutyWorkbook(file){
    if(!/\.xlsx$/i.test(file.name))throw Error('.xlsx 엑셀 파일을 선택해 주세요.');if(file.size>5*1024*1024)throw Error('5 MB 이하의 엑셀 파일을 선택해 주세요.');
    const bytes=await file.arrayBuffer(),view=new DataView(bytes);let expanded=0,entries=0;
    // Check the ZIP central directory before decompressing untrusted workbooks.
    let end=-1;for(let i=bytes.byteLength-22;i>=Math.max(0,bytes.byteLength-65557);i--){if(view.getUint32(i,true)===0x06054b50){end=i;break;}}
    if(end<0)throw Error('엑셀 파일을 읽을 수 없습니다.');let pos=view.getUint32(end+16,true);const count=view.getUint16(end+10,true);
    while(entries<count){if(pos+46>bytes.byteLength||view.getUint32(pos,true)!==0x02014b50)throw Error('엑셀 파일 구조가 올바르지 않습니다.');expanded+=view.getUint32(pos+24,true);if(expanded>20*1024*1024||++entries>2000)throw Error('엑셀 파일의 데이터가 너무 큽니다.');pos+=46+view.getUint16(pos+28,true)+view.getUint16(pos+30,true)+view.getUint16(pos+32,true);}
    if(!entries)throw Error('엑셀 파일이 비어 있습니다.');return window.DingdongReadExcel(bytes);
  }
  function dutyImportForm(kind){
    const t=DingdongDuties.types[kind];if(!t)return;const config=dutyConfig(),managers=config.managers[kind],allowed=!native||state.profile?.admin||managers.includes(state.profile?.id);let rows=null,preview=null,epoch=0;
    const names=ids=>ids.map(id=>state.data.people.find(p=>p.id===id)?.name||id).join(', ');
    openModal(t.label,`<div class="duty-import"><p><strong>${t.start}–${t.end}</strong> · 담당자: ${esc(names(managers)||'미등록')}</p><p class="muted">${kind==='safety'?`A열 날짜 · B열 ${esc(config.safetyDepartment)} 교사 · C열 그 외 교사`:'A열 날짜 · B열 교사 이름'}<br>첫 시트만 사용합니다. 날짜는 연도를 포함하고, 여러 이름은 쉼표로 구분해 주세요.</p><p class="muted">같은 업무·날짜는 새 배정으로 갱신합니다. 파일에 없는 날짜는 유지됩니다.</p>${!managers.length?'<p>설정 → 기타 업무 담당자에서 담당자를 먼저 등록해 주세요.</p>':''}${!allowed?'<p>관리자 또는 이 업무의 담당자만 업로드할 수 있습니다.</p>':''}<div class="duty-file-picker"><button type="button" class="btn" id="duty-choose" ${allowed&&managers.length?'':'disabled'}>엑셀 파일 선택</button><span id="duty-filename"></span><input id="duty-file" type="file" accept=".xlsx" hidden></div><p id="duty-file-status" role="status"></p><div id="duty-preview"></div></div>`,button('close-modal','닫기')+'<button class="btn btn-primary" id="duty-register" disabled>일정 등록</button>','wide');
    const input=$('#duty-file'),area=$('#duty-preview'),status=$('#duty-file-status'),submit=$('#duty-register');
    $('#duty-choose').onclick=()=>input.click();
    input.onchange=async()=>{$('#duty-filename').textContent=input.files[0]?.name||'';const token=++epoch;submit.disabled=true;rows=null;preview=null;area.innerHTML='';if(!input.files[0])return;status.textContent='엑셀을 확인하고 있습니다…';try{const parsed=await readDutyWorkbook(input.files[0]);if(token!==epoch||!input.isConnected)return;rows=parsed.map(r=>r.map(v=>v instanceof Date?v.toISOString().slice(0,10):v));preview=DingdongDuties.plan(kind,rows,config,state.data.people);status.textContent=preview.errors.length?`오류 ${preview.errors.length}개 · 수정 후 다시 업로드해 주세요.`:`${preview.events.length}일 · 담당자와 배정 교사의 일정에 등록됩니다.`;area.innerHTML=(preview.errors.length?`<ul class="duty-errors" role="alert">${preview.errors.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:'')+`<table class="duty-table"><thead><tr><th>날짜</th><th>배정 교사</th><th>일정 수신자</th></tr></thead><tbody>${preview.events.map(e=>`<tr><td>${esc(e.date)}</td><td>${esc(names(e.duty.assigned))}</td><td>${esc(names(e.targets))}</td></tr>`).join('')}</tbody></table>`;submit.disabled=!!preview.errors.length||!preview.events.length;}catch(error){if(token===epoch&&input.isConnected)status.textContent=error.message;}};
    submit.onclick=async()=>{if(!preview||preview.errors.length)return;submit.disabled=true;input.disabled=true;try{await dutyOperation('duty.import',{kind,rows},()=>{const imported=DingdongDuties.imports(state.data.events,preview.events),ids=new Set(imported.map(e=>e.id));state.data.events=state.data.events.filter(e=>!ids.has(e.id)).concat(imported);});closeModal();render();toast(`${t.label} ${preview.events.length}일을 등록했어요`);}catch(error){if(status.isConnected){status.textContent=error.message;submit.disabled=false;input.disabled=false;}}};
  }
  function staffImportForm(){
    if(windowApi?.openWorkspace&&!requestedStaff){closeModal();windowApi.openWorkspace("staff").catch(error=>toast("교직원 정보 창을 열지 못했어요",error.message));return;}
    const allowed=!native||state.profile?.admin,columns=DingdongStaffDirectory.headers;let editing=[{values:columns.map(()=>''),id:null}],preview=null,epoch=0,busy=false,timer=null,active=true;
    openModal('교직원 정보',`<div class="staff-import"><p class="muted">엑셀을 업로드하거나 행을 추가해 직접 입력하세요. 이름과 부서는 필수입니다. 학년·반은 담임으로 연결합니다.</p><div class="staff-editor-tools"><button class="btn" id="staff-choose" type="button" ${allowed?'':'disabled'}>엑셀 파일 선택</button><button class="btn" id="staff-add-row" type="button" ${allowed?'':'disabled'}>행 추가</button><button class="btn" id="staff-load" type="button" ${allowed?'':'disabled'}>기존 정보 불러오기</button><button class="btn" id="staff-check" type="button" ${allowed?'':'disabled'}>내용 확인</button><span id="staff-filename"></span><input type="file" accept=".xlsx" id="staff-file" hidden></div><p id="staff-status" role="status">표에 내용을 입력해 주세요.</p><div id="staff-preview" class="staff-table-scroll"></div><div id="staff-errors" role="alert"></div><p id="staff-summary" class="muted"></p><small class="muted">기존 행의 빈 값은 해당 정보를 지웁니다. 행을 제외하거나 파일에 넣지 않은 교직원은 삭제하지 않습니다. 여러 업무는 쉼표나 줄바꿈으로 구분하세요.</small>${allowed?'':'<p>관리자만 교직원 정보를 변경할 수 있습니다.</p>'}</div>`,button('close-modal','닫기')+'<button class="btn btn-primary" id="staff-apply" disabled>저장</button>','wide staff-editor-modal');
    const input=$('#staff-file'),status=$('#staff-status'),area=$('#staff-preview'),errorLabel=$('#staff-errors'),summary=$('#staff-summary'),submit=$('#staff-apply');
    const payload=()=>({rows:[columns,...editing.map(row=>row.values)],identities:editing.map(row=>row.id)});
    const renderRows=()=>{area.innerHTML=`<table class="duty-table staff-editor-table"><thead><tr>${columns.map(h=>`<th scope="col">${h}</th>`).join('')}<th scope="col">행 관리</th></tr></thead><tbody>${editing.map((row,r)=>`<tr>${columns.map((h,c)=>`<td><input class="input" data-staff-row="${r}" data-staff-col="${c}" aria-label="${r+1}행 ${h}" maxlength="${[40,40,10,10,20,60,300,120,120][c]}" value="${esc(row.values[c]??'')}" ${allowed?'':'disabled'}></td>`).join('')}<td><button type="button" class="btn" data-staff-remove="${r}" ${allowed?'':'disabled'}>행 제외</button></td></tr>`).join('')}</tbody></table>`;};
    const validate=async()=>{clearTimeout(timer);const token=++epoch;preview=null;submit.disabled=true;let values=payload();const local=DingdongStaffDirectory.plan(values.rows,state.data.people,{classTeachers:state.data.classTeachers,dutySettings:dutyConfig()},values.identities);for(const e of local.entries)if(!e.isNew&&!editing[e.row-2].id)editing[e.row-2].id=e.id;values=payload();errorLabel.textContent='';summary.textContent='';status.textContent='내용을 확인하고 있습니다…';try{
      let result=DingdongStaffDirectory.plan(values.rows,state.data.people,{classTeachers:state.data.classTeachers,dutySettings:dutyConfig()},values.identities);
      if(native){await network.queue;result=await native.request('/admin/staff-import',{...values,preview:true});if(result.error)throw Error(result.error);}
      if(!active||token!==epoch)return;preview=result;const fresh=result.entries.filter(e=>e.isNew).length;
      status.textContent=result.errors.length?`오류 ${result.errors.length}개 · 표에서 수정해 주세요.`:`${result.entries.length}명 · 기존 갱신 ${result.entries.length-fresh}명 · 신규 추가 ${fresh}명`;
      errorLabel.innerHTML=result.errors.length?`<ul class="duty-errors">${result.errors.slice(0,20).map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:'';
      if(!result.errors.length){summary.textContent=`반·담임 총 ${result.classTeachers.length}개 · `+Object.entries(result.dutySettings.managers).map(([kind,ids])=>(DingdongDuties.managementTypes[kind]?.label||kind)+' 담당 '+ids.length+'명').join(' · ');}
      submit.disabled=!allowed||!!result.errors.length;
    }catch(error){if(active&&token===epoch)status.textContent=error.message;}};
    const invalidate=()=>{epoch++;preview=null;submit.disabled=true;clearTimeout(timer);timer=setTimeout(validate,250);};
    area.oninput=e=>{const el=e.target.closest('[data-staff-row]');if(!el||busy)return;editing[+el.dataset.staffRow].values[+el.dataset.staffCol]=el.value;invalidate();};
    area.onclick=e=>{const el=e.target.closest('[data-staff-remove]');if(!el||busy)return;editing.splice(+el.dataset.staffRemove,1);if(!editing.length)editing=[{values:columns.map(()=>''),id:null}];renderRows();validate();};
    $('#staff-add-row').onclick=()=>{if(busy||editing.length>=1000)return;editing.push({values:columns.map(()=>''),id:null});renderRows();area.querySelector(`[data-staff-row="${editing.length-1}"]`)?.focus();validate();};
    $('#staff-load').onclick=()=>{if(busy)return;editing=state.data.people.filter(p=>!p.disabled).map(p=>{let grade=p.grade||'',classNumber=p.classNumber||'';const mapping=(state.data.classTeachers||[]).filter(c=>c.teacher===p.id);if(!classNumber&&mapping.length===1&&DingdongAnnouncements.isTeacher(p)){const m=mapping[0].className.match(/(\d+)학년\s*(\d+)반/);if(m){grade=m[1];classNumber=m[2];}}return {id:p.id,values:[p.name,p.position||'',grade,classNumber,p.extension||'',p.department,p.work||'',p.specialRoom||'',p.club||'']};});if(!editing.length)editing=[{values:columns.map(()=>''),id:null}];renderRows();validate();};
    $('#staff-check').onclick=validate;$('#staff-choose').onclick=()=>input.click();
    input.onchange=async()=>{if(busy)return;const token=++epoch;preview=null;submit.disabled=true;if(!input.files[0])return;$('#staff-filename').textContent=input.files[0].name;status.textContent='엑셀을 읽고 있습니다…';try{const rows=DingdongStaffDirectory.normalizeRows(await readDutyWorkbook(input.files[0]));if(!active||token!==epoch)return;if(!Array.isArray(rows[0])||columns.some((h,i)=>String(rows[0][i]||'').replace(/\s+/g,'')!==h))throw Error('첫 행을 이름, 보직, 학년, 반, 내선번호, 부서, 업무, 특별실, 동아리 순서로 작성해 주세요.');if(rows.some(row=>Array.isArray(row)&&row.slice(9).some(v=>v!=null&&String(v).trim())))throw Error('A~I열만 사용해 주세요.');const initial=DingdongStaffDirectory.plan(rows,state.data.people,{classTeachers:state.data.classTeachers,dutySettings:dutyConfig()});editing=rows.slice(1).filter(Array.isArray).map((values,i)=>({values:columns.map((h,c)=>String(values[c]??'')),id:initial.entries.find(e=>e.row===i+2&&!e.isNew)?.id||null}));if(!editing.length)editing=[{values:columns.map(()=>''),id:null}];renderRows();await validate();}catch(error){if(active&&token===epoch)status.textContent=error.message;}};
    renderRows();modalCleanup=()=>{active=false;clearTimeout(timer);};
    submit.onclick=async()=>{if(busy||!preview||preview.errors.length)return;busy=true;submit.disabled=true;const values=payload();$$('input,textarea,button', $('.staff-import')).forEach(el=>el.disabled=true);status.textContent='교직원 정보를 저장하고 있습니다…';try{
      let result;
      if(native){await network.queue;result=await native.request('/admin/staff-import',{...values,revision:preview.revision});if(result.error)throw Error(result.error);await network.refresh();}
      else{const current=DingdongStaffDirectory.plan(values.rows,state.data.people,{classTeachers:state.data.classTeachers,dutySettings:dutyConfig()},values.identities);if(current.errors.length)throw Error(current.errors.join('\n'));const ids=Object.fromEntries(current.entries.filter(e=>e.isNew).map(e=>[e.id,uid('staff-import')])),resolved=DingdongStaffDirectory.resolve(current,ids),previous=JSON.parse(JSON.stringify(state.data)),map=new Map(resolved.entries.map(e=>[e.id,{...e,status:e.status||'offline'}]));state.data.people=state.data.people.map(p=>map.get(p.id)||p).concat([...map.values()].filter(p=>!state.data.people.some(old=>old.id===p.id)));state.data.staffDirectoryPeople=[...(state.data.staffDirectoryPeople||[]).filter(p=>!map.has(p.id)),...map.values()];state.data.departments=[...new Set(state.data.people.map(p=>p.department))];state.data.classTeachers=resolved.classTeachers;state.data.dutySettings=resolved.dutySettings;state.data.events.filter(e=>e.duty).forEach(e=>e.targets=[...new Set([...resolved.dutySettings.managers[e.duty.kind],...e.duty.assigned,...(e.owner?[e.owner]:[])])]);if(!(await save())){state.data=previous;throw Error('저장하지 못했습니다.');}result={updated:resolved.entries.length,accounts:[]};}
      closeModal(true);render();
      if(result.accounts.length){const accounts=result.accounts;openModal('교직원 등록 완료',`<p>${result.updated}명의 정보를 반영했습니다.</p><p>신규 계정 ${accounts.length}개의 임시 로그인 정보를 다운로드해 해당 교직원에게 전달해 주세요. 첫 로그인 때 비밀번호를 변경합니다.</p><p class="muted">이 화면을 닫으면 임시 비밀번호는 다시 표시되지 않습니다. 필요하면 관리자에서 재발급할 수 있습니다.</p>`,'<button class="btn" data-action="close-modal">닫기</button><button class="btn btn-primary" id="staff-credentials">로그인 정보 다운로드</button>');$('#staff-credentials').onclick=()=>{const cell=value=>'"'+String(value).replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"',csv='\uFEFF'+[['이름','아이디','임시 비밀번호'],...accounts.map(a=>[a.name,a.username,a.password])].map(row=>row.map(cell).join(',')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='교직원-임시-로그인.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};}
      else if(requestedStaff)windowApi.windowAction('close');
      else toast('교직원 정보를 반영했어요',native?'':'신규 교직원은 데모 목록에 추가했습니다.');
    }catch(error){if(active){status.textContent=error.message;busy=false;$$('input,textarea,button',$('.staff-import')).forEach(el=>el.disabled=!allowed);submit.disabled=false;}}};
  }
  async function privacySettings() {
    if(!native?.privacy)return;
    const result=await native.privacy('security');if(result.error){toast('보안 정보를 열지 못했어요',result.error);return;}
    const format=value=>String(value).match(/.{1,4}/g).join(' ');
    openModal('내 메시지 보관·보안',`<p>메시지와 주고받은 기록은 각자의 PC에 보관합니다. 메시지·읽음·회신 알림은 암호화하여 전달하고, 상대 PC의 저장 확인 후 서버에서 삭제합니다. 첨부 파일은 암호화 없이 서버에서 10일간 제공합니다.</p><p class="muted">PC를 바꾸기 전에 보관 파일을 내보내고 이전 PC의 앱을 종료해 주세요. 새 PC에서 같은 학교 계정으로 가져올 수 있습니다.</p><div class="setting-row"><div>PC 교체용 파일<small>메시지와 첨부파일을 비밀번호 없이 파일 하나로 저장</small></div>${button('privacy-export','내보내기','download')}</div><div class="setting-row"><div>기존 PC에서 가져오기<small>같은 학교 서버와 계정의 보관 파일</small></div>${button('privacy-import','가져오기','folder')}</div><p><strong>내 보안 번호</strong></p><p style="word-break:break-all;font-family:monospace">${esc(format(result.fingerprint))}</p><p class="muted">상대방이 자신의 화면에서 확인한 보안 번호를 직접 대조하세요. 처음 연결할 때 받은 번호는 자동 보관하며, 번호가 바뀌면 송수신을 중단합니다.</p><label>확인할 상대방<select id="privacy-person" class="input">${result.people.filter(p=>p.id!==state.profile?.id).map(p=>`<option value="${esc(p.id)}">${esc(person(p.id).name)}${p.verified?' · 확인됨':''}</option>`).join('')}</select></label><label>상대방에게 직접 받은 보안 번호<input id="privacy-number" class="input" autocomplete="off" maxlength="100" placeholder="상대방 화면의 내 보안 번호"></label><p id="privacy-error" class="form-error" role="alert"></p>${button('privacy-verify','번호 대조하기','check')}${result.incomingFailed?`<div class="setting-row"><div>수신 확인 필요 ${result.incomingFailed}건<small>수신에 문제가 있는 항목을 따로 표시하며 다른 메시지는 계속 받습니다. 발신자에게 재전송을 요청하거나 보안 번호를 확인한 뒤 다시 시도하세요.</small></div>${button('privacy-retry-incoming','수신 다시 확인','refresh')}</div>`:''}<p class="muted">전달 대기 ${result.pending}건 · 전달 실패 ${result.failed||0}건 · 백업 확인 필요 ${result.restoreReview||0}건<br>PC 보관 위치</p><p class="muted" style="word-break:break-all">${esc(result.path)}</p>`,button('close-modal','닫기'),'work-modal');
  }
  async function verifyPrivacyNumber(){
    const result=await native.privacy('verify',{id:$('#privacy-person').value,fingerprint:$('#privacy-number').value});
    if(result.error){$('#privacy-error').textContent=result.error;return;}toast('상대방 보안 번호를 확인했어요');await privacySettings();
  }
  function privacyArchive(action){
    if(!native?.privacy)return;
    const exporting=action==='export';
    const instructions=exporting
      ?'보낸·받은 메시지, 이 PC에 보관한 첨부파일과 개인 암호화 키를 파일 하나에 담습니다. 별도 비밀번호가 없어 이 파일을 가진 사람은 내용을 열 수 있습니다. 본인만 접근할 수 있는 곳에 저장해 주세요.'
      :'새 PC에서 같은 학교 계정으로 로그인을 시도한 뒤, 기존 PC에서 복사한 .dingdong 파일을 선택하세요. 현재 PC에 없는 기록만 가져옵니다.';
    openModal(exporting?'PC 이전 파일 내보내기':'기존 PC의 기록 가져오기',`<form id="privacy-archive-form"><p>${instructions}</p><div id="privacy-legacy-password"></div><p id="privacy-archive-error" class="form-error" role="alert"></p></form>`,button('close-modal','취소')+`<button type="submit" form="privacy-archive-form" class="btn btn-primary">${exporting?'저장 위치 선택':'파일 선택'}</button>`,'work-modal');
    const form=$('#privacy-archive-form'),error=$('#privacy-archive-error'),submit=$('[form="privacy-archive-form"]');
    let selection;
    form.onsubmit=async event=>{
      event.preventDefault();if(submit.disabled)return;
      submit.disabled=true;error.textContent='처리 중입니다…';
      try{
        const result=await native.privacy(action,selection?{selection,password:form.querySelector('#privacy-password').value}:{});
        if(result.error)throw new Error(result.error);
        if(result.canceled){error.textContent='';return;}
        if(result.needsPassword){
          if(!form.isConnected)return;
          selection=result.selection;
          $('#privacy-legacy-password').innerHTML='<label>이전 보관 파일의 비밀번호<input id="privacy-password" type="password" class="input" maxlength="128" autocomplete="off" required></label>';
          error.textContent='';submit.textContent='가져오기';$('#privacy-password').focus();return;
        }
        if(form.isConnected)closeModal();if(!exporting)await network.refresh();
        toast(exporting?'PC 이전 파일을 저장했어요':'기존 PC의 기록을 가져왔어요',!exporting&&result.reviewRequired?`가져온 기록 중 전달 대기 ${result.reviewRequired}건이 있습니다. 보낸함의 ‘발송 여부 확인 필요’ 항목과 회신 내용을 확인해 주세요.`:'');
      }
      catch(problem){if(error.isConnected)error.textContent=problem.message;}
      finally{if(submit.isConnected)submit.disabled=false;}
    };
  }
  function settingsModal() {
    openModal(
      "선생님에게 맞는 띵동",
      `<div class="setting-row"><div>교직원 정보<small>파일 업로드·수동 입력으로 교직원과 담임 정보 관리</small></div><div class="heading-actions">${button("staff-import","관리","users")}${button("class-teachers","반별 담임 보기")}</div></div><div class="setting-row"><div>기타 업무 담당자<small>메신저에서 업무 일정을 등록·관리할 담당자</small></div>${button("duty-settings","설정","users")}</div><div class="setting-row"><div>학교 일과표<small>임시 일과표가 없는 날의 기본 교시 시간</small></div>${button("bell-default-settings","설정","clock")}</div><div class="setting-row"><div>캘린더 위치<small>본창 크기를 유지하고 선택한 방향으로 오늘 일정이 열립니다.</small></div><select class="input" id="calendar-position" aria-label="캘린더 위치" style="width:110px">${[["left","왼쪽"],["right","오른쪽"]].map(([value,label])=>`<option value="${value}" ${state.settings.calendarPosition===value?"selected":""}>${label}</option>`).join("")}</select></div><div class="setting-row"><div>다음에도 바로 들어오기<small>${native ? "설치형 앱은 보안을 위해 매 실행 시 로그인합니다." : "이 브라우저에 이름만 저장해요. 실제 자동 로그인은 아닙니다."}</small></div><label class="switch"><input type="checkbox" id="auto-login" aria-label="바로 들어오기" ${native ? "disabled" : ""} ${state.settings.autoLogin ? "checked" : ""}><span></span></label></div>${[
        ["orgFont", "교직원 목록 글자", 12, 22],
        ["mailFont", "메시지 본문 글자", 12, 24],
        ["chatFont", "대화 글자", 12, 22],
      ]
        .map(
          ([key, label]) =>
            `<div class="setting-row"><span>${label}</span><div class="stepper">${button("font-minus", "−", "", "", `data-setting="${key}" aria-label="${label} 작게"`)}<span id="setting-${key}">${state.settings[key]}px</span>${button("font-plus", "+", "", "", `data-setting="${key}" aria-label="${label} 크게"`)}</div></div>`,
        )
        .join(
          "",
        )}<div class="setting-row"><div>캘린더 어두운 화면<small>내 캘린더에만 적용됩니다.</small></div><label class="switch"><input type="checkbox" id="dark-mode" aria-label="캘린더 어두운 화면" ${state.settings.dark ? "checked" : ""}><span></span></label></div><div class="setting-row"><div>비밀번호 변경<small>${native ? "현재 비밀번호를 확인하고 변경합니다." : "계정 서버가 연결되면 제공할 기능입니다."}</small></div>${button("password-info", "안내", "lock")}</div>${native?`<div class="setting-row"><div>내 메시지 보관·보안<small>PC 보관 파일과 상대방 보안 번호 확인</small></div>${button("privacy-settings","관리","lock")}</div>`:""}<div style="margin-top:18px;padding:15px;background:var(--soft);border-radius:8px;font-size:11px;line-height:1.9"><strong>띵동 사용 안내</strong><br>이름을 더블클릭하면 메시지 작성, 우클릭하면 대화를 선택할 수 있어요.<br>일정의 빈 공간을 두 번 클릭하면 새 일정을 추가할 수 있어요.<br>${native ? "메시지는 암호화하여 전달하고 각자의 PC에 보관합니다. 서버의 메시지와 전달 정보는 전원 PC 저장 확인 후 삭제하며, 첨부 파일은 암호화 없이 10일간 제공합니다." : "모든 데이터는 예시이며 이 브라우저에만 저장됩니다."}</div>`,
      button("notification-test", "알림 테스트", "bell") +
        button("close-modal", "완료", "", "btn-primary"),
      "settings-modal",
    );
    $("#calendar-position").onchange = (e) => {
      state.settings.calendarPosition=e.target.value;
      save(); render();
      if(windowApi&&state.showToday)windowApi.toggleToday(true,state.settings.calendarPosition);
    };
    $("#auto-login").onchange = (e) => {
      state.settings.autoLogin = e.target.checked;
      save();
    };
    $("#dark-mode").onchange = (e) => {
      state.settings.dark = e.target.checked;
      applySettings();
      save();
    };
  }
  function confirmModal(title, body, action, id) {
    openModal(
      title,
      `<p style="font-size:13px;line-height:1.8">${esc(body)}</p>`,
      button("close-modal", "취소") +
        button(action, "확인", "", "btn-primary", `data-id="${esc(id)}"`),
    );
  }
  async function openPersonChat(ids) {
    ids = [...new Set(ids)];
    if (!ids.length) return;
    let room = state.data.rooms.find(
      (r) =>
        r.members.length === ids.length &&
        ids.every((id) => r.members.includes(id)),
    );
    if (!room) {
      room = {
        id: uid("user-room"),
        name:
          ids.length === 1
            ? person(ids[0]).name
            : ids
                .slice(0, 2)
                .map((id) => person(id).name)
                .join(", ") +
              " 외 " +
              Math.max(0, ids.length - 2) +
              "명",
        members: ids,
        pinned: false,
        muted: false,
        unread: 0,
        notice: "",
        messages: [],
      };
      state.data.rooms.unshift(room);
      if (!(await save())) return;
    }
    if(windowApi){await windowApi.openChat(room.id);return;}
    state.floating = room.id;
    state.reply = null;
    state.chatQuery = "";
    state.chatSearch = false;
    state.members = false;
    renderFloating();
  }
  let editorFormatRange=null,editorTypingFormats={},editorTypingAnchor=null;
  function editorPaletteHTML(kind){
    const colors=kind==="text"?[["기본","#22332f"],["빨강","#c65348"],["파랑","#2563eb"],["초록","#237a61"],["주황","#d97706"],["보라","#7c3aed"],["회색","#6b7280"]]:[["노랑","#fff59d"],["연두","#d9f99d"],["하늘","#bae6fd"],["분홍","#fbcfe8"],["주황","#fed7aa"],["보라","#e9d5ff"],["없음","transparent"]];
    return `<div id="editor-${kind}-palette" class="editor-palette" role="group" aria-label="${kind==="text"?"글자 색상":"형광펜"} 색상 선택" hidden>${colors.map(([name,color])=>`<button type="button" class="editor-swatch" data-action="editor-color" data-command="${kind==="text"?"foreColor":"hiliteColor"}" data-color="${color}" aria-label="${name} ${kind==="text"?"글자 색상":"형광펜"}" title="${name}" style="--swatch:${color}">${color==="transparent"?"×":""}</button>`).join("")}</div>`;
  }
  function closeEditorPalettes(){
    $$(".editor-palette").forEach(palette=>palette.hidden=true);
    $$('[data-action="editor-palette-toggle"]').forEach(button=>button.setAttribute("aria-expanded","false"));
  }
  function captureEditorFormat(){
    const editor=$("#mail-editor"),selection=window.getSelection();
    if(editor&&selection?.rangeCount&&editor.contains(selection.getRangeAt(0).commonAncestorContainer)){
      const range=selection.getRangeAt(0);
      if(editorTypingAnchor&&(!range.collapsed||range.startContainer!==editorTypingAnchor.node||range.startOffset!==editorTypingAnchor.offset)){editorTypingFormats={};editorTypingAnchor=null;}
      editorFormatRange=range.cloneRange();
    }
  }
  function applyEditorFormat(command,value){
    const editor=$("#mail-editor");if(!editor)return;
    editor.focus();const selection=window.getSelection();
    if(editorFormatRange&&editor.contains(editorFormatRange.commonAncestorContainer)){selection.removeAllRanges();selection.addRange(editorFormatRange.cloneRange());}
    const range=selection.rangeCount?selection.getRangeAt(0):null;
    if(command==="removeFormat"||!range?.collapsed){editorTypingFormats={};editorTypingAnchor=null;}
    else if(["foreColor","hiliteColor","fontSize"].includes(command)){
      editorTypingAnchor={node:range.startContainer,offset:range.startOffset};editorTypingFormats[command]=value;
    }
    document.execCommand("styleWithCSS",false,["foreColor","hiliteColor","fontSize"].includes(command));
    document.execCommand(command,false,value);
    if(range?.collapsed&&Object.keys(editorTypingFormats).length){
      document.execCommand("styleWithCSS",false,true);
      for(const [format,chosen] of Object.entries(editorTypingFormats))document.execCommand(format,false,chosen);
    }
    captureEditorFormat();closeEditorPalettes();
  }
  document.addEventListener("selectionchange",captureEditorFormat);
  document.addEventListener("pointerdown",event=>{if(!event.target.closest(".editor-tools"))closeEditorPalettes();});
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&$(".editor-palette:not([hidden])")){event.preventDefault();event.stopImmediatePropagation();closeEditorPalettes();$("#mail-editor")?.focus();}});
  let editorLinkRange=null;
  function captureEditorLink(event){
    const editor=$("#mail-editor"),selection=window.getSelection();
    if(selection?.rangeCount&&editor.contains(selection.getRangeAt(0).commonAncestorContainer))editorLinkRange=selection.getRangeAt(0).cloneRange();
    else{const caret=document.caretRangeFromPoint?.(event.clientX,event.clientY);if(caret&&editor.contains(caret.commonAncestorContainer))editorLinkRange=caret;else{editorLinkRange=document.createRange();editorLinkRange.selectNodeContents(editor);editorLinkRange.collapse(false);}}
    const anchor=event.target.closest("a");if(anchor&&editor.contains(anchor)&&editorLinkRange.collapsed)editorLinkRange.selectNode(anchor);
  }
  function insertEditorLink(){
    const editor=$("#mail-editor");if(!editor)return;
    const range=editorLinkRange?.cloneRange()||document.createRange();if(!editorLinkRange){range.selectNodeContents(editor);range.collapse(false);}
    let current=range.startContainer.nodeType===1?range.startContainer:range.startContainer.parentElement;const existing=current?.closest("a")||range.cloneContents().querySelector?.("a");
    const dialog=document.createElement("dialog");dialog.className="editor-link-dialog";dialog.id="editor-link-dialog";
    dialog.innerHTML=`<form id="editor-link-form"><h2>링크 삽입</h2><label>표시할 텍스트<input class="input" id="editor-link-text" maxlength="2000" required value="${esc(range.toString())}" placeholder="예: 회의 자료 보기"></label><label>연결할 주소<input class="input" id="editor-link-url" type="url" maxlength="2048" required value="${esc(existing?.getAttribute("href")||'')}" placeholder="https://example.com"></label><p id="editor-link-error" class="form-error" role="alert"></p><div class="editor-link-actions"><button class="btn" type="button" id="editor-link-cancel">취소</button><button class="btn btn-primary" type="submit">링크 삽입</button></div></form>`;
    $("#modal-root").append(dialog);
    const finish=()=>{dialog.close();dialog.remove();if(editor.isConnected){editor.focus();const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);}editorLinkRange=null;};
    dialog.querySelector("#editor-link-cancel").onclick=finish;
    dialog.oncancel=event=>{event.preventDefault();finish();};
    dialog.addEventListener("keydown",event=>{event.stopPropagation();if(event.key==="Escape"){event.preventDefault();finish();}});
    dialog.querySelector("form").onsubmit=event=>{event.preventDefault();const text=dialog.querySelector("#editor-link-text").value.trim();let url;try{url=new URL(dialog.querySelector("#editor-link-url").value.trim());if(!["http:","https:"].includes(url.protocol)||url.username||url.password)throw Error();}catch{dialog.querySelector("#editor-link-error").textContent="http:// 또는 https://로 시작하는 주소를 입력해 주세요.";return;}if(!text)return;
      if(!editor.contains(range.commonAncestorContainer)){dialog.querySelector("#editor-link-error").textContent="작성 위치가 변경되었습니다. 취소 후 다시 삽입해 주세요.";return;}
      const link=document.createElement("a");link.href=url.href;link.target="_blank";link.rel="noopener noreferrer";link.textContent=text;range.deleteContents();range.insertNode(link);range.setStartAfter(link);range.collapse(true);const space=document.createTextNode(" ");range.insertNode(space);range.setStartAfter(space);range.collapse(true);editor.dispatchEvent(new Event("input",{bubbles:true}));finish();};
    dialog.showModal();dialog.querySelector(range.toString()?"#editor-link-url":"#editor-link-text").focus();
  }
  function menu(x, y, items) {
    const root = $("#context-root");
    root.innerHTML = `<div class="menu" role="menu">${items.map((item) => `<button role="menuitem" data-action="${item.action}" ${item.extra || ""} class="${item.danger ? "danger" : ""}">${icon(item.icon || "file", 15)}${esc(item.label)}</button>`).join("")}</div>`;
    const el = $(".menu");
    el.style.left =
      Math.max(8, Math.min(x, innerWidth - el.offsetWidth - 8)) + "px";
    el.style.top =
      Math.max(8, Math.min(y, innerHeight - el.offsetHeight - 8)) + "px";
    $("button", el)?.focus();
  }
  function refreshSelection() {
    const count = $("#selected-count");
    if (count)
      count.textContent = state.selected.size
        ? state.selected.size + "명 선택"
        : "이름을 더블클릭해 메시지를 보내세요";
    const summary = $("#selection-summary");
    if (summary)
      summary.textContent = state.selected.size
        ? state.selected.size + "명에게 보내기"
        : "함께 나누면 더 쉬워져요";
    $$('[data-action="group-mail"],[data-action="group-chat"]').forEach(
      (b) => (b.disabled = !state.selected.size),
    );
    if ($("#select-all"))
      $("#select-all").checked =
        state.selected.size === state.data.people.length;
  }
  function refreshCounts() {
    [
      ["inbox", unreadMails()],
      ["chat", unreadChats()],
    ].forEach(([name, count]) => {
      const nav = $('[data-action="nav-' + name + '"]');
      if (nav) {
        $(".badge", nav)?.remove();
        if (count)
          nav.insertAdjacentHTML(
            "beforeend",
            '<b class="badge">' + count + "</b>",
          );
      }
    });
    for(const [kind,count] of [['mails',unreadMails()],['chats',unreadChats()]]){const badge=$('[data-minimal-'+kind+']');if(badge){badge.textContent=count;badge.parentElement.setAttribute('aria-label',(kind==='mails'?'안 읽은 메시지 ':'새 대화 ')+count+'개');}}
    if($('#mail-folder-select'))$('#mail-folder-select').innerHTML=mailFolderOptions();
  }
  function refreshMail() {
    refreshCounts();
    if ($("#mail-list")) {
      $("#mail-list").innerHTML = mailListHTML();
      initMailColumns();
    }
    if ($("#mail-detail")) {
      const m = state.data.mails.find((m) => m.id === state.mail);
      $("#mail-detail").innerHTML = m
        ? mailDetail(m)
        : empty(
            "메시지를 선택해 주세요",
            "목록에서 읽고 싶은 메시지를 선택하세요.",
            "mail",
          );
    }
    initMailHeader();
  }
  const selectedMessageRecipients=id=>state.selected.has(id)?[...state.selected]:[id];
  const dismissRecipientSuggestions=event=>{
    for(const [kind,prefix] of [["to","recipient"],["cc","cc"]]){
      if(!event.target.closest("#"+prefix+"-box"))hideRecipientSuggestions(kind);
    }
  };
  document.addEventListener("pointerdown",dismissRecipientSuggestions);
  document.addEventListener("focusin",dismissRecipientSuggestions);
  document.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-action]");
    if (!target) {
      if (!e.target.closest(".menu")) $("#context-root").innerHTML = "";
      if (e.target.classList.contains("overlay")) closeModal();
      return;
    }
    const action = target.dataset.action,
      d = target.dataset;
    $("#context-root").innerHTML = "";
    if(await workUI.handleAction(action,target))return;
    if(action==="privacy-settings"){await privacySettings();return;}
    if(action==="privacy-export"||action==="privacy-import"){privacyArchive(action==="privacy-export"?"export":"import");return;}
    if(action==="privacy-verify"){await verifyPrivacyNumber();return;}
    if(action==="privacy-retry-incoming"){target.disabled=true;try{const result=await native.privacy('retry-incoming');if(result.error)throw Error(result.error);await network.refresh();await privacySettings();toast(result.incomingFailures?'수신 확인이 필요한 메시지가 남아 있어요':'수신을 다시 확인했어요',result.incomingFailures?'발신자에게 재전송을 요청하거나 상대방 보안 번호를 확인해 주세요.':'');}catch(error){toast('수신을 다시 확인하지 못했어요',error.message);}finally{target.disabled=false;}return;}
    if(action === "window-minimize" || action === "window-close" || action === "window-maximize" || action === "window-minimal" || action === "window-restore-main"){windowApi?.windowAction(action.slice(7));return;}
    if(action === "makeup-notice"){if(target.closest(".school-work-menu"))closeModal();composeMail({noticeType:"makeup",title:"보강 안내",to:[...state.selected]});return;}
    if(action === "lesson-change"){if(target.closest(".school-work-menu"))closeModal();composeMail({noticeType:"lessonChange",title:"수업 변경 안내",to:[...state.selected]});return;}
    if(action === "editor-link"){insertEditorLink();return;}
    if(action === "staff-import"){staffImportForm();return;}
    if(action === "class-teachers"){classTeachersForm();return;}
    if(action === "bell-default-settings"){bellScheduleForm({basic:true});return;}
    if(action === "bell-schedule"){if(target.closest(".school-work-menu"))closeModal();bellScheduleForm();return;}
    if(action === "edit-duty"){dutyAssignmentForm(target.dataset.event);return;}
    if(action==='homeroom-work'){homeroomModal({date:koreanToday()});return;}
    if(['homeroom-prev','homeroom-next','homeroom-today'].includes(action)){const card=target.dataset.scope==='card',current=card?homeroomCardDate:homeroomModalDate,date=action==='homeroom-today'?koreanToday():addDays(current,action==='homeroom-prev'?-1:1);if(!DingdongHomeroom.validDay(date))return;if(card){homeroomCardDate=date;refreshHomeroom();}else homeroomModal({date});return;}
    if(action==='homeroom-memo'){await openHomeroomMemo(target.dataset.mail,target.dataset.date);return;}
    if(action==='homeroom-defer'||action==='homeroom-dismiss'){
      const date=target.dataset.date,mail=homeroomEntries(date).find(m=>m.id===target.dataset.mail);if(!mail||target.disabled)return;target.disabled=true;
      const defer=action==='homeroom-defer';
      try{await dutyOperation(defer?'homeroom.defer':'homeroom.dismiss',{mail:mail.id,date},()=>{const original=state.data.mails.find(m=>m.id===mail.id);if(defer)DingdongHomeroom.carry(original,date);else DingdongHomeroom.dismissDay(original,date);});render();refreshHomeroom();toast(defer?'다음 날짜의 담임 업무로 이월했어요':'이 날짜의 담임 업무에서 삭제했어요',defer?'오늘 기록과 메모는 그대로 보관됩니다.':'원본 메시지와 다른 날짜의 기록은 보관됩니다.');}
      catch(error){target.disabled=false;toast(defer?'이월하지 못했어요':'삭제하지 못했어요',error.message);}return;
    }
    if(action==='homeroom-pin'){
      const mail=homeroomEntries(target.dataset.date).find(m=>m.id===target.dataset.mail);if(!mail||target.disabled)return;
      const current=state.data.deadlines.find(d=>d.homeroomMail===mail.id),pinned=!current;target.disabled=true;
      try{await dutyOperation('homeroom.pin',{mail:mail.id,pinned,date:target.dataset.date},()=>{
        if(current)state.data.deadlines=state.data.deadlines.filter(d=>d.id!==current.id);
        else state.data.deadlines.push({id:uid('user-homeroom'),...DingdongHomeroom.pinnedItem(mail,target.dataset.date)});
      });render();refreshHomeroom();toast(pinned?'완료 확인에 고정했어요':'고정을 해제했어요');}
      catch(error){target.disabled=false;toast('고정을 변경하지 못했어요',error.message);}return;
    }
    if(action==='homeroom-source'){const id=target.dataset.mail;closeModal();if(windowApi)await windowApi.openWorkspace('inbox',{kind:'mail',id});else await revealBriefingTarget({kind:'mail',id});return;}
    if(action==='toggle-memo'){toggleMemo();return;}
    if(action==='exchange-inbox'){
      if(windowApi?.mainHost)await windowApi.openWorkspace('calendar',{kind:'exchange',id:'inbox-all'});else exchangeListForm();return;
    }
    if(action==='exchanges'){exchangeListForm(target.dataset.event||null);return;}
    if(action==='exchange-new'){exchangeRequestForm(target.dataset.event);return;}
    if(action==='exchange-prev'||action==='exchange-next'){if(!exchangeBusy&&target.dataset.exchange)exchangeDetailForm(target.dataset.exchange,$('#exchange-detail')?.dataset.eventScope||null);return;}
    if(action==='exchange-detail'){exchangeDetailForm(target.dataset.exchange);return;}
    if(action==='exchange-act'){exchangeRespond(target.dataset.exchange,target.dataset.exchangeAction);return;}
    if(action === "duty-edit-cancel"){viewEvent(target.dataset.event,false,true);return;}
    if(action === "nav-other-work"){otherWorkMenu();return;}
    if(action === "duty-settings"){dutySettingsForm();return;}
    if(action.startsWith("duty-import-")){dutyImportForm(action.slice(12));return;}
    if(action === "nav-school-work"){openModal("교무업무",'<div class="school-work-menu">'+button("makeup-notice","보강 안내","calendar")+button("lesson-change","수업 변경","calendar")+button("bell-schedule","일과표","clock")+'</div>',button("close-modal","닫기"));return;}
    if(action === "back-main"){state.page="people";render();return;}
    if(action === "import-server"){native.importConnection().then(value=>{if(value?.error)toast("서버 연결 실패",value.error);else if(value){network.connection=value;login();toast("서버 연결 파일을 가져왔어요",value.schoolName);}});return;}
    if (action.startsWith("nav-")) {
      const page=action.slice(4);
      if(windowApi&&["inbox","calendar","announcements","links","search","requests"].includes(page)){windowApi.openWorkspace(page);return;}
      state.page = action.slice(4);
      state.search = "";
      state.mobileList = state.page === "chat" && innerWidth <= 600;
      state.reply = null;
      render();
      return;
    }
    switch (action) {
      case "demo-login":
        state.user = "교사A";
        state.page = requestedChat ? "chat" : ["inbox","calendar","announcements","links","search","requests"].includes(requestedWorkspace) ? requestedWorkspace : "people";
        save();
        render();
        break;
      case "logout":
        inlineMailEpoch++;inlineMailCache.clear();inlineMailLoading.clear();inlineMailErrors.clear();
        if(native){try{await network.logout();}catch(error){toast("로그아웃 확인 필요",error.message);return;}}
        state.user = null;
        workUI.clearSearch();
        state.settings.autoLogin = false;
        state.floating = null;
        save();
        closeModal();
        render();
        break;
      case "briefing-open":
        target.disabled=true;await openBriefingEntry(d.kind,d.item);break;
      case "close-modal":
        closeModal();
        break;
      case "group":
        state.group = d.group;
        renderPage();
        break;
      case "dept-toggle":
        state.collapsed.has(state.group+":"+d.dept)
          ? state.collapsed.delete(state.group+":"+d.dept)
          : state.collapsed.add(state.group+":"+d.dept);
        $("#org-tree").innerHTML = orgTree();
        break;
      case "person-select":
        if(e.detail===0)composeMail({to:selectedMessageRecipients(d.person)});
        break;
      case "person-chat":
        openPersonChat([d.person]);
        break;
      case "person-mail":
        composeMail({ to: selectedMessageRecipients(d.person) });
        break;
      case "group-chat":
        openPersonChat([...state.selected]);
        break;
      case "group-mail":
        composeMail({ to: [...state.selected] });
        break;
      case "compose-mail":
        composeMail({to:[...state.selected]});
        break;
      case "toggle-today":
        if(requestedToday){windowApi?.toggleToday(false);return;}
        state.showToday = !state.showToday;
        if(windowApi)windowApi.toggleToday(state.showToday,state.settings.calendarPosition);
        else {const drawer=$(".today-drawer");if(drawer){drawer.classList.toggle("open",state.showToday);drawer.inert=!state.showToday;drawer.setAttribute("aria-hidden",String(!state.showToday));}}
        $$('[data-action="toggle-today"]').forEach(el=>el.setAttribute('aria-pressed',String(state.showToday)));
        break;
      case "today-prev":
        state.today = addDays(state.today, -1);
        render();
        break;
      case "today-next":
        state.today = addDays(state.today, 1);
        render();
        break;
      case "today-reset":
        state.today = Mock.today;
        render();
        break;
      case "open-room":
        if(windowApi){windowApi.openChat(d.room);const room=state.data.rooms.find(r=>r.id===d.room);if(room){room.unread=0;save();}return;}
        state.room = d.room;
        state.reply = null;
        state.chatQuery = "";
        state.chatSearch = false;
        state.members = false;
        state.mobileList = false;
        const room = state.data.rooms.find((r) => r.id === d.room);
        if (room) room.unread = 0;
        save();
        render();
        $(".chat-layout")?.classList.add("conversation-open");
        break;
      case "chat-back":
        state.mobileList = true;
        renderPage();
        $(".chat-layout")?.classList.remove("conversation-open");
        break;
      case "pop-chat":
        if(windowApi){windowApi.openChat(d.room);return;}
        state.floating = d.room;
        renderFloating();
        break;
      case "close-chat":
        state.floating = null;
        renderFloating();
        break;
      case "chat-search":
        state.chatSearch = !state.chatSearch;
        state.chatQuery = "";
        if (state.page === "chat") renderPage();
        renderFloating();
        $("[data-chat-search]:not([hidden])")?.focus();
        break;
      case "chat-members":
        state.members = !state.members;
        if (state.page === "chat") renderPage();
        renderFloating();
        break;
      case "cancel-reply":
        state.reply = null;
        $$(".reply-preview").forEach((el) => (el.hidden = true));
        break;
      case "reply-message": {
        const r = state.data.rooms.find((r) => r.id === d.room),
          m = r?.messages.find((m) => m.id === d.message);
        if (m) {
          state.reply = { room: r.id, text: m.text };
          $$(`[data-chat-form="${r.id}"] .reply-preview`).forEach((el) => {
            el.hidden = false;
            $("span", el).textContent = "답장 · " + m.text.slice(0, 55);
          });
          $(`[data-chat-input="${r.id}"]`)?.focus();
        }
        break;
      }
      case "like-message": {
        const m = state.data.rooms
          .find((r) => r.id === d.room)
          ?.messages.find((m) => m.id === d.message);
        if (m) {
          m.liked = !m.liked;
          m.likes = (m.likes || 0) + (m.liked ? 1 : -1);
          save();
          updateChat(d.room);
        }
        break;
      }
      case "new-chat":
        openModal(
          "새 대화 시작하기",
          `<p class="muted" style="font-size:12px;margin-bottom:12px">함께 이야기할 선생님을 골라 주세요.</p><div class="search">${icon("search", 16)}<input class="input" id="new-chat-search" aria-label="초대할 선생님 검색" placeholder="이름 검색"></div><div id="new-chat-people" style="max-height:350px;overflow:auto;margin-top:12px">${state.data.people.map((p, i) => `<label class="person" data-new-chat-person="${p.id}"><input type="checkbox" value="${p.id}" name="chat-invite">${avatar(p, "small", i)}<span>${esc(p.name)} <small class="muted">${esc(p.department)}</small></span></label>`).join("")}</div>`,
          button("close-modal", "취소") +
            button("create-chat", "대화 시작", "chat", "btn-primary"),
        );
        break;
      case "create-chat": {
        const ids = $$('[name="chat-invite"]:checked').map((el) => el.value);
        if (!ids.length) {
          toast(
            "선생님을 선택해 주세요",
            "한 명 이상 선택하면 대화를 시작할 수 있어요.",
          );
          break;
        }
        closeModal();
        openPersonChat(ids);
        break;
      }
      case "pin-room":
      case "mute-room": {
        const r = state.data.rooms.find((r) => r.id === d.room);
        if (r) {
          r[action === "pin-room" ? "pinned" : "muted"] =
            !r[action === "pin-room" ? "pinned" : "muted"];
          save();
          renderPage();
          renderFloating();
        }
        break;
      }
      case "leave-room":
        confirmModal(
          "대화방에서 나갈까요?",
          "이 브라우저에 저장된 대화 내용도 함께 삭제됩니다.",
          "confirm-leave",
          d.room,
        );
        break;
      case "confirm-leave":
        state.data.rooms = state.data.rooms.filter((r) => r.id !== d.id);
        if (state.floating === d.id) state.floating = null;
        save();
        closeModal();
        render();
        break;
      case "mail-folder":
        state.folder = d.folder;
        state.mail = null;
        state.mailSearch = "";
        renderPage();
        break;
      case "mail-more": {
        const list=$("#mail-list"),previous=list.querySelectorAll(".mail-table-row").length,scrollTop=list.scrollTop;
        mailVisible+=mailPageSize;list.innerHTML=mailListHTML();initMailColumns();
        list.querySelectorAll(".mail-table-row")[previous]?.focus({preventScroll:true});list.scrollTop=scrollTop;
        break;
      }
      case "open-mail": {
        const m = state.data.mails.find((m) => m.id === d.mail);
        if (m) {
          state.mail = m.id;
          m.unread = false;
          save();
          refreshMail();
          $(".mail-workspace")?.classList.add("show-detail");
        }
        break;
      }
      case "retry-inline-mail":
        inlineMailErrors.delete(d.mail);refreshMail();break;
      case "mail-back":
        state.mail = null;
        $(".mail-workspace")?.classList.remove("show-detail");
        break;
      case "star-mail": {
        const m = state.data.mails.find((m) => m.id === d.mail);
        if (m) {
          m.important = !m.important;
          save();
          refreshMail();
        }
        break;
      }
      case "delete-mail":
        confirmModal(
          "메시지를 휴지통으로 옮길까요?",
          "휴지통에서 언제든 다시 복원할 수 있어요.",
          "confirm-delete-mail",
          d.mail,
        );
        break;
      case "confirm-delete-mail": {
        const m = state.data.mails.find((m) => m.id === d.id);
        if (m) {
          m.previousFolder = m.folder;
          m.folder = "trash";
          state.mail = null;
          save();
          closeModal();
          render();
          toast("휴지통으로 옮겼어요");
        }
        break;
      }
      case "restore-mail": {
        const m = state.data.mails.find((m) => m.id === d.mail);
        if (m) {
          m.folder = m.previousFolder || "inbox";
          state.mail = null;
          save();
          render();
          toast("메시지를 복원했어요");
        }
        break;
      }
      case "recall-mail":
        confirmModal(
          "아직 읽지 않은 메시지를 회수할까요?",
          "이미 읽은 수신자의 메시지는 유지됩니다.",
          "confirm-recall",
          d.mail,
        );
        break;
      case "confirm-recall": {
        const m = state.data.mails.find((m) => m.id === d.id);
        if(m&&native){
          target.disabled=true;
          try{
            await network.queue;
            const result=await native.request('/sync',{operations:[{type:'mail.update',id:m.id,recall:true}]});
            if(result.error)throw Error(result.error);
            closeModal();await network.refresh();toast('회수를 요청했어요','보낸 메시지함에서 수신자별 상태를 확인할 수 있습니다.');
          }catch(error){toast('회수하지 못했어요',error.message);}
          finally{if(target.isConnected)target.disabled=false;}
          break;
        }
        if (m) {
          m.receipts = m.receipts.map((r) => (r === "unread" || r === "scheduled" ? "recalled" : r));
          save();
          closeModal();
          refreshMail();
          toast(
            "회수 상태를 반영했어요",
            "이미 읽은 수신자의 상태는 유지됩니다.",
          );
        }
        break;
      }
      case "retry-send-mail": {
        target.disabled=true;
        try{await network.queue;const result=await native.request('/sync',{operations:[{type:'mail.retry',id:d.mail}]});if(result.error)throw new Error(result.error);await network.refresh();toast(result.delivery?.[d.mail]==='failed'?'다시 발송하지 못했습니다':result.delivery?.[d.mail]==='queued'?'PC에 발송 대기 중입니다':'서버에 전달했습니다',result.delivery?.[d.mail]==='failed'?'메시지에 표시된 사유를 확인해 주세요.':'상대 PC 저장과 읽음은 따로 표시됩니다.');}catch(error){toast('다시 보내지 못했습니다',error.message);}finally{if(target.isConnected)target.disabled=false;}
        break;
      }
      case "redraft-mail": {
        const m=state.data.mails.find(m=>m.id===d.mail);if(!m)break;
        try{const html=await loadInlineMail(m);composeMail({to:m.to.filter(id=>!m.cc?.includes(id)),cc:m.cc||[],title:m.title,body:m.body,richBody:html,files:m.files,workRequest:m.workRequest,workReminderOf:m.workReminderOf});}catch(error){toast('내용을 불러오지 못했습니다',error.message);}
        break;
      }
      case "reply-mail":
      case "reply-all":
      case "forward-mail": {
        const m = state.data.mails.find((m) => m.id === d.mail);
        if (m) {
          let richHTML=m.html;try{richHTML=await loadInlineMail(m);}catch{toast("본문 이미지를 불러오지 못했습니다", "다시 시도해 주세요.");break;}
          composeMail({
            to:
              action === "forward-mail"
                ? []
                : action === "reply-all"
                  ? [...new Set([m.from, ...m.to].filter((id) => id !== "me"))]
                  : m.from === "me"
                    ? m.to
                    : [m.from],
            title: (action === "forward-mail" ? "전달: " : "답장: ") + m.title,
            body: "\n\n──────── 원본 메시지 ────────\n" + m.body,
            richBody:"<br><br>──────── 원본 메시지 ────────<br>"+safeRichHTML(richHTML||esc(m.body).replace(/\n/g,"<br>")),
            files: action === "forward-mail" ? m.files : [],
            forwarded: action === "forward-mail",
          });
        }
        break;
      }
      case "print-mail":
        window.print();
        break;
      case "download-file":
        downloadFile(
          state.data.mails.find((m) => m.id === d.mail),
          Number(d.file),
        );
        break;
      case "mail-recipients-more":
        {const expanded=target.getAttribute("aria-expanded")!=="true";target.setAttribute("aria-expanded",String(expanded));target.textContent=expanded?"접기":"더 보기";$("#mail-to-values").classList.toggle("expanded",expanded);}
        break;
      case "capture-mail":{
        captureEditorFormat();const editor=$("#mail-editor"),selection=window.getSelection();editor?.focus({preventScroll:true});
        if(editorFormatRange&&editor?.contains(editorFormatRange.commonAncestorContainer)){selection.removeAllRanges();selection.addRange(editorFormatRange.cloneRange());}
        const result=await window.dingdongDesktop?.captureScreen();
        if(result?.error&&$("#compose-error"))$("#compose-error").textContent="캡처 도구를 열지 못했습니다.";
        break;}
      case "attach-mail":
        $("#mail-files")?.click();
        break;
      case "compose-announcement":
        composeMail({mode:"announcement"});
        break;
      case "announcement-option":
        if(composeDraft?.mode!=="announcement")break;
        {const key=d.option==="scheduled"?"announcementScheduled":"announcementEvent";composeDraft[key]=!composeDraft[key];target.setAttribute("aria-pressed",String(composeDraft[key]));setComposeMode("announcement");}
        break;
      case "recipient-more":
        target.setAttribute("aria-expanded",String(target.getAttribute("aria-expanded")!=="true"));refreshRecipientFold(d.kind||"to");
        break;
      case "compose-mode":
        setComposeMode(d.mode);
        break;
      case "add-recipient": {
        const kind = d.kind || "to";
        if (!composeDraft[kind].includes(d.person)) composeDraft[kind].push(d.person);
        const box = $("#" + (kind === "to" ? "recipient" : "cc") + "-box");
        $(kind==="to"?"#recipient-values":"#cc-values").innerHTML=recipientChips(kind);
        refreshRecipientFold(kind);
        $("input", box).value = "";
        $("input", box).focus();
        hideRecipientSuggestions(kind);
        break;
      }
      case "remove-recipient":
        composeDraft[d.kind || "to"] = composeDraft[d.kind || "to"].filter(
          (id) => id !== d.person,
        );
        target.closest(".chip").remove();
        refreshRecipientFold(d.kind||"to");
        break;
      case "remove-file":
        composeDraft.files.splice(Number(d.file), 1);
        $("#compose-files").innerHTML = composeFilesHTML();
        break;
      case "editor-palette-toggle": {
        const palette=$("#editor-"+d.palette+"-palette"),open=palette.hidden;
        closeEditorPalettes();palette.hidden=!open;target.setAttribute("aria-expanded",String(open));
        break;
      }
      case "editor-color":
        if(["foreColor","hiliteColor"].includes(d.command)&&/^(#[0-9a-f]{6}|transparent)$/.test(d.color))applyEditorFormat(d.command,d.color);
        break;
      case "editor-bold":
      case "editor-italic":
      case "editor-underline":
      case "editor-list":
      case "editor-clear":
        applyEditorFormat({"editor-bold":"bold","editor-italic":"italic","editor-underline":"underline","editor-list":"insertUnorderedList","editor-clear":"removeFormat"}[action]);
        break;
      case "mail-calendar": {
        const m = state.data.mails.find((m) => m.id === d.mail);
        if (m?.eventId) {
          const event = state.data.events.find((ev) => ev.id === m.eventId);
          if (event) viewEvent(event.id);
          else if(state.data.deadlines.some(item=>item.id===m.eventId)) eventForm({...state.data.deadlines.find(item=>item.id===m.eventId),type:"deadline"});
          else
            toast("연동된 일정을 찾을 수 없어요", "일정을 다시 등록해 주세요.");
        } else if (m) eventForm({ title: m.title, mail: m.id });
        break;
      }
      case "week-prev":
        state.week = addDays(state.week, -7);
        state.expanded = null;
        renderPage();
        break;
      case "week-next":
        state.week = addDays(state.week, 7);
        state.expanded = null;
        renderPage();
        break;
      case "week-reset":
        state.week = weekStart(Mock.today);
        state.expanded = null;
        renderPage();
        break;
      case "expand-day":
        state.expanded = state.expanded === d.date ? null : d.date;
        renderPage();
        break;
      case "calendar-jump":
        state.week = weekStart(d.date);
        state.today = d.date;
        renderPage();
        break;
      case "weekly":
        state.calendarView="week";renderPage();
        break;
      case "duty-calendar":
        monthAnchor=state.today;state.calendarView="duty";renderPage();
        break;
      case "duty-month-reset":
        monthAnchor=Mock.today;renderPage();
        break;
      case "monthly":
        monthAnchor = state.today;
        monthly();
        break;
      case "month-prev":
      case "month-next": {
        const date = parseDate(monthAnchor);
        date.setDate(1);
        date.setMonth(date.getMonth() + (action === "month-next" ? 1 : -1));
        monthAnchor = dateKey(date);
        renderPage();
        break;
      }
      case "month-date":
        eventForm({ date: d.date });
        break;
      case "month-theme":
        state.settings.dark = !state.settings.dark;
        save();
        applySettings();
        target.innerHTML =
          icon(state.settings.dark ? "sun" : "moon", 16) +
          (state.settings.dark ? "밝게 보기" : "어둡게 보기");
        break;
      case "add-personal-event":
        eventForm({privateOnly:true});
        break;
      case "add-event":
        eventForm();
        break;
      case "view-event":
        viewEvent(d.event);
        break;
      case "edit-event": {
        const event = state.data.events.find((e) => e.id === d.event);
        if (event) eventForm(event);
        break;
      }
      case "delete-event":
        confirmModal(
          "일정을 삭제할까요?",
          "저장된 일정이 오늘 일정과 캘린더에서 함께 사라집니다.",
          "confirm-delete-event",
          d.event,
        );
        break;
      case "confirm-delete-event":
        state.data.events = state.data.events.filter((ev) => ev.id !== d.id);
        state.data.deadlines = state.data.deadlines.filter(item => item.id !== d.id);
        state.data.notes = state.data.notes.filter(item => item.id !== d.id);
        state.data.mails.forEach((m) => {
          if (m.eventId === d.id) delete m.eventId;
        });
        save();
        closeModal();
        render();
        toast("일정을 삭제했어요");
        break;
      case "event-note": {
        const event = state.data.events.find((ev) => ev.id === d.event);
        if (event) toast(event.title, event.note, "calendar");
        break;
      }
      case "view-note": {
        const n = state.data.notes.find((n) => n.id === d.note);
        if (n)
          openModal(
            "기억해 둘 메모",
            `<span class="chip">${fmtDate(n.date)} · ${n.time}</span><p style="margin-top:20px;white-space:pre-wrap">${esc(n.text)}</p>`,
            button("close-modal", "닫기") +
              button(
                "delete-note",
                "메모 삭제",
                "trash",
                "btn-danger",
                `data-note="${n.id}"`,
              ),
          );
        break;
      }
      case "delete-note":
        state.data.notes = state.data.notes.filter((n) => n.id !== d.note);
        save();
        closeModal();
        renderPage();
        break;
      case "schedule-memo": editScheduleMemo(d.schedule); break;
      case "schedule-summary": toggleScheduleSummary(target); break;
      case "schedule-source": {
        const item=[...state.data.events,...state.data.deadlines].find(i=>i.id===d.schedule);
        if(item)showScheduleSource(item);break;
      }
      case "schedule-return": {
        if(state.data.events.some(i=>i.id===d.schedule))viewEvent(d.schedule);
        else viewDeadline(d.schedule);
        break;
      }
      case "deadline-source": {
        const item=state.data.deadlines.find(i=>i.id===d.deadline);
        if(item)showScheduleSource(item);break;
      }
      case "deadline-detail": {
        viewDeadline(d.deadline);
        break;
      }
      case "demo-deadline": {
        if(native)break;
        openModal("수신 메시지 일정 체험",`<form id="demo-deadline-form" class="event-form"><p>메시지를 받으면 내 캘린더에 시작 시간 없는 마감 일정이 등록됩니다.</p><label>메시지 내용<textarea class="input" id="demo-deadline-text" maxlength="5000" rows="4" required>내일 점심시간 전까지 자료를 제출해 주세요.</textarea></label><label>발송 시각 (한국 시간)<input class="input" id="demo-deadline-sent" type="datetime-local" value="${window.DingdongDeadlines.sentDate(Date.now())}T09:00" required></label><p class="muted">오전 중·점심시간 전까지는 12:05, 날짜만 있으면 16:00입니다. 해당 날짜의 일과표를 바꾸면 4교시 종료 시간을 적용합니다.</p><div id="demo-deadline-result" role="status"></div></form>`,button("close-modal","닫기")+'<button type="submit" class="btn btn-primary" form="demo-deadline-form">수신 체험</button>');
        let messageId=null;
        $("#demo-deadline-form").onsubmit=event=>{
          event.preventDefault();const text=$("#demo-deadline-text").value,at=$("#demo-deadline-sent").value+':00+09:00';
          const entries=[...window.DingdongDeadlines.extract(text,at,state.data),...window.DingdongDeadlines.extractStartEvents(text,at,state.data)];
          if(!entries.length){$("#demo-deadline-result").textContent="인식한 마감 일정이 없습니다. 예: 내일까지 제출, 다음 주 수요일 오후 3시까지 회신";return;}
          if(!messageId){messageId=uid("user-incoming");state.data.mails.unshift({id:messageId,from:state.data.people[0].id,to:["me"],title:"마감 안내 체험",body:text,createdAt:new Date(at).getTime(),date:window.DingdongDeadlines.sentDate(at),time:at.slice(11,16),folder:"inbox",files:[],receipts:["unread"],unread:true});}
          save();const added=[...state.data.deadlines,...state.data.events].filter(d=>d.source?.id===messageId);
          $("#demo-deadline-result").textContent=added.map(d=>d.start?`${d.date} ${d.start}–${d.end}`:`${d.date} ${d.dueTime} 마감`).join(" / ")+" · 다시 눌러도 중복 등록되지 않습니다.";
          if(added[0]){state.today=added[0].date;state.week=weekStart(added[0].date);}render();
        };
        break;
      }
      case "edit-deadline": {
        const item=state.data.deadlines.find(d=>d.id===target.dataset.deadline);
        if(item)eventForm({...item,type:"deadline"});
        break;
      }
      case "toggle-deadline": {
        const item = state.data.deadlines.find((d1) => d1.id === d.deadline);
        item.done = !item.done;
        save();
        closeModal();
        renderPage();
        break;
      }
      case "settings":
        settingsModal();
        break;
      case "font-minus":
      case "font-plus": {
        const key = d.setting,
          limits = key === "mailFont" ? [12, 24] : [12, 22];
        state.settings[key] = Math.max(
          limits[0],
          Math.min(
            limits[1],
            state.settings[key] + (action === "font-plus" ? 1 : -1),
          ),
        );
        $("#setting-" + key).textContent = state.settings[key] + "px";
        applySettings();
        save();
        break;
      }
      case "password-info":
        if(native){changePasswordModal();return;}
        toast(
          "체험 화면에는 비밀번호가 없어요",
          "실제 인증 서버를 연결한 뒤 제공할 기능입니다.",
        );
        break;
      case "notification-center":
        openModal(
          "학교의 새로운 소식",
          `<p class="muted" style="font-size:12px;margin-bottom:15px">현재 ${unreadMails()}개의 안 읽은 메시지와 ${unreadChats()}개의 새 대화가 있어요.</p>${
            state.data.mails
              .filter((m) => m.unread && m.folder === "inbox")
              .map(
                (m) =>
                  `<button class="mail-row" data-action="notification-mail" data-mail="${m.id}"><span class="chip ${m.important ? "orange" : ""}">${m.important ? "중요 안내" : "새 메시지"}</span><strong style="display:block;margin-top:10px">${esc(mailSubject(m))}</strong><small class="muted">${esc(person(m.from).name)} · ${m.time}</small></button>`,
              )
              .join("") ||
            empty(
              "모두 확인했어요",
              "새로운 소식이 오면 여기에 모아둘게요.",
              "bell",
            )
          }`,
          button("notification-test", "알림 테스트", "bell") +
            button("close-modal", "닫기"),
        );
        break;
      case "notification-mail":
      case "announcement-open":
        closeModal();
        state.page = "inbox";
        state.folder = "inbox";
        state.mail = d.mail;
        const mail = state.data.mails.find((m) => m.id === d.mail);
        if (mail) {mail.unread = false;state.folder=mail.folder;}
        save();
        render();
        break;
      case "notification-test":
        [
          [
            "message",
            "새 메시지가 도착했어요",
            "홍길동 선생님 · 회의 자료 확인 부탁드려요.",
          ],
          [
            "readreceipt",
            "메시지 수신 확인",
            "교사A님이 예시 메시지를 수신했습니다.",
          ],
        ].forEach(([type, title, body], i) =>
          setTimeout(() => toast(title, body, type), i * 130),
        );
        break;
      case "add-shortcut":
        openModal(
          "바로가기 추가",
          `<form id="shortcut-form" class="event-form"><label>이름<input id="shortcut-title" class="input" maxlength="60" required></label><label>웹 주소<input id="shortcut-url" type="url" class="input" placeholder="https://" required></label><label>설명<input id="shortcut-desc" class="input" maxlength="120"></label><div id="shortcut-error" class="form-error" role="alert"></div></form>`,
          button("close-modal", "취소") +
            '<button class="btn btn-primary" type="submit" form="shortcut-form">추가하기</button>',
        );
        break;
    }
  });
  document.addEventListener("submit", async (e) => {
    if (e.target.id === "login-form") {
      e.preventDefault();
      const name = $("#login-name").value.trim();
      if (!name) {
        $("#login-error").textContent = "이름을 입력해 주세요.";
        return;
      }
      if(native){
        const submit=$("#login-form button[type=submit]");const label=submit.textContent;submit.disabled=true;submit.textContent="로그인 준비 중…";$("#login-error").textContent="";
        try{const user=await network.login(name,$("#login-password").value,$("#remember-login").checked);if(user.mustChange)changePasswordModal(true);}
        catch(error){const message=$("#login-error");if(message)message.textContent=error.message;}
        finally{if(submit.isConnected){submit.disabled=false;submit.textContent=label;}}
        return;
      }
      state.user = name;
      state.settings.autoLogin = $("#remember-login").checked;
      state.page = "people";
      save();
      render();
    } else if (e.target.matches("[data-chat-form]")) {
      e.preventDefault();
      const rid = e.target.dataset.chatForm,
        input = $("textarea", e.target),
        text = input.value.trim(),
        room = state.data.rooms.find((r) => r.id === rid);
      if (!text || !room) return;
      const sentAt=Date.now();
      room.messages.push({
        id: uid("user-message"),
        sender: "me",
        text,
        createdAt: sentAt,
        date: window.DingdongDeadlines.sentDate(sentAt),
        time: new Date(sentAt).toLocaleTimeString("en-GB",{timeZone:"Asia/Seoul",hour:"2-digit",minute:"2-digit"}),
        likes: 0,
        liked: false,
        reply: state.reply?.room === rid ? state.reply.text : "",
      });
      room.unread = 0;
      state.reply = null;
      if (!(await save())) return;
      input.value = "";
      input.style.height = "43px";
      $("button[type=submit]", e.target).disabled = true;
      $$(".reply-preview").forEach((el) => (el.hidden = true));
      updateChat(rid);
      $$(`[data-message-room="${rid}"]`).forEach(
        (el) => (el.scrollTop = el.scrollHeight),
      );
      if (state.page === "chat") {
        $$(".room").forEach((el) => {
          const r = state.data.rooms.find((r) => r.id === el.dataset.room);
          if (r)
            $(".room-info p", el).textContent = r.messages.at(-1)?.text || "";
        });
      }
    } else if (e.target.id === "shortcut-form") {
      e.preventDefault();
      const url = $("#shortcut-url").value.trim(),
        title = $("#shortcut-title").value.trim();
      if (!title) return;
      try {
        const parsed = new URL(url);
        if (!["https:", "http:"].includes(parsed.protocol))
          throw new Error("protocol");
      } catch {
        $("#shortcut-error").textContent =
          "http:// 또는 https:// 웹 주소를 입력해 주세요.";
        return;
      }
      if (!state.data.shortcuts)
        state.data.shortcuts = [
          {
            id: "s0",
            title: "나이스 대국민서비스",
            desc: "교육 행정 관련 서비스",
            url: "https://www.neis.go.kr",
            icon: "school",
          },
          {
            id: "s1",
            title: "에듀넷 · 티클리어",
            desc: "수업과 연구를 위한 교육 자료",
            url: "https://www.edunet.net",
            icon: "file",
          },
          {
            id: "s2",
            title: "학교알리미",
            desc: "학교의 주요 정보를 살펴보세요",
            url: "https://www.schoolinfo.go.kr",
            icon: "users",
          },
        ];
      state.data.shortcuts.push({
        id: uid("user-shortcut"),
        title,
        desc: $("#shortcut-desc").value,
        url,
        icon: "link",
      });
      save();
      closeModal();
      renderPage();
    }
  });
  document.addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "people-search") {
      state.search = el.value;
      $("#org-tree").innerHTML = orgTree();
    } else if (el.id === "room-search") {
      $$(".room").forEach(
        (row) =>
          (row.hidden = !state.data.rooms
            .find((r) => r.id === row.dataset.room)
            .name.includes(el.value)),
      );
    } else if (el.matches("[data-chat-input]")) {
      const form = el.closest("form");
      $("button[type=submit]", form).disabled = !el.value.trim();
      el.style.height = "auto";
      el.style.height = Math.min(100, el.scrollHeight) + "px";
    } else if (el.matches("[data-chat-search]")) {
      state.chatQuery = el.value;
      updateChat(el.dataset.chatSearch);
      const first = $(`[data-message-room="${el.dataset.chatSearch}"] mark`);
      first?.scrollIntoView({ block: "center" });
    } else if (el.id === "mail-search") {
      state.mailSearch = el.value;
      if(!filteredMails().some(m=>m.id===state.mail))state.mail=null;
      refreshMail();
    } else if (el.id === "new-chat-search") {
      $$("[data-new-chat-person]").forEach(
        (row) =>
          (row.hidden = !person(row.dataset.newChatPerson).name.includes(
            el.value,
          )),
      );
    }
  });
  document.addEventListener("change", (e) => {
    const el = e.target;
    if(el.matches('[data-show-completed-deadlines]')){
      state.settings.showCompletedDeadlines=el.checked;save();renderPage();
    }else if(el.id==='mail-folder-select'){
      state.folder=el.value;state.mail=null;state.mailSearch='';renderPage();
    }else if(el.id==='mail-search-by'){
      state.mailSearchBy=el.value;state.mail=null;refreshMail();
    } else if (el.matches("[data-person-check]")) {
      el.checked
        ? state.selected.add(el.dataset.personCheck)
        : state.selected.delete(el.dataset.personCheck);
      refreshSelection();
    } else if (el.id === "select-all") {
      state.selected = new Set(
        el.checked ? state.data.people.map((p) => p.id) : [],
      );
      $("#org-tree").innerHTML = orgTree();
      refreshSelection();
    } else if (el.matches("[data-dept-select]")) {
      state.data.people
        .filter((p) => groupLabel(p) === el.dataset.deptSelect && matchesPersonSearch(p))
        .forEach((p) =>
          el.checked ? state.selected.add(p.id) : state.selected.delete(p.id),
        );
      $("#org-tree").innerHTML = orgTree();
      refreshSelection();
    } else if (el.matches("[data-deadline]")) {
      const item = state.data.deadlines.find((d) => d.id === el.dataset.deadline);
      if (item) {item.done = el.checked;save();renderPage();}
    }
  });
  document.addEventListener("keydown", (e) => {
    if (
      e.target.matches("[data-chat-input]") &&
      e.key === "Enter" &&
      !e.shiftKey &&
      !e.isComposing
    ) {
      e.preventDefault();
      e.target.closest("form").requestSubmit();
    }
    if (e.key === "Escape") {
      if(timelineResizeTarget){cancelTimelineSelection?.();setTimelineResizeTarget(null);e.preventDefault();return;}
      if ($("#context-root").firstChild) $("#context-root").innerHTML = "";
      else if ($("#modal-root").firstChild) closeModal();
      else if (state.floating) {
        state.floating = null;
        renderFloating();
      }
    }
    if (
      e.target.matches(".mail-row[role=button]") &&
      (e.key === "Enter" || e.key === " ")
    ) {
      e.preventDefault();
      e.target.click();
    }
    const modal = $(".modal");
    if (modal && e.key === "Tab") {
      const focusables = $$(
        'button:not(:disabled),input:not([hidden]),textarea,select,[contenteditable=true],[tabindex="0"]',
        modal,
      ).filter((el) => el.offsetParent !== null);
      const first = focusables[0],
        last = focusables.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  });
  document.addEventListener("dblclick", e=>{const person=e.target.closest('.org-tree .person-line');if(person)composeMail({to:selectedMessageRecipients(person.dataset.person)});});
  windowApi?.subscribe(event=>{
    if(event.kind==='homeroom-memo')openHomeroomMemo(event.target.id,event.target.date).catch(error=>toast('메모를 열지 못했어요',error.message));
    if(event.kind==='memo-schedule'&&!$('#modal-root').firstChild&&(!native||network?.active))memoScheduleForm(event.draft);
    if(event.kind==='briefing-target')revealBriefingTarget(event.target).catch(error=>toast('관련 내용을 열지 못했어요',error.message));
    if(event.kind==='memo-panel'&&windowApi.mainHost){state.showMemo=event.open;syncMemoPanel();}
    if(event.kind==='minimal-main'&&windowApi.mainHost){state.minimal=event.open;document.body.classList.toggle('minimal-main',event.open);}
    if(event.kind==='today-panel'){
      state.showToday=event.open;
      if(windowApi.mainHost){
        document.body.dataset.hostSide=event.side;memoBoard?.position();
        document.body.classList.toggle('today-expanded',event.open);
        updateBriefingShape?.();
        const drawer=$(".today-drawer");
        if(drawer){drawer.classList.toggle('left',event.side==='left');drawer.classList.toggle('right',event.side==='right');drawer.classList.toggle('open',event.open);drawer.inert=!event.open;drawer.setAttribute('aria-hidden',String(!event.open));}
      }
      $$('.rail [data-action="toggle-today"]').forEach(el=>el.setAttribute('aria-pressed',String(event.open)));
    }
  });
  document.addEventListener("contextmenu", (e) => {
    if(e.target.closest("#mail-editor")){e.preventDefault();captureEditorLink(e);menu(e.clientX,e.clientY,[{action:"editor-link",label:"링크 삽입",icon:"link"}]);return;}
    const block=e.target.closest('[data-calendar-timeline] .event');
    if(block){
      e.preventDefault();
      if(timelineSaving||$('#modal-root').firstChild)return;
      cancelTimelineSelection?.();
      const item=state.data.events.find(event=>event.id===block.dataset.event);
      $('#context-root').innerHTML='';
      setTimelineResizeTarget(item&&canMoveEvent(item)?item.id:null);
      return;
    }
    setTimelineResizeTarget(null);
    const p = e.target.closest(".person[data-person]"),
      r = e.target.closest(".room"),
      hours = e.target.closest("[data-day-hours]");
    if (p) {
      e.preventDefault();
      menu(e.clientX, e.clientY, [
        {
          action: "person-mail",
          label: "메시지 보내기",
          icon: "mail",
          extra: `data-person="${p.dataset.person}"`,
        },
        {
          action: "person-chat",
          label: "대화",
          icon: "chat",
          extra: `data-person="${p.dataset.person}"`,
        },
      ]);
    } else if (r) {
      e.preventDefault();
      const room = state.data.rooms.find((room) => room.id === r.dataset.room);
      menu(e.clientX, e.clientY, [
        {
          action: "pin-room",
          label: room.pinned ? "상단 고정 해제" : "상단에 고정",
          icon: "star",
          extra: `data-room="${room.id}"`,
        },
        {
          action: "mute-room",
          label: room.muted ? "알림 켜기" : "알림 끄기",
          icon: "mute",
          extra: `data-room="${room.id}"`,
        },
        {
          action: "leave-room",
          label: "대화방 나가기",
          icon: "logout",
          danger: true,
          extra: `data-room="${room.id}"`,
        },
      ]);
    } else if (hours && !e.target.closest(".event")) {
      e.preventDefault();
      eventForm({ date: hours.dataset.dayHours });
    }
  });
  let cancelTimelineSelection = null;
  const formatTimelineTime = value => `${String(Math.floor(value/60)).padStart(2,"0")}:${String(value%60).padStart(2,"0")}`;
  let timelineSaving=false,suppressTimelineClickUntil=0;
  document.addEventListener('pointerdown',event=>{
    if(event.button===0)suppressTimelineClickUntil=0;
    if(timelineResizeTarget&&!event.target.closest('[data-calendar-timeline] .resize-target'))setTimelineResizeTarget(null);
  },true);
  document.addEventListener('click',event=>{if(performance.now()<suppressTimelineClickUntil&&event.target.closest('[data-calendar-timeline]')){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('pointerdown',event=>{
    const block=event.target.closest('[data-calendar-timeline] .event,[data-calendar-timeline] .timeline-point');
    if(!block||event.button!==0||!event.isPrimary||timelineSaving||$('#modal-root').firstChild)return;
    const point=block.classList.contains('timeline-point'),list=point?state.data.deadlines:state.data.events;
    const item=list.find(e=>e.id===(point?block.dataset.deadline:block.dataset.event));if(!item||!point&&!canMoveEvent(item))return;
    cancelTimelineSelection?.();
    const original={...item},origin=block.closest('[data-calendar-timeline]'),pointer=event.pointerId,initialX=event.clientX,initialY=event.clientY;
    const mode=point?'point':event.target.closest('[data-resize]')?.dataset.resize||'move';
    const start=minutes(point?item.dueTime:item.start),end=point?start:minutes(item.end),duration=end-start;
    const base=Number(origin.dataset.timelineStart||480),limit=Number(origin.dataset.timelineEnd||1080),scale=origin.getBoundingClientRect().height/(limit-base);
    let moved=false,targetGrid=origin,proposal;const css=block.style.cssText,band=document.createElement('div');band.className='timeline-selection';band.setAttribute('aria-live','polite');
    const paint=e=>{
      moved ||= Math.abs(e.clientY-initialY)>=4||Math.abs(e.clientX-initialX)>=4;if(!moved)return;
      const delta=Math.round((e.clientY-initialY)/scale/15)*15;
      if(mode==='move'||point){const grids=Array.from(origin.parentElement.closest('.calendar-grid')?.querySelectorAll('[data-calendar-timeline]')||[origin]);targetGrid=grids.find(grid=>{const r=grid.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;})||origin;}
      const lo=Number(targetGrid.dataset.timelineStart||480),hi=Number(targetGrid.dataset.timelineEnd||1080);let nextStart=start,nextEnd=end;
      if(point)nextStart=Math.max(lo,Math.min(Math.min(1425,hi-15),start+delta));
      else if(mode==='start')nextStart=Math.max(lo,Math.min(end-15,start+delta));
      else if(mode==='end')nextEnd=Math.max(start+15,Math.min(hi,end+delta));
      else{nextStart=Math.max(lo,Math.min(hi-duration,start+delta));nextEnd=nextStart+duration;}
      proposal={date:targetGrid.dataset.calendarTimeline,...(point?{dueTime:formatTimelineTime(nextStart),rule:'explicit'}:{start:formatTimelineTime(nextStart),end:formatTimelineTime(nextEnd)})};
      const targetScale=targetGrid.getBoundingClientRect().height/(hi-lo);targetGrid.append(band);band.style.top=((nextStart-lo)*targetScale)+'px';band.style.height=(point?28:Math.max(15,(nextEnd-nextStart)*targetScale))+'px';band.textContent=point?proposal.dueTime:proposal.start+'–'+proposal.end;block.style.opacity='.3';
    };
    const cleanup=()=>{band.remove();block.style.cssText=css;block.removeEventListener('pointermove',move);block.removeEventListener('pointerup',finish);block.removeEventListener('pointercancel',cancel);block.removeEventListener('lostpointercapture',cancel);document.removeEventListener('keydown',escape);window.removeEventListener('blur',cancel);if(block.hasPointerCapture(pointer))block.releasePointerCapture(pointer);if(cancelTimelineSelection===cancel)cancelTimelineSelection=null;if(moved)suppressTimelineClickUntil=performance.now()+400;};
    const cancel=()=>cleanup(),escape=e=>{if(e.key==='Escape')cancel();},move=e=>{if(e.pointerId===pointer)paint(e);};
    const finish=async e=>{
      if(e.pointerId!==pointer)return;paint(e);const valid=moved&&block.isConnected&&proposal;cleanup();if(!valid)return;
      const current=(point?state.data.deadlines:state.data.events).find(e=>e.id===item.id);if(!current||current.date!==original.date||(point?current.dueTime!==original.dueTime:current.start!==original.start||current.end!==original.end)){render();return;}
      const fields=point?['date','dueTime']:['date','start','end'];if(fields.every(key=>current[key]===proposal[key]))return;
      if(current.duty&&state.data.events.some(other=>other.id!==current.id&&other.duty?.kind===current.duty.kind&&other.date===proposal.date)){render();toast('이미 같은 업무 일정이 있는 날짜입니다.');return;}
      timelineSaving=true;const oldData=JSON.parse(JSON.stringify(state.data));Object.assign(current,proposal);render();const stored=await save();timelineSaving=false;
      if(!stored){if(!native)state.data=oldData;render();return;}state.today=proposal.date;render();Notify.create({id:'calendar-time-saved',title:'일정 시간을 변경했어요',bodyHtml:esc(current.duty?'배정 교사·업무 담당자의 캘린더에도 반영됩니다.':current.source||current.targets?.length?'연결된 발신자·수신자·참조자의 일정에도 반영됩니다.':'변경한 시간을 저장했습니다.'),type:'calendar timeline-feedback',duration:1800});
    };
    block.setPointerCapture(pointer);cancelTimelineSelection=cancel;block.addEventListener('pointermove',move);block.addEventListener('pointerup',finish);block.addEventListener('pointercancel',cancel);block.addEventListener('lostpointercapture',cancel);document.addEventListener('keydown',escape);window.addEventListener('blur',cancel);event.preventDefault();
  });
  document.addEventListener("pointerdown", e => {
    const grid=e.target.closest("[data-calendar-timeline]");
    if(!grid || e.button!==0 || !e.isPrimary || e.target.closest("button,input,a,.event-note") || $("#modal-root").firstChild) return;
    cancelTimelineSelection?.();
    const pointer=e.pointerId, initialY=e.clientY,base=Number(grid.dataset.timelineStart||480),limit=Number(grid.dataset.timelineEnd||1080),span=limit-base;
    const timeAt=y=>{const rect=grid.getBoundingClientRect();return Math.max(base,Math.min(limit,base+Math.round((y-rect.top)/rect.height*span/15)*15));};
    const anchor=timeAt(e.clientY);let moved=false,range;
    const band=document.createElement("div");band.className="timeline-selection";band.setAttribute("aria-live","polite");grid.append(band);
    const paint=y=>{
      const edge=timeAt(y);let start=Math.min(anchor,edge),end=Math.max(anchor,edge);
      if(start===end){start=Math.min(start,limit-15);end=start+15;}
      range={start,end};band.style.top=((start-base)/span*100)+"%";band.style.height=((end-start)/span*100)+"%";
      band.textContent=formatTimelineTime(start)+"–"+formatTimelineTime(end);
    };
    const cleanup=()=>{
      band.remove();grid.classList.remove("selecting-time");
      grid.removeEventListener("pointermove",move);grid.removeEventListener("pointerup",finish);
      grid.removeEventListener("pointercancel",cancel);grid.removeEventListener("lostpointercapture",cancel);
      document.removeEventListener("keydown",escape);window.removeEventListener("blur",cancel);
      if(grid.hasPointerCapture(pointer))grid.releasePointerCapture(pointer);
      if(cancelTimelineSelection===cancel)cancelTimelineSelection=null;
    };
    const cancel=()=>cleanup();
    const escape=event=>{if(event.key==="Escape")cancel();};
    const move=event=>{if(event.pointerId!==pointer)return;moved ||= Math.abs(event.clientY-initialY)>=4;paint(event.clientY);};
    const finish=event=>{
      if(event.pointerId!==pointer)return;paint(event.clientY);const valid=moved&&grid.isConnected,date=grid.dataset.calendarTimeline;
      cleanup();if(valid)eventForm({date,start:formatTimelineTime(range.start),end:formatTimelineTime(range.end),type:"personal"});
    };
    paint(e.clientY);grid.classList.add("selecting-time");grid.setPointerCapture(pointer);cancelTimelineSelection=cancel;
    grid.addEventListener("pointermove",move);grid.addEventListener("pointerup",finish);
    grid.addEventListener("pointercancel",cancel);grid.addEventListener("lostpointercapture",cancel);
    document.addEventListener("keydown",escape);window.addEventListener("blur",cancel);e.preventDefault();
  });
  document.addEventListener("dblclick", (e) => {
    const hours = e.target.closest("[data-day-hours]");
    if (hours && !e.target.closest(".event,.event-note")) {
      const y = Math.max(
        0,
        Math.min(hours.getBoundingClientRect().height-30, e.clientY - hours.getBoundingClientRect().top),
      );
      const start = Number(hours.dataset.timelineStart||480) + Math.floor(y / 30) * 30;
      eventForm({
        date: hours.dataset.dayHours,
        start:
          String(Math.floor(start / 60)).padStart(2, "0") +
          ":" +
          String(start % 60).padStart(2, "0"),
        end:
          String(Math.floor((start + 30) / 60)).padStart(2, "0") +
          ":" +
          String((start + 30) % 60).padStart(2, "0"),
      });
    }
  });
  window.addEventListener('dingdong-sticky-change',()=>{refreshScheduleMemoIcons();refreshHomeroom();});
  window.addEventListener('storage',event=>{if(event.key===scheduleMemoStore?.key){refreshScheduleMemoIcons();refreshHomeroom();}});
  if(!native)window.addEventListener("storage",event=>{
    if(event.key!=="dingdong-v1"||!event.newValue)return;
    try{const saved=JSON.parse(event.newValue);if(!saved.data)return;
      const oldMails=state.data.mails;state.data=saved.data;Object.assign(state.settings,saved.settings);showReceiptNotifications(DingdongMailReceipts.changes(oldMails,state.data.mails),state.user||'demo');refreshDutyDetail();refreshExchangeDialog();workUI.refreshDetail();notifyExchangeUpdates();
      if($("#homeroom-feed")){refreshHomeroom();return;}
      if($("#modal-root").firstChild){demoRefreshPending=true;return;}
      demoRefreshPending=false;
      const drafts=$$("[data-chat-input]").map(el=>[el.dataset.chatInput,el.value]);
      const restoreWorkSearch=workUI.preserveSearchForm();
      render({persist:false});restoreWorkSearch();drafts.forEach(([id,value])=>{const el=$(`[data-chat-input="${id}"]`);if(el)el.value=value;});
    }catch{}
  });
  let homeroomDaySeen=koreanToday();
  setInterval(()=>{const today=koreanToday();if(today===homeroomDaySeen)return;const previous=homeroomDaySeen;homeroomDaySeen=today;if(homeroomCardDate===previous)homeroomCardDate=today;if(homeroomModalDate===previous)homeroomModalDate=today;refreshHomeroom();},30000);
  DingdongDuties.normalizeTitles(state.data.events);
  if(!native&&!Array.isArray(state.data.classTeachers))state.data.classTeachers=JSON.parse(JSON.stringify(Mock.classTeachers));
  const workSelf=()=>state.profile?.id||state.data.people.find(p=>p.name===state.user)?.id||'me';
  const workUI=DingdongWorkToolsUI.create({
    state:()=>state,self:workSelf,native,windowApi,esc,button,icon,person,toast,
    today:koreanToday,openModal,closeModal,render,renderPage,compose:composeMail,
    navigate(page){if(windowApi){windowApi.openWorkspace(page);return;}state.page=page;render();$('#work-search-query')?.focus();},
    async openItem(kind,id,room){
      closeModal();
      if(windowApi){const target={kind,id,...(room?{room}:{})};const result=kind==='message'?await windowApi.openChat(room,target):await windowApi.openWorkspace(kind==='mail'?'inbox':'calendar',target);if(result?.error)toast('항목을 열지 못했습니다',result.error);}
      else await revealBriefingTarget({kind,id,room});
    },
    async respond(id,actor,done,note){
      if(native){
        await network.queue;
        const result=await native.request('/sync',{operations:[{type:'mail.work.respond',id,value:{done,note}}]});
        if(result.error)throw new Error(result.error);
        await network.refresh();
        const response=state.data.mails.find(m=>m.id===id)?.workResponses?.[actor];
        if(response?.sendError)throw new Error('응답은 PC에 저장했지만 전달에 실패했습니다. '+response.sendError.message+' 응답 창에서 다시 저장해 주세요.');
        return {queued:response?.pendingDelivery};
      }
      // Merge the latest demo snapshot before changing one recipient's response.
      try{const saved=JSON.parse(localStorage.getItem('dingdong-v1')||'null');if(saved?.data)state.data=saved.data;}catch{}
      const mail=state.data.mails.find(m=>m.id===id),row=mail&&DingdongWorkTools.summary(mail).rows.find(r=>r.id===actor);
      if(!row?.active||mail.folder==='trash')throw new Error('요청이 회수되었거나 처리할 수 없는 상태입니다.');
      const before=JSON.parse(JSON.stringify(mail));
      mail.workResponses={...mail.workResponses,[actor]:{done,note:note.trim().slice(0,500),updatedAt:Date.now()}};
      if(!await save()){Object.assign(mail,before);throw new Error('저장하지 못했습니다. 저장 공간을 확인해 주세요.');}
    },
    async seedDemo(){
      const others=state.data.people.filter(p=>p.id!==workSelf()).slice(0,3).map(p=>p.id);
      if(!others.length){toast('체험 요청을 추가할 수 없습니다','교직원 정보가 필요합니다.');return;}
      const date=koreanToday(),due=addDays(date,3),now=Date.now();
      const common={unread:false,important:false,date,time:'09:00',createdAt:now,scheduled:'',cc:[],files:[]};
      const sent={...common,id:'user-work-demo-sent',folder:'sent',from:'me',to:others,receipts:others.map((_,i)=>i?'unread':'read'),title:'[체험] 평가계획 제출 요청',body:'평가계획을 작성한 뒤 이 메시지에 답장으로 보내 주세요. 제출하신 후 완료 버튼으로 알려 주세요.',workRequest:{kind:'submission',dueDate:due,targets:others},workResponses:{[others[0]]:{done:true,note:'평가계획을 답장으로 보냈습니다.',updatedAt:now}},files:[{name:'평가계획_제출양식.xlsx',size:'24 KB',demo:true}]};
      const received={...common,id:'user-work-demo-received',folder:'inbox',from:others[0],to:[workSelf()],receipts:['read'],title:'[체험] 연수 참석 여부 회신 요청',body:'연수 참석 여부를 답장으로 알려 주시고 회신 완료를 표시해 주세요.',workRequest:{kind:'reply',dueDate:due,targets:[workSelf()]},workResponses:{}};
      let added=0;for(const mail of [sent,received])if(!state.data.mails.some(m=>m.id===mail.id)){state.data.mails.unshift(mail);added++;}
      if(await save())toast(added?'체험 요청을 추가했습니다':'체험 요청이 이미 있습니다','보낸 요청과 받은 요청에서 각각 확인할 수 있습니다.');
    }
  });
  if(native){
    network=new DingdongBackend(native,{
      data:acceptServerData,
      loginWarning(message){toast("자동 로그인 안내",message);},
      loginRetryEnded(){const message=$("#login-error");if(message)message.textContent="아이디와 비밀번호로 다시 로그인해 주세요.";},
      status(value){connectionStatus=value;const el=$("#connection-status span");if(el)el.textContent=value;$("#connection-status")?.classList.toggle("offline",["연결 끊김","재연결 중","연결 확인 필요"].includes(value));},
      error(message){toast("서버에 저장하지 못했어요",message,"security");},
      expired(){state.user=null;state.profile=null;state.data=JSON.parse(JSON.stringify(Mock));state.floating=null;workUI.clearSearch();closeModal();render();}
    });
    const transferUpdates=new Map();
    native.subscribe(event=>{if(event.kind!=='file-transfer')return;if(event.ready){network.scheduleRefresh();return;}const id='file-transfer-'+event.direction+'-'+event.id,now=Date.now();if(event.done!==event.total&&now-(transferUpdates.get(id)||0)<500)return;transferUpdates.set(id,now);const percent=event.total?Math.round(event.done/event.total*100):100,body=`${esc(event.name||'첨부 파일')} · ${percent}%<br><progress max="100" value="${percent}" aria-label="파일 전송 진행률"></progress>`;if(document.getElementById(id))Notify.update(id,body);else Notify.create({id,title:event.direction==='upload'?'첨부 파일 보내는 중':'첨부 파일 받는 중',bodyHtml:body,persistent:true});if(event.done===event.total){setTimeout(()=>Notify.remove(id),1500);transferUpdates.delete(id);}});
    render();network.init().then(result=>{if(!result&&!network.user&&!$("#login-name")?.value)login();});
  }else {if(desktopDemo)state.user=state.user||"교사A";save();render();}
})();


