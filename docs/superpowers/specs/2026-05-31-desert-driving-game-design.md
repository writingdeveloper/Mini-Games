# Dust Drifter — 사막 자유 주행 게임 설계서

- **작성일:** 2026-05-31
- **상태:** 승인됨 (구현 계획 대기)
- **유형:** Mini Games Hub 신규 게임 (4번째)
- **가제:** **Dust Drifter** (황혼의 사막을 떠도는 자유 주행)

---

## 1. 비전

황금빛 로우폴리 사막을 자유롭게 질주하는 **평온한 분위기 드라이빙 게임**. 강제 목표·실패·경쟁이 없고, **지평선의 빛이 끊임없이 "저기 가볼까?"를 속삭이는** 평온하지만 끌리는 경험이 핵심 주제다. Mini Games Hub의 첫 Three.js 게임이며, "단순하지만 매력적인"을 지향한다.

핵심 가치: ① 운전 그 자체의 손맛, ② 먼지의 시각적 황홀경, ③ 발견의 잔잔한 성취감.

## 2. 핵심 게임플레이 루프

```
지평선의 빛기둥 발견  →  그쪽으로 질주 (듄 오르내림·먼지 휘날림)
      ↑                              ↓
 새 빛기둥이 시선을 끔  ←  도달! 점등 + 발견 카운트     가는 길에 수집물·점프 램프
                          + 짧은 카메라 연출           (드리프트·빅에어 손맛)
```

플레이어는 매 순간 **(a) 다음 신기루로 가는 길의 운전 손맛**과 **(b) 도달의 작은 성취**를 번갈아 맛본다. 랜드마크 7개를 모두 발견하면 부드러운 축하 연출("오늘의 사막 일주 완료") — 단, 이후로도 자유롭게 계속 달릴 수 있다(소프트 완료, 하드 엔딩 아님).

## 3. 기능 상세

| # | 기능 | 동작 |
|---|---|---|
| ① | **신기루 탐험** | 맵에 7개 랜드마크(거대 석상·오아시스·아치·고탑 등)를 배치. 미발견은 **빛기둥**으로 표시. 일정 반경 안에 진입하면 **점등 + "발견 N/7" 증가 + 짧은 카메라 연출**. HUD에 가장 가까운 미발견 신기루의 방향·거리 표시. |
| ② | **먼지 & 빅에어 손맛** | 가속·드리프트 시 바퀴 뒤로 GPU 파티클 먼지가 노을빛 받으며 피어오름. 듄 램프에서 점프 시 **공중 슬로모 + 착지 먼지 폭발**. `Space`=핸드브레이크 드리프트(접지력 감소). |
| ③ | **빛나는 수집물** | 듄 곳곳에 떠 있는 빛나는 수정 20개. 닿으면 경쾌한 "팅!" + 카운트. 일부는 빅에어로만 닿는 위치에 배치해 손맛과 연결. |
| 🌇 | **동적 시간대** | 낮→노을→밤→여명 자동 순환(기본 주기 약 4분). 태양 위치·하늘색·그림자·먼지 발색이 실시간 변화. 밤에는 별 + 차량 헤드라이트. |
| 🎥 | **카메라** | 기본 3인칭 추적(속도 비례 흔들림·FOV 줌). `C`로 하늘뷰(드론) 전환 토글. |
| 🔊 | **사운드** | 엔진음(속도 비례 피치), 바람, 수집 "팅!", 발견 팡파르. Web Audio API로 경량 구현(외부 에셋 없이 합성 또는 소형 샘플). |

## 4. 조작 (키보드 전용)

| 키 | 동작 |
|---|---|
| `↑`/`W` | 가속 |
| `↓`/`S` | 감속·후진 |
| `←→`/`A` `D` | 조향 |
| `Space` | 핸드브레이크(드리프트) |
| `C` | 카메라 전환 (3인칭 ↔ 하늘뷰) |
| `R` | 차량 리셋(뒤집힘/이탈 복구) |
| `Esc` | 일시정지 |

## 5. 아트 디렉션

- **스타일:** 로우폴리 스타일라이즈드(flat-shaded). 각진 면 처리, 선명한 따뜻한 색. *Alto's Odyssey / Art of Rally* 감성.
- **팔레트:** 황금빛 노을 기준 — 하늘 `#ffd98a→#ff9d57→#f0703e→#9c4f6a`, 모래 `#f4a85e / #e07f3c / #c4632c / #9e4a24`. 시간대별로 동적 보간.
- **차량:** 단순 박스+바퀴 로우폴리 모델(코드 생성). 외부 GLB 불필요.

---

## 6. 기술 아키텍처

### 6.1 Three.js 로딩 — 빌드 불필요

npm 의존성 추가 없이 **importmap + jsdelivr CDN**으로 로드한다(기존 survival=Babylon CDN, flight=Cesium CDN 패턴과 동일, Next.js 번들 불변).

```html
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@<PIN>/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@<PIN>/examples/jsm/"
}}
</script>
<script type="module" src="./src/main.js"></script>
```

