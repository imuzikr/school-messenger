# 검증 기록 · 0.2.25

2026-10-11 한국 시간. Linux 관리형 작업 환경에서 수행했습니다.

- 작업 시작 브랜치 `recovery/app-asar-0.2.7-20261010`, 기준 커밋 `3276a8bb2d7b899fdf5f8a882cd766f98c637deb`, 미커밋 변경 없음. 구현 브랜치 `feature/offline-message-deadlines`.
- 복구 브랜치 RECOVERY.md를 먼저 읽었습니다. 저장소 루트의 기존 설치/분할 파일과 README·설치 스크립트·SHA256SUMS, 기존 RECOVERY.md와 recovery-notes 전체를 기준 브랜치와 바이트 비교하여 동일함을 확인했습니다.
- Node.js 24에서 새 의존성 설치 성공, package-lock.json 추가. `npm test`: 정규식/날짜/데모 중복 테스트 19개와 실제 HTTPS/SQLite 통합 테스트 1개, 총 20개 통과.
- 정규식 검증: 한국 자정 경계, 내일·모레·다음 주(월요일 시작), 월 일·연도 지정, 윤년/연말, 12시간제·24시간제, 명시 시간 우선, 기본 12:05/16:00, 대상 날짜 임시 일과표 우선, 잘못된 날짜/시간/발송시각, 여러 문장, 삭제 후 중복 방지.
- HTTPS 통합: 발신자(관리자)/수신자 별도 계정, 서버가 기록한 발송 시각, 대화·쪽지 자동 등록, 발신자와 수신자 각각 등록, 수신자 쪽지의 일정 링크, 시작 시간 없음, 반복/동시 재시도, 삭제 후 재전송, 일과표 변경, 잘못된 배치의 전체 롤백, 예약 발송 전 미등록·전달 후 등록, 서버 재시작 후 중복 없음, 타인 일정 삭제 거부.
- 기존 server-smoke 검사도 통과: health/login/bootstrap/sync/logout와 SQLite 재시작 보존.
- Chromium/Playwright: 먼저 둘러보기 → 내 캘린더 → 메시지 일정 체험 → 한국 발송시각/본문 입력 → 12:05 마감 확인. 같은 수신 체험 재실행 및 페이지 새로고침에도 등록 수 유지. 화면에 날짜·마감 표시. 페이지 오류 없음.
- Electron 44.7.0 Linux/Playwright: 자동 데모 진입, preload bridge, IPC로 독립 캘린더 창 생성, 메시지 일정 체험 등록, 메인 창 유지. 조직도 반·담임 버튼 없음, 설정에서 반·담임 진입 유지, 반·담임/일정 체험 모달의 X 아이콘 클릭 후 닫힘 확인. 클라우드 컨테이너에서는 OS sandbox를 비활성화하여 실행했으며 배포 설정은 변경하지 않았습니다.
- Windows x64 데모: 공식 Electron 44.7.0 Windows 런타임의 SHA-256을 공식 SHASUMS256.txt와 비교 검증했습니다. ZIP CRC 검사, Windows PE32+ x64 실행 파일, demo 역할, 모든 포함 JS/CSS/desktop/server/data/assets 파일이 최종 소스와 바이트 단위로 동일함을 확인했습니다. ZIP 해시는 release/SHA256SUMS.txt에 있습니다.
- 실제 Windows 실행·설치·서명/SmartScreen 검증과 실제 학교 PC 사이의 연결 검증은 이 Linux 환경에서 수행하지 않았습니다. 제공물은 설치 프로그램이 아닌 무설치 ZIP 데모입니다. 실제 교내 서버/클라이언트 배포에는 서버 의존성이 포함된 별도 배포 빌드가 필요합니다.

## 재검증

이 폴더에서 `npm install && npm test`. UI 검사에는 별도 Playwright 설치, Chromium과 (Electron 검사의 경우) Electron 44.7.0 및 DISPLAY가 필요합니다. 정적 HTTP 서버를 127.0.0.1:8000에 시작하고 `node tests/browser-deadlines.cjs`를 실행합니다. Electron 검사는 `DINGDONG_ROLE=demo node tests/electron-deadlines.cjs`로 실행합니다. 브라우저 검사의 Chromium 실행 경로는 `/usr/bin/chromium`입니다.

0.2.11 조직도 추가 검증: Chromium 430×830 화면에서 이름·부서·내선 한 줄 표시, 기존 프로필 제거, 세 상태 아이콘/접근성 이름, 행 높이 30px, 사용자 체크박스 선택, 페이지 오류 없음 확인. release/directory-0.2.11.png에 화면을 저장했습니다.


0.2.11 추가 검증: `tests/desktop-navigation.cjs`를 Linux Electron에서 실행했습니다. 여섯 메뉴 순서, 교무업무 선택/일과표 폼 진입, 조직도의 직접 업무/하단 선택 버튼 제거, 이름 단일클릭 시 작성창 미개방/더블클릭 시 수신자 지정 쪽지 작성창 개방, 우클릭 대화창 개방, 오늘 일정 패널의 좌우 위치와 닫힘, 본창 getBounds의 위치·크기 불변 확인. 기존 정규식/HTTPS 통합 20개 테스트도 통과했습니다. 좁은 패널을 숨기던 기존 반응형 CSS를 패널 창에서 재정의했습니다.

0.2.12 추가 검증: 교무업무의 보강 안내·수업 변경 선택 후 독립 작성창이 열리고 본창의 선택 모달이 사라짐을 확인했습니다. 일과표 선택도 기존 선택창을 대체합니다. 캘린더 창의 부모 관계를 제거하고 showInactive 및 본창 moveTop으로 본창 뒤에서 슬라이딩하도록 수정했습니다. 좌우 패널의 위치와 본창 위치·크기 유지, 부모 창 없음/항상 위 옵션 꺼짐을 Linux Electron에서 검사했습니다. 본창 너비 430px와 760px에서 조직도와 shell의 오른쪽 끝이 창 끝과 일치함을 확인했습니다. tests/desktop-navigation.cjs 및 tests/electron-deadlines.cjs 통과. 실제 Windows에서 창 겹침과 애니메이션은 별도 실행 확인이 필요합니다.

0.2.13 추가 검증: 390px/430px Chromium 화면에서 분류 버튼이 조직도 제목 오른쪽에 같은 줄로 배치되고 창 밖으로 넘치지 않음을 확인했습니다. 부서/교과/학년/기타 전환과 선택 상태, 학교 이름 옆 전체/접속 인원 표시, 세 상태 이미지의 로컬 로드(3:1 PNG) 확인. 접속은 초록 원·체크, 부재는 주황 마름모·시계, 미접속은 회색 사각형·가로선으로 색과 모양 모두 구분합니다. 이미지 생성 후 assets/presence-status.png에 포함해 실행 중 외부 요청 없이 사용합니다. release/directory-0.2.13.png 화면 확인. 기존 Electron 화면/캘린더/모달 동작 회귀 검사 통과. 실제 Windows 실행은 미검증입니다.

0.2.14: 상태 이미지를 머리와 어깨가 있는 사람 실루엣으로 교체했습니다. 초록 사람+체크(접속), 주황 사람+시계(부재), 회색 사람+가로선(미접속). 390px/430px 화면에서 로컬 이미지 로드, 세 상태 접근성 이름, 분류 전환 및 기존 제목/인원 배치를 확인했습니다. release/directory-0.2.14.png 시각 확인 및 Electron 데모 검사 통과. 이미지가 배포물에 포함되므로 표시를 위한 외부 통신은 없습니다.

0.2.15: 일반 쪽지 본문 작성 중 인식된 마감 날짜/시간과 발신자·수신자 자동 등록 안내를 표시합니다. 기존 수동 옵션을 직접 일정 추가로 명확히 구분했습니다. 데모 쪽지·대화에 실제 발송 타임스탬프와 한국 날짜/시간을 기록하도록 보완했습니다. tests/electron-message-send.cjs는 조직도 이름 더블클릭→쪽지 작성→체크박스 미선택 발송→이미 열린 캘린더 자동 반영, 우클릭 대화→실제 본문 발송→15:00 마감 추출, 시작/종료 시간 없음, 한국 발송일 기준 내일, 재조회 중복 없음을 확인합니다. npm test 20개(발신자/수신자 서버 등록 포함) 및 기존 메뉴 회귀 검사 통과. 실제 Windows 실행은 미검증입니다.

0.2.16: 오늘 일정 패널의 220ms 고정 보간을 감쇠 이동으로 바꿨습니다. 현재 위치와 속도를 유지해 열기/닫기 도중 방향을 바꿀 때 숨김 위치로 재설정하지 않습니다. 프레임마다 창 순서를 변경하지 않고 실제 픽셀이 바뀔 때 패널 위치만 이동합니다. 브라우저 패널도 440ms 감속 곡선으로 조정했습니다. Linux Electron에서 좌우 최종 위치, 본창 위치/크기 불변, 부모 관계 없음, 닫는 중 80ms 후 다시 열 때 위치 점프 없음 및 최종 펼침 위치 검사 통과. 실제 Windows에서 체감 부드러움은 미검증입니다.

0.2.17: 자동 추출한 기한 항목을 오늘 일정 패널의 제출 마감에서 내 일정으로 이동했습니다. 시작 시간 없는 기한은 카드로, 회의/연수 등 명시된 시간 범위는 시간대 블록으로 표시합니다. 내일 1시에서 3시까지 교직원 연수는 13:00–15:00 일정으로 등록합니다. 오전/오후 표시가 없고 시 표기인 1–7시는 학교 오후 시간으로 해석하며 08:00 같은 24시간제는 그대로 사용합니다. 시간 범위가 없는 행사 문장은 자동 추출하지 않습니다. 기존 자동 기한 중 원본 메시지가 남아 있고 연수 시간 범위인 항목만 일정으로 재분류하며 삭제 기록을 유지합니다. 데모와 서버 양쪽에 회의 일정 추출/중복 방지 적용. npm test 22개 및 실제 쪽지/대화→내 일정 카드/연수 13–15시 블록 화면 검사 통과. release/calendar-0.2.17.png 시각 확인. 캘린더는 고정된 투명 창 내부에서 Chromium transform으로 슬라이딩하며 OS 창을 매 프레임 이동하지 않습니다. 좌우 위치/본창 불변, 실제 중간 transform과 반전 연속성 검사 통과. 실제 Windows의 최종 체감은 미검증입니다.

0.2.18: 발송 저장 완료 후 서버 bootstrap을 곧바로 반영한 뒤 발송 완료를 반환합니다. 수신 변경 알림의 120ms 지연/반복 연장을 없앴습니다. 데모 창에서 모달이 열린 동안 받은 변경사항은 모달 닫기 직후 렌더링하고, 실제 자동 갱신과 충돌하던 새로고침 안내를 제거했습니다. 재실행 없는 쪽지/대화 등록, 이미 열린 캘린더/모달 닫은 뒤 신규 회의 반영을 Electron에서 검증했습니다. backend-refresh 테스트는 발송 완료 반환 시 서버 추출 일정이 UI 데이터에 이미 반영되었음을 확인합니다. npm test 23개 통과. 내일 일정은 내일 날짜에서 확인합니다. 실제 Windows 실행은 미검증입니다.

0.2.19: 자동 추출한 단일 시각을 상단 카드 대신 일간/주간 타임라인의 해당 시각에 표시합니다. 시작/종료 시간이 없는 항목에 기간을 임의로 추가하지 않고 점·선과 시각 라벨로 표시합니다. 시간 범위가 있는 연수는 기존 시간대 블록을 유지합니다. 기본 08–18시 범위를 벗어나는 항목이 있으면 시간축 범위를 자동 확장하며 시간대 드래그/더블클릭의 기준도 해당 범위에 맞춥니다. 한국 현재 시각으로 현재 시간 선을 표시합니다. Electron 실제 대화 발송 후 오늘 10시까지 모여주세요의 표시 위치가 10:00 좌표와 일치함을 확인했습니다. 06:30/20:15 등록 시 06–21시 확장 및 주간 캘린더의 15:00 위치/상단 마감 행 제외 검사 통과. 재실행 없는 반영과 중복 방지 유지. release/calendar-0.2.19.png 시각 확인. 실제 Windows 실행은 미검증입니다.

