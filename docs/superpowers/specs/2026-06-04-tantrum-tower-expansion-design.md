# Tantrum Tower — 확장 스토리 로드맵 & 설계서

- **작성일:** 2026-06-04
- **상태:** S1–S6 구현·머지 완료 (프로덕션 배포). 남은 스토리: **S7 오디오/보이스**(사용자 "나중에" 보류).
- **유형:** Tantrum Tower(5번째 게임) 확장 — v1 위에 시스템·깊이·현실감 추가
- **기반:** v1 = PR #13 (`feat/construction-management-game`). 이 확장은 v1 코드 위에 쌓는다.
- **운영 방식:** 이 문서가 **"스토리 파일"(살아있는 로드맵)** 이다. 전체 스토리를 §1 표로 관리하고, **한 스토리씩** 상세 설계 → 구현(각 스토리 = 자체 plan + 실행). 스토리 완료 시 §1 상태를 갱신한다.

---

## 0. 비전

v1의 "양날의 검" 코어는 좋다(컨셉 승인됨). 다만 ① **난이도 관리**가 필요하고, ② 관리의 **깊이**(경제·AI 관리자 고용), ③ **다중 건물**, ④ **공사장다운 현실감**(인부다운 외형·소품·온라인 CC0 에셋), ⑤ **오디오/보이스**가 빠져 있다. 이 확장은 이들을 **독립적이고 검증 가능한 스토리**로 쪼개 순차 구현한다. 원칙은 v1과 동일: **빌드리스(glTF) 유지 · CC0만 커밋 · 순수 로직은 THREE-free로 단위 테스트 · 한 스토리씩 완성**.

---

## 1. 스토리 로드맵 (관리 표)

| ID | 스토리 | 상태 | 우선 | 의존 |
|---|---|---|---|---|
| **S1** | 경제 & 인건비 (자금 획득·관리자 월급 지출) | ✅ 완료 | ★ 1 | feat/tantrum-tower-expansion |
| **S2** | AI 관리자 4종 고용 (개성·자동 관리·외형 차별화) | ✅ 완료 | ★ 1 | feat/tantrum-tower-expansion |
| **S3** | 난이도 모드(Easy/Normal/Hard) + 관리자 레버 | ✅ 완료 | ★ 1 | feat/tantrum-tower-expansion |
| **S4** | 다중 건물 (단일 현장 → 여러 건물 순차) | ✅ 완료 | 2 | S1·S3 |
| **S5** | 에셋 패스 (CC0 인부/관리자 4종 + 공사장 소품) | ✅ 완료 | 2 | S2 |
| **S6** | 부가 요소 — **랜덤 현장 이벤트**(§5.2) | ✅ 완료 | 3 | S1 |
| **S7** | 오디오 & 보이스 (SFX + 캐릭터 TTS) | 🔒 방향 확정(§4) — 사용자 "나중에" 보류 | 3 | S2 |

**첫 구현 묶음 = S1+S2+S3** (경제 + AI 관리자 + 난이도). 이 셋이 "난이도 관리"를 직접 해결하며 서로 의존한다. 관리자 외형은 이 단계에서 **구분되는 임시 외형(색/헬멧/소품)** 으로 차별화하고, 실제 Quaternius 모델은 **S5**에서 교체한다(S2는 S5에 막히지 않는다).

> 범례: 📋 설계됨(plan 작성 가능) · 🔒 방향 확정(에셋/기술 선택 잠금) · ✏️ 스케치(추후 상세 설계) · ✅ 완료

---

## 2. 첫 스토리 상세 설계 — S1+S2+S3

v1 구조를 그대로 따른다: THREE-free 순수 로직(`public/construction-game/src/logic/`)은 Vitest로 단위 테스트, 엔진/UI는 브라우저·Playwright로 검증. v1의 `config.js` 난이도 시드(§6.7)를 확장한다.

### 2.1 경제 & 인건비 (S1)

- **통화:** 자금(₩). HUD에 잔액 + 페이롤(₩/초) 표시.
- **수입:** **층 완공마다** 보상 지급(`floorReward`), 건물 완공 시 보너스. (단일 건물 MVP에선 층 보상이 주 수입.)
- **지출:** AI 관리자 **고용비(1회)** + **월급(매초 차감)**. 일꾼은 **무임금**(핵심 루프를 가혹하게 만들지 않음).
- **압박(가벼움):** 잔액이 음수가 되면 페이롤을 못 막아 **관리자 자동 해고**(월급이 가장 비싼 관리자부터 1명, 해고 쿨다운 3초)로 페이롤을 줄인다. **즉시 패배 아님** — 난이도 완화 의도에 부합. (Hard에선 더 빡빡한 보상/시작자금으로 압박↑.)
- **순수 로직 `logic/economy.js`:**
  - `createEconomy(startFunds)` → `{ funds, payrollPerSec }`
  - `earn(econ, amount)` · `spend(econ, amount) → bool(가능여부)`
  - `tickPayroll(econ, managers, dt)` → 잔액 차감, 부족 시 해고 대상 반환(엔진이 실제 해고)
  - `canAfford(econ, cost) → bool`
