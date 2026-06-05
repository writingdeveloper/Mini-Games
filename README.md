# 🎮 Mini Games Hub

여러 브라우저 게임을 한곳에서 즐기는 게임 허브입니다. **Next.js 프론트엔드 + 독립 Socket.io 멀티플레이어 서버**로 구성된 풀스택 프로젝트로, 서로 다른 4개의 렌더링 엔진(2D Canvas / Babylon.js / CesiumJS / Three.js)으로 만든 게임을 제공합니다.

[![CI](https://github.com/writingdeveloper/Mini-Games/actions/workflows/ci.yml/badge.svg)](https://github.com/writingdeveloper/Mini-Games/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

> **🔗 라이브 데모:** https://mini-games-dun.vercel.app

---

## 📸 스크린샷

> _아래에 각 게임의 스크린샷/GIF를 추가하세요. 포트폴리오에서 가장 효과가 큰 부분입니다._

<!--
| 메인 허브 | 도주 게임 | 서바이벌 | Sky Explorer |
|---|---|---|---|
| ![hub](docs/hub.png) | ![escape](docs/escape.png) | ![survival](docs/survival.png) | ![flight](docs/flight.png) |
-->

---

## ✨ 주요 특징

- **풀스택 실시간 멀티플레이어** — Socket.io 기반 룸 매칭/로비 시스템과 권위 서버(authoritative server) 구조
- **4개의 독립 게임 엔진** — 2D Canvas, Babylon.js(3D), CesiumJS(실제 지구본), Three.js(로우폴리 3D) 통합
- **모노레포 구조** — Next.js 앱과 게임 서버를 한 저장소에서 관리, 각각 독립 배포
- **테스트 & CI** — Vitest 단위/통합 테스트 + Playwright E2E + GitHub Actions 자동화
- **타입 안전성** — TypeScript, ESLint, Prettier 일관 적용

---

## 🕹️ 게임 목록

### 🚗 도주 게임 (Escape)

- HTML5 Canvas 기반 2D 게임
- 경찰차로부터 자동차를 조종해 도주
- **2–4인 경쟁 멀티플레이어** (실시간)
- 방향키 조작 · 점수 시스템

### 🌍 3D 서바이벌 (Survival)

- Babylon.js 기반 3D 오픈 월드 + Havok 물리 엔진
- 서바이벌 시스템 (체력 · 스태미나 · 배고픔 · 갈증)
- 캐릭터 커스터마이징 · 낮/밤 사이클 · 탈것
- **2–4인 협동 멀티플레이어** (실시간)
- WASD 이동 · 마우스 시점

### ✈️ Sky Explorer (비행)

- CesiumJS 기반 3D 비행 시뮬레이터 (실제 위성 지도 위 비행)
- 6개 도시 시작 위치 (서울 · 뉴욕 · 파리 · 도쿄 · 두바이 · 시드니)
- 3가지 모드 (자유 비행 · 체크포인트 레이스 · 서바이벌)
- 리얼한 비행 물리 (양력 · 항력 · 스톨) + HUD (속도/고도/연료/나침반)
- 조작: `W/S` 피치 · `A/D` 롤 · `Q/E` 요 · `Shift/Ctrl` 스로틀
- > _현재 싱글플레이어. 멀티플레이어 넷코드는 소스(`public/flight-game/src/`)에 구현되어 있으며 런타임 통합은 로드맵 참고._

### 🏜️ Dust Drifter (사막 자유 주행)

- Three.js 기반 3D 로우폴리 사막 오픈 월드 (싱글플레이어)
- 자유 주행 + 신기루 탐험(7) + 빛나는 수집물(20) + 낮↔밤 순환
- 먼지 파티클 드리프트 · 듄 빅에어 · 3인칭/하늘뷰 카메라
- 빌드 없는 자체완결형 ESM (Three.js를 importmap CDN으로 로드)
- 조작: `↑↓←→`/`WASD` 주행 · `Space` 드리프트 · `C` 카메라 · `R` 리셋

### 🏗️ Tantrum Tower (건설 관리)

- 막장 건설 현장에서 폐급 일꾼들을 다그쳐 마감 전에 탑을 올리는 코미디 관리 게임
- 빌드리스 Three.js 0.184 + PS2 레트로 셰이더 + Web Audio (진동음/외침/콤보/층완공/경보)
- 일꾼 AI (일함/태업/사보타주/폭동/탈주) · 대치 시스템 · 신상필벌 콤보
- 싱글플레이어 (`/construction-game`)

---

## 🏗️ 아키텍처

프론트엔드(Vercel)와 게임 서버(컨테이너)를 분리해, 정적 게임은 CDN에서 서빙하고 실시간 통신만 WebSocket으로 처리합니다.

```
┌─────────────────────────┐         WebSocket (WSS)        ┌──────────────────────────┐
│   Vercel — Frontend      │  <───────────────────────────> │  Game Server (Docker)     │
│   Next.js + 정적 게임     │         Socket.io              │  Node.js + Socket.io      │
│   (App Router, iframe)   │                                │  ├─ LobbyManager / Room   │
└─────────────────────────┘                                │  ├─ GameSession (게임별)   │
            │                                               │  └─ SocketManager         │
   각 게임은 /public 에서                                     └──────────────────────────┘
   정적으로 서빙되고,                                          룸 매칭 · 권위 상태 동기화
   멀티플레이어 시 동적으로
   socket.io-client 로드
```

- **클라이언트 공유 코드** (`public/shared/`): `GameClient`(Socket.io 래퍼), `StateBuffer`/`InputBuffer`(보간·예측), `LobbyUI`
- **서버** (`server/`): 룸 코드 생성·매칭, 게임별 세션 로직(`escape`/`flight`/`survival`), 핑/연결 관리, `/health` 엔드포인트
- 멀티플레이어가 필요할 때만 클라이언트가 서버에서 `socket.io-client`를 동적 로드하므로, 싱글플레이는 서버 없이 동작

---

## 🛠️ 기술 스택

| 영역         | 기술                                 |
| ------------ | ------------------------------------ |
| 프레임워크   | Next.js 16 (App Router) · React 19   |
| 언어         | TypeScript 5                         |
| 스타일       | Tailwind CSS 4                       |
| 게임 엔진    | HTML5 Canvas · Babylon.js · CesiumJS · Three.js |
| 멀티플레이어 | Socket.io (서버/클라이언트)          |
| 서버         | Node.js · better-sqlite3 · Docker    |
| 테스트       | Vitest · Playwright                  |
| CI/CD        | GitHub Actions · Vercel              |

---

## 🚀 시작하기

### 사전 준비

- Node.js 20+
- (선택) [Cesium Ion 토큰](https://cesium.com/ion/tokens) — 비행 게임의 3D 지도용 (무료)

### 1. 설치

```bash
git clone https://github.com/writingdeveloper/Mini-Games.git
cd Mini-Games
npm install
```

### 2. 환경 변수 (선택)

토큰 없이도 허브와 도주·서바이벌 게임은 정상 동작합니다. 비행 게임 지도와 멀티플레이어를 사용하려면 프로젝트 루트에 `.env.local`을 만드세요 ([.env.example](./.env.example) 참고):

```bash
# 비행 게임 3D 지도용 (https://cesium.com/ion/tokens)
CESIUM_TOKEN=your_cesium_ion_token_here

# 멀티플레이어 서버 주소 (미설정 시 멀티플레이어 버튼 비활성화)
NEXT_PUBLIC_GAME_SERVER_URL=https://your-game-server.example.com
```

### 3. 개발 서버

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속.

### 4. 빌드 / 프로덕션

```bash
npm run build   # 정적 빌드
npm start       # 프로덕션 실행
```

### 멀티플레이어 서버 실행 (선택)

```bash
cd server
npm install
npm run dev     # 개발 (tsx watch)
# 또는 Docker
docker compose up -d --build
```

자세한 배포 가이드는 [`server/DEPLOY.md`](./server/DEPLOY.md) 참고.

---

## 🧪 테스트

```bash
npm run test          # Vitest 단위 + 통합 테스트
npm run test:coverage # 커버리지 리포트
npm run test:e2e      # Playwright E2E
npm run lint          # ESLint
npm run type-check    # TypeScript 타입 검사
```

CI(`.github/workflows/ci.yml`)에서 push/PR 시 lint · type-check · 단위 테스트 · E2E · 서버 검증을 자동 실행합니다.

---

## 📁 프로젝트 구조

```
Mini-Games/
├── app/                       # Next.js App Router
│   ├── page.tsx               # 메인 허브 페이지
│   ├── layout.tsx             # 루트 레이아웃
│   ├── error-boundary.tsx     # 게임 로드 에러 처리
│   ├── escape-game/page.tsx   # 도주 게임 라우트 (모드 선택)
│   ├── survival-game/page.tsx # 서바이벌 라우트 (모드 선택)
│   ├── flight-game/page.tsx   # 비행 게임 라우트
│   └── desert-game/page.tsx   # Dust Drifter 라우트
├── public/
│   ├── escape-game/           # 2D Canvas 게임
│   ├── survival-game/         # Babylon.js 3D (game-modular.js + src/)
│   ├── flight-game/           # CesiumJS 3D (game.js + src/)
│   ├── desert-game/           # Three.js 3D 로우폴리 (src/ ESM, importmap)
│   └── shared/                # 멀티플레이어 공유 클라이언트
│       ├── networking/        # GameClient · State/InputBuffer · MessageTypes
│       └── lobby/             # LobbyUI
├── server/                    # Socket.io 멀티플레이어 서버 (TypeScript)
│   ├── src/
│   │   ├── index.ts           # 서버 엔트리 + /health
│   │   ├── lobby/             # LobbyManager · Room · RoomCodeGenerator
│   │   ├── games/             # escape / flight / survival 게임 세션
│   │   └── network/           # SocketManager · MessageTypes
│   ├── Dockerfile
│   └── docker-compose.yml
├── __tests__/                 # Vitest 단위/통합 테스트
├── e2e/                       # Playwright E2E 테스트
├── scripts/                   # 빌드 시 환경변수 주입 스크립트
└── .github/workflows/ci.yml   # CI 파이프라인
```

---

## 🗺️ 로드맵

- [ ] 비행 게임(Sky Explorer) 멀티플레이어 런타임 통합
- [ ] 게임별 스크린샷/GIF 추가
- [ ] 모바일 터치 조작 지원

---

## 📄 라이선스

[MIT](./LICENSE) © 2026 Si Hyeong Lee