0.2.20: 날짜·시각과 모임/회의 요청이 있는 단일 시작 메시지를 기본 1시간 개인 일정으로 등록합니다. 제목·본문 반복 중복 제거, 오전/오후·24시간제, 한국 발송일, 날짜 없는 시각, 자정 넘김 60분 분할, 기존 메시지 재조회 및 삭제 기록 유지 검증. npm test 26개 통과. 실제 HTTPS 쪽지 발송 시 발신자/수신자 18:00–19:00 등록과 서버 재시작 후 중복/삭제 방지를 확인했습니다. Electron 쪽지 작성 미리보기·발송·이미 열린 캘린더와 오늘 일정 패널의 1시간 블록 확인. 실제 Windows 실행은 미검증입니다.

0.2.21: 오전·오후 없는 1–7시 마감도 오후로 통일했습니다. 일곱 시각별 마감·일정, 오전/24시간제 우선, 7시 반 19:30 검증. npm test 27개 통과. 실제 Windows 실행은 미검증입니다.

0.2.22: npm test 28개 통과. 실제 HTTPS/SQLite에서 발신자·수신자·별도 참조자 계정에 일정 등록, 참조자가 시간 변경 시 세 계정 반영, 한 메시지의 두 일정 중 선택한 항목만 변경, 비참여자의 변경 거부, 역순 시간 및 잘못된 배치 전체 롤백, 삭제된 수신자 사본 미복구, 직접 공유 일정 참여자의 시간 조절, 마감 시각 공유 변경과 연결 메타데이터 보존, 재시작 후 수정 시간/삭제 보존 검증. backend diff는 수신자의 공통 일정과 마감 이동을 각각 허용된 reschedule 작업으로 전달하는지 확인했습니다.

Linux Electron 실제 마우스 검사 tests/electron-calendar-edit.cjs: 일간/주간 블록 이동, 양 가장자리 조절, 15분 스냅, 주간 날짜 간 이동, 마감 시각 이동, Escape 취소, 이동 후 불필요한 상세창 미개방, 일반 클릭 상세창 개방, 재조회 보존 및 다른 열린 창 반영 확인. 기존 실제 쪽지·대화 자동 등록 화면 검사도 통과. 실제 Windows 실행 및 여러 학교 PC 간 실물 검증은 미수행입니다.

연속 편집 시 완료 알림이 마우스를 가리지 않도록 알림을 통과시켰으며, 15분 일정 블록도 실제 14px 시간축 높이를 유지합니다. 일과표에 따른 보강 시간 갱신과 선택적인 마감 시각 제거는 기존 작업 경로를 유지하는 회귀 검사를 추가했습니다.

0.2.23: 화면 문구·접근성 이름·알림·설정·서버 오류의 쪽지를 메시지로 통일했습니다. 기존 저장 데이터와 동작 식별자는 유지합니다. Electron 실제 메시지함 검사: 왼쪽 사이드바 제거, 메시지함/이름·내용 선택/돋보기 입력창 순서, 받은 메시지 발신자 이름 검색과 보낸 메시지 수신자 이름 검색, 제목/본문 내용 검색과 이름 검색 분리, 중요·안 읽음·휴지통 전환, 중요/읽음 처리 후 선택 메뉴 건수, 1100px/430px/390px에서 같은 줄 배치 및 넘침 없음, 상세창·답장 동작, 페이지 오류 없음. release/message-toolbar-0.2.23.png 화면 확인. npm test 28개와 기존 메뉴·실제 발송 검사 통과. 실제 Windows 실행은 미검증입니다.

## 0.2.24 · 일정 요약 / 관련 메시지

- 기존 미커밋 변경이 없는 상태에서 RECOVERY.md를 먼저 확인하고 복구 하위 폴더만 수정했습니다.
- npm test 총 30개 통과. 수정된 캘린더 시간이 요약에 우선하고, 마감/모임/연수 축약·장소/준비 추출·다른 일정의 장소 혼입 방지 검증. 기존 중복 방지와 발신자/수신자/참조자 변경 전파 회귀 통과.
- HTTPS/SQLite: 원본 대화 조회, 비참여자 403, 없는 원본 404, 501개 후속 대화로 bootstrap에서 제외된 오래된 원본 조회 성공.
- Electron 화면 검사: 모달 하단 책장 펼치기/접기, 고정된 상단 위치, 요약과 원문 분리, 원본 메시지/대화·첨부파일 표시, 일정으로 돌아가기, 원본 접근 불가 안내, 키보드와 동작 줄이기 설정.
- Windows 10/11 x64 ZIP은 공식 Electron 런타임 해시 및 배포 ZIP CRC·소스 일치로 검증합니다. 실제 Windows 실행 확인은 이 Linux 환경에서 하지 못했습니다.

## 0.2.25 · 일정 요약 버튼과 노트북 커버 효과

- 기존 파일과 미커밋 변경을 확인했습니다. 기존 미커밋 변경 없음. 작업은 복구 하위 폴더에 한정하고 기존 배포본을 보존했습니다.
- Electron 화면 검사에서 펼침/접힘 버튼 문구 ‘일정 요약’ 및 동일 너비·높이 확인, 중간 프레임의 3D 회전과 900px 원근감 확인, 회전 중 방향 전환의 위치 연속성 확인. 상세창 상단 위치 유지·원본 메시지/대화·마감 요약·키보드·동작 줄이기·330px 작은 창 회귀 통과.
- 변경된 JS 구문 검사와 git diff --check 통과. Windows ZIP은 런타임 체크섬·CRC·소스 바이트 일치 및 공개 다운로드 검증을 수행합니다. Windows 직접 실행은 미검증입니다.

## 0.2.26 · 단일 네이티브 창과 오늘 일정

- 작업 시작 시 미커밋 변경 없음. 기존 소스·복구 기록·배포 파일을 확인하고 복구 하위 폴더만 변경했습니다.
- npm test 30개 통과. 자동 등록·한국 시간·중복 방지·연결 일정 변경·원문 조회 회귀 통과.
- Electron 내비게이션: 오늘 일정 열기 전후 창 수 증가 없음, todayPanel 독립 창 없음, 조직도 화면 좌표·너비·높이 유지, 좌우 배치와 연속 슬라이딩 반전, 다른 네이티브 창 활성화 후 복귀, 함께 이동·최소화·복원·숨김, 닫힌 예약 공간의 네이티브 shape 제외 확인. 오른쪽 위치 설정으로 앱 재시작 후 조직도 위치·430px 너비·캘린더 닫힘 상태 확인.
- Electron 일정 조작: 오늘/주간 드래그, 상하 시간 조절, 15분 단위, 날짜 이동, 마감 이동, Escape 취소, 저장/여러 창 갱신, 단일 창 일정 상세와 요약 확인.
- 실제 메시지 작성·대화 발송 → 일정 즉시 등록 → 열린 오늘 일정 갱신 → 시간축 표시 → 재조회 중복 방지 회귀 통과.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 단일 ZIP 공개 다운로드 검증을 수행합니다. 직접 Windows 실행은 미검증입니다.

## 0.2.27 · 요약 커버와 모달 동시 이동

- 기존 변경 및 복구 기록 확인 후 복구 하위 폴더만 수정했습니다. 원본 파일과 이전 배포본은 보존합니다.
- Electron 일정 상세 검사: 펼침 직후 위치 연속성, 펼침 중 위로 이동, 완전히 펼친 위치, 접힘 후 원래 중앙 위치 복귀, 커버 반전, 고정 버튼 크기, 원본 메시지/대화, 수정 시간 요약, 동작 줄이기·키보드·330px 작은 창 화면 제한 확인.
- npm test 30개 및 일정 드래그/공유 변경 화면 회귀 검사 통과. Windows ZIP 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. Windows 직접 실행은 미검증입니다.

## 0.2.28 · 메시지함 최소 너비

- 작업 전 변경 없음. 복구 기록 및 원본 배포 파일 보존. 메시지함 작업 창에만 최소 너비 1000px 적용.
- Electron 메시지함: 실제 네이티브 최소 너비 확인, 700px 축소 요청 후 1000px 이상 유지, 선택 전/후 목록과 본문 동시 표시, 최소 너비에서 목록 350px 이상·본문 400px 이상 및 가로 넘침 없음, 검색·폴더·읽음·중요·답장 회귀 검사 통과.
- Windows 배포 ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행은 미검증입니다.

## 0.2.29 · 일반 일정 시간 제한

- 미커밋 변경 없는 상태와 복구 기록 확인. 기존 복구·배포 파일 보존.
- Electron: 23:00–23:15 및 06:30–07:30 입력의 브라우저 검증과 실제 저장 확인. 역순 시간은 안내 후 저장하지 않음.
- npm test 30개 통과. HTTPS/SQLite event.upsert의 이른 아침·밤 일정 저장, 역순·24시 시작·잘못된 분 입력 거부 및 저장된 기존 시각 보존 확인. 기존 공유 일정/중복 방지/일과표 회귀 통과.
- Windows ZIP 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.30 · 기본 단체 일정과 내용 발송

- 기존 변경 없음 및 복구 기록 확인. 복구 하위 폴더만 수정.
- Electron: 종류 선택 제거, 날짜/장소 같은 행, 수신자 기본 표시, 제목 없이 내용만 작성하고 두 수신자 선택해 저장하면 단체 일정과 내용·장소 메시지 한 건 생성 확인. 이른 아침·밤 시간 및 역순 오류 검사 통과. 일정 상세의 기존 마감 편집/요약 회귀 확인.
- npm test 30개 통과. HTTPS/SQLite 직접 공유 일정 발송 시 발신자·두 수신자의 원문/일정 연결 확인, 재발송 중복 없음, 자동 추출에 의한 이중 일정 없음.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. Windows 직접 실행 미검증.

## 0.2.31 · 내 일정 등록과 강조

- 작업 전 변경 없음·복구 기록 확인. 기존 파일 및 체크리스트 데이터 보존.
- Electron: 오늘 일정의 내 일정 버튼 → 개인 등록창, 수신자 영역 숨김과 비활성화, 저장 후 개인 종류·빈 수신자·메시지 건수 변화 없음, 주간/오늘 시간축 즉시 반영, 노란색과 개인 배지 표시, 수정 후 개인 상태·미발송 유지 확인. 기존 단체 등록·내용 발송 회귀 통과.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행은 미검증.

## 0.2.32 · 달력 전환·할 일·실행 브리핑

- 변경 없는 작업 상태·복구 기록 확인. 원본 복구 및 배포 파일 보존. 데모 날짜는 한국 날짜로 생성합니다.
- Electron: 시작 브리핑 표시와 날짜/섹션, 새로고침 후 반복 없음, 실제 앱 종료 후 다시 실행 시 저장된 할 일이 포함된 새 브리핑 확인.
- 같은 캘린더 창에서 주간→월간→다음 달→주간 전환, 모달 생성 없음·네이티브 창 수 유지·창 좌표/너비/높이 동일 확인. 나의 할 일 추가·완료·미완료와 재시작 보존 확인.
- 기존 개인/단체 일정 등록 및 시간 검사, npm test 30개 회귀 통과. Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.33 · 받은 메시지 마감 표시

- 기존 변경 없음·복구 기록 확인 후 복구 하위 폴더만 수정.
- npm test 31개: 제출·마감은 날짜/시각입니다·알려주세요·보내주세요, 한국 발송 날짜, 날짜만 16:00, 1~7시 오후, 부정 요청 제외 및 기존 서버 중복 방지 검증.
- Electron 실제 수신 예시 메시지의 보내주세요 마감이 제출 목록과 14:00 시간축에 같은 ID로 표시됨, 목록 체크 후 시간축 완료 반영, 재조회 후 한 건·완료 상태 유지 확인.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.34 · 메시지함 글자 크기

- 변경 없는 작업 상태·복구 기록 확인. 기존 파일과 사용자 본문 글자 설정 보존.
- Electron: 실제 렌더링 글자 크기(제목 17·미리보기 15·발신자/날짜 14·검색 14·기본 본문 17px), 1000/1100px 검색 메뉴 배치와 목록/본문 동시 표시·가로 넘침 없음, 검색·폴더·읽음·중요·답장 회귀 확인.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.35 · 완료 표시 선택

