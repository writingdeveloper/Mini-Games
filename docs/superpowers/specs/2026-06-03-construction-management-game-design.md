# Tantrum Tower — 막장 건설 현장 관리 게임 설계서

- **작성일:** 2026-06-03
- **상태:** 승인됨 (구현 계획 대기)
- **유형:** Mini Games Hub 신규 게임 (5번째)
- **가제:** **Tantrum Tower** / **호통 반장** (폐급들을 다그쳐 마감 전에 탑을 올려라) — 명칭 변경 가능

---

## 1. 비전

폐급(무능·농땡이) 일꾼들만 모인 막장 건설 현장의 **성질 급한 반장**이 되어, 당근과 채찍으로 일꾼들을 다그쳐 마감 전에 건물을 완공하는 **코미디 관리 게임**. PS2 시절 3D 게임의 레트로 룩(저해상도·텍스처 일렁임·플랫 셰이딩)을 입은 "미니어처 공사장 디오라마"가 무대다.

핵심 재미는 **'양날의 검'**: 시비를 걸면 일꾼이 즉시 일로 복귀하고 생산성이 오르지만 **빡침**이 쌓인다. 너무 몰아붙이면 태업·도주·반란으로 번진다. 여러 폐급을 동시에 굴리는 코미디, 시비 순간의 카메라 푸시인 연출, 쑥쑥 올라가는 타워의 쾌감이 매력 포인트다. "단순하지만 매력적인"을 지향한다.

핵심 가치: ① 당근·채찍 판단의 긴장감, ② 폐급들의 코미디, ③ 완공의 성취감.

## 2. 핵심 게임플레이 루프

```
순찰하며 농땡이 포착  →  다가가 전술 선택 (윽박 / 비꼬기 / 달래기)
      ↑                              ↓
 빡침 관리 실패 시 악화          작업 복귀 + 생산성 부스트
 태업 → 도주 → 반란              (윽박·비꼬기는 빡침↑, 달래기는 빡침↓)
      ↑                              ↓
      └──────── 건물 층 상승 ◄────────┘
       마감 시계 ⏱ 안에 목표 층 완공 = 승리 / 시간초과·인력붕괴 = 패배
```

플레이어는 매 순간 **(a) 어느 일꾼을 언제 다그칠지의 판단**과 **(b) 빡침을 식힐 타이밍**을 저울질한다. 작업중 일꾼이 누적 작업량을 쌓아 층을 올리고, 목표 층수에 도달하면 승리. 시간이 다하거나 다수 일꾼이 도주·반란해 인력이 붕괴하면 패배.

## 3. 기능 상세

| # | 기능 | 동작 |
|---|---|---|
| ① | **전술 시비 (양날의 검)** | 농땡이 일꾼에게 다가가면 전술 프롬프트 등장. **윽박(생산성↑↑·빡침↑↑) / 비꼬기(↑·↑) / 달래기(↑·빡침↓)** 중 키로 즉석 선택. 시비는 농땡이→작업중 즉시 복귀 + 수초간 생산성 부스트. |
| ② | **빡침 게이지 & 단계 악화** | 일꾼별 빡침(0~100). 임계 초과 시 **태업(60)→도주(80)→반란(95)**으로 악화. 달래기·시간 경과로 빡침이 내려가면 단계 회복. 도주 중인 일꾼은 가까이서 달래면 붙잡는 고위험 플레이. 반란은 주변 일꾼 빡침을 선동. |
| ③ | **폐급 아키타입 4종** | **졸보**(낮잠·느림), **폰충**(잦은 농땡이), **잡담러**(주변 농땡이 전염), **다혈질**(빡침 2배·윽박 위험). 농땡이 빈도·빡침 민감도·작업률이 달라 매번 다른 판단을 요구. |
| ④ | **건물 상승** | 작업중 인원 × 작업률이 누적 진척을 쌓고, 임계마다 층이 완공되며 **건물 모델이 다음 건설 단계로 교체**된다. HUD에 진척·층수 표시. |
| 🎥 | **하이브리드 카메라** | 기본은 원근 3/4 **디오라마 감독뷰**(현장·일꾼·게이지 한눈에). 시비 발동 시 **카메라 푸시인**으로 반장+일꾼 클로즈업(PS2 일렁임 연출) 후 복귀. |
| 🔊 | **사운드** | 호통·콤보·일꾼 반응·공사 소음·앰비언트. Web Audio API로 경량 합성(외부 에셋 없이). |

## 4. 조작 (키보드 전용)

