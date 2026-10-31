'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const resultPath=path.resolve(process.argv[2]||'.artifacts/message-crypto-benchmark/results.json');
const reportPath=path.join(path.dirname(resultPath),'REPORT.ko.md');
const report=JSON.parse(fs.readFileSync(resultPath,'utf8'));
const f=value=>value.toFixed(2);
const signed=value=>(value>=0?'+':'')+f(value);
const kb=value=>(value/1024).toFixed(value<2048?1:0)+' KiB';
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)];
let randomState=0x20_26_10_30;
const random=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
function pairedMedianCI(values) {
  const boot=[];
  for(let i=0;i<5000;i++)boot.push(percentile(values.map(()=>values[Math.floor(random()*values.length)]),.5));
  return [percentile(boot,.025),percentile(boot,.975)];
}
const appRoot=path.resolve(__dirname,'../..');
const sourceFiles=['server/index.cjs','desktop/main.cjs','js/backend.js','benchmarks/message-crypto/crypto-cost.cjs','benchmarks/message-crypto/server-fixture.cjs','benchmarks/message-crypto/run.cjs'];
const hashes=sourceFiles.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(appRoot,file))).digest('hex')}));
if(report.sourceHashes)assert.deepEqual(hashes,report.sourceHashes,'Benchmark source changed after measurement');
const summaries=report.results.map(row=>{
  for(const mode of ['plain','encrypted'])assert.equal(row.raw[mode].length,row.repeats);
  const difference=row.encrypted.allMessagesMs.median-row.plain.allMessagesMs.median;
  return {recipients:row.recipients,bodyBytes:row.bodyBytes,fileBytes:row.fileBytes,
    medianDeltaMs:difference,medianDeltaPercent:difference/row.plain.allMessagesMs.median*100,
    pairedMedianDeltaMs:row.pairedDelta.allMessagesMs.median,
    pairedMedianDeltaCI95:pairedMedianCI(row.pairs.map(pair=>pair.allMessagesMs))};
});
const textGroups=summaries.filter(row=>row.recipients===70&&!row.fileBytes);
const individual=summaries.filter(row=>row.recipients===1&&!row.fileBytes);
const date=new Date(report.createdAt).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
const lines=[
'# 메시지 내용만 암호화한 송수신 성능 시험',
'',`측정 완료: ${date} (Asia/Seoul)`,
'',
'## 관찰 결과',
'',
`파일 없는 메시지의 추가 시간(각 방식의 중앙값 차이)은 개인 ${f(Math.min(...individual.map(row=>row.medianDeltaMs)))}~${f(Math.max(...individual.map(row=>row.medianDeltaMs)))} ms, 70명 모의 단체 수신 ${f(Math.min(...textGroups.map(row=>row.medianDeltaMs)))}~${f(Math.max(...textGroups.map(row=>row.medianDeltaMs)))} ms였습니다. 이 조건에서는 본문 암호화에 따른 추가 시간이 수십 ms 이내였습니다.`,
'',
'이는 특정 암호화 비용 모델과 이 PC의 로컬 송수신 시험 결과입니다. 실제 앱의 종단간 암호화 도입 완료, 화면 반응성, 학교 네트워크 성능 또는 보안성을 보장하는 결과는 아닙니다.',
'',
'## 시험 조건',
'',
'- 최대 단체 발송은 한 메시지의 수신자 70명으로 해석했습니다.',
'- 메시지 제목·본문·HTML만 추가 암호화했습니다. 별도 첨부파일은 평문 원본을 그대로 사용했습니다. 두 비교군 모두 HTTPS는 유지합니다.',
'- 실제 앱 서버를 수정 없이 별도 프로세스에서 실행하고, 합성 사용자 71명(발신자 1명 + 수신자 70명)과 별도 임시 DB를 사용했습니다.',
'- 암호화 비용 모델은 AES-256-GCM 본문 암호화 + 수신자/발신자별 X25519/HKDF 키 전달 + Ed25519 서명/검증입니다. **이 시험 코드는 제품용 종단간 암호화 구현이 아닙니다.**',
`- 각 경우 준비 ${report.results[0].warmups}쌍을 제외하고 일반 메시지 ${report.results[0].repeats}쌍, 1 MiB 첨부 포함 ${report.results.find(row=>row.fileBytes).repeats}쌍을 측정했습니다. 암호화 전후 순서를 번갈아 적용했으며 이상치를 제거하지 않았습니다.`,
'- 송신 암호화 시작 → HTTPS 업로드 → SQLite 저장 → SSE 알림 → 수신자 목록 조회 → 복호화/원문 확인까지 포함합니다. 발신자의 목록 갱신 요청도 부하에 포함합니다.',
'- 모든 수신자가 같은 PC의 하나의 Node 프로세스에서 동작합니다. **아래 70명 시간은 이 모의 시험의 마지막 수신 완료 시간이며, 70대 실제 PC의 시간은 아닙니다.**',
'',
'## 환경',
'',
`- CPU: ${report.environment.cpu} (${report.environment.logicalCpus} logical CPUs)`,
`- RAM: ${f(report.environment.totalMemoryGiB)} GiB`,
`- OS: ${report.environment.platform} ${report.environment.release} ${report.environment.arch}`,
`- Runtime: Node ${report.environment.node}; OpenSSL ${report.environment.openssl}`,
'- 네트워크: 같은 PC의 127.0.0.1, 인증서 검증 HTTPS, 연결 재사용. 초기 TLS 연결과 키 등록은 측정에서 제외.',
'',
'## 메시지 수신 완료 시간',
'',
'단위 ms. 중앙값은 반복 결과의 가운데 값, p95는 95%의 측정이 그 이내에 끝난 값입니다. 첨부파일 다운로드는 모든 수신자가 본문을 확인한 뒤 동시에 시작하도록 분리했습니다.',
'',
'| 수신자 | 본문 | 첨부 | 암호화 전 중앙값 | 암호화 후 중앙값 | 중앙값 차이 | 전 p95 | 후 p95 |',
'|---:|---:|---:|---:|---:|---:|---:|---:|'];
for(const row of report.results)lines.push(`| ${row.recipients} | ${kb(row.bodyBytes)} | ${row.fileBytes?'1 MiB':'없음'} | ${f(row.plain.allMessagesMs.median)} | ${f(row.encrypted.allMessagesMs.median)} | ${signed(row.encrypted.allMessagesMs.median-row.plain.allMessagesMs.median)} | ${f(row.plain.allMessagesMs.p95)} | ${f(row.encrypted.allMessagesMs.p95)} |`);
lines.push('','## 암호화 연산만 측정한 비용','','HTTP/DB를 제외한 별도 반복 측정입니다. 발신에는 수신자 전원과 발신자 자신의 키 처리도 포함합니다. 수신은 한 명의 서명 확인·복호화·원문 일치 확인입니다.','','| 수신자 | 본문 | 발신 중앙값(ms) | 발신 p95(ms) | 한 수신자 중앙값(ms) | 한 수신자 p95(ms) |','|---:|---:|---:|---:|---:|---:|');
for(const row of report.cryptoMicrobenchmarks)lines.push(`| ${row.recipients} | ${kb(row.bodyBytes)} | ${f(row.senderEncryptMs.median)} | ${f(row.senderEncryptMs.p95)} | ${f(row.oneReceiverDecryptMs.median)} | ${f(row.oneReceiverDecryptMs.p95)} |`);
lines.push('','## 첨부파일 포함 시험','','본문 약 10 KiB와 암호화하지 않은 1 MiB 파일을 70명에게 보냈습니다. 각 수신자가 파일까지 다운로드한 후 SHA-256 일치를 확인했습니다. 파일 원본은 서버 DB에서도 암호화되지 않았음을 확인했습니다.','','| 항목 | 암호화 전 중앙값 | 메시지만 암호화 후 중앙값 |','|---|---:|---:|');
const attached=report.results.find(row=>row.fileBytes);
for(const [label,key]of [['마지막 본문 확인(ms)','allMessagesMs'],['마지막 파일 검증(ms)','allAttachmentsMs'],['송신 승인(ms)','sendAckMs'],['서버 CPU 시간(ms)','serverCpuMs'],['모의 클라이언트 전체 CPU 시간(ms)','clientCpuMs']])lines.push(`| ${label} | ${f(attached.plain[key].median)} | ${f(attached.encrypted[key].median)} |`);
const encodingPath=path.join(path.dirname(resultPath),'encoding-control.json');
if(fs.existsSync(encodingPath)) {
  const encoding=JSON.parse(fs.readFileSync(encodingPath,'utf8'));
  lines.push('','### 첨부 시험의 음수 차이 해석','',
    '첨부 포함 시 암호화 쪽이 더 빠르게 측정되었습니다. 이를 암호화 알고리즘의 속도 개선으로 해석하지 않습니다. 현재 서버는 파일의 base64 원본과 메시지를 하나의 SQLite JSON TEXT에 저장하며, 이 시험의 암호문 봉투와 고정 제목은 ASCII인 반면 평문에는 한글이 들어 있습니다.',
    '',
    '이를 분리한 보조 시험에서 1 MiB 파일을 포함하는 JSON을 SQLite에서 70회 읽고 파싱한 뒤 첨부 메타데이터를 출력했습니다. 네트워크와 암호화 연산은 제외했습니다. 암호문 모양의 동일한 ASCII 본문에 고정 제목만 한글로 바꾼 경우에도 처리 비용이 달라졌습니다.',
    '',
    '| 보조 시험 형식 | 70회 처리 중앙값(ms) |','|---|---:|',
    `| 한글 평문 + 파일 | ${f(encoding.results.koreanPlain.medianMs)} |`,
    `| ASCII 봉투 + ASCII 제목 + 파일 | ${f(encoding.results.asciiEnvelope.medianMs)} |`,
    `| 동일 ASCII 봉투 + 한글 제목 + 파일 | ${f(encoding.results.koreanLabelEnvelope.medianMs)} |`,
    '',
    '따라서 파일 포함 측정에는 암호화뿐 아니라 서버의 문자열/JSON 처리 방식이 영향을 줍니다. 파일이 암호화되지 않았고 전송 후 동일성이 유지된다는 점은 확인했지만, 음수 차이를 제품의 성능 개선 약속으로 사용해서는 안 됩니다. 원시 값은 `encoding-control.json`에 있습니다.');
}
lines.push('','## 반복 측정 편차','','인접한 암호화 전/후 한 쌍의 차이(후−전)를 별도로 계산했습니다. 아래 신뢰구간은 같은 시험의 쌍별 차이에 대한 5,000회 부트스트랩 추정치이며 다른 PC나 LAN의 예측 구간은 아닙니다. 0을 포함하는 구간에서는 작은 속도 차이의 방향을 확정하지 않습니다. 음수 결과를 암호화가 속도를 높인다는 의미로 해석하지 않습니다.','','| 수신자 | 본문 | 첨부 | 쌍별 차이 중앙값(ms) | 추정 95% 구간(ms) |','|---:|---:|---:|---:|---:|');
for(const row of summaries)lines.push(`| ${row.recipients} | ${kb(row.bodyBytes)} | ${row.fileBytes?'1 MiB':'없음'} | ${signed(row.pairedMedianDeltaMs)} | ${signed(row.pairedMedianDeltaCI95[0])} ~ ${signed(row.pairedMedianDeltaCI95[1])} |`);
lines.push('','## 데이터량과 CPU','','본문/첨부 JSON 요청·응답의 합계이며 TLS/HTTP/SSE 헤더는 제외합니다. 현재 서버 API에 암호화 데이터를 넣는 시험 어댑터가 모든 수신자의 키 목록을 함께 전달하므로, 제품용 포맷 최적화 전의 비용입니다.','','| 수신자 | 본문 | 첨부 | 전 데이터(MiB) | 후 데이터(MiB) | 전 서버 CPU(ms) | 후 서버 CPU(ms) |','|---:|---:|---:|---:|---:|---:|---:|');
for(const row of report.results)lines.push(`| ${row.recipients} | ${kb(row.bodyBytes)} | ${row.fileBytes?'1 MiB':'없음'} | ${f(row.plain.wireBytes.median/1024**2)} | ${f(row.encrypted.wireBytes.median/1024**2)} | ${f(row.plain.serverCpuMs.median)} | ${f(row.encrypted.serverCpuMs.median)} |`);
lines.push('','## 정확성 확인과 해석 한계','',
'- 모든 회차에서 모든 수신자의 원문 일치와 발신자의 보낸 메시지 복원을 확인했습니다.',
'- 잘못된 수신자/메시지 ID/키 및 변조된 내용의 거부를 확인했습니다. 이는 기본 시험이며 종단간 암호화의 보안 검증 전체를 대신하지 않습니다.',
'- 파일 포함 회차는 모든 수신자의 파일 해시와 서버의 원본 저장 여부를 확인했습니다.',
'- 실제 70대 PC, 학교 LAN, Electron 화면/IPC, PC의 영구 보관함, 장기 메시지 이력, 초기 키 등록·교체·복구, 예약 발송과 자동 일정 추출은 이 측정에 포함하지 않았습니다.',
'- Node의 이벤트 루프·메모리 수치로 실제 앱의 화면 반응성을 판정하지 않습니다. 실제 앱 UI 시험은 별도입니다.',
'- 수신 후 서버 본문 삭제와 파일 10일 보관 정책은 이번에 구현하지 않았습니다. 앱의 기존 송수신·저장 코드는 그대로입니다.',
'- 첨부파일을 암호화하지 않으므로 서버 운영자는 서버에 남아 있는 파일 원본을 읽을 수 있습니다.',
'',
'## 재현','',
'프로젝트 루트에서:',
'',
'```powershell',
'node resources/app/benchmarks/message-crypto/run.cjs --repeats=30 --warmups=5 --output=.artifacts/message-crypto-benchmark/results.json',
'node resources/app/benchmarks/message-crypto/encoding-control.cjs',
'node resources/app/benchmarks/message-crypto/report.cjs .artifacts/message-crypto-benchmark/results.json',
'```','',
'원시 결과는 같은 폴더의 `results.json`, 시험 방식은 `resources/app/benchmarks/message-crypto/README.md`에 있습니다.','',
'## 소스 식별값','',
'```text',...hashes.map(row=>row.sha256+'  '+row.file),'```','');
fs.writeFileSync(reportPath,lines.join('\n'));
fs.writeFileSync(path.join(path.dirname(resultPath),'summary.json'),JSON.stringify({resultPath,reportPath,checks:report.checks,summaries,sourceHashes:hashes},null,2)+'\n');
console.log(JSON.stringify({reportPath,environment:report.environment,summaries,micro:report.cryptoMicrobenchmarks.map(row=>({recipients:row.recipients,bytes:row.bodyBytes,encrypt:row.senderEncryptMs.median,decrypt:row.oneReceiverDecryptMs.median})),attachment:{plain:attached.plain.allAttachmentsMs,encrypted:attached.encrypted.allAttachmentsMs}},null,2));