- 기존 변경 없음·복구 기록 확인 후 복구 하위 폴더만 수정.
- Electron 수신 마감: 기본 완료 표시, 옵션 끔→목록에서 숨김, 다시 켬→완료 상태 유지하며 재표시, 재조회 중복 없음, 실제 종료/재실행 후 숨김 설정 유지 및 다시 표시 확인. 시간축 완료 상태 보존.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.36 · 마감 내용 클릭과 주간 22:00

- 작업 시작 시 미커밋 변경 없음. 복구 하위 폴더 외 파일 및 RECOVERY.md·recovery-notes 변경 없음.
- Electron 수신 마감: 완료 체크는 메시지 창을 열지 않음, 완료/미완료 상태에서 내용 클릭 시 정확한 원본 메시지 표시 및 체크 상태 유지, 연결 없는 수동 마감 안내 확인. 완료 표시 설정·실제 종료 후 복원·재조회 중복 없음 확인.
- 주간 달력 시간축 종료 1320분(22:00), 마지막 시간 칸 21:00~22:00 및 종료 눈금 표시 확인.
- Electron 기존 오늘/주간 드래그·상하 시간 조절·날짜 이동·마감 이동·취소·저장·다중 창 갱신·일정 상세 열기 테스트 통과. JS 구문 검사 통과.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.37 · 일과표 제목·날짜별 적용

- 작업 시작 시 미커밋 변경 없음. 복구 하위 폴더 외 파일 및 RECOVERY.md·recovery-notes 변경 없음.
- Node 테스트 32개 통과: 기존 서버·정규표현식·요약 회귀와 일과표 제목/전체 발송, 트랜잭션 실패 시 원복, 재시도 중복 없음, 관리자 권한, 기존 SQLite 일과표 데이터 유지하며 제목 컬럼 추가, 서버 재시작 후 제목·기간별 시간 보존 확인.
- 서버 보강 일정: 수정 날짜 4교시 종료 12:20, 다음 날 기본 12:00 적용 확인.
- Electron: 설정 기본 시간 저장 시 메시지 없음, 교무업무 제목 입력과 날짜별 저장·전체 수신자 메시지 생성, 기본값 유지, 날짜 변경과 앱 전체 종료/재시작 후 다음 날 기본 시간 및 수정 날짜 제목·시간 재표시 확인.
- JS/CJS 구문 검사와 변경 공백 검사 통과. Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.38 · 메시지 한 행 목록

- 작업 시작 시 미커밋 변경 없음. 복구 하위 폴더 외 파일 및 RECOVERY.md·recovery-notes 변경 없음.
- Electron 실제 화면: 4열 순서, 본문 앞부분/줄바꿈 정리, 제목 중복 줄 제거, 행 높이 55px 미만 및 모든 열의 같은 행 배치 확인.
- 3개 구분선 모두 드래그, 헤더/본문 열 위치·너비 일치, 키보드 좌우 조절, 최소 너비 보장 및 너비 합 100%, 새로고침과 실제 앱 종료/재실행 후 조절한 너비 복원 확인.
- 이름/내용 검색, 보낸 메시지 수신자 검색, 폴더별 필터·집계, 중요 표시·읽음·답장, 기존 본문 기본 크기 17px 유지, 목록 제목 17px·미리보기 15px·발신자/날짜 14px 유지 확인.
- 창 너비 1000/1100px 검색 배치, 1000px 최소 너비와 목록/본문 동시 표시, 콘솔 오류 없음 확인. JS 구문·변경 공백 검사 통과. Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.39 · 제목 크기와 선택 표시

- 작업 시작 시 미커밋 변경 없음. 복구 하위 폴더 외 파일 및 RECOVERY.md·recovery-notes 변경 없음.
- Electron 실제 글자 크기: 제목·본문 미리보기·발신자·날짜 모두 15px 확인, 제목 볼드 확인. 본문 크기 설정 유지.
- 세 구분선을 각각 마우스로 드래그한 뒤 활성 포커스/포커스 테두리가 남지 않음 확인. 키보드 조절·최소 열 너비·저장·새로고침·전체 앱 재시작 후 복원 회귀 통과.
- 기존 검색·폴더/집계·중요 표시·읽음·답장, 1000px 최소 창 너비와 목록/본문 동시 표시 확인. 콘솔 오류 없음, JS 구문 및 변경 공백 검사 통과.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.40 · 본문 공간 확보

- 작업 시작 시 미커밋 변경 없음. 복구 하위 폴더 외 파일 및 RECOVERY.md·recovery-notes 변경 없음.
- Electron 실제 화면에서 제목이 상단에 위치, 일반 메시지 헤더 높이 100px 이하, 본문 높이 300px 이상 확인. 16명 수신자 목록 펼침/접힘·읽음 상태 표시·상세 영역 안의 위치와 상단 높이 유지 확인.
- 긴 제목은 두 줄(56px) 이하이며 전체 제목 툴팁 제공. 긴 제목 헤더 130px 이하, 본문 300px 이상·인쇄 버튼 표시 확인.
- 이름/내용 검색·폴더/집계·중요 표시·읽음·답장, 열 너비 조절·저장·실제 앱 재시작, 1000px 최소 창 너비와 목록/본문 동시 표시 회귀 통과. 본문 글자 설정 유지·콘솔 오류 없음, JS 구문 및 변경 공백 검사 통과.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증. 이전 소스와 배포 ZIP은 보관하고 압축 해제된 빌드 폴더/다운로드 검사용 임시 복사본만 정리했습니다.

## 0.2.41 · 다중 수신자와 추천 목록

- 작업 시작 시 미커밋 변경 없음. 복구 하위 폴더 외 파일 및 RECOVERY.md·recovery-notes 변경 없음.
- Electron에서 조직도 3명 체크 → 선택한 이름 더블클릭 → 받는 사람 3명 표시 → 실제 발송 후 수신자·읽음 상태 3명 저장 확인. 우클릭 메시지에서도 3명 유지, 체크하지 않은 이름은 단독 수신 확인.
- 받는 사람·참조 추천 선택 후 닫힘, 빈 입력칸 재포커스 시 재열림 없음, 이름 입력 후 추천 표시, 외부 클릭·Escape 닫힘, Enter 선택·수신자 중복 없음 확인.
- 기존 실제 메시지·대화 발송 및 열린 캘린더 자동 반영·한국 발송일·명시 시간·재조회 중복 방지 회귀 통과. JS 구문·변경 공백 검사 통과.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증. 이전 소스와 배포 ZIP은 보관합니다.

## 0.2.42 · 메시지 상세 일정 버튼 제거

- 작업 시작 시 미커밋 변경 없음. 복구 하위 폴더 외 파일 및 RECOVERY.md·recovery-notes 변경 없음.
- 메시지 상세의 연동된 일정/일정으로 등록 버튼 생성 구문 제거. 자동 등록·원본 연결 데이터 처리 유지.
- Electron 메시지함 화면 테스트 통과: 일정 버튼 없음, 답장 유지, 검색·폴더·읽음·열 너비 조절·저장·최소 너비·본문 및 수신자 정보 표시 회귀 통과. JS 구문·변경 공백 검사 통과.
- Windows ZIP 공식 런타임 체크섬·CRC·소스 일치 및 공개 다운로드 검증. 실제 Windows 실행 미검증. 이전 소스와 배포 ZIP 보관.

## 0.2.43 · 상단 작성 방식 버튼

- 작업 시작 시 미커밋 변경 없음. 원본 복구 기록·하위 폴더 외 기존 파일 유지.
- Electron 작성창: 상단 3개 버튼, 별도 수신자 목록/하단 체크박스/자동 등록 설명 제거 확인. 우클릭 메뉴 메시지 보내기 문구 및 3명 수신 유지 확인.
- 작성 방식 전환 시 제목·본문·수신자·선택 필드 유지. 지난 예약 시간·역전 시간 거절, 미래 예약 저장 및 발송 전 자동 추출 없음 확인.
- 직접 일정은 실제 입력한 날짜·20:00~21:00·교무실로 저장하고 받는 사람/참조자 대상과 메시지를 함께 연결. 원문에 일정 표현이 있어도 일정 하나만 생성, 다시 불러와도 하나 유지 확인.
- 기존 실제 메시지·대화 발송, 한국 날짜·명시 시간·캘린더 즉시 반영 및 중복 방지 회귀 통과. 서버/추출/공유 일정 테스트 32개 통과. JS 구문·변경 공백 검사 통과.
- Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증. 이전 소스와 배포 ZIP 보관.

## 0.2.44 · 본문 공간 확대와 첨부 버튼

- 작업 시작 시 미커밋 변경 없음. 원본 복구 기록·하위 폴더 외 기존 파일 유지.
- Electron 작성창 하단 취소/파일 첨부/보내기 순서 및 별도 큰 첨부 영역 제거 확인. 일반 작성창 본문 높이 350px 이상 확인. 긴 본문 100줄 입력 후 본문 내부 스크롤·하단 위치 유지 확인.
- 실제 파일 선택 버튼 → 파일 선택 창 → 첨부 파일 목록, 본문 드롭으로 두 번째 파일 추가 및 삭제 확인. 실제 발송 데이터에 첫 파일 이름·내용 유지 확인.
- 작성 방식 전환/입력 유지, 예약 시간 검증/예약 저장, 직접 공유 일정 및 TO/CC 연결·중복 방지 테스트 통과. 기존 일반 메시지·대화 발송 후 캘린더 자동 반영 회귀 통과.
- JS 구문·변경 공백 검사, Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증. 이전 소스와 배포 ZIP 보관.

## 0.2.45 · 미니멀 플로팅 바

- 작업 시작 시 미커밋 변경 없음. 원본 복구 기록·하위 폴더 외 기존 파일 유지.
- Electron 본창 상단 최소화/미니멀/닫기 순서, 동일한 네이티브 창 360×56 접힘·전체 창 영역 적용·접힌 동안 항상 위/크기 변경 불가 확인. 별도 패널 창 생성 없음.
- 바 클릭·Enter로 원래 위치·크기·최소/최대 크기 제한·크기 변경 가능 여부·항상 위 상태 복원 확인. 조직도 선택 유지 및 좌우 캘린더 열림 상태 복원 확인.
- 실제 별도 메시지함 창의 데이터 변경으로 새 메시지·대화 숫자 즉시 갱신, 자동 본체 확장 없음 확인. 새로고침 후 접힘 유지 및 이동된 바 위치에서 본체 복원 확인. 별도 작업 창의 미니멀 IPC 요청 거절 확인.
- 기존 Electron 조직도·설정 닫기·독립 캘린더·메시지 일정 체험 회귀 통과. 콘솔 오류 없음, JS/CJS 구문·변경 공백 검사 통과.
- Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증. 이전 소스와 배포 ZIP 보관.

## 0.2.46 · 조직도 복귀와 글자 서식

- 작업 시작 시 미커밋 변경 없음. 원본 복구 기록·하위 폴더 외 기존 파일 유지.
- Electron 대화 메뉴 → 조직도 메뉴 → 조직도 표시와 선택된 메뉴 상태 확인.
- 선택한 일부 글자에 빨강·노랑 형광펜·24px·볼드 적용, 미선택 글자 유지 확인. 형광펜 없음/재적용, 팔레트 Escape 닫힘 및 작성창 유지 확인.
- 쓰기 전에 파랑·분홍 형광펜·18px 선택 → 이후 입력 글자에 세 옵션 동시 적용, 서식 지우기로 기본 복원 확인.
- 실제 발송 후 저장 HTML, 읽기 화면의 실제 표시, 전달 작성창에서 색상·크기·형광펜·볼드 보존 및 본문 텍스트 유지 확인. 제한 밖 CSS·이벤트 속성·스크립트 제거 확인.
- 기존 작성 방식 전환·파일 첨부/드롭/삭제·본문 내부 스크롤·공유 일정·예약 저장 회귀 통과. 서버/추출/연동 테스트 32개 통과.
- JS 구문·변경 공백 검사, Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증. 이전 소스와 배포 ZIP 보관.

## 0.2.47 메시지 중요·파일 검색