| 키 | 동작 |
|---|---|
| `↑↓←→` / `WASD` | 반장 이동 |
| `1` | 윽박지르기 (가까운 일꾼) |
| `2` | 비꼬기 |
| `3` | 어르고 달래기 |
| `Esc` | 일시정지 |
| `R` | 결과 화면에서 재시작 |

전술 키는 **범위 내 가장 가까운 일꾼**에게 적용된다. 프롬프트가 어떤 키가 어떤 전술인지 항상 표시한다.

## 5. 아트 디렉션

- **스타일:** **Quaternius 단일 작가 패밀리로 통일**(캐릭터·건물·소품). 각진 메시 + 플랫 셰이딩 + 저해상도 텍스처의 정통 PS1/PS2 룩. 그 위에 PS2 레트로 셰이더를 입혀 **모든 에셋을 한 톤으로 최종 통일**한다. 작가가 섞이면 폴리 밀도·텍스처·비율·팔레트가 어긋나 톤이 깨지므로, 단일 패밀리 통일이 일관성의 핵심 원칙이다.
- **일꾼 상태 표현:** 애니메이션은 소수 핵심 세트(대기·작업·걷기·달리기)만 쓰고, **농땡이 종류·빡침은 플로팅 아이콘**(💤 졸음 · 📱 폰 · 💬 잡담 · 😤 빡침 · ❗농땡이)으로 표현한다. 디오라마 거리에선 실루엣 모션 + 아이콘만으로 충분히 읽히며, 오히려 관리 가독성을 높인다.
- **PS2 룩:** 저해상도 내부 렌더 → 니어레스트 업스케일, 정점 흔들림(vertex jitter), 어파인 텍스처 일렁임, 디더링 + 색 단계 축소, 니어레스트 텍스처 필터, 플랫/램버트 조명, 안티앨리어싱 끔, 안개로 드로 거리 마스킹.
- **Kenney 등 타 작가 에셋:** 무텍스처 블록아웃이라 결이 달라 **기본 제외**. 부득이한 바닥/도로 정도만 톤을 맞춰 제한 사용하거나 직접 제작.

---

## 6. 기술 아키텍처

### 6.1 Three.js 로딩 — 빌드 불필요

기존 사막 게임과 동일하게 **importmap + jsdelivr CDN**으로 로드한다(Next.js 번들 불변). glTF 로딩·스키닝 클론을 위해 addons를 추가한다.

```html
<script type="importmap">
{ "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/"
}}
</script>
<script type="module" src="./src/main.js"></script>
```

main 라이브러리와 addons는 **반드시 동일 버전·동일 CDN**(사막 게임과 같은 `three@0.184.0`). 사용 addons: `loaders/GLTFLoader.js`, `utils/SkeletonUtils.js`, (선택) `postprocessing/`.

### 6.2 언어·빌드 정책

**바닐라 ES 모듈(.js), 빌드 단계 없음.** `tsconfig.json`이 `public/`을 type-check에서 제외하므로 `.ts`의 이득이 없고, 브라우저 직접 실행에는 빌드가 오히려 방해다. 다운로드 모델은 **`.glb`(단일 바이너리)**로 커밋해 로더 마찰을 최소화한다.

### 6.3 파일 구조