`<PIN>`은 구현 시점의 최신 안정 릴리스로 고정한다(검증 후 단일 버전 사용, 예: `three@0.180.0`). main 라이브러리와 addons는 **반드시 동일 버전·동일 CDN**을 사용한다.

### 6.2 언어·빌드 정책

**바닐라 ES 모듈(.js), 빌드 단계 없음.** 근거: `tsconfig.json`이 `public/`을 type-check에서 제외하므로 `.ts`의 타입 안전 이득이 없고, 브라우저 직접 실행에는 오히려 빌드가 필요해진다. 빌드 없는 순수 ESM이 자체완결형 게임에 가장 단순하고 권장된다.

### 6.3 파일 구조

```
app/desert-game/page.tsx              # Next 라우트: 전체화면 iframe + 홈 버튼
public/desert-game/
├── index.html                        # importmap, <canvas>, 메뉴/HUD DOM
├── style.css
└── src/
    ├── main.js                       # 부트스트랩 → Game 생성·루프 시작
    ├── core/
    │   ├── Game.js                   # 오케스트레이터: scene/renderer/loop/상태/리사이즈
    │   └── Input.js                  # 키보드 → InputState (멀티 확장 seam)
    ├── world/
    │   ├── Terrain.js                # 노이즈 하이트맵 → flat-shaded 듄 메시 + 높이 샘플링
    │   ├── Sky.js                    # 낮↔노을↔밤 (태양광·하늘색·별·헤드라이트)
    │   ├── Landmarks.js              # 7 신기루 메시 + 빛기둥 + 발견 연출
    │   └── Collectibles.js           # 20 수정 메시 + 획득 처리
    ├── vehicle/
    │   ├── Car.js                    # 차량 메시 + 바퀴/서스펜션 시각화 (THREE)
    │   └── DustEmitter.js            # GPU 파티클 먼지 (THREE.Points 풀)
    ├── camera/ChaseCamera.js         # 3인칭 추적 + 하늘뷰 토글
    ├── ui/
    │   ├── HUD.js                    # 속도·발견·수집·시간·방향 포인터
    │   └── Menu.js                   # 시작/조작법/일시정지 오버레이
    ├── audio/AudioManager.js         # 엔진·바람·수집·팡파르 (Web Audio)
    └── logic/                        # ★ THREE-free 순수 로직 (단위 테스트 대상)
        ├── carPhysics.js             # 입력+dt → 속도/방향/드리프트/점프 step (순수 함수)
        ├── noise.js                  # 결정적 value noise (지형 높이 함수)
        ├── discovery.js              # 랜드마크 거리/발견 판정
        └── dayNight.js               # 시간 → 태양 각도·하늘색 매핑
```

각 모듈은 단일 책임을 가지며 명확한 인터페이스로 통신한다. `logic/`은 렌더링/DOM/THREE에 의존하지 않아 독립적으로 테스트 가능하다.

### 6.4 핵심 기법

- **지형(Terrain):** value-noise 하이트맵을 큰 `PlaneGeometry`(초기값 1000×1000 유닛, 192×192 세그먼트)에 정점 변위 + `flatShading: true`로 로우폴리 듄 생성. 차량 위치의 지형 높이는 `noise.js`의 동일 높이 함수로 샘플링(레이캐스트 불필요). 맵 가장자리는 부드러운 보이지 않는 경계로 차량을 되돌린다.
- **차량 물리(carPhysics.js):** 물리 엔진 없이 **아케이드 키네마틱 모델**. 상태(위치·속도·헤딩·공중여부) + 입력 + dt → 다음 상태를 반환하는 순수 함수. 조향은 헤딩 변화, 드리프트는 횡속도 감쇠 완화로 표현. 지형 높이를 샘플링해 착지 + 서스펜션 lerp; 듄 꼭대기에서 상향 속도가 임계 초과 시 공중(중력 적용) → 빅에어.
- **먼지(DustEmitter):** `THREE.Points` 파티클 풀(상한 약 1500). 바퀴 접지점에서 속도·드리프트 강도에 비례해 스폰, 수명 동안 확산·상승·페이드, 현재 시간대의 노을빛으로 발색. 풀 재사용으로 GC 최소화.
- **카메라(ChaseCamera):** 차량 뒤·위 오프셋을 부드럽게 추종, 속도 비례 FOV·미세 흔들림. `C` 토글 시 높은 드론 시점으로 보간.
- **하늘·시간대(Sky + dayNight.js):** `dayNight.js`가 정규화 시간(0~1)을 태양 방위·고도·하늘색·앰비언트로 매핑(순수 함수). `Sky.js`가 이를 `DirectionalLight`·배경색·별·헤드라이트에 적용.
- **랜드마크·수집물:** 시드 기반으로 위치를 데이터화. `discovery.js`가 차량-랜드마크 거리로 발견을 판정(순수). 메시·연출은 `Landmarks.js`/`Collectibles.js`가 담당.
- **사운드(AudioManager):** Web Audio로 엔진(오실레이터 피치 변조)·바람(노이즈)·수집·팡파르 합성. 사용자 제스처 후 오디오 컨텍스트 활성화.