- Electron 실제 화면에서 이름/내용/중요/파일 순서, 빈 검색어의 중요·첨부 필터, 중요 내 제목·본문 검색, 파일명 부분 검색 및 대소문자 무시 확인. 받은/보낸 메시지함 범위 유지 및 중요 해제 즉시 제외 확인.
- 실제 SVG 별의 노란색 채움 확인. 기존 열 너비 조절·저장, 목록/본문 동시 표시, 1000px 최소 너비 및 검색 도구 정렬, 상세 정보와 답장 회귀 통과.
- JS 구문·변경 공백 검사, Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증. 이전 소스와 배포 ZIP 보관.

## 0.2.48 알림 테스트 정리

- Electron 실제 설정 창 → 알림 테스트를 눌러 새 메시지·읽음 확인 두 알림만 표시되는 것을 확인했습니다. 불필요한 중요·일정·공용 PC·미구현 투표 예시를 제거하고 알림 닫기 동작을 확인했습니다.
- JS 구문·변경 공백 검사, 원본 복구 기록과 루트 배포 파일 보존 확인. Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.49 교시 기반 모임 일정

- 로컬 규칙: 5교시 → 기본 일과표 시간, 다음날 임시 일과표 우선, 임시 날짜 다음날 기본값 복귀, 3층 모둠교실 장소, 중복·삭제 보존 및 시간 미설정·복수 교시·취소 거부 확인.
- 실제 Electron 메시지 작성 → 발송 → 열린 캘린더 반영 → 시간 블록 표시 및 일정 상세 장소 확인. 기존 시각 안내/마감/대화 발송·열린 창 갱신·재조회 중복 방지 회귀 통과.
- 교내 HTTPS 서버 실제 송수신자 양쪽 등록, 중복 발송, 기존 메시지 재시작 보완 및 기존 일정/마감 연동 테스트 33개 통과.
- JS 구문·변경 공백, 원본 복구 기록과 기존 루트 배포 파일 보존 확인. Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.50 기본 일과표 일괄 입력

- 40/45/50분 수업, 고정 10분 쉬는 시간, 점심 앞뒤 겹침 방지, 3/5교시 뒤 점심, 미입력·역전·교시 수·시간 범위 오류 및 현재 입력값 보존을 검증했습니다.
- 실제 Electron 설정 창에서 입력 → 일괄 채움 → 교시별 수동 조정 → 저장 → 전체 재시작 후 유지 확인. 저장 전 기본값·메시지 수 유지, 기본 저장 시 발송 없음, 날짜별 임시 일과표 저장/제목/발송 및 다음날 기본값 회귀 통과.
- 실제 HTTPS 서버에서 생성한 기본 시간 저장·보강 갱신·임시 일과표 보존·발송 없음 확인. 규칙/서버/연동 테스트 36개 통과.
- JS 구문·변경 공백, 원본 복구 기록과 기존 루트 배포 파일 보존 확인. Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.51 만남 안내 일정 인식

- 사용자 예시 “오늘 7교시에 3층에서 뵙겠습니다.” 및 뵈어요/뵐게요/봅시다의 날짜별 교시 시간·층 장소 인식과 부정 표현 제외 확인. 한국 기준 발송 날짜, 기존 메시지 보완, 중복·삭제 보존 확인.
- 실제 Electron 메시지 작성·발송 → 열린 오늘 일정에 7교시 블록 표시 → 상세에서 3층 장소 확인. 기존 모임/마감/대화 발송·열린 창 갱신·중복 방지 회귀 통과.
- 실제 HTTPS 서버의 발신자·수신자 양쪽 등록 및 이전 미인식 메시지 재시작 보완 확인. 규칙/서버/연동 테스트 37개 통과.
- JS 구문·변경 공백, 원본 복구 기록과 기존 루트 배포 파일 보존 확인. Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.52 초대 문장·연한 상태 색상

- 모이겠습니다/모입니다/오세요/오십시오/와 주세요/와 주십시오의 교시·시각 인식, 시간 없는 초대·부정/취소·미설정 교시 제외 확인.
- 실제 HTTPS 서버 발신자/수신자 등록, 재발송 중복 방지, 기존 메시지 재시작 보완 포함 테스트 38개 통과. Electron 실제 오세요 메시지 작성·발송 → 오늘 일정 교시 블록 → 상세 장소 확인 및 기존 발송 흐름 회귀 통과.
- Electron 조직도에서 세 상태의 실제 CSS 색상·SVG 아이콘·접근성 상태 설명 확인 및 화면 시각 검토.
- JS 구문·변경 공백, 원본 복구 기록과 기존 루트 배포 파일 보존 확인. Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증.

## 0.2.53 상대 날짜를 제거한 자동 일정 제목

- 원문의 내일/오늘·시각·교시를 제거한 교직원 연수/계획서 제출/모임 제목 및 원본 제목·날짜·수정 시각·직접 입력 제목 보존 검증. 규칙/서버/연동 테스트 39개 통과.
- Electron 실제 메시지 발송 → 열린 캘린더의 간단한 제목과 현재 시간 표시, 실제 날짜를 붙인 제출 마감, 기존 일정 등록·대화 발송·열린 창 갱신·중복 방지 회귀 통과. 화면 시각 검토 완료.
- 일정 상세의 정리한 제목·현재 시간·원문 안내, 원본 메시지의 원문 보존과 첨부/복귀/요약/수정/키보드 동작 회귀 통과.
- JS 구문·변경 공백, 원본 복구 기록과 기존 루트 배포 파일 보존 확인. Windows 공식 런타임 체크섬·ZIP CRC·소스 일치·공개 다운로드 검증. 실제 Windows 실행 미검증.

### 0.2.54 검증
- Node 테스트: 역할별 교사/행정 직원/비활성 계정 구분, 서버 전체 대상 강제 적용 및 임의 참조 제외, 발신 부서 검증, 예약 공지와 공유 일정의 동시 발송, 회수와 중복 방지 포함.
- Electron: 25명 수신자 두 줄 접기/더 보기/접기, 일반↔공지 전환 시 작성 내용 보존, 교직원 25명·교사 20명 구분, 부서 태그 및 부서 발신, 예약/일정 옵션 동시 선택, 학교 소식 원문 보기와 재시작 보존 확인.
- 기존 작성 모드: 첨부/본문 스크롤/예약 검증/TO+CC 공유 일정/재시작 중복 방지 회귀 확인.
- 실제 Windows 실행은 미검증입니다.

### 0.2.55 검증
- Electron 메시지함: 불필요한 머리말/설명 제거, 남은 창 높이 사용, 38px 이하 행, 16px 제목과 같은 줄 발신자, 목록 첫 행/본문 시작선 일치 확인.
- 받는 사람/참조 구분, 참조 읽음 상태, 긴 제목 툴팁, 명단을 열어도 고정 헤더 유지 확인.
- 기존 중요/파일/이름/내용 필터, 열 너비 마우스·키보드 조절 및 보존, 최소 너비에서 목록/본문 표시 회귀 검증.
- Windows 실제 실행은 미검증입니다.

### 0.2.56 검증
- Electron: 상세 제목 없음, 보내는 사람/수신자/참조 순서, 16명 수신자 한 줄+더 보기/접기, 짧은 수신자에는 더 보기 없음 확인.
- 참조 20명이 항상 표시되고 줄바꿈 끝까지 헤더 안에 보임, 펼침/접기/참조 줄바꿈 시 목록과 본문 시작선 연동 확인.
- 원래 읽음 상태, 중요 별/검색, 메시지 목록 제목, 본문과 인쇄 버튼 유지 확인.
- 일반 내용 및 중요 메시지에 불필요한 태그 없음, 실제 자동 일정 및 마감에 일정 확인 표시, 삭제된 연결에 태그 없음, 공지는 부서 태그가 우선임을 확인.
- 실제 Windows 실행은 미검증입니다.

### 0.2.57 검증
- Electron 메시지함 검증 통과: 중요 필터/별 전환, 한 줄 수신자와 더 보기, 모든 참조 표시, 긴 명단에서도 양쪽 헤더 정렬, 기존 열 너비/검색/본문 동작 확인.
- 실제 캡처에서 큰 별과 옅은 수신 정보 구분선을 확인했습니다.
- 실제 Windows 실행은 미검증입니다.

### 0.2.58 검증
- Electron: 실제 클립보드 이미지 Ctrl+V, 캡처 패널 본문 삽입/PNG 첨부, 빈 클립보드/2 MB 초과 처리, 이미지 단독 발송, 폭에 맞춘 수신 본문, 재시작 보존 확인.
- 원격 이미지/SVG/이벤트 속성 제거, 기존 본문 색상/크기/형광펜과 전달 서식 회귀 확인.
- HTTPS 서버: 이전 HTML 제한을 넘는 이미지 저장/권한 확인 조회, 목록의 이미지 원본 제외, 합산 크기 초과 거부 확인.
- 설치형 클라이언트 로그인부터 서버 이미지 조회/렌더링/전달까지 검증합니다. Windows 캡처 도구 실제 실행은 미검증입니다.

### 0.2.59 검증
- Electron 시작 시 브리핑의 불투명 단색 배경, 배경 흐림 없음, 팝업과 본창 그림자 없음 확인.
- 오늘 일정 좌/우 방향에서 실제 패널을 열어도 브리핑 배경이 조직도 영역 안에 한정됨 확인.
- 닫은 뒤 조직도로 복귀, 다른 팝업의 기존 스타일 유지 확인. Windows 실제 실행은 미검증입니다.

### 0.2.60 검증 항목
- 카드 바깥 픽셀의 투명도, 좌우 캘린더에서 네이티브 표시 영역 일치, 브리핑 종료 후 본창 복원을 확인하는 Electron 검증을 추가했습니다.
- 일정/마감/할 일에서 원본 메시지로 이동, 기존 창 재사용과 검색 초기화, 키보드 선택, 원본 대화 강조, 수동 항목 조회 시 완료 상태 유지 검증을 추가했습니다.
- GitHub Actions에서 단위 테스트와 Electron 동작을 검증한 뒤 Windows 패키지를 빌드하고 동일한 브리핑 동작을 검증하도록 구성했습니다. 실행 결과는 워크플로에서 확인합니다.

0.2.61: 메신저 본창·작업 창·브리핑 테두리를 보강했습니다. 교무업무 바로 아래 기타 업무(생활 안전 지도/중식 지도/자율학습 지도), 관리자 업무별 담당자·안전 담당 부서 설정, 오프라인 .xlsx 첫 시트 검증과 미리보기 후 일정 등록을 추가했습니다. 담당자는 전체 날짜, 배정 교사는 해당 날짜만 수신합니다. 시간은 각각 07–08시, 12–13시, 18–22시입니다. 동일 업무/날짜 재업로드는 기존 배정을 갱신하고, 오류가 있는 배치는 전체 거부합니다. 이름·소속·날짜 검증, 권한과 비참여자 캘린더 격리, 배정 교체, 담당자 변경, 서버 재시작 후 보존을 실제 HTTPS/SQLite로 검증했습니다. npm test 46개 통과. Electron에서 실제 XLSX 날짜 셀/오류 파일/미리보기/등록/중복 방지/재로딩/오늘 일정 표시·상세 읽기 전용과 테두리를 확인했습니다. 기존 브리핑 투명 배경·관련 메시지 이동 검증도 통과했습니다. Windows 실행은 이 Linux 환경에서 직접 검증하지 못했습니다.

0.2.63: 설치형 오늘의 브리핑 제목 표시줄을 네이티브 드래그 영역으로 지정하고 닫기·본문 항목은 클릭 가능한 영역으로 유지했습니다. 기타 업무 메뉴는 지도 업무 3종만 표시하며, 업로드 창의 담당자 설정 바로가기도 제거해 설정 메뉴로 통일했습니다. Electron에서 드래그/클릭 영역, 창 위치 변경 후 브리핑 투명 배경과 영역 마스크 유지, 원본 메시지 이동, 설정 메뉴를 통한 담당자 등록 및 실제 엑셀 업로드 흐름을 검증했습니다.