```
app/construction-game/page.tsx        # Next 라우트: 전체화면 iframe + LoadingOverlay + 홈 버튼
public/construction-game/
├── index.html                        # importmap, <canvas>, 메뉴/HUD DOM, WebGL 폴백
├── style.css
├── assets/                           # CC0 .glb 모델 + CREDITS.md (작자·라이선스·출처)
└── src/
    ├── main.js                       # 부트스트랩 → Game 생성·루프 시작, WebGL/로드 폴백, 토스트
    ├── core/
    │   ├── Game.js                   # 오케스트레이터: scene/renderer/loop/상태/리사이즈
    │   └── Input.js                  # 키보드 → InputState (멀티 확장 seam)
    ├── render/
    │   ├── RetroPipeline.js          # 저해상도 RT + 니어레스트 업스케일 + 디더/포스터라이즈 패스 + 안개
    │   └── retroMaterial.js          # onBeforeCompile 주입(정점 스냅 + 어파인 UV), 스키닝 보존
    ├── assets/
    │   └── AssetLoader.js            # GLTFLoader(CDN), 레트로 머티리얼·니어레스트 텍스처 적용, 캐시, SkeletonUtils.clone, 로드 실패 시 박스 폴백
    ├── world/
    │   ├── Site.js                   # 바닥·현장 배치·정적 소품(InstancedMesh)·바리케이드
    │   └── Building.js               # 진척에 따른 단계별 건물 모델 교체(층 상승)
    ├── entities/
    │   ├── Worker.js                 # SkinnedMesh 클론 + AnimationMixer, 상태→애니 매핑 + 상태 아이콘·빡침 게이지 빌보드
    │   └── Foreman.js                # 플레이어 아바타(모델 + 걷기 애니) + InputState 이동
    ├── camera/DioramaCamera.js       # 감독뷰 추종 + 시비 푸시인 보간 + 복귀
    ├── ui/
    │   ├── HUD.js                    # 마감 시계·층 진척·인력·점수·콤보
    │   ├── ConfrontationPrompt.js    # 근접 시 전술 프롬프트(윽박/비꼬기/달래기 + 일꾼 빡침)
    │   └── Menu.js                   # 시작/일시정지/결과(점수·재시작) 오버레이
    ├── audio/AudioManager.js         # 호통·콤보·반응·공사 소음·앰비언트 (Web Audio)
    └── logic/                        # ★ THREE-free 순수 로직 (단위 테스트 대상)
        ├── config.js                 # 모든 튜닝 상수 (난이도·레벨 확장의 단일 출처)
        ├── workerState.js            # 일꾼 상태 머신: createWorker, stepWorker(state,dt,ctx)
        ├── rage.js                   # 빡침 적용·자연 감소·임계→상태 매핑
        ├── tactics.js                # 윽박/비꼬기/달래기 정의 → (생산성Δ, 빡침Δ)
        ├── production.js             # 작업 인원 → 진척 누적 → 층 완공 판정
        ├── scoring.js                # 승패·점수·콤보 평가
        ├── archetypes.js             # 폐급 4종 파라미터 데이터
        └── spawn.js                  # 시드 기반 결정적 일꾼·소품 배치
```

각 모듈은 단일 책임을 가지며 명확한 인터페이스로 통신한다. `logic/`은 렌더링/DOM/THREE에 의존하지 않아 독립적으로 테스트 가능하다.

### 6.4 일꾼 AI & 빡침 (순수 로직)

- **상태 머신(workerState.js):** 상태 = `작업중 | 농땡이 | 태업 | 도주 | 반란`. `stepWorker(state, dt, ctx)`가 순수 함수로 다음 상태를 반환.
  - **작업중 → 농땡이:** 집중 타이머가 만료되면(아키타입별 평균) 농땡이로 전환, 생산 기여 0.
  - **시비 적용:** 농땡이/태업 → 작업중 즉시 복귀 + 생산성 부스트(수초). 전술에 따라 빡침 변동.
  - **빡침 임계(rage.js):** 60↑ 태업(작업률 급감), 80↑ 도주(현장 출구로 이동, 도달 시 인력 −1), 95↑ 반란(정지 + 주변 일꾼 빡침 가산). 빡침이 내려가면 역순으로 단계 회복.
  - **빡침 자연 감소:** 방치 시 천천히 감소(쿨다운). 아키타입별 민감도 계수.
- **아키타입(archetypes.js):** 졸보/폰충/잡담러/다혈질 — 농땡이 빈도·빡침 민감도·작업률·기본 애니/아이콘이 다름. 잡담러는 인접 일꾼의 농땡이 전환을 가속.
- **생산(production.js):** 매 프레임 작업중 인원의 (기본 작업률 × 부스트 × 아키타입 계수)를 진척에 누적. 진척이 층 임계를 넘으면 층 완공 이벤트 → `Building.js`가 모델 교체.
- **승패·점수(scoring.js):** `evaluate(state)` → 목표 층 도달=승리 / 마감 시간 초과 또는 잔여 인력 < 임계=패배. 점수 = 완공 층 + 잔여 시간 + 보너스. **콤보** = 빡침 폭발(태업 이상) 없이 농땡이를 연속 복귀시킨 횟수로 점수 배수에 기여하고, **무사고**(도주·반란 0회) 보너스가 더해진다.

### 6.5 PS2 레트로 파이프라인 (렌더링)