- **승패 영향:** 자금은 패배 조건이 아니다(v1 그대로: 목표 층/시간/인력붕괴). 자금은 "관리자를 얼마나 운영하느냐"의 자원일 뿐.

### 2.2 AI 관리자 4종 (S2)

플레이어가 자금으로 고용하는 **개성 있는 관리자 캐릭터**. 저마다 동작·비용·외형·코믹 퀴크가 달라 **상황별 조합 고용**이 전략이 된다. 관리자는 v1의 `applyTactic`/`rage` 로직을 재사용해 자동으로 일꾼을 관리한다.

| 관리자 | 자동 동작 | 고용비 / 월급 | 외형 차별화 (임시 → Quaternius) | 퀴크 |
|---|---|---|---|---|
| 🧓 **김 베테랑** (만능) | 순찰 + **자동 달래기**(넓은 반경), 빡침 억제 | 중 / 중 | 회색 헬멧·차분한 색 → 정장/조끼 | 가끔 "라떼" 훈수로 잠깐 멈춤 |
| 🪖 **박 군기** (고효율 고위험) | **자동 윽박**(좁은 반경), 생산성↑↑·담당 빡침↑ | 높음 / 높음 | 빨강·각진 군용 → 군복/전술 | 다혈질에게 쓰면 폭발(반란) 유발 위험 |
| 😎 **이 인싸** (패시브) | 반경 내 **빡침 자연감소 가속 + 농땡이 전환 지연**(직접 시비 약함) | 중 / 중하 | 화려한 색 → 후드+밝은 팔레트 | 본인도 수다로 가끔 흐름 끊김 |
| 🧑‍🎓 **최 인턴** (가성비) | 느린 자동 달래기, 좁은 반경, **가끔 놓침**(실수) | 낮음 / 낮음 | 후줄근·민무늬 → 후줄근 복장 | 본인도 가끔 폰 봄(폐급 기질) |

- **외형 차별화 원칙:** 효과가 **겉모습으로 즉시 읽혀야** 한다(색/헬멧/소품/실루엣). 임시 외형도 4종이 한눈에 구분되게(예: 헬멧 색 + 보디 색 + 작은 소품). S5에서 Quaternius 복장 변형으로 교체.
- **엔진 `entities/Manager.js`:** 아바타(임시 프리미티브 → 모델) + 순찰 이동 + 쿨다운마다 반경 내 대상 선정 → `applyTactic`(아키타입별 전술). 인싸는 패시브 버프(시비 안 함). 인턴은 확률적 실패.
- **순수 로직 `logic/managers.js`:**
  - `MANAGER_ARCHETYPES` (위 표 파라미터: tacticId/radius/cooldown/hireCost/salary/successRate/passive)
  - `pickManagerTarget(manager, workers) → workerIndex|null` (반경·상태 기준 대상 선정, 결정적·테스트 가능)
  - `managerTickPassive(manager, workers, dt)` (인싸 버프 적용: rage 감소 가속 등)
- **고용 UI `ui/HireMenu.js`:** 관리자 카드(이름·효과·고용비·월급·퀴크) + 고용 버튼 + 현재 페이롤. v1 메뉴 톤 재사용. 자금 부족 시 비활성.

### 2.3 난이도 모드 + 관리자 레버 (S3)

- **모드 선택:** 시작 메뉴에서 Easy/Normal/Hard. 선택 시 v1 `config.js`에 **난이도 변형(override)** 적용.
- **`logic/difficulty.js`:** `DIFFICULTY_MODES = { easy, normal, hard }`, `applyDifficulty(config, mode) → config` (순수 병합). 초기값:

| 항목 | Easy | Normal | Hard |
|---|---|---|---|
| 일꾼 수 | 6 | 8 | 10 |
| 교대 시간(초) | 240 | 180 | 150 |
| 목표 층수 | 4 | 5 | 6 |
| 빡침 자연감소 | ×1.3 | ×1.0 | ×0.8 |
| 농땡이 빈도 | ×0.8 | ×1.0 | ×1.25 |
| 시작 자금(₩) | 6000 | 4000 | 2500 |
| 층 보상(₩) | 1500 | 1000 | 700 |

- **동적 레버:** AI 관리자 고용이 게임 중 난이도를 낮추는 주 수단. 모드는 출발선, 관리자는 운영 중 조절.
- **확장 seam:** 모드 = config 변형(v1 §6.7 그대로). 레벨/엔드리스도 동일 메커니즘.