0.2.64: 안전 지도/중식 지도/자율학습 태그와 일정 상세 편집 버튼을 추가했습니다. 관리자 또는 업무 담당자가 날짜별 교사를 선택해 저장하면 기존 배정을 제거하고 새 배정과 업무 담당자로 캘린더 수신 대상을 갱신합니다. 안전 지도의 소속 구분, 동시 수정 충돌 거부, 다른 날짜의 A/B 교사 교환, 잘못된 일괄 교환 전체 롤백, 담당자 일정 유지 및 서버 재시작 후 보존을 검증했습니다. Node 테스트 47개 및 Electron 실제 엑셀 등록 → 두 날짜의 편집·저장 → 캘린더 상세·재로딩 검증 통과. Windows 패키지에서도 동일 편집 흐름을 자동 검증한 뒤 배포합니다.

0.2.65: 캡처 버튼의 추가 안내 패널·삽입/첨부/닫기 버튼을 제거하고 운영체제 캡처 도구를 바로 엽니다. Ctrl+V 본문 삽입과 파일 첨부는 유지했습니다. 이미지 선택 시 본문 외부의 네 모서리 조절점을 표시해 원본 비율로 크기를 조절하며, 유효한 width 값만 저장/표시합니다. 드래그·키보드 조절·실행 취소/다시 실행·Escape 선택 해제·조절점 미발송·과대 크기 값 제거·발송/전달/재로딩/앱 재시작 후 표시 크기 보존을 Electron에서 검증했습니다. HTTPS 서버 이미지 전달도 width 보존을 확인했고 Node 테스트 47개 통과. Windows 패키지에서도 실제 클립보드 및 조절점 흐름을 검사한 뒤 배포합니다.

0.2.66: 소독·방역·청소·점검 안내의 시작/종료 시각을 일정으로 인식합니다. 금요일 16시에 전체 소독이 있습니다는 해당 금요일 16–17시(종료 시각 미기재 시 기본 1시간)로 등록됩니다. 요일/다음 주/범위 시각/취소·연기·자료 안내 제외, 기존 교시·시각·범위 일정의 추출 순번과 삭제 기록 유지, 데모 시작 및 서버 재시작 시 기존 메시지 재처리, 잘못된 소독 마감의 범위 일정 전환을 검증했습니다. Node 테스트 49개 통과. Electron에서 실제 발송 → 금요일 타임라인 → 원본 메시지 이동, 기존 안내 복구·중복 방지·삭제 유지 검사 통과. Windows 패키지에서도 동일 흐름을 검사한 뒤 배포합니다.

0.2.67: 개회식·퇴임식·졸업식 등 의식/행사명과 시작·진행·개최·열림 안내를 인식하도록 보완했습니다. 내일 2시 행사 시작 / 3시 의화제 개회식 / 4시 퇴임식의 세 문장을 14시·15시·16시 개별 일정으로 등록합니다. 취소·연기·자료 존재 문장 제외와 기존 행사·소독 추출 순번 및 삭제 기록 유지를 검증했습니다. 주간 달력은 주말에 일정/마감/학사 일정이 있거나 주말을 선택하면 해당 날짜를 포함합니다. Node 테스트 51개 통과. Electron 실제 세 문장 발송 → 세 타임라인 블록 → 원본 연결, 토요일 표시, 기존 한 일정의 식별자 유지·누락분 추가·중복/삭제 기록 보존 검증 통과. Windows 패키지에서도 동일 흐름을 검증한 뒤 배포합니다.

0.2.68: 제목 입력창 아래에 공지·마감·연수·제출·행사·회의·행정실·기타 단일 선택 버튼을 추가했습니다. 직접 입력한 제목을 우선 사용하고, 빈 입력은 선택한 버튼 문구를 사용합니다. 새 작성에서는 기타가 자동 선택됩니다. Electron에서 8개 버튼의 순서·단일 선택, 기타 기본값, 공백 입력 처리, 직접 입력 우선순위, 작성 방식 전환 후 보존, 실제 발송 및 재로딩 후 제목 저장을 검증했습니다. Node 테스트 51개 및 기존 행사 일정·이미지 캡처 흐름 통과. Windows 패키지도 동일 제목 흐름을 자동 검증한 뒤 배포합니다.

0.2.69: 관리자·업무 담당자는 안전 지도/중식 지도/자율학습 지도 블록을 끌어 날짜와 시간을 옮기고 위·아래 경계로 시작/종료 시간을 15분 단위로 조절할 수 있습니다. 서버는 권한, 이전 시간과의 충돌, 같은 업무·날짜 중복을 확인하고 하나의 공유 일정을 갱신해 기존 배정 교사와 담당자 모두에게 반영합니다. 드래그 이후 엑셀 재업로드는 실제 날짜를 기준으로 갱신하며 이동한 원래 일정을 덮어쓰거나 중복 등록하지 않습니다. Electron에서 일반/업무 일정 이동, 양쪽 경계 조절, 날짜 이동, 배정 유지, 중복 날짜 거부, Escape 취소 및 재로딩 보존을 확인했습니다. 서버에서 권한·동시 수정 거부, 담당자/배정 교사 캘린더 일치, 관리자 이동 및 재업로드 일관성을 검증했습니다. Windows 패키지에서도 같은 드래그 흐름을 자동 검증한 뒤 배포합니다.

0.2.70: 자동 등록 일정·제출 마감의 제목을 본문 추출 문구 대신 발송한 메시지의 확정 제목으로 통일했습니다. 빈 제목·기본 선택은 기타, 버튼 선택은 버튼 문구, 직접 입력은 입력 문자열을 그대로 저장하고 캘린더의 요약 변환도 적용하지 않습니다. 기존 자동 항목은 식별자·날짜·수정 시간·완료 상태·삭제 기록을 유지하며 제목만 한 번 보정합니다. Node 테스트 56개와 실제 Electron 발송에서 기타/버튼/직접 입력 우선순위, 마감·시간 범위·교시 일정, 캘린더 블록 및 상세 제목, 재로딩 보존을 검증했습니다. 기존 소독·행사 일정 흐름도 통과했습니다. Windows 패키지에서도 동일 제목 흐름을 검사한 뒤 배포합니다.

0.2.71: 일정 위·아래의 굵은 조절 표시를 제거하되 경계 드래그 영역은 유지했습니다. 오늘 일정 패널과 주간 달력에서 일정 블록과 추출 마감 표시를 하나의 겹침 그룹으로 계산해 서로 덮이지 않는 열에 배치하고 점선 경계로 구분합니다. 겹침이 연쇄적으로 이어져도 열 번호와 폭을 일관되게 유지합니다. 오늘 일정 패널의 제출 마감과 시간표 사이에 학사일정 영역을 추가해 선택 날짜의 기존 academic 데이터를 표시하며 빈 상태를 제공합니다. 하단 버튼은 내 일정 등록으로 변경했습니다. Electron에서 일정 2개·같은 시각 마감의 실제 화면 좌표 비겹침, 점선·조절 표시 제거, 날짜별 학사일정·빈 상태·버튼 문구를 검사했습니다. 기존 업무 드래그·양 경계 조절 검사와 Node 테스트 56개 통과. Windows 패키지도 동일 화면과 드래그를 검증한 뒤 배포합니다.

0.2.72: 기타업무는 별도 서류가방 아이콘으로 구분합니다. 설정에 교직원 통합 엑셀 등록을 추가해 이름/학년/반/내선번호/부서/업무/특별실/동아리를 미리보기 후 일괄 반영합니다. 기존 이름 연결(동명이인 내선번호 구분), 신규 교직원 추가, 담임·지도 업무 담당자 자동 지정, 기존 업무 일정 수신 대상 갱신, 특별실·동아리 검색을 지원합니다. 관리자가 서버에 등록하면 신규 계정은 무작위 아이디와 임시 비밀번호를 발급하고 첫 로그인 때 변경하며, 기존 로그인 정보·권한은 유지합니다. 임시 로그인 정보는 등록 직후 CSV로 내려받을 수 있고 서버에는 해시만 저장합니다. 오류·담임 중복·비활성 계정·이전 미리보기 충돌 시 일괄 변경을 거부합니다. Node 테스트 60개, 실제 XLSX → 데모 미리보기/등록/담당자 일정/다음 날짜 보존, 설치형 클라이언트 → HTTPS 서버 → 신규 계정 CSV → 첫 로그인 및 담임/담당자 반영 흐름을 검증했습니다. 기존 업무 엑셀 및 교사 교환 검사도 통과. Windows 패키지에서 동일 교직원 엑셀 흐름을 검사한 뒤 배포합니다.

0.2.73: 기타 업무 담당자 화면을 메신저에서 업무 일정을 등록·관리할 사람을 고르는 화면으로 명확히 했습니다. 상단 부서 선택은 안전 지도 배정 구분 설정 대신 사람 목록 필터로 동작하며 세 업무 모두 해당 부서의 활성 교직원만 표시합니다. 부서를 전환해도 숨겨진 기존 선택을 유지하고 업무별 선택한 담당자를 별도로 보여줍니다. 저장 시 부서 필터와 독립적으로 전체 선택을 반영하고 안전 지도 구분 부서는 유지합니다. Electron에서 세 목록 필터링, 부서 간 복수 선택·저장·재로딩·선택 해제, 안전 지도 구분 부서 보존 및 기존 엑셀 등록·배정 교사 교환 흐름을 확인했습니다. Windows 패키지에서도 동일 필터·선택 보존 흐름을 검증한 뒤 배포합니다.

0.2.74: 교직원 정보 모달을 이름/보직/학년/반/내선번호/부서/업무/특별실/동아리 9열의 직접 편집 표로 변경했습니다. 빈 틀, 파일 업로드 후 셀 수정, 수동 행 추가, 기존 명단 불러오기와 행 제외를 지원합니다. 보직은 계정 권한과 독립적으로 저장하며, 기존 행의 이름을 바꿔도 식별자·로그인 정보는 유지합니다. 변경하지 않은 담임/담당자 연결은 보존하고 이전 8열 엑셀도 읽습니다. 별도 반·담임 설정 행을 제거했습니다. 담당자 카드는 교무부 일과표·보강/시간표 2개, 생활 안전부 안전 지도·중식 지도 2개, 학년부 자율학습 지도 1개만 표시하며 부서별 사람 필터와 기존 선택을 유지합니다. 일과표 담당자의 실제 일과표 변경·안내 발송 권한도 연결했습니다. Node 테스트 61개 및 Electron에서 헤더/빈 틀, 파일 후 수정, 파일 없는 신규 입력, 기존 명단 이름 수정 시 중복 방지, 보직 보존, 부서별 카드·선택 저장, 기존 업무 엑셀/교사 교환, 설치형 HTTPS 신규 등록·CSV·첫 로그인을 검증했습니다. Windows 패키지에서도 동일 편집·카드 흐름을 확인한 뒤 배포합니다.

## 0.2.75 — independent staff editor

Staff information opens in a singleton, resizable native window, up to 1400×860 and clamped to the display work area. All nine staff headers and row actions fit at normal desktop sizes. Smaller windows retain a horizontal scroll fallback. The header supports native dragging; closing or saving leaves the messenger size unchanged. XLSX, manual rows, saved identity, LAN imports and credential download remain covered by active Electron tests.

## 0.2.76 — duty exchange workflow

- Shared state machine covers all three duty kinds, safety group preservation, teacher consent before approval, cancellation/decline/rejection, authorization, duplicate reservation prevention, changed snapshots, date expiry, and calendar conflicts.
- Authenticated HTTPS tests verify isolated request visibility, server-derived actors, concurrent reply/approval rejection, rollback of both assignments plus history, manager targets, stale request invalidation and history after server restart.
- Active Electron demo covers calendar entry, before/after comparison, reason, request/accept/approve, role-specific actions, unchanged preapproval calendars, both updated targets, audit trail, reload and cancellation.
- Three separately authenticated Electron LAN clients exercise teacher request → recipient acceptance → manager approval, live SSE status changes on all three clients and each user's synchronized calendar. Installed clients have no demo role selector.

## 0.2.77 — personal sliding sticky notes