### 6.5 멀티플레이어 확장 seam (지금은 미구현)

싱글플레이어로 완성하되, 나중에 멀티를 붙이기 쉽도록 결합만 분리한다:

- 입력을 `InputState` 객체(가속/조향/핸드브레이크 등 불리언·스칼라)로 추상화 → 로컬 키보드든 원격이든 동일 형태로 주입.
- `carPhysics.step(state, input, dt)`를 순수 함수로 유지 → 원격 플레이어 상태를 동일 함수로 재현/보간 가능.
- `RemotePlayers` no-op 스텁을 두어 향후 다중 차량 렌더 지점을 확보.
- 기존 `public/shared/networking/`(GameClient/StateBuffer/InputBuffer)와 결이 맞는 형태를 지향.

**범위 주의:** 본 작업에서 네트워킹 코드는 작성하지 않는다. 위는 "결합 회피" 설계 원칙일 뿐이다.

---

## 7. 허브 통합

- `app/desert-game/page.tsx` — `'use client'`, 전체화면 `<iframe src="/desert-game/index.html">` + "홈으로" 버튼 오버레이(기존 최소 패턴). 게임 자체 시작 메뉴는 `index.html`이 담당.
- `app/page.tsx` — 사막 테마 카드 추가(아이콘 🏜️, 황토/주황 그라데이션, 제목 "Dust Drifter", 설명·특징 목록).
- `README.md` — 게임 목록·기술 스택(Three.js 추가)·프로젝트 구조 갱신.

## 8. CI 안전 조치 (기존 통과 상태 유지)

CI는 `lint`(eslint) → `type-check`(tsc --noEmit) → `test`(vitest) → e2e(Playwright) → server-test 순으로 돈다.

- **ESLint:** `eslint.config.mjs`의 `globalIgnores`에 **`public/desert-game/**`** 추가(survival-game/src 선례와 동일). 바닐라 게임 JS + importmap bare specifier(`three`)에 next/TS 린트 규칙이 충돌하지 않게 한다.
- **type-check:** `public/`은 이미 `tsconfig.json`에서 제외 → 영향 없음.
- **coverage:** `vitest.config.ts`의 `coverage.include`에 **`public/desert-game/src/**`** 추가.

## 9. 테스트 전략

- **단위(Vitest, jsdom):** `logic/` 순수 모듈만 대상(THREE-free라 곧장 import 가능, flight-game식 코드 복제 불필요).
  - `carPhysics`: 가속/감속/조향/드리프트/점프·착지/경계 처리, dt 안정성.
  - `noise`: 동일 입력 → 동일 출력(결정성), 범위.
  - `discovery`: 반경 내/외 판정, 가장 가까운 미발견 선택.
  - `dayNight`: 시간 0/0.25/0.5/0.75 → 기대 태양 고도·색 구간.
  - 위치: `__tests__/unit/desert-game/`.
- **E2E(Playwright):** 허브 카드 클릭 → `/desert-game` 진입 → `<iframe>`/`<canvas>` 존재 + 콘솔 에러 없음 검증. 위치: `e2e/`(기존 `hub.spec.ts` 확장 또는 신규 `desert-game.spec.ts`).
- **수동 검증:** `npm run dev` 후 렌더링·먼지·시간대 전환·발견 연출 육안 확인.

## 10. 성능 · 리스크

- **성능:** 단일 평면 + 파티클 상한(~1500) + 인스턴싱으로 60fps 목표.
- **리스크/대응:**
  - WebGL 미지원 → `index.html`에서 컨텍스트 생성 실패 시 안내 메시지 폴백.
  - CDN 의존(오프라인 시 로드 실패) → 기존 게임들과 동일하게 수용.
  - 멀미 → 기본 3인칭이라 경미; 흔들림 강도는 보수적으로.

## 11. 비범위 (YAGNI)

충돌 데미지·체력·연료·적/전투·점수 경쟁·랭킹·멀티플레이어 구현·모바일 터치 입력·외부 3D 에셋·빌드 파이프라인 — **전부 본 작업에서 제외.** "평온한 자유 주행"이라는 핵심 주제를 흐리거나 불필요하게 복잡도를 키운다.

## 12. 튜닝 가능 상수 (초기값, `Config`로 노출)

| 상수 | 초기값 |
|---|---|
| 랜드마크 수 | 7 |
| 수집물 수 | 20 |
| 맵 크기 / 세그먼트 | 1000×1000 유닛 / 192² |
| 먼지 파티클 상한 | 1500 |
| 시간대 1주기 | 약 240초 |
| 최고 속도 (초기값) | 약 40 유닛/s |
| 발견 반경 (초기값) | 약 45 유닛 |

---

## 부록 — 출처

- [three.js — Installation](https://threejs.org/manual/en/installation.html)
- [Using Import Maps — sbcode three.js tutorials](https://sbcode.net/threejs/importmap/)
- [threejs-template-cdn (GitHub)](https://github.com/salaivv/threejs-template-cdn)
