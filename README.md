# 띵동 학교 메신저

교내 네트워크에서 사용하는 Windows용 메신저입니다. 같은 소스에서 교직원용 클라이언트와 교내 서버를 각각 빌드합니다. 앱 소스, 테스트, 버전별 변경 기록은 `resources/app`과 `READ-ME.txt`에 있습니다.

## 새로 복제한 PC에서 준비하기

1. Windows x64 개발 PC에 Node.js 24와 npm을 준비합니다.
2. 저장소 루트의 `version` 파일에 적힌 버전과 일치하는 Electron Windows x64 배포본을 풉니다. 그 안의 `electron.exe`를 `Dingdong.exe`로 이름을 바꾸고, 실행 파일과 런타임 파일들(DLL, 언어 파일, 라이선스 등)을 이 저장소 루트에 같은 구조로 둡니다. 앱 소스는 `resources/app`에 둡니다. [Electron 44.7.0 공식 배포 파일](https://github.com/electron/electron/releases/tag/v44.7.0)
3. 저장소 루트에서 다음 명령을 실행합니다.

```powershell
cd resources/app
npm ci
node scripts/build-windows.cjs client --check
npm run build:windows-client
npm run build:windows-server
```

생성된 클라이언트용·서버용 ZIP은 `dist`에 있습니다. 개발 폴더에서는 루트의 `START-CLIENT.cmd`, `START-SERVER.cmd`, `START-DEMO.cmd`로 역할을 선택해 실행할 수 있습니다. [배포 안내](resources/app/DEPLOYMENT.md)