- Storage tests verify per-account namespaces, note/view persistence, malformed and duplicate records, size bounds and write errors without overwriting the original stored data.
- Active Electron test exercises the main-only index tab, native slide and closed hit region, three local notes, list/grid, genuine long-press reordering, trash drop, Escape, Alt+arrow ordering, delete/undo and reload.
- Forced local-storage failure retains the draft and retries successfully. An incoming update from another workspace preserves the focused note, selection and text. Existing calendar switching and native minimal/restore are verified.
- Authenticated LAN test switches between two real accounts, checks separate notes and view preferences, hides notes on logout, restores the first account and confirms note text never appears in server bootstrap data.
- Existing briefing shape and minimal-window flows remain covered; GUI flows run sequentially to avoid sharing desktop focus during pointer interactions.

## 0.2.78 — expanded sticky editor and homeroom feed

- The protruding tab has a separate 12px native hit region; the main messenger retains its original content width. Briefing clipping and the minimal bar remain independent of this region.
- New notes open in a large colored editor. Minimize, outside-click collapse, per-card expand and immediate grip dragging preserve content and order. The drawer establishes its closed layout before animating and uses a single eased transform.
- Recipient-scoped homeroom selection tests cover explicit categorization, chronological accumulation, deduplication, reservations, recall/trash exclusion and typed-title priority.
- Two authenticated Electron clients plus a second sending account verify composer selection, recipient-only live accumulation, normal-message exclusion, category validation, source navigation, recall and persistence after server restart. The demo flow is also tested against the packaged Windows application.

## 0.2.79 — homeroom pins and compact calendar controls

- All 71 Node tests passed locally. The Electron demo verifies header source/pin placement, personal pin/unpin, completion, reload persistence and original-message navigation.
- Authenticated LAN flow verifies recipient-only pin permission, sender/outsider rejection, idempotent repeated requests, owner isolation, completion/date preservation, source metadata and server restart persistence.
- The date reset was manually exercised in Electron: it fits next to the date, returns to today and keeps exactly two footer actions on other days.
- The packaged Windows build runs the homeroom flow and existing calendar, duty, notes, staff and message regression flows in CI before publication.

## 0.2.80 — independent calendar and memo wings

- Native main window reserves independent left/right areas. The organization keeps its screen coordinates while either or both wings open; each close animation has its own native clipping timer. Widths adapt to the initial display work area.
- New packaged-Windows-ready Electron flow samples animation frames for intermediate positions, monotonic movement and no overshoot; checks independent opening/closing, preserved native bounds, both calendar-side preferences, reload and rapid toggles.
- Pixel checks verify full transparency below the external memo tab. Dialog geometry checks verify exact centering with one or both wings, excluding the 12px tab gutter; the homeroom explanatory paragraph is absent.
- Existing notes, homeroom pin/completion/reload, minimal/restore, briefing transparent surfaces/source navigation, calendar drag and authenticated account-local notes flows pass locally. The full suite and packaged Windows flows run before release publication.

## 0.2.81 — drawer-attached seamless memo handle

- The persistent handle is mounted above the frame seam and moves using the same transform duration/easing as the drawer. Native paint/hit regions include the handle at the outer drawer edge while opening/closing; display-edge fitting includes its full protrusion.
- Electron samples the handle-to-drawer offset during both opening and closing, verifies no gap or drifting, and checks opaque yellow pixels across the main-frame boundary with zero handle border.
- Existing sticky note interactions, account-local persistence, briefing transparency and minimal/restore flows pass locally. The complete source and packaged Windows suites run before publication.

## 0.2.82 — rich sticky note formatting

- Existing version-1 text-only notes remain readable. Optional bounded HTML stores basic formatting alongside plain text. New storage tests verify legacy records, rich round trips, invalid types and size bounds.
- The Electron formatting flow verifies selection-preserving bold/italic/underline tools and keyboard shortcuts, two-item bullet and number lists, compact rich editing, collapse/reopen/reload persistence and absence from shared messenger data.
- Clipboard HTML is reduced to supported semantic tags without attributes; script/media nodes are discarded. Paste and character-limit behavior are verified in the real editor.
- Existing sticky note reorder/undo, save-failure retry, Korean input focus across external workspace updates and native wings remain covered. The authenticated account test verifies formatted notes stay isolated locally and absent from server bootstrap.

## 0.2.83 — reliable settings dismissal

- Modal header close buttons invoke dismissal directly, without relying on document-level click delegation. Context menus are cleared consistently on dismissal.
- The settings header/footer cannot shrink into the scrolling body. The X has a 40px hit area, no native drag region and non-interactive SVG children.
- A packaged-Windows-ready Electron flow tests X at 125% display scaling after font, theme and calendar changes, after scrolling, with each wing combination, repeated reopening, footer completion, Enter/Escape and preference persistence after reload.
- Existing briefing and homeroom flows verify shared modal close behavior. Source and Windows regression suites run before release publication.

## 0.2.84 — actual sender read-receipt notifications

- All 75 Node tests pass locally. Receipt transitions match recipient IDs rather than array positions; notifications include the actual name and subject and are scoped to the sender.
- Server first-read timestamps and acknowledgment flags persist with the existing recipient rows. Repeated reads do not reset acknowledgments. Existing historical read rows are not replayed on upgrade.
- Authenticated tests cover sender/recipient/outsider isolation, CC, forged status/ack requests, repeated acknowledgment, atomic rollback, recalled/reserved messages, deferred delivery, server restart and legacy read rows. No reply mails or calendar items are generated for receipt notifications.
- Two authenticated Electron clients verify real composer delivery and recipient opening, a single sender-main toast/native notification while minimized, no workspace duplication, read retries, logout/offline reading, briefing-first login catch-up, acknowledgment and reload without replay.
- The packaged-demo flow verifies recipient-state transitions from a second window, actual reader names and subject, the native notification bridge, deduplication, and notification geometry inside the painted organization region with both wings closed.

## 0.2.85 캘린더 교환 및 알림 검증

- 공유 상태 테스트: 원래 일정 등록자의 열람 권한과 갱신 대상 보존, 승인 권한 분리, 교사 이름·교환 날짜·완료 상태 알림 문구.
- 인증 서버 테스트: 등록자(현재 담당자가 아닌 관리자)·현재 담당자·두 당사자별 알림, 무관한 사용자 격리, 타인 ACK 거부, 지연 ACK의 후속 상태 보존, ACK 재시작 지속, 충돌·취소·동시 승인·트랜잭션 롤백.
- Electron 데모: 캘린더 블록 클릭 → 교환 요청, 클릭한 내 일정 고정, 목록 새 요청 제거, 수락/승인/취소 및 변경 이력.
- 세 인증 LAN 클라이언트: 기타 업무 교환 메뉴 제거, 실제 캘린더 상세에서 요청·수락·승인, 두 개인 캘린더와 담당자 전체 일정 동기화, 세 본창 모두 완료 토스트 및 OS IPC 알림, 작업창 중복 없음, ACK 이후 재접속 재알림 없음.

## 0.2.86 업무 달력 검증

- 인증 서버: 전체 교직원용 dutyCalendar는 세 업무의 배정 정보만 반환. 개인 일정과 원문/메모/메시지 연결 정보 제외. 요청용 dutyRoster의 기존 본인 업무 종류 범위 유지.
- Electron 업무 달력: 42일 월간 보기, 세 업무 정렬·색상·교사 이름·내 배정 표시, 제목만 같은 개인 일정 제외, 학사 일정/완료 확인 제외, 월 이동·빈 달·이번 달 복귀.
- 실제 달력 블록에서 요청 → 상대 수락 → 담당자 승인 → 배정 표시 이동, 타인 배정 요청 차단, 기존 주간/월간 보기 및 저장 후 재시작 확인.
- 세 인증 LAN 클라이언트가 모두 업무 달력에서 같은 배정표를 보고, 상세 화면에서 교환 후 각 개인 캘린더와 담당자 배정 및 완료 알림 동기화를 검증.
- 데모 다중 창에서 수신한 저장 변경을 렌더링할 때 다시 저장하지 않도록 하여 창 사이 변경 반복과 클릭 중 DOM 재생성을 방지.

## 0.2.87 교환 진입·대상 범위·간결한 카드 검증

- 상태 모듈: 오늘·월말 포함, 지난 날짜·다음 달·다음 해 같은 달 제외, 연말 및 윤년 월말 경계, 다음 달 요청 차단.
- 인증 서버: 테스트의 JS 날짜만 고정하여 기존 교환 수락·승인·원자성·권한·알림 검증을 재현하고, 다음 달 배정이 있어도 대상 요청을 거절하는지 확인.
- 업무 달력: 상단 교환 버튼 없음, 카드에 시간 없음, 본인 일정 상세 모달 → 요청, 어제와 다음 달 배정을 둔 상태에서 대상 목록에는 이번 달 남은 날짜만 표시. 실제 교환 후 배정 갱신 및 타인 배정 요청 차단.
- 기존 교환·다중 클라이언트 검증도 일정 상세 경로로 수행. OS 알림 문구를 해당 일정 클릭 경로로 갱신.

## 0.2.88 교환 버튼 표시와 사용자 구분

- 데모 업무 달력: 타인 일정에서도 비활성 교환 버튼 및 현재 사용자/배정 교사/사유를 표시. 배정 교사로 명시적으로 체험 역할을 선택하면 버튼 활성 및 해당 원본 일정의 요청 폼 진입. 모달 닫기 이후 본인 배정 재진입·역할 초기화 검증.
- 달력의 내 배정 표시를 현재 사용자 기준으로 분리하고, 일정을 처음 열 때 이전 교환 승인 체험 역할이 남지 않도록 초기화.
- 세 인증 LAN 클라이언트: 담당자가 전체 일정을 봐도 배정 교사가 아니면 요청 버튼 비활성, 현재 사용자 이름 표시, 데모 역할 선택기 없음. 본인 요청·상대 수락·담당자 승인·개인 캘린더 및 알림 동기화 검증.

## 0.2.89 상대 일정 선택으로 단순화

- 업무 달력에서 상대 일정 클릭 → 교환 요청하기. 상대 일정 ID 고정, 내 일정 하나일 때 자동 선택·비활성 선택기, 상대 하나일 때 자동 선택. 과거·다음 달 내 배정을 제외.
- 내 날짜가 여러 개일 때 선택기를 활성화하고 선택한 날짜로 전후 비교를 갱신. 자기 일정 클릭 안내, 교환할 내 배정 없음 안내, 데모 요청자 전환·복귀 및 실제 사용자 내 배정 표시 검증.
- 데모 및 세 인증 LAN 클라이언트 모두 상대 일정에서 요청을 시작해 수락·승인·공유 캘린더·완료 알림을 검증.
- 기존 인증 서버 상태·동시성·롤백·본인 권한 검사를 유지.

## 0.2.90 닫기 테두리 및 포커스 검증

- 브리핑 초기 포커스가 대화상자에 있고 X에는 외곽선 스타일이 없는지 확인.
- Tab으로 X 이동 시 1px 내부선·-3px 오프셋·6px 모서리 확인. Enter로 닫은 뒤 메신저 본창 X의 실제 계산된 테두리·모서리·포커스 스타일과 일치하는지 비교.
- 기존 브리핑 투명 픽셀/네이티브 영역, 양쪽 날개, 원문 이동 및 키보드 활성화 검증.
- 설정 창 125% 배율 테스트로 X 클릭·Enter·Esc·완료 버튼·최소 클릭 영역 및 저장 설정 유지 확인.

## 0.2.91 교환 상대 고정 표시 검증

- Electron 업무 달력: 단일 상대 이름 고정 표시와 숨김 ID 일치, 상대 선택 목록 부재, 상세의 데모 요청자 목록 제거, 실제 사용자 유지, 내 일정 자동 연결/여러 날짜 선택 및 수락·최종 승인 후 배정 교체 통과.
- 실제 LAN 세 계정: 요청자 → 상대 수락 → 담당자 승인, SSE 상태 갱신과 개인 일정 동기화 통과.
- JavaScript 구문 및 git diff 공백 검사 통과. 전체 회귀 및 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.92 교환 카드 표시

- 기존 Electron 교환 흐름 검사 통과: 일정에서 요청, 상대 수락, 담당자 승인, 전후 배정, 변경 이력, 재실행 및 취소.
- 교환 카드는 기존 grid의 직접 자식으로 업무명·교사 이름을 분리하여 각각 다른 행에 표시합니다.
- JavaScript 구문 및 diff 공백 검사 통과. 전체 소스 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.93 업무 일정 드래그 차단