### 2.4 튜닝 가능 상수 (초기값, `config.js`로 노출)

| 상수 | 초기값 |
|---|---|
| 층 보상 / 건물 완공 보너스 | 모드별(위) / +2000 |
| 베테랑 고용비·월급·반경·쿨다운 | 1200 · 6/s · 7 · 2.5s |
| 군기 고용비·월급·반경·쿨다운 | 2000 · 12/s · 4.5 · 2s |
| 인싸 고용비·월급·반경 | 1000 · 5/s · 8 (패시브) |
| 인턴 고용비·월급·반경·성공률 | 500 · 3/s · 4 · 70% |
| 관리자 상한 | 6명(성능·밸런스) |
| 적자 시 해고 쿨다운 | 1명 / 3초 |

### 2.5 코드 영향 요약 (S1–S3)

- **신규 순수 로직:** `economy.js`, `managers.js`, `difficulty.js` (+ 각 단위 테스트 `__tests__/unit/construction-game/`)
- **신규 엔진/UI:** `entities/Manager.js`, `ui/HireMenu.js`; HUD에 자금/페이롤; 메뉴에 난이도 선택
- **수정:** `main.js`(경제·관리자·난이도 와이어링), `config.js`(보상·관리자·난이도 상수), `index.html`/`style.css`(자금 HUD·고용 UI·모드 선택 DOM)
- **재사용:** `applyTactic`·`rage`·`workerState`·`production`·`scoring`·`DioramaCamera` 등 v1 전부
- **CI:** 기존 eslint ignore/vitest include 범위가 `public/construction-game/**`라 신규 파일 자동 포함. e2e는 자금 HUD·고용 UI·모드 선택 스모크 추가.

---

## 3. 🔒 에셋 방향 확정 (S5 실행 시 사용)

**원칙:** CC0 우선 커밋 · glTF(.glb) 런타임 · **네이티브 GLB 우선**, FBX 전용 팩은 **1회 오프라인 Blender→.glb 변환** 후 변환본만 커밋(원본 FBX는 미커밋). v1 `AssetLoader`(폴백 안전)와 PS2 셰이더로 톤 통일.

- **캐릭터(인부+관리자 4종 베이스):** **Quaternius — Ultimate Modular Men** (CC0, glTF, 모듈식·단일 스켈레톤) — https://quaternius.com/packs/ultimatemodularcharacters.html · 안전모 인부(CC0) https://poly.pizza/m/Yg2bQZO6Hj . 관리자 4종은 복장/색/소품 변형으로 차별화(정장=베테랑·군용=군기·후드밝은색=인싸·후줄근=인턴).
- **공사장 소품:**
  - LowPolyAssets — Low Poly Construction Pack (CC0, FBX→변환) — https://lowpolyassets.itch.io/low-poly-construction-pack (크레인·비계·믹서·펜스·포터포티·자재 ~80%)
  - Majadroid — 3D House Construction Site (CC0, FBX→변환) — https://majadroid.itch.io/3d-house-construction-site (시공중 건물+계단·크레인2·트럭·컨테이너)
  - Kenney — City Kit Industrial / Roads(펜스·바리케이드) / Building Kit (CC0, **네이티브 GLB**) — https://kenney.nl/assets/city-kit-industrial · /city-kit-roads · /building-kit
  - Poly Pizza — construction (개별 GLB; 불도저·안전모·시멘트블록=Public Domain, Quaternius 펜스 CC0) — https://poly.pizza/search/construction
- **⛔ 커밋 금지:** Mixamo 원본 · Sketchfab CC-BY/"free"(비-CC0) · 라이선스 불명(ithappystudios 403).
- `assets/CREDITS.md`에 작자·라이선스·출처 URL 기록.

## 4. 🔒 오디오/보이스 방향 확정 (S7 실행 시 사용)