- **정점 스냅 + 어파인(retroMaterial.js):** 로드된 머티리얼에 `material.onBeforeCompile`로 `#include <project_vertex>`를 치환(스키닝 이후라 **스켈레탈 애니메이션 보존**) — 클립 공간 정점을 격자로 양자화(흔들림) + `gl_Position.w`로 UV를 곱했다 프래그먼트에서 나눠 어파인 텍스처 일렁임 구현.
- **저해상도 + 디더(RetroPipeline.js):** 작은 `WebGLRenderTarget`(예 320×240, NearestFilter)에 렌더 → 풀스크린 쿼드로 업스케일. 디더(Bayer)+색 단계 축소(≈16) 패스. `antialias:false`, `setPixelRatio(1)`, `scene.fog`로 드로 거리 마스킹.
- **텍스처:** 모든 텍스처 `NearestFilter` + `generateMipmaps=false`, 작은 소스 해상도.
- **조명:** PBR 대신 `MeshLambertMaterial`/`flatShading`.

### 6.6 에셋 파이프라인 & 라이선스

- **출처(전부 CC0 우선):** 캐릭터 = Quaternius RPG/Universal(+군중 다양성), 건물 = Quaternius Ultimate Buildings(건설 단계별), 소품 = Quaternius/Poly Pizza(모델별 라이선스 확인). 부족분은 Three.js 박스로 직접 제작.
- **포맷 변환:** Quaternius Ultimate Buildings는 페이지상 FBX/OBJ/Blend → **1회 오프라인 Blender로 `.glb` 변환** 후 커밋(런타임은 `.glb`만 로드, 빌드리스 유지). 또는 glTF 네이티브 모듈 조각으로 층을 조립. 구현 시 확정.
- **라이선스 위생(공개 포트폴리오):** **CC0만 커밋**이 원칙. CC-BY 사용 시 `assets/CREDITS.md`에 작자·라이선스·출처 URL 기록. **Mixamo 원본 파일·비-CC0 Sketchfab 모델은 커밋 금지**(재배포 제약).
- **인스턴싱·클론:** 애니메이션 NPC는 `SkeletonUtils.clone()` + 인스턴스별 `AnimationMixer`(수십 체 목표). 정적 소품은 `InstancedMesh`. 모델 로드 실패(CDN 404) 시 박스 플레이스홀더 + 토스트로 **무중단**.

### 6.7 멀티플레이어 · 확장 seam (지금은 미구현)

싱글플레이어로 완성하되 결합만 분리한다:

- **레벨/엔드리스 확장:** 모든 수치를 `config.js`로 분리 → 새 레벨 = config 변형 + 레벨 선택 UI만 추가. 본 MVP는 단일 타임어택 현장.
- **멀티 seam:** 입력을 `InputState`로 추상화, `stepWorker`/`production`을 순수 함수로 유지해 원격 재현 여지 확보. 네트워킹 코드는 본 작업에서 작성하지 않음(사막 게임과 동일 원칙).

---

## 7. 허브 통합

- `app/construction-game/page.tsx` — `'use client'`, 전체화면 `<iframe src="/construction-game/index.html">` + `LoadingOverlay` + "홈으로" 버튼(사막 게임과 동일 패턴).
- `app/_components/games.data.ts` — 신규 `Game` 항목 추가(id `construction-game`, 제목 "Tantrum Tower", 태그라인·설명·특징, 이모지 🏗️, 황색/주황 계열 그라데이션, `imageAlt`, 배경 이미지 4장). 배경 사진은 기존 `scripts/fetch-game-images.mjs` 흐름으로 CC 라이선스 공사장 테마 수급.
- `README.md` — 게임 목록·기술 스택·구조 갱신.

## 8. CI 안전 조치 (기존 통과 상태 유지)

CI는 `lint` → `type-check` → `test`(vitest) → e2e(Playwright) → server-test 순.

- **ESLint:** `eslint.config.mjs`의 `globalIgnores`에 **`public/construction-game/**`** 추가.
- **type-check:** `public/`은 이미 `tsconfig.json`에서 제외 → 영향 없음.
- **coverage:** `vitest.config.ts`의 `coverage.include`에 **`public/construction-game/src/**`** 추가.

## 9. 테스트 전략

- **단위(Vitest, jsdom):** `logic/` 순수 모듈만 대상(THREE-free). 위치 `__tests__/unit/construction-game/`, **상대 경로 import**(`@/public/...` 별칭은 vitest에서 미해석 — 사막 게임 선례).
  - `workerState`: 작업↔농땡이 전환, 시비 복귀, 임계별 태업/도주/반란 진입·회복.
  - `rage`: 전술별 빡침 변동, 자연 감소, 임계 경계.
  - `tactics`: 윽박/비꼬기/달래기 (생산성Δ, 빡침Δ) 값.
  - `production`: 작업 인원→진척→층 완공 임계.
  - `scoring`: 승리(목표 층)·패배(시간초과/인력붕괴)·점수.
  - `spawn`: 동일 시드 → 동일 배치(결정성).