- 기존 Electron 타임라인 검사를 새 요구사항에 맞게 변경하고 통과했습니다.
- 안전·중식·자율학습 세 종류 각각 본문 이동, 다른 날짜로 이동, 상하 경계 드래그 후 저장 데이터가 그대로임을 확인했습니다. 이전 canReschedule=true 값이 있어도 조절 핸들이 표시되지 않습니다.
- 일반 개인 일정의 이동·상하 조절·다른 날짜 이동, 업무 상세 열기와 교환 버튼, 재실행 후 고정 상태를 확인했습니다.
- JavaScript 구문과 diff 공백 검사 통과. 전체 회귀 및 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.94 메모 카드 클릭 확대

- 기존 Electron 메모 검사에서 그리드 본문 클릭으로 해당 내용이 확대되는 것을 확인하고, 목록 카드의 빈 공간 클릭도 확인했습니다.
- 전체 메모 흐름 검사 통과: 손잡이 이동·취소·휴지통, 키보드 순서 이동, 삭제·되돌리기, 확대·최소화·바깥 클릭, 저장 실패 재시도, 수신 갱신 시 포커스 유지, 재실행과 개인 로컬 저장.
- JavaScript 구문 및 diff 공백 검사 통과. 전체 회귀 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.95 데모 사용자 이름 공백 회귀 검증

- Electron 업무 달력에서 로그인 이름 교사A, 교직원 이름 교사 A로 재현하여 세 업무 모두 본인 배정으로 표시되는지 확인했습니다. 상대 일정에서 내 배정을 자동 연결하고 수락·최종 승인 후 두 날짜의 배정 교체, 재실행을 통과했습니다.
- 공백을 제거하면 같은 이름인 교직원이 여러 명일 때 임의로 연결하지 않고 요청을 차단하는지 확인했습니다. 담당자 미지정은 별도 안내로 표시됩니다.
- 공유 업무 교환 상태 검사 6개 통과(세 업무의 수락→최종 승인, 권한·충돌·기간·중복 검증 포함). 실제 LAN 세 계정의 요청·수락·승인, SSE와 개인 일정 동기화 통과.
- JavaScript 구문과 diff 공백 검사 통과. 전체 소스 및 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.96 미니 달력과 교환 방향

- 기존 Electron 교환 흐름 검사 통과: 작성 미리보기, 요청, 상대 수락, 담당자 승인, 배정 교체, 이력·재실행·취소.
- 미니 달력에서 실제 두 요청 날짜를 표시하는지, 교사별 카드 두 개의 화살표 및 교환 전후 날짜 방향이 맞는지 검증했습니다.
- 넓은 화면 및 640px 화면에서 비교 영역의 가로 넘침이 없고 좁은 화면은 한 열로 배치되는지 확인했습니다. 두 화면 캡처를 직접 확인했습니다.
- JavaScript 구문과 diff 공백 검사 통과. 전체 회귀 및 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.97 교환 요청함과 알림 바로가기

- Node 전체 78개 검사 통과. 상대 수락 시 요청자와 담당자의 안내 문구가 구분되고, 승인 대기 중에도 요청자가 취소 가능함을 확인했습니다.
- 실제 LAN 세 계정 검사 통과: 상대가 앱 알림에서 바로 상세 열기 → 수락 → 요청자 수락 알림·담당자 승인 요청 알림 → 담당자 요청함에서 직접 승인. 이후 요청자 목록 취소와 상대방 받은 요청 목록 거절도 통과했으며 기존 승인 배정이 유지됩니다.
- 같은 검사에서 승인 대기 건수, 목록의 직접 처리 버튼, 진행 중 두 날짜 표시와 1px 파란 테두리·붉은 점선 조합, 카드 상태 글자 제거, 최종 승인 후 개인 일정 갱신과 알림 ACK/재접속 중복 방지를 확인했습니다.
- Electron 데모 교환 흐름 및 업무 달력 검사 통과. OS 팝업을 띄우지 않는 Notification 이벤트 검사로 Windows 알림 클릭 핸들러의 기존 창 재사용과 새 창에서 해당 요청 직접 열기를 확인했습니다. 요청함/달력 캡처를 직접 확인했습니다.
- JavaScript 구문과 diff 공백 검사 통과. 처음 Node 전체 검사에서 의존성 경로 누락으로 서버 검사가 실행되지 않았으며, 설정된 NODE_PATH로 다시 실행하여 78개 모두 통과했습니다. 전체 GUI 회귀 및 실제 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.98 미니 달력 기본 진입·수락 즉시 반영

- Node 전체 78개 검사 통과. 세 업무 모두 상대 수락 시 두 배정을 반환하고, 별도 담당자 승인을 지원하지 않는지 검증했습니다. 충돌·지난 날짜·배정 변경·권한 검사와 취소/거절 시 배정 유지, 이전 승인 대기 요청의 상대 재확인을 포함합니다.
- 실제 서버 검사에서 수락 직후 요청자·수락자·담당자의 개인 일정 반영, 중복 수락의 단일 성공, 수락과 취소 동시 요청의 단일 성공, 배치 실패 시 요청 상태와 두 배정의 원자적 롤백, 서버 재시작 후 알림/이력 보존을 확인했습니다.
- Electron 데모 교환·업무 달력 검사 통과: 상대 일정 클릭으로 미니 달력부터 표시, 요청 후에도 미니 달력에서 취소/수락·거절, 수락 즉시 완료와 변경 이력 2건, 단일 요청 바로 열기, 여러 내 날짜 선택, 사용자 이름 공백 처리, 좁은 화면과 화살표 가로/세로 중앙 정렬, 알림 클릭의 기존/새 창 연결.
- 실제 LAN 세 계정 검사 통과: 알림에서 요청 직접 열기, 상대 수락 한 번으로 세 계정 일정과 완료 알림 전달, 담당자는 별도 처리 버튼 없음, 요청자 취소와 상대 거절, 재접속 시 ACK 중복 방지. 테스트 중 이미 클릭해 사라진 담당자 알림을 다시 기다리던 검사를 실제 소비 동작에 맞게 수정 후 통과했습니다.
- 화면 캡처 직접 확인, JavaScript 구문 및 diff 공백 검사 통과. 전체 GUI 회귀 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.99 순환 아이콘·다중 요청 미니 달력 기본 화면

- 기존 Electron 교환 흐름 검사에서 본창의 요청함 버튼으로 빈 요청함을 열고, 이후 요청이 두 건인 상태에서도 카드 목록 없이 미니 달력이 바로 열리는 것을 확인했습니다.
- 이전/다음 버튼의 첫·마지막 비활성 상태, 요청 1 / 2 → 2 / 2 → 1 / 2 전환, 선택한 건의 완료/취소 상태와 날짜 표시를 확인했습니다. 헤더 아이콘과 여러 요청의 미니 달력 화면을 캡처하여 직접 확인했습니다.
- 수락 즉시 완료, 수락 전 취소, 재실행 후 보존, OS 알림 클릭 시 기존/새 창 연결을 포함한 기존 Electron 교환 흐름 통과.
- 실제 LAN 세 계정의 요청 → 수락 즉시 세 계정 일정 반영, 완료 알림·ACK, 취소·거절 검사 통과. JavaScript 구문 및 diff 공백 검사 통과.
- 전체 GUI 회귀 및 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.100 입력 박스와 배정 배경색

- 기존 Electron 교환 흐름 검사 통과: 요청 사유를 펼침 동작 없이 입력하고 저장·표시하며 수락 즉시 반영, 취소와 다중 요청 미니 달력 탐색을 유지합니다.
- 기존 업무 달력 검사 통과. 내 배정 세 종류가 함께 표시된 날짜와 다른 교사 배정 날짜를 캡처하여 직접 확인했습니다. 내 안전·중식·자율학습 지도는 같은 연한 살구색이며 다른 교사의 자율학습 지도는 연한 회색입니다.
- 요청 사유 텍스트 박스 화면을 직접 확인했습니다. JavaScript 구문과 diff 공백 검사 통과. 전체 GUI 회귀 및 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.

## 0.2.101 업무 종류 색 차이 강화

기존 Electron 업무 달력 검사 통과. 다른 교사의 안전·중식·자율학습 지도가 함께 표시된 캡처를 직접 확인하여 파란색·연두색·중성 회색의 차이를 확인했습니다. 내 배정 살구색과 교환 흐름은 유지됩니다. diff 공백 검사 통과. 전체 회귀 및 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.

첫 CI에서 Node 78개와 업무 달력 검사는 통과했으나, 한국 날짜가 일요일로 넘어가며 교환 검사 대상인 월요일 일정이 다음 주에 있어 클릭 대기가 실패했습니다. 기존 교환 검사가 대상 주로 이동하고 두 번째 요청 전 이번 주로 돌아오도록 보완했습니다. 로컬 교환 흐름 재검사 통과.

## 0.2.102 점선 시간 조절 대상과 메모 일정 등록

- Node 전체 78개 검사 통과.
- 기존 Electron 드래그 검사를 확장하여 일반 이동·경계 조절, 오른쪽 클릭 대상 전환, 위·아래 공유 경계의 이웃 일정 쪽 2px 지점에서도 선택 대상만 조절하는지 확인했습니다. 저장 후 대상 유지, 단독 일정, Esc로 드래그 취소, 바깥 클릭, 왼쪽 클릭 상세, 새로고침 시 해제를 포함합니다. 주간 달력과 본창 오늘 일정의 서로 다른 배율에서 확인했으며 고정 세 업무의 이동·경계 조절 금지도 통과했습니다.
- 새 Electron 메모 일정 검사에서 명시적인 버튼 조작, 날짜·시간 입력과 역전 시간 검증, 취소 시 미등록, 개인 일정 저장, 같은 메모에서 재편집 시 중복 방지, 메모 수정·삭제와 등록 일정 분리, 새로고침 유지, 다른 창에서 등록 IPC 호출 거부를 확인했습니다.
- 실제 HTTPS 서버에 연결하는 기존 메모 검사도 확장하여 등록 전 로컬 저장, 등록 후 본인 전용 캘린더·다른 계정 비공개, 오른쪽 클릭 경계 수정의 서버 저장, 메모에서 다시 열 때 최신 시간 표시와 중복 없는 갱신을 확인했습니다.
- 기존 메모 목록/그리드·이동·삭제/복원·자동 저장·서식과 캘린더 겹침/표시 검사 통과. 점선 대상, 메모 버튼, 일정 입력 화면 캡처를 직접 확인했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 GUI 회귀와 Windows 실행 파일 검증은 릴리스 워크플로에서 수행합니다.

첫 CI에서 Node 78개와 메모 일정·실제 LAN·업무 교환·캘린더 표시 검사는 통과했습니다. 드래그 취소 직후 상세 열기 검사에서 기존 400ms 클릭 차단이 새 클릭까지 막는 것을 확인하여, 새 왼쪽 포인터 입력에서는 이전 드래그의 클릭 차단을 해제하도록 수정했습니다. 오늘 일정 검사에서 날짜 이동 버튼도 본창의 다른 날짜 버튼과 구분하도록 날개 내부로 범위를 한정했습니다.

두 번째 CI에서는 기존 LAN 교환 화면의 색상 검사가 실시간 재렌더 중 분리된 요소에서 빈 스타일을 읽어 실패했습니다. 기대하는 파란 테두리·붉은 점선 값은 유지하되 연결된 DOM에서 두 스타일을 함께 확인할 때까지 기다리는 검사로 보완했습니다. 메모 일정과 서버 검사 78개는 이 실행에서도 통과했습니다.


## 0.2.103 일정 개인 메모 검증

- Node 전체 79개 검사 통과. 같은 일정 기록의 중복 없는 갱신, 비우기와 다른 메모 보존, 계정별 저장소 분리를 포함합니다.
- 새 Electron 검사 통과: 잠금 배지/독립 메모 제거, 제목 앞 아이콘만 표시, 캘린더에 내용·툴팁 없음, 일정 요약 바로 오른쪽 메모하기, 상세 작성/수정/취소/비우기, 메모장과 상호 갱신/삭제, 안전한 텍스트, 저장 실패 시 초안 유지, 새로고침 후 보존을 확인했습니다.
- 실제 LAN 메모 검사 통과: 개인 기록이 서버 bootstrap에 포함되지 않음, 다른 계정에서 보이지 않음, 본인 재로그인 후 보존, 캘린더 시간 조절 후 메모장의 시간 갱신을 확인했습니다.
- 기존 캘린더 표시, 메모 자동 저장·서식·이동/삭제·일정 등록 검사 통과. 새 상세·캘린더 아이콘·메모장 카드 화면을 직접 확인했습니다. 전체 GUI와 Windows 실행 파일 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.104 메모 내 일정 입력 검증