- **SFX:** CC0 — Kenney Impact/UI Audio (https://kenney.nl/assets/impact-sounds, /ui-audio) · OpenGameArt 100 CC0 SFX#2 (https://opengameart.org/content/100-cc0-sfx-2) · 기존 런타임 Web Audio 합성 + **직접 구현한 도구**(audio.devmanage.duckdns.org — 로컬/로그인 추정으로 외부 fetch는 불가, 사용 가능한 SFX 생성원으로 가정; 사용 시 출력물 라이선스/접근 확인 필요).
- **캐릭터 보이스(TTS, 단계적):**
  - 1단계(프로토): 브라우저 `speechSynthesis`(ko-KR, 무료·에셋0, 기기별 한국어 음성 편차 — 런타임 `getVoices()` 확인 + 폴백 필요).
  - 2단계(폴리시): **MeloTTS-Korean**(MIT·로컬·무료) 또는 **Google Cloud TTS**(무료 1M자/월, ko-KR Neural2) 로 ~40–60개 라인 **오프라인 사전 생성 → OGG 커밋**, 캐릭터별 `playbackRate` 피치 변조로 4종 구분. (ElevenLabs는 품질 최상이나 유료/상업권 주의.)
- **빌드리스 정합:** 오디오 파일은 커밋 또는 런타임 생성. 라이선스는 CC0/생성물 소유 기준.

---

## 5. 나머지 스토리 스케치

### 5.1 S4 — 다중 건물
단일 현장 → 여러 건물. 순차(하나 완공 후 다음) 또는 동시(여러 진척 동시 관리). 건물별 진척/인력 배치, 관리자 구역 배치와 연계. `world/Building.js`를 다중 인스턴스로 일반화, `production`을 건물별로. 난이도/캠페인과 결합 가능. (상세 설계는 S1–S3 완료 후.)

### 5.2 S6 — 랜덤 현장 이벤트 (✅ 구현 완료)
후보(자재/보급·사고·업그레이드·사기·날씨) 중 **YAGNI**로 **"랜덤 현장 이벤트"** 하나만 선별·구현. ~30초마다(±변량) 이벤트가 발생해 게임에 변주와 가벼운 난이도 출렁임을 준다. **좋은 이벤트 비중을 높여(좋음 6 > 나쁨 4)** 가혹하지 않게 유지 — 이 불변식은 단위 테스트로 고정.

| 이벤트 | 종류 | 효과 | 가중치 |
|---|---|---|---|
| 🍱 **새참 타임!** | 좋음 | 전원 빡침 −22 + 생산 ×1.4 (6초) | 3 |
| 📦 **자재 보급 도착** | 좋음 | 자금 +600 + 생산 ×1.3 (6초) | 3 |
| 🛡️ **안전 점검** | 중립 | 자금 +800 | 2 |
| 🔧 **장비 고장** | 나쁨 | 생산 ×0.5 (14초) | 2 |
| ⚠️ **낙하 사고!** | 나쁨 | 랜덤 일꾼 1명 빡침 +35 | 2 |

- **순수 로직 `logic/events.js` (THREE-free·단위 테스트):** `SITE_EVENTS`(위 카탈로그) + `pickEvent(rng)`(가중 랜덤, 결정적 — `mulberry32` 주입). 좋음>나쁨 불변식·경계값·재현성·전 이벤트 도달을 `events.test.ts`(5 케이스)로 검증.
- **`config.js`의 `events` 블록:** 간격(30±12s)·최초 지연(18s)·각 이벤트 수치(전부 튜닝 가능 상수).
- **`main.js` 와이어링:** `startGame`에서 이벤트 상태 6필드 초기화(재시작 위생 — 재플레이 시 진행 중 배수/타이머 누수 방지). `game.step`에서 배수 타이머 감쇠(만료 시 정확히 1로 복원, 누적 아닌 **설정**) → 타이머 만료 시 `pickEvent`→`applyEvent`→간격 리셋. 생산량에 `_eventProdMult * _eventBoostMult` 적용. 발생 시 토스트(아이콘+라벨) + 오디오(좋음=`combo`/나쁨=`alarm`). 모든 무작위는 별도 시드 스트림(`seed+777`)으로 e2e 비교란.
- **검증:** 단위 50/50·e2e 3/3·lint·type-check 그린; 라이브 실행에서 4종(🔧·⚠️·📦·🛡️) 실제 발생·경제 반영·콘솔 에러 0 확인.

---

## 6. 비범위 · 원칙

- 한 번에 전부 구현하지 않는다 — **스토리 단위**로 완성·검증·커밋.
- **빌드리스 유지**(importmap glTF), **CC0만 커밋**, 순수 로직 THREE-free 단위 테스트, v1 패턴 준수.
- 자금은 **패배 조건 아님**(난이도 완화 의도). 관리자는 **돕는** 시스템이지 새 실패원이 아니다.
- 멀티플레이어/넷코드 미포함(seam만 유지).

---

## 부록 — 출처 URL (요약)
- 캐릭터: Quaternius Ultimate Modular Men, Poly Pizza Worker(CC0)
- 소품: LowPolyAssets 건설팩, Majadroid 공사현장, Kenney City Kit(Industrial/Roads/Building), Poly Pizza construction
- 오디오: Kenney Impact/UI, OpenGameArt 100 CC0 SFX#2, MeloTTS-Korean(HF), Google Cloud TTS, MDN Web Speech API
- ⛔ 비-CC0/커밋금지: Mixamo, Sketchfab CC-BY, ithappystudios(미확인)
