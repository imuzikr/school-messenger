/* 모든 이름·학교·대화는 예시입니다. 서버와 연결되지 않습니다. */
(function () {
  const koreanParts=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());
  const part=key=>Number(koreanParts.find(p=>p.type===key).value);
  const today = new Date(part("year"),part("month")-1,part("day"),12);
  const key = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const date = (offset = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return key(d);
  };
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDate = (n) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + n);
    return key(d);
  };
  const departments = [
    "교무기획부",
    "교육연구부",
    "학생생활부",
    "1학년부",
    "행정실",
  ];
  const people = Array.from({ length: 25 }, (_, i) => ({
    id: "p" + i,
    name:
      ["홍길동", "김철수", "이영희", "교사A", "교사B"][i % 5] +
      (i < 5 ? "" : ` ${Math.floor(i / 5) + 1}`),
    department: departments[Math.floor(i / 5)],
    role: i >= 20 ? "행정직원" : i % 5 === 0 ? "부장" : "교사",
    subject: ["국어", "수학", "영어", "과학", "행정"][i % 5],
    grade: i % 5 === 4 ? "" : `${i % 3 + 1}학년`,
    otherGroup: i % 5 === 4 ? "업무지원" : i % 2 ? "학교행사" : "교내연수",
    extension: 201 + i,
    status: ["online", "away", "busy", "offline"][i % 4],
  }));
  const texts = [
    "오늘 회의 자료 공유드립니다. 편하실 때 확인해 주세요.",
    "네, 확인했습니다. 감사합니다!",
    "자료는 메시지에도 첨부해 두었습니다.",
    "이번 주 협의회는 도서관에서 진행해요.",
    "일정에 등록해 두겠습니다.",
    "함께 준비하니 훨씬 든든하네요.",
    "혹시 추가 의견 있으시면 말씀해 주세요.",
    "좋습니다. 오후에 뵙겠습니다.",
    "안내문 최종본 확인 부탁드려요.",
    "수고하셨습니다. 좋은 하루 보내세요!",
    "행사 준비 체크리스트도 공유해 주세요.",
    "네, 방금 정리해서 보냈습니다.",
  ];
  const rooms = [
    "교무기획부",
    "1학년 선생님들",
    "홍길동",
    "교육연구부",
    "행사 준비 모임",
    "행정실 문의",
  ].map((name, i) => ({
    id: "r" + i,
    name,
    members:
      i === 2
        ? ["p0"]
        : people.filter((p, j) => j % (i + 2) === 0).map((p) => p.id),
    pinned: i === 0,
    muted: i === 4,
    unread: i === 0 ? 3 : i === 1 ? 2 : 0,
    notice: "이번 주 교과협의회 · 15:00, 도서관",
    messages: Array.from({ length: 12 }, (_, j) => ({
      id: `r${i}m${j}`,
      sender: j % 3 === 1 ? "me" : people[(i + j) % 25].id,
      text: texts[(i + j) % 12],
      date: date(j < 4 ? -1 : 0),
      time: `${j < 4 ? "16" : "09"}:${String(10 + j * 3).padStart(2, "0")}`,
      likes: j === 2 ? 2 : 0,
      liked: false,
      reply: j === 5 ? texts[(i + 3) % 12] : "",
    })),
  }));
  const titles = [
    "이번 주 교과협의회 안내",
    "학부모 상담 주간 준비 안내",
    "학교 행사 운영 계획 공유",
    "출장 보고서 제출 요청",
    "도서관 이용 안내",
    "교직원 연수 자료 공유",
    "가정통신문 검토 부탁드립니다",
    "안전 점검 체크리스트",
    "교육과정 협의 자료",
    "업무 인수인계 안내",
    "학생 상담 자료 정리",
    "다음 주 회의 안건 모집",
    "행정 서류 제출 안내",
    "교내 행사 사진 공유",
    "학교 소식지 원고 요청",
  ];
  const mails = Array.from({ length: 20 }, (_, i) => ({
    id: "mail" + i,
    folder: i < 15 ? "inbox" : "sent",
    from: people[i % 25].id,
    to: ["p0", "p1", "p2"],
    title: titles[i % 15],
    body: `선생님, 안녕하세요.\n\n${titles[i % 15]} 관련하여 안내드립니다.\n\n이번 주에 진행할 내용을 정리하여 공유합니다. 첨부 자료를 확인하시고, 추가 의견이나 변경이 필요한 부분은 편하게 말씀해 주세요.\n\n• 장소: 도서관 세미나실\n• 준비물: 개인 노트북 및 협의 자료\n• 문의: 교무기획부 (내선 201)\n\n함께 만들어 가는 학교를 위해 늘 애써 주셔서 감사합니다.\n좋은 하루 보내세요.`,
    date: date(-Math.floor(i / 3)),
    time: "09:" + String(10 + i).padStart(2, "0"),
    unread: i < 4,
    important: i === 0 || i === 3 || i === 7,
    files:
      i % 3 === 0
        ? [{ name: "협의회_안내자료.pdf", size: "248 KB", demo: true }]
        : [],
    receipts: ["read", "unread", i === 17 ? "recalled" : "read"],
  }));
  const events = Array.from({ length: 10 }, (_, i) => ({
    id: "event" + i,
    title: [
      "교과협의회",
      "개인 상담",
      "교육연구 회의",
      "자료 정리",
      "정기 업무 점검",
      "행사 준비",
      "학부모 상담",
      "출장",
      "교직원 연수",
      "부서 협의",
    ][i],
    date: i === 0 || i === 1 ? date() : weekDate(i % 5),
    start: i < 2 ? "09:00" : `${String(9 + (i % 6)).padStart(2, "0")}:00`,
    end: i < 2 ? "10:00" : `${String(10 + (i % 6)).padStart(2, "0")}:00`,
    type: ["group", "personal", "repeat"][i % 3],
    place: i % 2 ? "교무실" : "도서관",
    note:
      i === 0
        ? "협의 자료를 미리 확인해 주세요."
        : i === 1
          ? "상담 기록 준비"
          : "",
  }));
  window.Mock = {
    classTeachers:Array.from({length:36},(_,i)=>({className:`${Math.floor(i/12)+1}학년 ${i%12+1}반`,teacher:people[i%people.length].id})),
    defaultPeriods: Array.from({length:7},(_,i)=>({period:i+1,start:String(8+i).padStart(2,'0')+':00',end:String(8+i).padStart(2,'0')+':50'})),
    bellSchedules: [],
    deadlineDefaultPeriodsChanged: false,
    today: key(today),
    people,
    departments,
    rooms,
    mails,
    events,
    academic: [
      { date: date(), title: "학부모 상담 주간" },
      { date: weekDate(2), title: "교내 탐구대회" },
      { date: weekDate(4), title: "교직원 연수" },
    ],
    deadlines: [
      { id: "d0", title: "출장 보고서 제출", date: date(-1), done: false },
      { id: "d1", title: "행사 운영 계획서", date: date(), done: false },
      { id: "d2", title: "연수 신청서 제출", date: date(2), done: false },
    ],
    notes: [
      {
        id: "n0",
        date: date(),
        time: "11:00",
        text: "학부모 상담 자료 챙기기",
      },
      { id: "n1", date: weekDate(2), time: "14:00", text: "협의 결과 정리" },
    ],
    tasks: [],
  };
})();