- Node 전체 79개 검사 통과.
- 기존 메모 일정 Electron 검사를 새 흐름으로 갱신하여 제목 아래 선택자 위치, 다른 창을 열지 않음, 취소 시 미등록, 역전 시간 검증, 개인 캘린더 직접 등록, 같은 메모 재저장 시 중복 없음, 최신 저장 시간 복원, 저장 실패 시 선택값 유지와 캘린더 원본 보존, 메모 본문/삭제 독립성을 확인했습니다.
- 실제 HTTPS 서버 검사에서 메모 내 등록·수정, 캘린더에서 변경한 시간의 재조회, 개인 캘린더·다른 계정 비공개, 기존 개인 기록 연동을 확인했습니다.
- 일정 개인 메모와 서식 검사 통과. 날짜/시간 선택자 화면과 제목·날짜 아래 연한 구분선 화면을 직접 확인했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 GUI 회귀와 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.105 마감 메모 표시 검증

- Node 전체 79개 검사 통과.
- 기존 개인 메모 GUI 검사를 확장하여 완료 확인 목록의 메모 아이콘이 제목 첫 요소인지, 상세 메모 작성/확인, 캘린더/서버 데이터와 내용 분리, 마감 시간 변경 후 메모장 갱신, 완료 체크 후 아이콘 유지, 시간 없는 마감과 메모 삭제를 확인했습니다.
- 기존 마감 목록 검사에서 완료/미완료, 상세 → 관련 메시지 보기, 수동 마감의 메모 기능, 표시 설정과 재실행 보존 검사 통과. 캘린더 표시와 실제 LAN 메모 연동 검사 통과.
- 초록색 아이콘이 있는 완료 확인 목록 화면을 직접 확인했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 GUI 및 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.106 메모 일정 분류 표시 검증

- 실제 Electron에서 메모를 작성하고 등록한 일정의 상세 분류가 메모 일정인지 확인했습니다. 일반 개인 일정의 상세 분류는 개인 일정으로 유지됨을 확인했습니다.
- 기존 메모 일정 등록·수정·실패 시 보존 검사와 개인 메모 작성·메모장 연동·삭제·재실행 검사가 통과했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 GUI와 Windows 패키지 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.107 캘린더 아이콘 검증

- 실제 Electron에서 미등록 메모에는 아이콘이 없고 일정 저장 후 카드와 확대 메모에 아이콘이 나타나는 것을 확인했습니다. 메모 등록·수정·취소·실패 시 입력 보존, 개인 기록 작성과 메모장 연동·삭제·재실행 검사가 통과했습니다. 카드 화면을 캡처하여 아이콘과 기존 이동·확대·삭제 버튼 배치를 확인했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 회귀 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.108 메모 연결 방향 검증

- 기존 개인 메모 GUI 검사 통과: 작성·수정·취소·비우기·삭제·재실행과 마감 목록 표시, 개인 내용 분리 및 메모장 연동을 확인했습니다.
- 실제 메모 등록 흐름에서 안쪽 아이콘 표시, 같은 일정에 추가 기록 시 양쪽 아이콘 동시 표시, 기록 비우기 시 안쪽 아이콘 유지, 원래 메모 삭제 및 캘린더 재실행 후 등록 경로 표시 보존을 확인했습니다. 안쪽·바깥쪽 아이콘 화면을 캡처하여 확인했습니다.
- JavaScript 구문 및 diff 공백 검사 통과. 전체 회귀 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.109 메모 겹침 검증

- 실제 Electron에서 7개 메모(일정 연결·빈 메모·짧은 내용·긴 내용)를 그리드와 목록으로 표시해 카드 교차 영역이 없고 일정 버튼이 카드 안에 있으며 마지막 카드까지 스크롤할 수 있음을 확인했습니다. 일반 짧은 카드 높이는 그리드 약 184px에서 132px, 목록 약 140px에서 108px로 감소했습니다. 두 보기의 화면을 캡처하여 확인했습니다.
- 기존 메모 GUI 검사에 7개 혼합 카드의 행 간격과 버튼 영역 검증을 추가했습니다. 이동·삭제·되돌리기·편집·확대·저장 실패 시 복구·재실행 및 메모 일정 등록 검사가 통과했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 회귀 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.110 담임 업무 메모·삭제·일정 연동 검증

- Node 전체 82개 검사 통과. 개인 메모의 계정 분리·동일 메시지 중복 방지·서식 보존·잘못된 연결 정보 거부, 숨긴 담임 항목 필터, 샘플 최초 등록 및 삭제 유지 검사를 포함합니다.
- 실제 HTTPS 서버와 두 Electron 클라이언트에서 메모 작성/재열기/재시작 후 연결, 개인 내용이 서버와 발신자 데이터에 포함되지 않음, 본인 목록 삭제와 원본 받은 메시지 보존, 다른 수신자 목록 유지, 비수신자 삭제 차단, 서버 재시작 후 숨김 보존을 확인했습니다.
- 담임 메시지 본문의 명확한 상담/회의 날짜·시간은 수신자와 발신자 일정에, 제출 마감은 수신자 완료 확인에 등록됨을 확인했습니다. 일정 추가를 함께 사용한 담임 메시지는 연결된 일정 한 건만 등록됩니다.
- Windows에서도 실행하는 체험 GUI 검사로 샘플 4개와 연결된 자동 일정·마감, 실제 메모장에서 작성 후 메모 보기, 목록 X 삭제와 재실행 보존을 확인했습니다. 샘플 목록과 연결 메모 화면을 직접 확인했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 회귀 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.111 날짜별 담임 업무 검증

- Node 전체 86개 검사 통과. 날짜별 조회·중복 없는 복사·개별 날짜 삭제·원본 날짜와 예약 발송의 한국 시간 처리·샘플의 날짜 변경 보존 검사를 포함합니다.
- 실제 HTTPS 서버에서 수신자별 복사 분리, 발신자/비수신자의 이월 차단, 잘못된 날짜와 없는 날짜 거부, 동시 이월 요청의 중복 방지, 실패한 묶음 작업의 원자성, 다른 수신자/원본 보존과 서버 재시작 후 이력 유지 검사를 통과했습니다.
- 실제 설치 클라이언트에서 담임 업무를 이월하고 달력 작업 창의 다음 날짜 카드에서 조회했습니다. 카드에서 본창 메모장을 열어 개인 기록을 작성하는 경로와 기존 메모·일정·마감·고정·삭제 검사가 통과했습니다.
- 새 체험 Electron 검사는 오늘 목록 초기 선택, 날짜 앞뒤 이동, 원본을 남기는 내일 복사, 중복 버튼 차단, 날짜별 삭제, 업무 달력 오른쪽 카드 배치, 날짜 사이 메모 공유와 창 간 메모 열기, 재실행 보존, 작은 창에서의 카드 배치와 실제 할 일 추가 입력을 확인합니다. 한국 시간 자정을 넘긴 오늘 목록 전환과 과거 이력 보존도 확인합니다. 이 검사를 소스 및 Windows 패키지 워크플로에 포함했습니다.
- JavaScript 구문 및 diff 공백 검사 통과. 전체 GUI 회귀 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.112 할 일 제거 검증

- 브리핑 GUI 검사에서 기존 할 일 데이터가 있어도 목록·제목이 나타나지 않으며 일정·마감의 원문 열기와 상세 확인은 유지되는 것을 확인했습니다.
- 기존 달력 보기 검사를 갱신하여 주간/월간 전환, 동일 창·창 크기 유지, 재시작 후 브리핑에서 할 일 미표시를 확인합니다. 날짜별 담임 업무 GUI 검사에서도 월간 달력에 할 일 입력/카드가 없음을 확인합니다.
- Node 전체 86개 검사, JavaScript 구문 및 diff 공백 검사 통과. 월간 달력의 빈 사이드 영역 제거를 화면으로 확인했습니다. 전체 GUI 회귀·Windows 실행 검증은 릴리스 검사에서 수행합니다.


## 0.2.113 원문 제목·첫 문장 표시 검증

- 미리보기의 원문 불변, 제목 그대로 표시, 제목 없음/분류 기본값의 본문 앞부분 사용, 직접 입력한 담임 제목 보존, 문장부호/첫 줄/날짜/소수 구분과 Unicode 글자 제한을 확인했습니다.
- 실제 HTTPS 서버와 발신·수신 클라이언트에서 제목 없음과 직접 입력한 담임을 따로 발송하여 수신 목록의 제목과 첫 문장이 요청대로 표시되는 것을 확인했습니다. 메모·목록 삭제·이월·서버 재시작·일정/마감 연동 검사도 통과했습니다.
- 체험판 수신 샘플에서 두 번째 문장이 목록에 보이지 않고 전체 내용은 원문에서 확인됨을 검사했습니다. 미리보기 화면을 직접 확인했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 GUI 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.
- Node 전체 87개 검사 통과.


## 0.2.114 담임 업무 복귀 검증

- 실제 HTTPS 수신 클라이언트에서 메모 작성 후 새 버튼으로 담임 업무 모달에 돌아가며 메모 보기와 개인 내용이 유지됨을 확인했습니다. 버튼이 메시지 보기 바로 오른쪽에 배치된 화면을 직접 확인했습니다.
- 체험 GUI에서 이월된 다음 날짜의 메모를 작성하고 담임 업무 보기로 같은 날짜의 이월 항목에 돌아가는 것을 확인했습니다. 이후 날짜 이동·삭제·재실행·창 간 메모 연결·자정 전환 검사도 통과했습니다.
- Node 전체 87개 검사, JavaScript 구문 및 diff 공백 검사 통과. 전체 GUI 회귀 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.115 담임 고정 아이콘 검증

- 실제 Electron에서 담임 업무를 고정하고 완료 확인 제목의 첫 요소가 담임 아이콘인지, 접근성 이름이 담임 업무인지, 일반 마감에는 아이콘이 없는지 확인했습니다. 완료 체크 후에도 표시되는 것을 검사하고 화면을 직접 확인했습니다. 기존 고정/해제·원문 연결·완료 및 재실행 검사 통과.
- Node 전체 87개 검사, JavaScript 구문 및 diff 공백 검사 통과. 전체 GUI 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.116 일정 여백 검증

- 오늘 일정과 주간 달력의 실제 한 시간/30분 블록에서 제목 위 및 마지막 표시 줄 아래에 5px 이상 여백과 텍스트 줄 사이 간격이 남는 것을 검사했습니다. 한 시간 블록은 제목·시간·장소를 모두 표시하며 겹친 일정/마감은 기존처럼 독립 열을 사용합니다. 화면을 직접 확인했습니다.
- 기존 일반 일정의 이동·시간 조절, 맞닿은 경계의 오른쪽 클릭 선택, 취소·상세 열기 및 고정 업무 제한 검사가 통과했습니다. 개인 메모 아이콘과 상세/메모장 연동 검사도 통과했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 회귀와 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.


## 0.2.117 메모 삭제 검증

- 기존 메모 GUI 검사에서 카드 삭제 글자 표시, 확대 메모의 삭제 저장 실패 시 편집기와 저장 원본 보존, 재시도 후 삭제, 되돌리기 후 원래 순서·내용 복원을 확인했습니다. 기존 이동·정렬·저장·재실행 검사도 통과했습니다.
- 일정 개인 메모의 삭제 후 캘린더 표시 갱신과 메모에서 등록한 일정이 메모 삭제 후에도 유지되는 검사가 통과했습니다. 확대 메모의 새 삭제 버튼 화면을 직접 확인했습니다. JavaScript 구문 및 diff 공백 검사 통과. 전체 회귀 및 Windows 실행 검증은 릴리스 워크플로에서 수행합니다.