- **E2E(Playwright):** 허브 카드 클릭 → `/construction-game` 진입 → `<iframe>`/`<canvas>` 존재 + 콘솔 에러 없음. 위치 `e2e/construction-game.spec.ts`.
- **수동 검증:** `npm run dev` 후 PS2 룩·일꾼 상태·시비 푸시인·건물 상승 육안 + 스크린샷.

## 10. 성능 · 리스크

- **성능:** 저해상도 RT + 정적 소품 인스턴싱 + NPC 수 상한(config)으로 60fps 목표. 오프스크린 믹서 동결 등 여지.
- **리스크/대응:**
  - WebGL 미지원 → `index.html` 컨텍스트 실패 시 안내 폴백.
  - glTF 로드 실패(CDN/404) → 박스 플레이스홀더 + 토스트(무중단).
  - 레트로 셰이더 × 스키닝 충돌 → 반드시 `project_vertex`(스키닝 이후)에서 주입.
  - 에셋 톤 불일치 → 단일 작가 통일 + 셰이더 최종 통일 원칙으로 방지.
  - NPC 과다 → SkinnedMesh CPU 비용 한계, config 상한으로 관리.

## 11. 비범위 (YAGNI)

캠페인/다수 레벨(확장 seam만 둠)·엔드리스·멀티플레이어 구현·모바일 터치·낮밤 순환·일꾼 인벤토리/경제 시뮬·세이브·랭킹 서버·복잡한 대사 트리 — **본 MVP에서 제외.** "단순하지만 매력적인" 단일 타임어택 현장에 집중한다.

## 12. 튜닝 가능 상수 (초기값, `config.js`로 노출)

| 상수 | 초기값 |
|---|---|
| 일꾼 수 | 8 |
| 목표 층수 | 5 |
| 교대(마감) 시간 | 약 180초 |
| 빡침 임계 (태업/도주/반란) | 60 / 80 / 95 |
| 윽박 (빡침Δ / 부스트·지속) | +28 / ×2.0·5s |
| 비꼬기 (빡침Δ / 부스트) | +15 / ×1.6 |
| 달래기 (빡침Δ / 부스트) | −25 / ×1.3 |
| 빡침 자연 감소 | 약 −4/초 |
| 작업중→농땡이 평균 | 약 8~14초 (아키타입별) |
| 아키타입 | 졸보·폰충·잡담러·다혈질 |
| NPC 애니 인스턴스 상한 | 수십 체 |

---

## 부록 — 출처

### 에셋 (CC0 우선)
- [Quaternius — Ultimate Buildings Pack (건설 단계별)](https://quaternius.com/packs/ultimatetexturedbuildings.html)
- [Quaternius — RPG Characters](https://quaternius.com/packs/rpgcharacters.html) · [Quaternius 허브](https://quaternius.com/)
- [Poly Pizza — construction (모델별 라이선스 확인)](https://poly.pizza/search/construction)
- [Kenney — assets (보조/제한)](https://kenney.nl/assets)

### PS2/PSX 레트로 기법 (Three.js)
- [PS1 style graphics in Three.js — Roman Liutikov](https://romanliutikov.com/blog/ps1-style-graphics-in-threejs)
- [PS1-Inspired Jitter Shader — Codrops](https://tympanus.net/codrops/2024/09/03/how-to-create-a-ps1-inspired-jitter-shader-with-react-three-fiber/)
- [Affine Texture Mapping — three.js forum #5945](https://discourse.threejs.org/t/affine-texture-mapping-in-shader-ps1-style-graphics/5945)
- [Building a PS1 style retro 3D renderer — David Colson](https://www.david-colson.com/2021/11/30/ps1-style-renderer.html)
- [The Art of Dithering and Retro Shading — Maxime Heckel](https://blog.maximeheckel.com/posts/the-art-of-dithering-and-retro-shading-web/)

### glTF · 애니메이션 (빌드리스)
- [SkeletonUtils — three.js docs](https://threejs.org/docs/pages/module-SkeletonUtils.html)
- [Material.onBeforeCompile — three.js docs](https://threejs.org/docs/#api/en/materials/Material.onBeforeCompile)
- [RenderPixelatedPass — three.js docs](https://threejs.org/docs/pages/RenderPixelatedPass.html)
