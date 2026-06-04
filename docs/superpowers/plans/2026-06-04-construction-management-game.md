# Tantrum Tower — 건설 관리 게임 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PS2 레트로 룩의 코미디 건설 관리 게임 "Tantrum Tower"를 Mini Games Hub의 5번째 게임으로, 빌드리스 Three.js로 구현한다 — 폐급 일꾼을 다그쳐(양날의 검) 마감 전에 목표 층수를 올리는 단일 타임어택 현장.

**Architecture:** 사막 게임(Dust Drifter)의 검증된 구조를 그대로 따른다 — THREE-free 순수 로직(`src/logic/`)을 Vitest로 단위 테스트, Three.js 엔진/렌더링은 브라우저 실행·스크린샷·Playwright로 검증. 게임은 **박스 프리미티브만으로 끝까지 플레이 가능**하게 만들고(Phase 1–5), glTF 에셋은 **로드 실패 시 프리미티브로 폴백되는 점진적 강화**(Phase 6)로 얹는다. 따라서 다운로드 에셋이 하나도 없어도 게임은 완성 상태로 동작한다.

**Tech Stack:** Vanilla ES Modules (`.js`, 빌드 없음) · Three.js `0.184.0` (importmap + jsdelivr CDN, 사막 게임과 동일 버전) · addons `GLTFLoader`/`SkeletonUtils` · Web Audio API · Vitest(jsdom) · Playwright · Next.js 16 App Router(iframe 래퍼).

---

## 스펙 대비 조정 사항 (계획 단계 확정)

설계 스펙(`docs/superpowers/specs/2026-06-03-construction-management-game-design.md`)을 실제 현재 브랜치(`feat/construction-management-game`, `main` 기반) 코드에 맞춰 두 가지를 확정한다. 둘 다 스펙의 의도를 보존한다.

1. **허브 등록 위치:** 스펙 §7은 `app/_components/games.data.ts`에 `Game` 항목을 추가한다고 적었으나, 그 파일은 **이 브랜치에 존재하지 않는다**(미병합 랜딩 리디자인 브랜치 `feat/kinetic-scroll-telling-landing`의 산물). 현재 `main` 기반 허브는 `app/page.tsx`에 **인라인 `<Link>` 카드**로 게임을 등록한다(도주/서바이벌/Sky Explorer/Dust Drifter 4장). 따라서 본 계획은 **`app/page.tsx`에 5번째 인라인 카드**를 추가한다(Task 17).

2. **에셋은 선택적 강화:** 스펙 §6.6의 Quaternius `.glb`는 **오프라인 수급/변환이 필요한 외부 의존**이다. 본 계획은 게임 로직·렌더링·UI·오디오를 **전부 박스/캡슐 프리미티브 + PS2 셰이더로 완성**(Phase 1–5)한 뒤, `AssetLoader`가 있으면 모델을 입히고 **없거나 404면 프리미티브로 무중단 폴백**(Phase 6)하도록 한다. glTF 수급은 Task 29의 명시된 **수동 단계**이며, 게임의 동작은 그것에 의존하지 않는다.

3. **오케스트레이션 위치:** 스펙 §6.3은 `core/Game.js`를 "오케스트레이터: scene/renderer/loop/상태"로 정의한다. 본 계획은 그 정의를 따라 **`Game.js`가 엔진(루프/씬/렌더/리사이즈) + 게임 상태(elapsed/build/combo/incidents/status) + 매 프레임 `step()`**을 함께 소유한다. 사막 게임의 `Game.js`(순수 엔진)보다 약간 크지만 스펙이 의도한 단일 게임 오케스트레이터다.

---

## 인터페이스 & 데이터 계약 (모든 태스크가 준수)

아래 시그니처·필드명을 **모든 태스크에서 정확히 동일하게** 사용한다. (writing-plans 셀프리뷰의 타입 일관성 기준.)

**일꾼 로직 객체** (`createWorker` 반환):
```js
{
  id: number,
  archetypeId: 'dozer' | 'phone' | 'chatter' | 'hothead',
  state: 'working' | 'slacking' | 'sabotage' | 'fleeing' | 'riot', // 파생값(deriveState)
  activity: 'working' | 'slacking',   // calm 단계에서의 활동(시비/타이머로만 변함)
  rage: number,        // 0..100
  slackTimer: number,  // 작업중→농땡이까지 남은 초
  boostMul: number,    // 생산성 배수(1=기본)
  boostTimer: number,  // 부스트 잔여 초
  escaped: boolean,    // 도주 완료(인력에서 제외)
}
```

**상태 한글 라벨(렌더링 표시용):** working=작업중, slacking=농땡이, sabotage=태업, fleeing=도주, riot=반란.

**순수 로직 API (THREE-free, `src/logic/`):**
- `config.js` → `export const CONFIG`
- `archetypes.js` → `ARCHETYPES`, `ARCHETYPE_LIST`, `getArchetype(id)`
- `rage.js` → `clampRage(r)`, `addRage(worker, delta, sensitivity=1)`, `decayRage(worker, dt)`, `rageStage(rage) → 'calm'|'sabotage'|'fleeing'|'riot'`
- `tactics.js` → `TACTICS` (`{bark,taunt,soothe}`), `tacticByKey(n)`, `applyTactic(worker, tacticId, sensitivity=1) → worker`
- `workerState.js` → `STATES`, `createWorker(id, archetypeId, rng)`, `deriveState(worker) → state`, `stepWorker(worker, dt) → worker`, `applySlackPressure(worker, dt, factor)`
- `production.js` → `workerOutput(worker) → number`, `crewOutputPerSecond(workers) → number`, `advanceProgress(build, outputPerSec, dt) → {progress, floorsBuilt, floorsCompletedThisStep}`
- `scoring.js` → `isWin(s)`, `isDefeat(s)`, `evaluate(s) → 'playing'|'win'|'defeat'`, `scoreMultiplier(combo)`, `computeScore(s) → number`
- `spawn.js` → `mulberry32(seed) → ()=>number`, `spawnWorkers(seed, count) → [{id, archetypeId, x, z}]`, `spawnProps(seed, count) → [{x, z, kind}]`

**엔진이 소비하는 로직 함수:** `createWorker`, `stepWorker`, `deriveState`, `applyTactic`, `tacticByKey`, `getArchetype`, `crewOutputPerSecond`, `advanceProgress`, `evaluate`, `computeScore`, `scoreMultiplier`, `spawnWorkers`, `spawnProps`, `mulberry32`, `rageStage`, `applySlackPressure`, `TACTICS`.

---

## 파일 구조 맵

```
app/construction-game/page.tsx                         # (Task 16) Next 라우트: iframe + LoadingOverlay + 홈버튼
app/page.tsx                                            # (Task 17) 5번째 카드 추가(인라인)
public/construction-game/
├── index.html                                          # (Task 8) importmap, canvas, 메뉴/HUD/프롬프트/결과 DOM, WebGL 폴백
├── style.css                                           # (Task 8) 오버레이/패널/버튼/HUD/토스트
├── assets/CREDITS.md                                   # (Task 29) 에셋 작자·라이선스·출처
└── src/
    ├── main.js                                         # (Task 10) 부트스트랩·폴백·토스트·와이어링
    ├── core/Game.js                                    # (Task 9) 엔진+게임상태+step 오케스트레이터
    ├── core/Input.js                                   # (Task 9) 이동/전술키/일시정지 → InputState
    ├── world/Site.js                                   # (Task 11) 바닥·소품(InstancedMesh)·출구 게이트
    ├── world/Building.js                               # (Task 12) 층수에 따른 단계별 건물(프리미티브→glTF)
    ├── entities/Foreman.js                             # (Task 13) 플레이어 아바타 + 이동
    ├── camera/DioramaCamera.js                         # (Task 14) 감독뷰 추종 + 시비 푸시인
    ├── entities/Worker.js                              # (Task 15) 로직 래핑 + 상태색/아이콘/게이지 + 공간 이동
    ├── ui/ConfrontationPrompt.js                       # (Task 18) 근접 일꾼 전술 프롬프트
    ├── ui/HUD.js                                       # (Task 21) 마감시계·층·인력·점수·콤보
    ├── ui/Menu.js                                      # (Task 22) 시작/일시정지/결과 오버레이
    ├── render/retroMaterial.js                         # (Task 24) onBeforeCompile 정점 스냅(+선택 어파인)
    ├── render/RetroPipeline.js                         # (Task 25) 저해상도 RT + 디더/포스터라이즈 + 안개
    ├── assets/AssetLoader.js                           # (Task 28) GLTFLoader + 레트로머티리얼 + 클론 + 폴백
    ├── audio/AudioManager.js                           # (Task 30) Web Audio 합성(호통/콤보/반응/앰비언트)
    └── logic/                                          # ★ THREE-free 순수 로직(단위 테스트 대상)
        ├── config.js                                   # (Task 1)
        ├── archetypes.js                               # (Task 1)
        ├── rage.js                                     # (Task 2)
        ├── tactics.js                                  # (Task 3)
        ├── workerState.js                              # (Task 4)
        ├── production.js                               # (Task 5)
        ├── scoring.js                                  # (Task 6)
        └── spawn.js                                    # (Task 7)
__tests__/unit/construction-game/*.test.ts             # (Task 1–7) 상대경로 import
e2e/construction-game.spec.ts                           # (Task 19)
eslint.config.mjs / vitest.config.ts                   # (Task 20) globalIgnores / coverage.include
README.md                                              # (Task 31)
```

---

# Phase 1 — 순수 로직 (TDD)

THREE·DOM 의존 없는 게임의 두뇌. 각 모듈을 실패 테스트 → 구현 → 통과 → 커밋으로 만든다. 테스트는 `__tests__/unit/construction-game/<module>.test.ts`에서 **상대경로**(`../../../public/construction-game/src/logic/<module>.js`)로 import(사막 게임 선례: `@/public/...` 별칭은 vitest에서 미해석).

### Task 1: config.js + archetypes.js (튜닝 상수 & 폐급 4종)

**Files:**
- Create: `public/construction-game/src/logic/config.js`
- Create: `public/construction-game/src/logic/archetypes.js`
- Test: `__tests__/unit/construction-game/archetypes.test.ts`

- [ ] **Step 1: config.js 작성** (스펙 §12 초기값)

```js
// public/construction-game/src/logic/config.js
export const CONFIG = {
  seed: 7777,
  shiftSeconds: 180,
  targetFloors: 5,
  workerCount: 8,
  site: { width: 44, depth: 44 },
  exit: { x: 0, z: 22 }, // 도주 일꾼이 향하는 출구(현장 +Z 경계)
  rage: { max: 100, sabotage: 60, flee: 80, riot: 95, decayPerSec: 4 },
  tactics: {
    bark:   { id: 'bark',   key: 1, label: '윽박', icon: '💢', rageDelta: 28,  boost: 2.0, boostSeconds: 5 },
    taunt:  { id: 'taunt',  key: 2, label: '비꼬기', icon: '😏', rageDelta: 15, boost: 1.6, boostSeconds: 5 },
    soothe: { id: 'soothe', key: 3, label: '달래기', icon: '🤝', rageDelta: -25, boost: 1.3, boostSeconds: 5 },
  },
  production: { baseRatePerWorker: 1.0, floorProgress: 100, sabotageRate: 0.2 },
  worker: { confrontRadius: 4.5, wanderRadius: 2.2, moveSpeed: 3.2, fleeSpeed: 6 },
  crewCollapseThreshold: 2, // 잔여 인력이 이 값 미만이면 패배
  chatterSpreadRadius: 6,
  chatterSpreadFactor: 2.0, // 잡담러 인접 일꾼 slackTimer 추가 감소 배수
  scoring: { floorPoints: 1000, timeBonusPerSec: 10, comboStep: 0.1, noIncidentBonus: 2000 },
};
```

- [ ] **Step 2: archetypes.js 작성** (폐급 4종)

```js
// public/construction-game/src/logic/archetypes.js
export const ARCHETYPES = {
  dozer:   { id: 'dozer',   label: '졸보',   icon: '💤', slackMeanSeconds: 10, slackVariance: 4, rageSensitivity: 0.8, workRate: 0.9, spreads: false, color: 0x6fae6f },
  phone:   { id: 'phone',   label: '폰충',   icon: '📱', slackMeanSeconds: 7,  slackVariance: 3, rageSensitivity: 1.0, workRate: 1.0, spreads: false, color: 0x6f9fae },
  chatter: { id: 'chatter', label: '잡담러', icon: '💬', slackMeanSeconds: 9,  slackVariance: 4, rageSensitivity: 1.0, workRate: 1.0, spreads: true,  color: 0xae9f6f },
  hothead: { id: 'hothead', label: '다혈질', icon: '😤', slackMeanSeconds: 12, slackVariance: 5, rageSensitivity: 2.0, workRate: 1.1, spreads: false, color: 0xae6f6f },
};

export const ARCHETYPE_LIST = Object.values(ARCHETYPES);

export function getArchetype(id) {
  const a = ARCHETYPES[id];
  if (!a) throw new Error(`unknown archetype: ${id}`);
  return a;
}
```

- [ ] **Step 3: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/archetypes.test.ts
import { describe, it, expect } from "vitest";
import { ARCHETYPES, ARCHETYPE_LIST, getArchetype } from "../../../public/construction-game/src/logic/archetypes.js";
import { CONFIG } from "../../../public/construction-game/src/logic/config.js";

describe("archetypes & config", () => {
  it("has exactly four archetypes with required fields", () => {
    expect(ARCHETYPE_LIST).toHaveLength(4);
    for (const a of ARCHETYPE_LIST) {
      expect(typeof a.slackMeanSeconds).toBe("number");
      expect(typeof a.rageSensitivity).toBe("number");
      expect(typeof a.workRate).toBe("number");
    }
  });
  it("getArchetype returns by id and throws on unknown", () => {
    expect(getArchetype("hothead").rageSensitivity).toBe(2.0);
    expect(() => getArchetype("nope")).toThrow();
  });
  it("config rage thresholds are ordered", () => {
    const { sabotage, flee, riot, max } = CONFIG.rage;
    expect(sabotage).toBeLessThan(flee);
    expect(flee).toBeLessThan(riot);
    expect(riot).toBeLessThan(max);
  });
});
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- archetypes`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add public/construction-game/src/logic/config.js public/construction-game/src/logic/archetypes.js __tests__/unit/construction-game/archetypes.test.ts
git commit -m "feat(construction): tuning config + 4 worker archetypes" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: rage.js (빡침 적용·감소·임계)

**Files:**
- Create: `public/construction-game/src/logic/rage.js`
- Test: `__tests__/unit/construction-game/rage.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/rage.test.ts
import { describe, it, expect } from "vitest";
import { clampRage, addRage, decayRage, rageStage } from "../../../public/construction-game/src/logic/rage.js";

describe("rage", () => {
  it("clamps to 0..100", () => {
    expect(clampRage(120)).toBe(100);
    expect(clampRage(-5)).toBe(0);
    expect(clampRage(42)).toBe(42);
  });
  it("addRage scales positive deltas by sensitivity, not negatives", () => {
    expect(addRage({ rage: 10 }, 28, 1).rage).toBe(38);
    expect(addRage({ rage: 10 }, 28, 2).rage).toBe(66);   // hothead doubles the gain
    expect(addRage({ rage: 10 }, -25, 2).rage).toBe(0);   // soothe not scaled, clamps at 0
  });
  it("decayRage subtracts decayPerSec*dt, floored at 0", () => {
    expect(decayRage({ rage: 50 }, 1).rage).toBe(46);
    expect(decayRage({ rage: 50 }, 0.5).rage).toBe(48);
    expect(decayRage({ rage: 1 }, 1).rage).toBe(0);
  });
  it("rageStage maps thresholds 60/80/95", () => {
    expect(rageStage(59)).toBe("calm");
    expect(rageStage(60)).toBe("sabotage");
    expect(rageStage(79)).toBe("sabotage");
    expect(rageStage(80)).toBe("fleeing");
    expect(rageStage(94)).toBe("fleeing");
    expect(rageStage(95)).toBe("riot");
    expect(rageStage(100)).toBe("riot");
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- rage`
Expected: FAIL ("Cannot find module .../rage.js")

- [ ] **Step 3: rage.js 구현**

```js
// public/construction-game/src/logic/rage.js
import { CONFIG } from './config.js';

export function clampRage(r) {
  return Math.max(0, Math.min(CONFIG.rage.max, r));
}

export function addRage(worker, delta, sensitivity = 1) {
  const scaled = delta > 0 ? delta * sensitivity : delta;
  worker.rage = clampRage(worker.rage + scaled);
  return worker;
}

export function decayRage(worker, dt) {
  worker.rage = Math.max(0, worker.rage - CONFIG.rage.decayPerSec * dt);
  return worker;
}

export function rageStage(rage) {
  const { sabotage, flee, riot } = CONFIG.rage;
  if (rage >= riot) return 'riot';
  if (rage >= flee) return 'fleeing';
  if (rage >= sabotage) return 'sabotage';
  return 'calm';
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- rage`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add public/construction-game/src/logic/rage.js __tests__/unit/construction-game/rage.test.ts
git commit -m "feat(construction): rage apply/decay/threshold logic" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: tactics.js (윽박/비꼬기/달래기)

**Files:**
- Create: `public/construction-game/src/logic/tactics.js`
- Test: `__tests__/unit/construction-game/tactics.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/tactics.test.ts
import { describe, it, expect } from "vitest";
import { TACTICS, tacticByKey, applyTactic } from "../../../public/construction-game/src/logic/tactics.js";

const w = (over = {}) => ({ rage: 10, activity: "slacking", boostMul: 1, boostTimer: 0, slackTimer: 0, ...over });

describe("tactics", () => {
  it("maps number keys 1/2/3 to bark/taunt/soothe", () => {
    expect(tacticByKey(1)).toBe("bark");
    expect(tacticByKey(2)).toBe("taunt");
    expect(tacticByKey(3)).toBe("soothe");
    expect(tacticByKey(9)).toBeNull();
  });
  it("bark returns worker to work, raises rage, applies boost", () => {
    const r = applyTactic(w(), "bark", 1);
    expect(r.activity).toBe("working");
    expect(r.rage).toBe(38);
    expect(r.boostMul).toBe(TACTICS.bark.boost);
    expect(r.boostTimer).toBe(TACTICS.bark.boostSeconds);
  });
  it("soothe lowers rage", () => {
    expect(applyTactic(w({ rage: 30 }), "soothe", 1).rage).toBe(5);
  });
  it("sensitivity amplifies the rage gain (hothead bark)", () => {
    expect(applyTactic(w(), "bark", 2).rage).toBe(66);
  });
  it("throws on unknown tactic", () => {
    expect(() => applyTactic(w(), "nope", 1)).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- tactics`
Expected: FAIL (module missing)

- [ ] **Step 3: tactics.js 구현**

```js
// public/construction-game/src/logic/tactics.js
import { CONFIG } from './config.js';
import { addRage } from './rage.js';

export const TACTICS = CONFIG.tactics;

export function tacticByKey(n) {
  for (const t of Object.values(TACTICS)) if (t.key === n) return t.id;
  return null;
}

// Confront a worker: instantly back to work + productivity boost, rage shifts per tactic.
export function applyTactic(worker, tacticId, sensitivity = 1) {
  const t = TACTICS[tacticId];
  if (!t) throw new Error(`unknown tactic: ${tacticId}`);
  addRage(worker, t.rageDelta, sensitivity);
  worker.activity = 'working';
  worker.slackTimer = 0; // re-armed by stepWorker on next tick
  worker.boostMul = t.boost;
  worker.boostTimer = t.boostSeconds;
  return worker;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- tactics`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add public/construction-game/src/logic/tactics.js __tests__/unit/construction-game/tactics.test.ts
git commit -m "feat(construction): tactic definitions (bark/taunt/soothe)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: workerState.js (상태 머신)

**Files:**
- Create: `public/construction-game/src/logic/workerState.js`
- Test: `__tests__/unit/construction-game/workerState.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/workerState.test.ts
import { describe, it, expect } from "vitest";
import { createWorker, deriveState, stepWorker, applySlackPressure } from "../../../public/construction-game/src/logic/workerState.js";

const HALF = () => 0.5; // deterministic rng → slackTimer == mean

describe("workerState", () => {
  it("createWorker starts working, calm, with archetype slack mean", () => {
    const wk = createWorker(1, "dozer", HALF);
    expect(wk.state).toBe("working");
    expect(wk.activity).toBe("working");
    expect(wk.rage).toBe(0);
    expect(wk.slackTimer).toBeCloseTo(10, 5); // dozer mean, variance*0
    expect(wk.escaped).toBe(false);
  });

  it("deriveState lets rage override activity", () => {
    expect(deriveState({ rage: 0, activity: "working" })).toBe("working");
    expect(deriveState({ rage: 0, activity: "slacking" })).toBe("slacking");
    expect(deriveState({ rage: 65, activity: "working" })).toBe("sabotage");
    expect(deriveState({ rage: 85, activity: "working" })).toBe("fleeing");
    expect(deriveState({ rage: 99, activity: "slacking" })).toBe("riot");
  });

  it("stepWorker turns a working worker into slacking when slackTimer elapses", () => {
    const wk = createWorker(1, "dozer", HALF); // slackTimer 10
    stepWorker(wk, 11);
    expect(wk.activity).toBe("slacking");
    expect(wk.state).toBe("slacking");
  });

  it("stepWorker decays rage and boost over time", () => {
    const wk = createWorker(1, "phone", HALF);
    wk.rage = 50; wk.boostMul = 2; wk.boostTimer = 5;
    stepWorker(wk, 1);
    expect(wk.rage).toBe(46);
    expect(wk.boostMul).toBe(2);
    expect(wk.boostTimer).toBe(4);
    stepWorker(wk, 10);
    expect(wk.boostMul).toBe(1);
    expect(wk.boostTimer).toBe(0);
  });

  it("applySlackPressure shortens slackTimer (chatter spread)", () => {
    const wk = createWorker(1, "dozer", HALF); // slackTimer 10
    applySlackPressure(wk, 1, 2); // removes 2s of timer this tick
    expect(wk.slackTimer).toBeCloseTo(8, 5);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- workerState`
Expected: FAIL (module missing)

- [ ] **Step 3: workerState.js 구현**

```js
// public/construction-game/src/logic/workerState.js
import { getArchetype } from './archetypes.js';
import { decayRage, rageStage } from './rage.js';

export const STATES = ['working', 'slacking', 'sabotage', 'fleeing', 'riot'];

export function createWorker(id, archetypeId, rng) {
  const a = getArchetype(archetypeId);
  const slackTimer = a.slackMeanSeconds + (rng() * 2 - 1) * a.slackVariance;
  return {
    id,
    archetypeId,
    state: 'working',
    activity: 'working',
    rage: 0,
    slackTimer: Math.max(2, slackTimer),
    boostMul: 1,
    boostTimer: 0,
    escaped: false,
  };
}

// State is rage-driven first; activity (working/slacking) only matters when calm.
export function deriveState(worker) {
  const stage = rageStage(worker.rage);
  if (stage !== 'calm') return stage; // sabotage | fleeing | riot
  return worker.activity === 'working' ? 'working' : 'slacking';
}

export function stepWorker(worker, dt) {
  // boost countdown
  if (worker.boostTimer > 0) {
    worker.boostTimer = Math.max(0, worker.boostTimer - dt);
    if (worker.boostTimer === 0) worker.boostMul = 1;
  }
  // natural rage cooldown
  decayRage(worker, dt);
  // working -> slacking when focus runs out
  if (worker.activity === 'working') {
    worker.slackTimer -= dt;
    if (worker.slackTimer <= 0) worker.activity = 'slacking';
  }
  worker.state = deriveState(worker);
  return worker;
}

// Chatter neighbours: pull a worker toward slacking sooner.
export function applySlackPressure(worker, dt, factor) {
  if (worker.activity === 'working') worker.slackTimer -= dt * factor;
  return worker;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- workerState`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add public/construction-game/src/logic/workerState.js __tests__/unit/construction-game/workerState.test.ts
git commit -m "feat(construction): worker state machine (work/slack/sabotage/flee/riot)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: production.js (작업 인원 → 진척 → 층 완공)

**Files:**
- Create: `public/construction-game/src/logic/production.js`
- Test: `__tests__/unit/construction-game/production.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/production.test.ts
import { describe, it, expect } from "vitest";
import { workerOutput, crewOutputPerSecond, advanceProgress } from "../../../public/construction-game/src/logic/production.js";

const wk = (over: any) => ({ archetypeId: "phone", state: "working", boostMul: 1, ...over });

describe("production", () => {
  it("working worker outputs baseRate*workRate*boost", () => {
    expect(workerOutput(wk({ archetypeId: "phone" }))).toBeCloseTo(1.0, 5); // 1*1.0*1
    expect(workerOutput(wk({ archetypeId: "dozer" }))).toBeCloseTo(0.9, 5); // 1*0.9*1
    expect(workerOutput(wk({ archetypeId: "hothead", boostMul: 2 }))).toBeCloseTo(2.2, 5); // 1*1.1*2
  });
  it("slacking/fleeing/riot output nothing; sabotage outputs reduced", () => {
    expect(workerOutput(wk({ state: "slacking" }))).toBe(0);
    expect(workerOutput(wk({ state: "fleeing" }))).toBe(0);
    expect(workerOutput(wk({ state: "riot" }))).toBe(0);
    expect(workerOutput(wk({ archetypeId: "phone", state: "sabotage" }))).toBeCloseTo(0.2, 5); // 1*1.0*0.2
  });
  it("crewOutputPerSecond sums outputs", () => {
    const out = crewOutputPerSecond([wk({}), wk({}), wk({ state: "slacking" })]);
    expect(out).toBeCloseTo(2.0, 5);
  });
  it("advanceProgress completes a floor when progress crosses floorProgress", () => {
    const r = advanceProgress({ progress: 90, floorsBuilt: 0 }, 20, 1); // +20 -> 110
    expect(r.floorsBuilt).toBe(1);
    expect(r.progress).toBeCloseTo(10, 5);
    expect(r.floorsCompletedThisStep).toBe(1);
  });
  it("advanceProgress can complete multiple floors in one step", () => {
    const r = advanceProgress({ progress: 50, floorsBuilt: 1 }, 250, 1); // +250 -> 300
    expect(r.floorsCompletedThisStep).toBe(3);
    expect(r.floorsBuilt).toBe(4);
    expect(r.progress).toBeCloseTo(0, 5);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- production`
Expected: FAIL (module missing)

- [ ] **Step 3: production.js 구현**

```js
// public/construction-game/src/logic/production.js
import { CONFIG } from './config.js';
import { getArchetype } from './archetypes.js';

export function workerOutput(worker) {
  const a = getArchetype(worker.archetypeId);
  const base = CONFIG.production.baseRatePerWorker * a.workRate;
  if (worker.state === 'working') return base * worker.boostMul;
  if (worker.state === 'sabotage') return base * CONFIG.production.sabotageRate;
  return 0; // slacking | fleeing | riot
}

export function crewOutputPerSecond(workers) {
  let sum = 0;
  for (const w of workers) sum += workerOutput(w);
  return sum;
}

// Pure: returns a NEW build state plus how many floors finished this step.
export function advanceProgress(build, outputPerSec, dt) {
  const floorProgress = CONFIG.production.floorProgress;
  let progress = build.progress + outputPerSec * dt;
  let floorsBuilt = build.floorsBuilt;
  let floorsCompletedThisStep = 0;
  while (progress >= floorProgress) {
    progress -= floorProgress;
    floorsBuilt += 1;
    floorsCompletedThisStep += 1;
  }
  return { progress, floorsBuilt, floorsCompletedThisStep };
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- production`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add public/construction-game/src/logic/production.js __tests__/unit/construction-game/production.test.ts
git commit -m "feat(construction): production accrual + floor completion" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: scoring.js (승패·점수·콤보)

**Files:**
- Create: `public/construction-game/src/logic/scoring.js`
- Test: `__tests__/unit/construction-game/scoring.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/scoring.test.ts
import { describe, it, expect } from "vitest";
import { isWin, isDefeat, evaluate, scoreMultiplier, computeScore } from "../../../public/construction-game/src/logic/scoring.js";

const base = {
  elapsed: 30, shiftSeconds: 180, floorsBuilt: 2, targetFloors: 5,
  crewRemaining: 8, crewCollapseThreshold: 2, combo: 0, incidents: 1,
};

describe("scoring", () => {
  it("win when target floors reached", () => {
    expect(isWin({ ...base, floorsBuilt: 5 })).toBe(true);
    expect(isWin({ ...base, floorsBuilt: 4 })).toBe(false);
  });
  it("defeat on time-out (not won) or crew collapse", () => {
    expect(isDefeat({ ...base, elapsed: 180, floorsBuilt: 4 })).toBe(true);
    expect(isDefeat({ ...base, crewRemaining: 1 })).toBe(true);
    expect(isDefeat(base)).toBe(false);
  });
  it("evaluate prioritises win over defeat over playing", () => {
    expect(evaluate({ ...base, floorsBuilt: 5, elapsed: 200 })).toBe("win");
    expect(evaluate({ ...base, elapsed: 200 })).toBe("defeat");
    expect(evaluate(base)).toBe("playing");
  });
  it("scoreMultiplier grows 0.1 per combo", () => {
    expect(scoreMultiplier(0)).toBeCloseTo(1.0, 5);
    expect(scoreMultiplier(3)).toBeCloseTo(1.3, 5);
  });
  it("computeScore = (floors*pts + remaining*bonus) * comboMul + noIncidentBonus", () => {
    // floors5*1000 + (180-30=150)*10 = 5000+1500 = 6500
    expect(computeScore({ ...base, floorsBuilt: 5, combo: 0, incidents: 1 })).toBe(6500);
    expect(computeScore({ ...base, floorsBuilt: 5, combo: 2, incidents: 1 })).toBe(Math.round(6500 * 1.2));
    expect(computeScore({ ...base, floorsBuilt: 5, combo: 0, incidents: 0 })).toBe(6500 + 2000);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- scoring`
Expected: FAIL (module missing)

- [ ] **Step 3: scoring.js 구현**

```js
// public/construction-game/src/logic/scoring.js
import { CONFIG } from './config.js';

export function isWin(s) {
  return s.floorsBuilt >= s.targetFloors;
}

export function isDefeat(s) {
  const timedOut = s.elapsed >= s.shiftSeconds && s.floorsBuilt < s.targetFloors;
  const collapsed = s.crewRemaining < s.crewCollapseThreshold;
  return timedOut || collapsed;
}

export function evaluate(s) {
  if (isWin(s)) return 'win';
  if (isDefeat(s)) return 'defeat';
  return 'playing';
}

export function scoreMultiplier(combo) {
  return 1 + Math.max(0, combo) * CONFIG.scoring.comboStep;
}

export function computeScore(s) {
  const { floorPoints, timeBonusPerSec, noIncidentBonus } = CONFIG.scoring;
  const remaining = Math.max(0, Math.floor(s.shiftSeconds - s.elapsed));
  const base = s.floorsBuilt * floorPoints + remaining * timeBonusPerSec;
  const total = Math.round(base * scoreMultiplier(s.combo));
  return total + (s.incidents === 0 ? noIncidentBonus : 0);
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `npm run test -- scoring`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add public/construction-game/src/logic/scoring.js __tests__/unit/construction-game/scoring.test.ts
git commit -m "feat(construction): win/lose + score + combo evaluation" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: spawn.js (시드 기반 결정적 배치)

**Files:**
- Create: `public/construction-game/src/logic/spawn.js`
- Test: `__tests__/unit/construction-game/spawn.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// __tests__/unit/construction-game/spawn.test.ts
import { describe, it, expect } from "vitest";
import { mulberry32, spawnWorkers, spawnProps } from "../../../public/construction-game/src/logic/spawn.js";

describe("spawn", () => {
  it("mulberry32 is deterministic for a seed", () => {
    const a = mulberry32(123), b = mulberry32(123);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
    expect(seqA[0]).toBeGreaterThanOrEqual(0);
    expect(seqA[0]).toBeLessThan(1);
  });
  it("spawnWorkers is deterministic and produces the requested count", () => {
    const r1 = spawnWorkers(7777, 8);
    const r2 = spawnWorkers(7777, 8);
    expect(r1).toHaveLength(8);
    expect(r1).toEqual(r2);
    for (const w of r1) {
      expect(["dozer", "phone", "chatter", "hothead"]).toContain(w.archetypeId);
      expect(Math.abs(w.x)).toBeLessThanOrEqual(22);
      expect(Math.abs(w.z)).toBeLessThanOrEqual(22);
    }
  });
  it("different seeds give different layouts", () => {
    expect(spawnWorkers(1, 8)).not.toEqual(spawnWorkers(2, 8));
  });
  it("spawnProps is deterministic", () => {
    expect(spawnProps(7777, 12)).toEqual(spawnProps(7777, 12));
    expect(spawnProps(7777, 12)).toHaveLength(12);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `npm run test -- spawn`
Expected: FAIL (module missing)

- [ ] **Step 3: spawn.js 구현**

```js
// public/construction-game/src/logic/spawn.js
import { CONFIG } from './config.js';
import { ARCHETYPE_LIST } from './archetypes.js';

// Small, fast, deterministic PRNG (returns 0..1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROP_KINDS = ['barrel', 'crate', 'cone', 'pipe', 'scaffold'];

export function spawnWorkers(seed, count) {
  const rng = mulberry32(seed);
  const halfW = CONFIG.site.width / 2 - 2;
  const halfD = CONFIG.site.depth / 2 - 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    const archetypeId = ARCHETYPE_LIST[Math.floor(rng() * ARCHETYPE_LIST.length)].id;
    const x = +((rng() * 2 - 1) * halfW).toFixed(3);
    const z = +((rng() * 2 - 1) * halfD).toFixed(3);
    out.push({ id: i, archetypeId, x, z });
  }
  return out;
}

export function spawnProps(seed, count) {
  const rng = mulberry32(seed + 555);
  const halfW = CONFIG.site.width / 2 - 1;
  const halfD = CONFIG.site.depth / 2 - 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    const kind = PROP_KINDS[Math.floor(rng() * PROP_KINDS.length)];
    const x = +((rng() * 2 - 1) * halfW).toFixed(3);
    const z = +((rng() * 2 - 1) * halfD).toFixed(3);
    out.push({ x, z, kind });
  }
  return out;
}
```

- [ ] **Step 4: 테스트 실행 → 통과 + 전체 로직 스위트 확인**

Run: `npm run test -- construction-game`
Expected: PASS (모든 Phase 1 테스트 통과)

- [ ] **Step 5: 커밋**

```bash
git add public/construction-game/src/logic/spawn.js __tests__/unit/construction-game/spawn.test.ts
git commit -m "feat(construction): seeded deterministic worker/prop spawning" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase 2 — 엔진 부트 & 허브 통합 (라우트가 뜨고 e2e 통과)

이 단계가 끝나면 `/construction-game`이 빈 조명 씬(바닥)을 콘솔 에러 없이 렌더하고, 허브 카드로 진입 가능하며, e2e가 통과한다.

### Task 8: index.html + style.css

**Files:**
- Create: `public/construction-game/index.html`
- Create: `public/construction-game/style.css`

- [ ] **Step 1: index.html 작성** (importmap·canvas·전체 DOM·WebGL 폴백)

```html
<!-- public/construction-game/index.html -->
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tantrum Tower — 호통 반장</title>
  <link rel="stylesheet" href="./style.css" />
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js",
      "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <canvas id="game"></canvas>

  <div id="webgl-error" class="overlay hidden">
    <div class="panel"><h1>WebGL을 사용할 수 없습니다</h1><p>WebGL을 지원하는 최신 브라우저에서 실행해 주세요.</p></div>
  </div>

  <div id="menu" class="overlay">
    <div class="panel">
      <h1 class="title">TANTRUM TOWER</h1>
      <p class="subtitle">폐급들을 다그쳐 마감 전에 탑을 올려라</p>
      <button id="start-btn" class="btn-primary">현장 투입</button>
      <div class="controls">
        <span>↑↓←→ / WASD</span><span>반장 이동</span>
        <span>1</span><span>윽박지르기 (빡침↑↑)</span>
        <span>2</span><span>비꼬기 (빡침↑)</span>
        <span>3</span><span>달래기 (빡침↓)</span>
        <span>Esc</span><span>일시정지</span>
      </div>
    </div>
  </div>

  <div id="hud" class="hidden">
    <div id="hud-time">⏱ <span id="time-val">180</span>s</div>
    <div id="hud-floors">🏢 <span id="floor-val">0</span> / <span id="floor-total">5</span>층</div>
    <div id="hud-progress"><div id="progress-fill"></div></div>
    <div id="hud-crew">👷 <span id="crew-val">8</span></div>
    <div id="hud-score">⭐ <span id="score-val">0</span></div>
    <div id="hud-combo" class="hidden">🔥 <span id="combo-val">0</span> COMBO</div>
    <div id="hud-hint">↑↓←→/WASD 이동 · 1 윽박 · 2 비꼬기 · 3 달래기 · Esc 정지</div>
  </div>

  <div id="confront" class="hidden">
    <div id="confront-name">졸보</div>
    <div id="confront-rage"><div id="confront-rage-fill"></div></div>
    <div class="confront-tactics">
      <span><b>1</b> 💢 윽박</span><span><b>2</b> 😏 비꼬기</span><span><b>3</b> 🤝 달래기</span>
    </div>
  </div>

  <div id="pause" class="overlay hidden">
    <div class="panel">
      <h1 class="title" style="font-size:34px">일시정지</h1>
      <button id="resume-btn" class="btn-primary">계속하기</button>
      <button id="restart-btn" class="btn-primary" style="margin-top:12px;background:linear-gradient(135deg,#bbb,#888)">처음으로</button>
    </div>
  </div>

  <div id="result" class="overlay hidden">
    <div class="panel">
      <h1 id="result-title" class="title" style="font-size:40px">완공!</h1>
      <p id="result-detail" class="subtitle">점수 0</p>
      <button id="result-restart" class="btn-primary">다시 도전 (R)</button>
    </div>
  </div>

  <div id="toast" class="toast hidden"></div>

  <script type="module" src="./src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: style.css 작성** (사막 게임 톤 미러 + 건설 팔레트)

```css
/* public/construction-game/style.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #14181d; font-family: system-ui, sans-serif; }
#game { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
.hidden { display: none !important; }
.overlay { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(160deg, #20262e, #3a2f1a); z-index: 10; }
.panel { background: rgba(0,0,0,.5); border: 1px solid rgba(255,200,90,.3); border-radius: 18px;
  padding: 40px 48px; text-align: center; backdrop-filter: blur(8px); color: #fff; max-width: 520px; }
.title { font-size: 50px; letter-spacing: 3px; color: #ffd24a; text-shadow: 0 0 24px rgba(255,170,40,.6); }
.subtitle { margin: 10px 0 28px; color: #ffe0a0; }
.btn-primary { font-size: 20px; font-weight: 700; color: #2a1c08; background: linear-gradient(135deg,#ffd24a,#ff9d2e);
  border: none; border-radius: 14px; padding: 14px 40px; cursor: pointer; transition: transform .15s; display: block; width: 100%; }
.btn-primary:hover { transform: scale(1.05); }
.controls { display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; margin-top: 26px; font-size: 13px; color: #e8d3b8; text-align: left; }
.controls span:nth-child(odd) { font-weight: 700; color: #ffd24a; }

#hud { position: fixed; inset: 0; pointer-events: none; z-index: 5; color: #fff; text-shadow: 0 2px 6px rgba(0,0,0,.7); }
#hud-time { position: absolute; top: 14px; left: 50%; transform: translateX(-50%);
  background: rgba(0,0,0,.45); padding: 6px 16px; border-radius: 20px; font-size: 22px; font-weight: 800; color: #ffe0a0; }
#hud-floors { position: absolute; top: 14px; left: 16px; background: rgba(0,0,0,.45); padding: 6px 14px; border-radius: 20px; font-weight: 700; }
#hud-progress { position: absolute; top: 52px; left: 16px; width: 160px; height: 8px; background: rgba(0,0,0,.5); border-radius: 6px; overflow: hidden; }
#progress-fill { height: 100%; width: 0%; background: linear-gradient(90deg,#ffd24a,#ff9d2e); transition: width .2s; }
#hud-crew { position: absolute; top: 14px; right: 16px; background: rgba(0,0,0,.45); padding: 6px 14px; border-radius: 20px; font-weight: 700; }
#hud-score { position: absolute; top: 50px; right: 16px; background: rgba(0,0,0,.45); padding: 6px 14px; border-radius: 20px; color: #ffd24a; font-weight: 700; }
#hud-combo { position: absolute; top: 86px; right: 16px; background: rgba(220,80,20,.7); padding: 5px 12px; border-radius: 16px; color: #fff; font-weight: 800; font-size: 13px; }
#hud-hint { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); white-space: nowrap; font-size: 11px; opacity: .75; }

#confront { position: fixed; left: 50%; bottom: 64px; transform: translateX(-50%); z-index: 6;
  background: rgba(0,0,0,.62); border: 1px solid rgba(255,200,90,.35); border-radius: 14px;
  padding: 12px 18px; text-align: center; color: #fff; min-width: 240px; }
#confront-name { font-weight: 800; color: #ffd24a; margin-bottom: 6px; }
#confront-rage { width: 100%; height: 7px; background: rgba(255,255,255,.18); border-radius: 5px; overflow: hidden; margin-bottom: 8px; }
#confront-rage-fill { height: 100%; width: 0%; background: linear-gradient(90deg,#7ec96f,#ffcf3a,#ff5a3a); transition: width .15s; }
.confront-tactics { display: flex; gap: 14px; justify-content: center; font-size: 13px; }
.confront-tactics b { color: #ffd24a; margin-right: 3px; }

.toast { position: fixed; top: 92px; left: 50%; transform: translateX(-50%); z-index: 8;
  background: rgba(0,0,0,.6); color: #ffe0a0; padding: 12px 22px; border-radius: 12px; font-weight: 700;
  transition: opacity .4s; pointer-events: none; }
```

- [ ] **Step 3: 커밋**

```bash
git add public/construction-game/index.html public/construction-game/style.css
git commit -m "feat(construction): page shell (DOM, importmap, styles)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: core/Game.js + core/Input.js (엔진 + 입력)

**Files:**
- Create: `public/construction-game/src/core/Game.js`
- Create: `public/construction-game/src/core/Input.js`

- [ ] **Step 1: Game.js 작성** (PS2 기본값: antialias 끔, pixelRatio 1, 안개; `pipeline` seam; 게임 상태·step 오케스트레이션)

```js
// public/construction-game/src/core/Game.js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x9fb0bf);
    this.scene.fog = new THREE.Fog(0x9fb0bf, 48, 130);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 2000);
    this.camera.position.set(0, 24, 26);
    this.camera.lookAt(0, 4, 0);

    this.clock = new THREE.Clock();
    this.running = false;
    this.started = false;
    this.systems = [];      // { update(dt, game) }
    this.pipeline = null;   // optional RetroPipeline; falls back to direct render

    // gameplay state (orchestrated in step())
    this.status = 'menu';   // 'menu' | 'playing' | 'win' | 'defeat'
    this.elapsed = 0;
    this.build = { progress: 0, floorsBuilt: 0 };
    this.combo = 0;
    this.incidents = 0;     // flee + riot events
    this.crewRemaining = CONFIG.workerCount;
    this.step = null;       // set by main.js: (dt, game) => void

    this._onResize = () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.pipeline) this.pipeline.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', this._onResize);
  }

  add(system) {
    this.systems.push(system);
    if (system.object3d) this.scene.add(system.object3d);
    return system;
  }

  render() {
    if (this.pipeline) this.pipeline.render(this.renderer, this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
  }

  start() {
    this.started = true;
    if (this.running) return;
    this.running = true;
    this.clock.start();
    const loop = () => {
      if (!this.running) return;
      const dt = Math.min(0.05, this.clock.getDelta());
      for (const s of this.systems) s.update && s.update(dt, this);
      if (this.step) this.step(dt, this);
      this.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() { this.running = false; }
  dispose() { this.stop(); window.removeEventListener('resize', this._onResize); this.renderer.dispose(); }
}
```

- [ ] **Step 2: Input.js 작성** (이동 + 전술키 1/2/3 엣지트리거 큐)

```js
// public/construction-game/src/core/Input.js
export class Input {
  constructor() {
    this.state = { moveX: 0, moveZ: 0, tactic: 0 };
    this.keys = new Set();
    this._tacticQueue = [];
    this._down = (e) => {
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Digit1', 'Digit2', 'Digit3'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === 'Digit1') this._tacticQueue.push(1);
      if (e.code === 'Digit2') this._tacticQueue.push(2);
      if (e.code === 'Digit3') this._tacticQueue.push(3);
    };
    this._up = (e) => this.keys.delete(e.code);
    window.addEventListener('keydown', this._down);
    window.addEventListener('keyup', this._up);
  }

  sample() {
    const has = (c) => this.keys.has(c);
    const s = this.state;
    s.moveX = (has('ArrowRight') || has('KeyD') ? 1 : 0) - (has('ArrowLeft') || has('KeyA') ? 1 : 0);
    s.moveZ = (has('ArrowDown') || has('KeyS') ? 1 : 0) - (has('ArrowUp') || has('KeyW') ? 1 : 0);
    s.tactic = this._tacticQueue.shift() || 0; // edge-triggered, one tactic per frame
    return s;
  }

  dispose() {
    window.removeEventListener('keydown', this._down);
    window.removeEventListener('keyup', this._up);
  }
}
```

- [ ] **Step 3: 커밋** (main.js가 아직 import하지 않아 독립 커밋 가능)

```bash
git add public/construction-game/src/core/Game.js public/construction-game/src/core/Input.js
git commit -m "feat(construction): engine core (Game loop + Input)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: main.js (부트 + 빈 조명 씬 + 폴백 + 토스트)

이 단계는 라우트가 "뜨는" 최소 부트다. 월드/엔티티는 Phase 3에서 추가하며, main.js는 그때마다 와이어링을 늘린다.

**Files:**
- Create: `public/construction-game/src/main.js`

- [ ] **Step 1: main.js 작성** (최소 부트: 조명 + 바닥 + 시작 버튼)

```js
// public/construction-game/src/main.js
import * as THREE from 'three';
import { Game } from './core/Game.js';
import { Input } from './core/Input.js';
import { CONFIG } from './logic/config.js';

const canvas = document.getElementById('game');
const menu = document.getElementById('menu');
const hudEl = document.getElementById('hud');
const startBtn = document.getElementById('start-btn');
const toast = document.getElementById('toast');

let toastTimer = 0;
export function showToast(msg) {
  toast.textContent = msg;
  toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 2200);
}

let game = null;
try {
  game = new Game(canvas);
} catch (err) {
  console.error('[construction-game] WebGL unavailable', err);
  document.getElementById('webgl-error').classList.remove('hidden');
}

if (game) {
  // lighting: flat, PS2-ish — hemisphere + a soft directional
  const hemi = new THREE.HemisphereLight(0xffffff, 0x556070, 1.0);
  game.scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xfff0d0, 0.7);
  dir.position.set(20, 40, 10);
  game.scene.add(dir);

  // temporary ground so the empty scene renders something (replaced by Site in Phase 3)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.site.width, CONFIG.site.depth),
    new THREE.MeshLambertMaterial({ color: 0x8a8170 })
  );
  ground.rotation.x = -Math.PI / 2;
  game.scene.add(ground);

  const input = new Input();
  game.input = input;

  startBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    hudEl.classList.remove('hidden');
    game.status = 'playing';
    game.start();
  });

  console.log('[construction-game] ready');
}
```

- [ ] **Step 2: 로컬 확인** — `npm run dev` 후 브라우저에서 `http://localhost:3000/construction-game/index.html`

Expected: 메뉴 오버레이 표시 → "현장 투입" 클릭 시 회색 바닥이 보이는 씬. 콘솔에 `[construction-game] ready`, 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add public/construction-game/src/main.js
git commit -m "feat(construction): bootstrap (lights, ground, start wiring, toast)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 11: 라우트 래퍼 page.tsx + 허브 카드

**Files:**
- Create: `app/construction-game/page.tsx`
- Modify: `app/page.tsx` (사막 카드 `</Link>` 다음에 5번째 카드 추가)

- [ ] **Step 1: app/construction-game/page.tsx 작성** (사막 게임 래퍼 패턴 그대로)

```tsx
// app/construction-game/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { LoadingOverlay } from "@/app/_components/LoadingOverlay";

export default function ConstructionGame() {
  const [loading, setLoading] = useState(true);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Link
        href="/"
        className="absolute left-4 top-4 z-10 flex items-center gap-2 rounded-lg bg-black/70 px-4 py-2 text-white transition-colors hover:bg-black/90"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
        홈으로
      </Link>
      {loading && <LoadingOverlay />}
      <iframe
        src="/construction-game/index.html"
        className="h-full w-full border-0"
        title="Tantrum Tower - 막장 건설 현장 관리"
        allow="fullscreen"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
```

- [ ] **Step 2: app/page.tsx에 5번째 카드 추가** — 사막 카드의 닫는 `</Link>`(line 115 부근) 바로 다음, `</div>`(grid 닫기) 앞에 삽입

```tsx
          {/* 건설 관리 카드 */}
          <Link href="/construction-game" aria-label="Tantrum Tower 건설 관리 게임 플레이하기">
            <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-yellow-500 to-amber-700 p-8 shadow-2xl transition-all duration-300 hover:scale-105 hover:shadow-amber-500/50 cursor-pointer">
              <div aria-hidden="true" className="absolute -right-8 -top-8 text-9xl opacity-20">
                🏗️
              </div>
              <div className="relative z-10">
                <h2 className="mb-3 text-3xl font-bold text-white">
                  Tantrum Tower
                </h2>
                <p className="mb-4 text-white/90">
                  폐급 일꾼들을 다그쳐 마감 전에 탑을 올리세요!
                </p>
                <ul className="mb-6 space-y-2 text-sm text-white/80">
                  <li>✓ PS2 레트로 로우폴리 룩</li>
                  <li>✓ 윽박·비꼬기·달래기 양날의 검</li>
                  <li>✓ 빡침 관리 · 콤보 점수</li>
                </ul>
                <div className="inline-block rounded-full bg-white/20 px-6 py-2 font-semibold text-white backdrop-blur-sm transition-colors group-hover:bg-white/30">
                  플레이하기 →
                </div>
              </div>
            </div>
          </Link>
```

- [ ] **Step 3: 확인** — `npm run dev` 후 `http://localhost:3000/` 에서 5번째 카드 클릭 → `/construction-game` 진입 → iframe 로드, 메뉴 표시.

- [ ] **Step 4: 커밋**

```bash
git add app/construction-game/page.tsx app/page.tsx
git commit -m "feat(construction): hub card + route iframe wrapper" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 12: CI 설정 (eslint ignore + vitest coverage)

**Files:**
- Modify: `eslint.config.mjs` (globalIgnores 배열)
- Modify: `vitest.config.ts` (coverage.include 배열)

- [ ] **Step 1: eslint.config.mjs의 globalIgnores에 추가** — `"public/desert-game/**",` 다음 줄에

```js
    "public/desert-game/**",
    "public/construction-game/**",
```

- [ ] **Step 2: vitest.config.ts의 coverage.include에 추가** — `'public/desert-game/src/**',` 다음 줄에

```js
        'public/desert-game/src/**',
        'public/construction-game/src/**',
```

- [ ] **Step 3: lint + test 통과 확인**

Run: `npm run lint && npm run test -- construction-game`
Expected: lint 통과(건설 게임 JS는 ignore됨), 모든 로직 테스트 통과.

- [ ] **Step 4: 커밋**

```bash
git add eslint.config.mjs vitest.config.ts
git commit -m "chore(construction): wire eslint ignore + vitest coverage" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 13: e2e/construction-game.spec.ts

**Files:**
- Create: `e2e/construction-game.spec.ts`

- [ ] **Step 1: e2e 스펙 작성** (사막 스펙 패턴 그대로)

```ts
// e2e/construction-game.spec.ts
import { test, expect } from "@playwright/test";

test.describe("Tantrum Tower construction game", () => {
  test("hub card navigates to the game", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Tantrum Tower/ }).click();
    await expect(page).toHaveURL(/\/construction-game/);
    await expect(page.locator('iframe[title*="Tantrum Tower"]')).toBeVisible();
  });

  test("game canvas mounts without console errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/construction-game/index.html");
    await expect(page.locator("canvas#game")).toBeVisible();
    await page.waitForTimeout(1500); // allow boot
    expect(errors, errors.join("\n")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: e2e 실행 → 통과 확인**

Run: `npm run test:e2e -- construction-game`
Expected: 2 tests PASS.

- [ ] **Step 3: 커밋**

```bash
git add e2e/construction-game.spec.ts
git commit -m "test(construction): e2e route + canvas boot" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase 3 — 월드·엔티티·카메라 (프리미티브 게임플레이)

이 단계가 끝나면 일꾼들이 농땡이↔작업을 오가고, 빡침이 차오르고, 카메라가 반장을 따라가는 "살아있는" 디오라마가 박스 프리미티브로 동작한다(생산·시비·UI는 Phase 4).

### Task 14: world/Site.js (바닥 + 소품 InstancedMesh + 출구)

**Files:**
- Create: `public/construction-game/src/world/Site.js`
- Modify: `public/construction-game/src/main.js` (임시 바닥 제거 → Site 추가)

- [ ] **Step 1: Site.js 작성**

```js
// public/construction-game/src/world/Site.js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { spawnProps } from '../logic/spawn.js';

const PROP_GEO = {
  barrel: () => new THREE.CylinderGeometry(0.5, 0.5, 1.2, 8),
  crate: () => new THREE.BoxGeometry(1, 1, 1),
  cone: () => new THREE.ConeGeometry(0.45, 1, 8),
  pipe: () => new THREE.CylinderGeometry(0.25, 0.25, 2.4, 6),
  scaffold: () => new THREE.BoxGeometry(0.3, 3, 0.3),
};
const PROP_COLOR = { barrel: 0x9a6b3a, crate: 0xb59148, cone: 0xff7a2a, pipe: 0x8893a0, scaffold: 0xb0b6bd };

export class Site {
  constructor() {
    this.object3d = new THREE.Group();

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.site.width, CONFIG.site.depth),
      new THREE.MeshLambertMaterial({ color: 0x8a8170 })
    );
    ground.rotation.x = -Math.PI / 2;
    this.object3d.add(ground);

    // perimeter barricades (4 thin boxes)
    const barMat = new THREE.MeshLambertMaterial({ color: 0xd8a93a });
    const w = CONFIG.site.width, d = CONFIG.site.depth;
    const edges = [
      [0, -d / 2, w, 0.4], [0, d / 2, w, 0.4],
      [-w / 2, 0, 0.4, d], [w / 2, 0, 0.4, d],
    ];
    for (const [x, z, sx, sz] of edges) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(sx, 1, sz), barMat);
      bar.position.set(x, 0.5, z);
      this.object3d.add(bar);
    }

    // exit gate marker (where fleeing workers escape)
    const gate = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.1, 0.6),
      new THREE.MeshLambertMaterial({ color: 0x2ec16b })
    );
    gate.position.set(CONFIG.exit.x, 0.06, CONFIG.exit.z);
    this.object3d.add(gate);

    // static props via InstancedMesh, grouped by kind
    const props = spawnProps(CONFIG.seed, 16);
    const byKind = {};
    for (const p of props) (byKind[p.kind] ||= []).push(p);
    const m4 = new THREE.Matrix4();
    for (const kind of Object.keys(byKind)) {
      const list = byKind[kind];
      const mesh = new THREE.InstancedMesh(
        PROP_GEO[kind](),
        new THREE.MeshLambertMaterial({ color: PROP_COLOR[kind], flatShading: true }),
        list.length
      );
      list.forEach((p, i) => {
        m4.makeTranslation(p.x, 0.6, p.z);
        mesh.setMatrixAt(i, m4);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.object3d.add(mesh);
    }
  }
}
```

- [ ] **Step 2: main.js 수정** — 임시 ground 블록 삭제, Site import + 추가

main.js 상단 import에 추가:
```js
import { Site } from './world/Site.js';
```
`// temporary ground ...` 로 시작하는 `ground` 생성·추가 4줄을 삭제하고 그 자리에:
```js
  game.add(new Site());
```

- [ ] **Step 3: 확인** — `npm run dev` → 현장 바닥·바리케이드·소품·녹색 출구 표시.

- [ ] **Step 4: 커밋**

```bash
git add public/construction-game/src/world/Site.js public/construction-game/src/main.js
git commit -m "feat(construction): construction site (ground, barricades, instanced props, exit)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 15: world/Building.js (층수에 따른 단계별 건물)

**Files:**
- Create: `public/construction-game/src/world/Building.js`
- Modify: `public/construction-game/src/main.js`

- [ ] **Step 1: Building.js 작성** (프리미티브: 완공 층마다 박스 한 칸 쌓기 + 현재 작업층 반투명)

```js
// public/construction-game/src/world/Building.js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

const FLOOR_H = 2.4;
const FOOTPRINT = 10;

export class Building {
  constructor() {
    this.object3d = new THREE.Group();
    this.object3d.position.set(0, 0, -6);
    this.floors = []; // completed floor meshes
    this.floorMat = new THREE.MeshLambertMaterial({ color: 0xb8b0a0, flatShading: true });

    // foundation slab
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(FOOTPRINT + 1, 0.5, FOOTPRINT + 1),
      new THREE.MeshLambertMaterial({ color: 0x6e6a63 })
    );
    slab.position.y = 0.25;
    this.object3d.add(slab);

    // "under construction" ghost for the floor in progress
    this.ghost = new THREE.Mesh(
      new THREE.BoxGeometry(FOOTPRINT, FLOOR_H, FOOTPRINT),
      new THREE.MeshLambertMaterial({ color: 0xffd24a, transparent: true, opacity: 0.25, flatShading: true })
    );
    this.object3d.add(this.ghost);
    this._positionGhost(0, 0);
  }

  _positionGhost(floorsBuilt, progress01) {
    const y = 0.5 + floorsBuilt * FLOOR_H + (FLOOR_H * progress01) / 2;
    this.ghost.position.set(0, y, 0);
    this.ghost.scale.y = Math.max(0.05, progress01);
    this.ghost.visible = floorsBuilt < CONFIG.targetFloors;
  }

  // Called by Game.step each frame with current build state.
  sync(floorsBuilt, progress01) {
    while (this.floors.length < floorsBuilt) {
      const i = this.floors.length;
      const floor = new THREE.Mesh(new THREE.BoxGeometry(FOOTPRINT, FLOOR_H, FOOTPRINT), this.floorMat);
      floor.position.set(0, 0.5 + i * FLOOR_H + FLOOR_H / 2, 0);
      this.object3d.add(floor);
      this.floors.push(floor);
    }
    this._positionGhost(floorsBuilt, progress01);
  }
}
```

- [ ] **Step 2: main.js 수정** — import + 생성, `game.building` 참조 보관

import 추가:
```js
import { Building } from './world/Building.js';
```
Site 추가 다음에:
```js
  const building = game.add(new Building());
  game.building = building;
```

- [ ] **Step 3: 확인** — `npm run dev` → 건물 기초 슬래브 + 반투명 작업층 고스트 표시(아직 층 상승 없음; Phase 3 Task 17에서 step이 sync 호출).

- [ ] **Step 4: 커밋**

```bash
git add public/construction-game/src/world/Building.js public/construction-game/src/main.js
git commit -m "feat(construction): staged building with rising floors + ghost" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 16: entities/Foreman.js + camera/DioramaCamera.js

**Files:**
- Create: `public/construction-game/src/entities/Foreman.js`
- Create: `public/construction-game/src/camera/DioramaCamera.js`
- Modify: `public/construction-game/src/main.js`

- [ ] **Step 1: Foreman.js 작성**

```js
// public/construction-game/src/entities/Foreman.js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';

export class Foreman {
  constructor(input) {
    this.input = input;
    this.object3d = new THREE.Group();
    this.speed = 12;

    const mat = new THREE.MeshLambertMaterial({ color: 0xffcc33, flatShading: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.2, 3, 6), mat);
    body.position.y = 1.2;
    this.object3d.add(body);
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: 0xff7a2a, flatShading: true })
    );
    helmet.position.y = 2.0;
    this.object3d.add(helmet);

    this.position = this.object3d.position;
    this.position.set(0, 0, 8);
  }

  // optional model swap (Phase 6)
  setModel(obj) {
    this.object3d.clear();
    obj.position.y = 0;
    this.object3d.add(obj);
  }

  update(dt) {
    const s = this.input.sample(); // single sampler for the frame
    const len = Math.hypot(s.moveX, s.moveZ);
    if (len > 0) {
      const nx = s.moveX / len, nz = s.moveZ / len;
      this.position.x += nx * this.speed * dt;
      this.position.z += nz * this.speed * dt;
      const halfW = CONFIG.site.width / 2 - 1, halfD = CONFIG.site.depth / 2 - 1;
      this.position.x = Math.max(-halfW, Math.min(halfW, this.position.x));
      this.position.z = Math.max(-halfD, Math.min(halfD, this.position.z));
      this.object3d.rotation.y = Math.atan2(nx, nz);
    }
  }
}
```

- [ ] **Step 2: DioramaCamera.js 작성** (감독뷰 추종 + `pushIn()` 시비 클로즈업)

```js
// public/construction-game/src/camera/DioramaCamera.js
import * as THREE from 'three';

export class DioramaCamera {
  constructor(camera, foreman) {
    this.camera = camera;
    this.foreman = foreman;
    this.mode = 'overseer';
    this.focus = null;
    this.holdTimer = 0;
    this.overseerOffset = new THREE.Vector3(0, 22, 24);
    this._desired = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  pushIn(targetObject3d, seconds = 1.4) {
    this.focus = targetObject3d;
    this.mode = 'pushin';
    this.holdTimer = seconds;
  }

  update(dt) {
    const f = this.foreman.position;
    let k;
    if (this.mode === 'pushin' && this.focus) {
      this.holdTimer -= dt;
      const w = this.focus.position;
      const mx = (f.x + w.x) / 2, my = (f.y + w.y) / 2 + 1.4, mz = (f.z + w.z) / 2;
      this._look.set(mx, my, mz);
      this._desired.set(mx, my + 3.5, mz + 8);
      k = 1 - Math.pow(0.002, dt);
      if (this.holdTimer <= 0) { this.mode = 'overseer'; this.focus = null; }
    } else {
      this._desired.set(f.x + this.overseerOffset.x, this.overseerOffset.y, f.z + this.overseerOffset.z);
      this._look.set(f.x, 3, f.z - 4);
      k = 1 - Math.pow(0.004, dt);
    }
    this.camera.position.lerp(this._desired, k);
    this.camera.lookAt(this._look);
  }
}
```

- [ ] **Step 3: main.js 수정** — Foreman + DioramaCamera 추가, 참조 보관

import 추가:
```js
import { Foreman } from './entities/Foreman.js';
import { DioramaCamera } from './camera/DioramaCamera.js';
```
Building 추가 다음에:
```js
  const foreman = game.add(new Foreman(input));
  game.foreman = foreman;
  game.systems.push(new DioramaCamera(game.camera, foreman));
```

- [ ] **Step 4: 확인** — `npm run dev` → 시작 후 WASD/방향키로 노란 반장(헬멧)이 현장을 이동하고 카메라가 부드럽게 추종.

- [ ] **Step 5: 커밋**

```bash
git add public/construction-game/src/entities/Foreman.js public/construction-game/src/camera/DioramaCamera.js public/construction-game/src/main.js
git commit -m "feat(construction): foreman avatar + diorama follow camera" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 17: entities/Worker.js + Game.step 와이어링 (일꾼이 살아 움직임)

**Files:**
- Create: `public/construction-game/src/entities/Worker.js`
- Modify: `public/construction-game/src/main.js` (일꾼 스폰 + `game.step` 정의)

- [ ] **Step 1: Worker.js 작성** (로직 래핑 + 상태색 + 아이콘/게이지 스프라이트 + 공간 이동)

```js
// public/construction-game/src/entities/Worker.js
import * as THREE from 'three';
import { CONFIG } from '../logic/config.js';
import { getArchetype } from '../logic/archetypes.js';
import { stepWorker } from '../logic/workerState.js';

const STATE_COLOR = {
  working: 0x6fae6f, slacking: 0xd8c24a, sabotage: 0xe08a2a, fleeing: 0xe05a3a, riot: 0xa44ad0,
};
const STATE_ICON = { slacking: '❗', sabotage: '😠', fleeing: '🏃', riot: '✊' };

function makeStatusSprite() {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 96;
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.4, 1.8, 1);
  sprite.position.y = 3.4;
  return { sprite, canvas, tex, ctx: canvas.getContext('2d') };
}

export class Worker {
  constructor(logic, x, z, exit) {
    this.logic = logic;
    this.archetype = getArchetype(logic.archetypeId);
    this.exit = exit;
    this.object3d = new THREE.Group();
    this.object3d.position.set(x, 0, z);
    this.home = new THREE.Vector2(x, z);
    this.position = this.object3d.position;
    this.justEscaped = false;
    this.enteredRiot = false;

    this.bodyMat = new THREE.MeshLambertMaterial({ color: this.archetype.color, flatShading: true });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.0, 3, 6), this.bodyMat);
    body.position.y = 1.0;
    this.object3d.add(body);

    const s = makeStatusSprite();
    this.statusSprite = s.sprite; this._canvas = s.canvas; this._tex = s.tex; this._ctx = s.ctx;
    this.object3d.add(this.statusSprite);
    this._lastKey = '';
    this._wanderPhase = Math.random() * 6.28;

    this._redraw();
  }

  setModel(obj) {
    // Phase 6: keep the status sprite, swap the capsule body
    this.object3d.children = this.object3d.children.filter((c) => c === this.statusSprite);
    obj.position.y = 0;
    this.object3d.add(obj);
  }

  _redraw() {
    const w = this.logic;
    const icon = STATE_ICON[w.state] || (w.state === 'working' ? '' : this.archetype.icon);
    const rage01 = w.rage / CONFIG.rage.max;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, 128, 96);
    if (icon) { ctx.font = '52px serif'; ctx.textAlign = 'center'; ctx.fillText(icon, 64, 52); }
    // rage bar
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(20, 70, 88, 12);
    ctx.fillStyle = rage01 > 0.8 ? '#ff5a3a' : rage01 > 0.6 ? '#ffcf3a' : '#7ec96f';
    ctx.fillRect(22, 72, 84 * rage01, 8);
    this._tex.needsUpdate = true;
  }

  update(dt) {
    const w = this.logic;
    if (w.escaped) { this.object3d.visible = false; return; }

    stepWorker(w, dt);
    this.bodyMat.color.setHex(STATE_COLOR[w.state]);

    // spatial behaviour by state
    const p = this.position;
    if (w.state === 'fleeing') {
      const dx = this.exit.x - p.x, dz = this.exit.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.8) { w.escaped = true; this.justEscaped = true; }
      else { p.x += (dx / d) * CONFIG.worker.fleeSpeed * dt; p.z += (dz / d) * CONFIG.worker.fleeSpeed * dt; }
      this.object3d.rotation.y = Math.atan2(dx, dz);
    } else if (w.state === 'riot') {
      if (!this.enteredRiot) this.enteredRiot = true; // flagged; Game counts incident
      this.object3d.position.y = Math.abs(Math.sin(performance.now() / 90)) * 0.3; // jump in place
    } else {
      this.object3d.position.y = 0;
      // gentle wander around home while slacking; drift to home while working
      this._wanderPhase += dt;
      const tx = w.state === 'working' ? this.home.x : this.home.x + Math.cos(this._wanderPhase) * CONFIG.worker.wanderRadius;
      const tz = w.state === 'working' ? this.home.y : this.home.y + Math.sin(this._wanderPhase) * CONFIG.worker.wanderRadius;
      p.x += (tx - p.x) * Math.min(1, CONFIG.worker.moveSpeed * dt * 0.4);
      p.z += (tz - p.z) * Math.min(1, CONFIG.worker.moveSpeed * dt * 0.4);
    }

    // redraw status sprite only when icon or rage bucket changes
    const key = `${w.state}:${Math.round(w.rage / 5)}`;
    if (key !== this._lastKey) { this._lastKey = key; this._redraw(); }
  }
}
```

- [ ] **Step 2: main.js 수정** — 일꾼 스폰 + `game.step` 정의 (상태 진행 + 건물 sync + 채터 전염 + 인력/사고 집계)

import 추가:
```js
import { Worker } from './entities/Worker.js';
import { createWorker } from './logic/workerState.js';
import { spawnWorkers, mulberry32 } from './logic/spawn.js';
import { crewOutputPerSecond, advanceProgress } from './logic/production.js';
import { applySlackPressure } from './logic/workerState.js';
import { getArchetype } from './logic/archetypes.js';
```
DioramaCamera 추가 다음에:
```js
  // spawn workers
  const placed = spawnWorkers(CONFIG.seed, CONFIG.workerCount);
  const rng = mulberry32(CONFIG.seed + 99);
  const workers = placed.map((p) => {
    const logic = createWorker(p.id, p.archetypeId, rng);
    return game.add(new Worker(logic, p.x, p.z, CONFIG.exit));
  });
  game.workers = workers;

  // per-frame gameplay orchestration
  game.step = (dt, g) => {
    if (g.status !== 'playing') return;
    g.elapsed += dt;

    // chatter spread: a slacking chatter pulls nearby workers toward slacking
    for (const cw of workers) {
      if (!cw.archetype.spreads || cw.logic.state !== 'slacking' || cw.logic.escaped) continue;
      for (const ow of workers) {
        if (ow === cw || ow.logic.escaped) continue;
        const dx = ow.position.x - cw.position.x, dz = ow.position.z - cw.position.z;
        if (dx * dx + dz * dz <= CONFIG.chatterSpreadRadius ** 2) {
          applySlackPressure(ow.logic, dt, CONFIG.chatterSpreadFactor);
        }
      }
    }

    // production from currently-working crew
    const active = workers.filter((w) => !w.logic.escaped);
    const output = crewOutputPerSecond(active.map((w) => w.logic));
    const res = advanceProgress(g.build, output, dt);
    g.build = { progress: res.progress, floorsBuilt: res.floorsBuilt };
    g.building.sync(res.floorsBuilt, res.progress / CONFIG.production.floorProgress);

    // incidents (escape) + combo reset on any rage explosion
    for (const w of workers) {
      if (w.justEscaped) { w.justEscaped = false; g.incidents += 1; g.combo = 0; }
    }
    if (active.some((w) => w.logic.state === 'sabotage' || w.logic.state === 'fleeing' || w.logic.state === 'riot')) {
      g.combo = 0;
    }
    g.crewRemaining = active.length;
  };
```

- [ ] **Step 3: 확인** — `npm run dev` → 일꾼들이 작업(녹색)→농땡이(노랑, 배회+❗)로 전환되고, 시간이 지나면 빡침 게이지가 오르며(자연감소로 천천히), 건물 고스트가 미세하게 차오른다(작업 인원 있을 때). 콘솔 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add public/construction-game/src/entities/Worker.js public/construction-game/src/main.js
git commit -m "feat(construction): living workers (state visuals, wander/flee/riot, production wiring)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase 4 — 상호작용 · UI · 점수

### Task 18: ui/ConfrontationPrompt.js + 시비 적용 + 카메라 푸시인

**Files:**
- Create: `public/construction-game/src/ui/ConfrontationPrompt.js`
- Modify: `public/construction-game/src/main.js` (근접 탐지, 전술 적용, 푸시인, 콤보)

- [ ] **Step 1: ConfrontationPrompt.js 작성** (근접 일꾼 표시/숨김 + 빡침 표시)

```js
// public/construction-game/src/ui/ConfrontationPrompt.js
import { CONFIG } from '../logic/config.js';
import { getArchetype } from '../logic/archetypes.js';

export class ConfrontationPrompt {
  constructor() {
    this.el = document.getElementById('confront');
    this.nameEl = document.getElementById('confront-name');
    this.fill = document.getElementById('confront-rage-fill');
    this.current = null;
  }

  // returns the nearest non-escaped worker within confrontRadius, or null
  nearest(foreman, workers) {
    let best = null, bestD = CONFIG.worker.confrontRadius ** 2;
    for (const w of workers) {
      if (w.logic.escaped) continue;
      const dx = w.position.x - foreman.position.x, dz = w.position.z - foreman.position.z;
      const d = dx * dx + dz * dz;
      if (d <= bestD) { bestD = d; best = w; }
    }
    return best;
  }

  update(foreman, workers) {
    const w = this.nearest(foreman, workers);
    this.current = w;
    if (!w) { this.el.classList.add('hidden'); return; }
    this.el.classList.remove('hidden');
    this.nameEl.textContent = getArchetype(w.logic.archetypeId).label;
    this.fill.style.width = `${(w.logic.rage / CONFIG.rage.max) * 100}%`;
  }
}
```

- [ ] **Step 2: main.js 수정** — 프롬프트 인스턴스 + step에서 근접 갱신 + 전술키 처리 + 콤보 증가 + 푸시인

import 추가:
```js
import { ConfrontationPrompt } from './ui/ConfrontationPrompt.js';
import { applyTactic, tacticByKey } from './logic/tactics.js';
```
워커 스폰 다음, `game.step` 정의 전에:
```js
  const prompt = new ConfrontationPrompt();
  const diorama = game.systems.find((s) => s.pushIn); // DioramaCamera
```
`game.step` 본문에서 — chatter spread 직후, production 전에 삽입:
```js
    // confrontation: nearest worker within range gets the chosen tactic
    prompt.update(g.foreman, workers);
    const tacticKey = g.input.state.tactic; // already sampled this frame by Foreman.update
    if (tacticKey) {
      const target = prompt.current;
      const tacticId = tacticByKey(tacticKey);
      if (target && tacticId) {
        const wasSlacking = target.logic.state === 'slacking';
        applyTactic(target.logic, tacticId, target.archetype.rageSensitivity);
        target._lastKey = ''; // force sprite redraw next tick
        if (wasSlacking) g.combo += 1; // streak of clean returns
        diorama && diorama.pushIn(target.object3d, 1.2);
      }
    }
```

> 참고: `g.input`은 Task 10에서 `game.input = input`으로 보관됨. `Foreman.update`가 매 프레임 `input.sample()`을 호출해 `input.state.tactic`을 채우고, systems 순회가 끝난 뒤 `game.step`이 그 값을 읽는다(엣지트리거 큐라 1프레임 1전술).

- [ ] **Step 3: 확인** — `npm run dev` → 일꾼에게 다가가면 하단 프롬프트(이름+빡침 바+1/2/3) 표시. `1/2/3` 누르면 농땡이→작업 복귀 + 카메라가 잠깐 클로즈업 후 복귀. 윽박은 빡침이 크게, 달래기는 빡침이 내려감(다혈질은 윽박 시 빡침 급등 확인).

- [ ] **Step 4: 커밋**

```bash
git add public/construction-game/src/ui/ConfrontationPrompt.js public/construction-game/src/main.js
git commit -m "feat(construction): confrontation prompt + tactic apply + camera push-in + combo" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 19: ui/HUD.js (마감시계·층·인력·점수·콤보)

**Files:**
- Create: `public/construction-game/src/ui/HUD.js`
- Modify: `public/construction-game/src/main.js`

- [ ] **Step 1: HUD.js 작성** (사막 HUD의 ~10Hz 스로틀 패턴)

```js
// public/construction-game/src/ui/HUD.js
import { CONFIG } from '../logic/config.js';
import { computeScore } from '../logic/scoring.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.time = document.getElementById('time-val');
    this.floor = document.getElementById('floor-val');
    this.progressFill = document.getElementById('progress-fill');
    this.crew = document.getElementById('crew-val');
    this.score = document.getElementById('score-val');
    this.combo = document.getElementById('combo-val');
    this.comboBox = document.getElementById('hud-combo');
    document.getElementById('floor-total').textContent = CONFIG.targetFloors;
    this._acc = 0;
  }

  update(dt) {
    this._acc += dt;
    if (this._acc < 0.1) return; // ~10 Hz
    this._acc = 0;
    const g = this.game;
    const remaining = Math.max(0, Math.ceil(CONFIG.shiftSeconds - g.elapsed));
    this.time.textContent = remaining;
    this.floor.textContent = g.build.floorsBuilt;
    this.progressFill.style.width = `${(g.build.progress / CONFIG.production.floorProgress) * 100}%`;
    this.crew.textContent = g.crewRemaining;
    this.score.textContent = computeScore({
      elapsed: g.elapsed, shiftSeconds: CONFIG.shiftSeconds,
      floorsBuilt: g.build.floorsBuilt, targetFloors: CONFIG.targetFloors,
      combo: g.combo, incidents: g.incidents,
    });
    if (g.combo >= 2) { this.comboBox.classList.remove('hidden'); this.combo.textContent = g.combo; }
    else this.comboBox.classList.add('hidden');
  }
}
```

- [ ] **Step 2: main.js 수정** — HUD를 systems에 추가(`game.step` 정의 후 어디든)

import 추가:
```js
import { HUD } from './ui/HUD.js';
```
`game.step = ...` 정의 다음:
```js
  game.systems.push(new HUD(game));
```

- [ ] **Step 3: 확인** — `npm run dev` → 상단 마감 카운트다운, 층/진척 바/인력/점수가 실시간 갱신, 콤보 2 이상 시 🔥 표시.

- [ ] **Step 4: 커밋**

```bash
git add public/construction-game/src/ui/HUD.js public/construction-game/src/main.js
git commit -m "feat(construction): HUD (timer, floors, crew, score, combo)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 20: ui/Menu.js (일시정지 + 결과 + 재시작) + 승패 처리

**Files:**
- Create: `public/construction-game/src/ui/Menu.js`
- Modify: `public/construction-game/src/main.js` (Esc 정지, 결과 표시, R 재시작, scoring 연결)

- [ ] **Step 1: Menu.js 작성**

```js
// public/construction-game/src/ui/Menu.js
import { CONFIG } from '../logic/config.js';
import { computeScore } from '../logic/scoring.js';

export class Menu {
  constructor(game, onRestart) {
    this.game = game;
    this.onRestart = onRestart;
    this.pauseEl = document.getElementById('pause');
    this.resultEl = document.getElementById('result');
    this.resultTitle = document.getElementById('result-title');
    this.resultDetail = document.getElementById('result-detail');
    this.paused = false;

    document.getElementById('resume-btn').addEventListener('click', () => this.togglePause(false));
    document.getElementById('restart-btn').addEventListener('click', () => this._restart());
    document.getElementById('result-restart').addEventListener('click', () => this._restart());

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.game.status === 'playing') this.togglePause(!this.paused);
      if (e.code === 'KeyR' && (this.game.status === 'win' || this.game.status === 'defeat')) this._restart();
    });
  }

  _restart() {
    this.pauseEl.classList.add('hidden');
    this.resultEl.classList.add('hidden');
    this.paused = false;
    this.onRestart();
  }

  togglePause(on) {
    if (this.game.status !== 'playing' && !on) { /* allow unpausing only when paused */ }
    this.paused = on;
    this.pauseEl.classList.toggle('hidden', !on);
    if (on) this.game.stop();
    else this.game.start();
  }

  showResult(status) {
    const g = this.game;
    const score = computeScore({
      elapsed: g.elapsed, shiftSeconds: CONFIG.shiftSeconds,
      floorsBuilt: g.build.floorsBuilt, targetFloors: CONFIG.targetFloors,
      combo: g.combo, incidents: g.incidents,
    });
    this.resultTitle.textContent = status === 'win' ? '🏆 완공!' : '💥 현장 붕괴';
    this.resultDetail.textContent =
      `${g.build.floorsBuilt}/${CONFIG.targetFloors}층 · 사고 ${g.incidents}회 · 점수 ${score}`;
    this.resultEl.classList.remove('hidden');
    this.game.stop();
  }
}
```

- [ ] **Step 2: main.js 수정** — `restartGame()` 정의, Menu 생성, step 끝에서 `evaluate` → 결과 전환

import 추가:
```js
import { Menu } from './ui/Menu.js';
import { evaluate } from './logic/scoring.js';
```
`game.step` 정의 **앞**에 재시작 함수와 Menu:
```js
  function resetState() {
    game.status = 'playing';
    game.elapsed = 0;
    game.build = { progress: 0, floorsBuilt: 0 };
    game.combo = 0;
    game.incidents = 0;
    game.crewRemaining = CONFIG.workerCount;
    const rng2 = mulberry32(CONFIG.seed + 99);
    placed.forEach((p, i) => {
      const fresh = createWorker(p.id, p.archetypeId, rng2);
      Object.assign(workers[i].logic, fresh);
      workers[i].enteredRiot = false;
      workers[i].justEscaped = false;
      workers[i].object3d.visible = true;
      workers[i].position.set(p.x, 0, p.z);
      workers[i]._lastKey = '';
    });
    // reset building visuals
    for (const f of game.building.floors) game.building.object3d.remove(f);
    game.building.floors = [];
    game.building.sync(0, 0);
    hudEl.classList.remove('hidden');
  }

  const menu = new Menu(game, () => { resetState(); game.start(); });
```
`game.step` 본문 **맨 끝**(crewRemaining 갱신 다음)에 승패 판정:
```js
    const verdict = evaluate({
      elapsed: g.elapsed, shiftSeconds: CONFIG.shiftSeconds,
      floorsBuilt: g.build.floorsBuilt, targetFloors: CONFIG.targetFloors,
      crewRemaining: g.crewRemaining, crewCollapseThreshold: CONFIG.crewCollapseThreshold,
    });
    if (verdict !== 'playing') {
      g.status = verdict;
      menu.showResult(verdict);
    }
```

> 참고: `placed`, `workers`, `createWorker`, `mulberry32`, `hudEl`은 이미 상위 스코프에 존재한다(Task 17/10). `resetState`는 새 워커 로직을 기존 엔티티에 `Object.assign`으로 덮어써 참조를 유지한다.

- [ ] **Step 3: 확인** — `npm run dev` →
  - Esc로 일시정지/재개.
  - 5층 완공 시 "🏆 완공!" 결과 + 점수, R/버튼으로 재시작.
  - 일부러 윽박만 남발 → 도주/반란으로 인력 붕괴 시 "💥 현장 붕괴" 패배 + 재시작.

- [ ] **Step 4: 커밋**

```bash
git add public/construction-game/src/ui/Menu.js public/construction-game/src/main.js
git commit -m "feat(construction): pause + win/lose result + restart" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase 5 — PS2 레트로 파이프라인

게임이 완전히 플레이 가능한 상태에서 "룩"을 입힌다. 셰이더는 단위 테스트가 불가하므로 **스크린샷 육안 검증 + 상수 튜닝**으로 마감한다.

### Task 21: render/retroMaterial.js (정점 스냅; 스키닝 보존)

**Files:**
- Create: `public/construction-game/src/render/retroMaterial.js`
- Modify: `public/construction-game/src/main.js` (씬 머티리얼에 적용)

- [ ] **Step 1: retroMaterial.js 작성** — `#include <project_vertex>` 치환(스키닝 이후)으로 클립공간 정점 양자화

```js
// public/construction-game/src/render/retroMaterial.js
// Inject PS1-style vertex snapping AFTER skinning/morph (post project_vertex),
// so skeletal animation is preserved. Optionally enable affine UV warp.
export function applyRetro(material, { snap = 160, affine = false } = {}) {
  if (!material || material.userData.__retro) return material;
  material.userData.__retro = true;
  material.flatShading = true;

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = { value: snap };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform float uSnap;
         ${affine ? 'varying vec2 vAffineUv; varying float vAffineW;' : ''}`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         {
           vec4 snapped = gl_Position;
           snapped.xyz /= snapped.w;                       // -> NDC
           snapped.xy = floor(snapped.xy * uSnap) / uSnap; // quantize to a coarse grid
           snapped.xyz *= snapped.w;                       // back to clip space
           gl_Position = snapped;
           ${affine ? 'vAffineW = gl_Position.w; vAffineUv = uv * gl_Position.w;' : ''}
         }`
      );

    if (affine) {
      // perspective-incorrect (affine) texture sampling, PS1-style swim
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec2 vAffineUv; varying float vAffineW;`)
        .replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 sampledDiffuseColor = texture2D( map, vAffineUv / vAffineW );
            diffuseColor *= sampledDiffuseColor;
          #endif`);
    }
  };
  material.needsUpdate = true;
  return material;
}

// Walk a scene/object graph and apply retro to every mesh material.
export function applyRetroToObject(root, opts) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => applyRetro(m, opts));
  });
}
```

- [ ] **Step 2: main.js 수정** — 씬 구성 후 레트로 적용 (시작 직전에 한 번)

import 추가:
```js
import { applyRetroToObject } from './render/retroMaterial.js';
```
`startBtn` 클릭 핸들러 안, `game.start()` 직전:
```js
    applyRetroToObject(game.scene, { snap: 160, affine: false });
```

> `affine`은 기본 끔(정점 스냅만으로 PS2 느낌의 핵심). Task 25 검증 후 `affine: true`로 텍스처 일렁임을 켜고 육안 비교한다(텍스처가 있는 glTF 적용 시 효과 큼; 프리미티브는 무텍스처라 차이 미미).

- [ ] **Step 3: 확인 + 스크린샷** — `npm run dev` → 카메라 이동 시 모서리에 미세한 정점 흔들림(PS1 특유의 떨림). 애니메이션이 없으니(프리미티브) 스키닝 보존은 Phase 6에서 재확인. 스크린샷 1장 저장.

- [ ] **Step 4: 커밋**

```bash
git add public/construction-game/src/render/retroMaterial.js public/construction-game/src/main.js
git commit -m "feat(construction): retro vertex-snap material (skinning-safe)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 22: render/RetroPipeline.js (저해상도 RT + 디더/포스터라이즈)

**Files:**
- Create: `public/construction-game/src/render/RetroPipeline.js`
- Modify: `public/construction-game/src/main.js` (`game.pipeline` 장착)

- [ ] **Step 1: RetroPipeline.js 작성** — 저해상도 RT 렌더 → 풀스크린 쿼드 업스케일 + Bayer 디더 + 색 단계 축소

```js
// public/construction-game/src/render/RetroPipeline.js
import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */`
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D tDiffuse;
  uniform float uColorLevels;
  // 4x4 Bayer dithering matrix
  const mat4 bayer = mat4(
     0.0,  8.0,  2.0, 10.0,
    12.0,  4.0, 14.0,  6.0,
     3.0, 11.0,  1.0,  9.0,
    15.0,  7.0, 13.0,  5.0
  ) / 16.0;
  void main() {
    vec3 c = texture2D(tDiffuse, vUv).rgb;
    int xi = int(mod(gl_FragCoord.x, 4.0));
    int yi = int(mod(gl_FragCoord.y, 4.0));
    float threshold = bayer[xi][yi] - 0.5;
    c += threshold / uColorLevels;                 // dither before quantizing
    c = floor(c * uColorLevels + 0.5) / uColorLevels; // posterize
    gl_FragColor = vec4(c, 1.0);
  }
`;

export class RetroPipeline {
  constructor(width = 320, height = 240, colorLevels = 16) {
    this.rt = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
    });
    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { tDiffuse: { value: this.rt.texture }, uColorLevels: { value: colorLevels } },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.quadScene.add(quad);
  }

  setSize(_w, _h) { /* low-res RT stays fixed; the upscale quad fills the canvas */ }

  render(renderer, scene, camera) {
    renderer.setRenderTarget(this.rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(this.quadScene, this.quadCamera);
  }

  dispose() { this.rt.dispose(); this.material.dispose(); }
}
```

- [ ] **Step 2: main.js 수정** — 파이프라인 장착 (Game 생성 직후, `if (game) {` 블록 초반)

import 추가:
```js
import { RetroPipeline } from './render/RetroPipeline.js';
```
`if (game) {` 직후:
```js
  game.pipeline = new RetroPipeline(320, 240, 16);
```

- [ ] **Step 3: 확인 + 스크린샷** — `npm run dev` → 화면 전체가 저해상도 픽셀 + 디더 그라데이션 + 제한된 색 단계(PS2 룩). `style.css`의 `#game { image-rendering: pixelated }`로 업스케일 시 선명한 픽셀. 안개로 먼 곳 마스킹. `snap`/`colorLevels`/RT 해상도를 육안으로 튜닝(예: 256×192~360×270, levels 12~20). 스크린샷 저장.

- [ ] **Step 4: e2e 회귀 확인** — `npm run test:e2e -- construction-game` (파이프라인 추가 후에도 canvas 부트 무오류).

- [ ] **Step 5: 커밋**

```bash
git add public/construction-game/src/render/RetroPipeline.js public/construction-game/src/main.js
git commit -m "feat(construction): low-res render target + dither/posterize pipeline" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Phase 6 — 에셋(glTF) · 오디오 · 문서

### Task 23: assets/AssetLoader.js (GLTFLoader + 폴백)

**Files:**
- Create: `public/construction-game/src/assets/AssetLoader.js`

- [ ] **Step 1: AssetLoader.js 작성** — CDN GLTFLoader, 레트로 머티리얼·니어레스트 적용, `SkeletonUtils.clone`, 실패 시 `null` 반환(호출부가 프리미티브 유지)

```js
// public/construction-game/src/assets/AssetLoader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { applyRetroToObject } from '../render/retroMaterial.js';

export class AssetLoader {
  constructor(onWarn) {
    this.loader = new GLTFLoader();
    this.cache = new Map(); // url -> { scene, animations }
    this.onWarn = onWarn || (() => {});
  }

  async load(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    try {
      const gltf = await this.loader.loadAsync(url);
      gltf.scene.traverse((o) => {
        if (o.isMesh && o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m.map) { m.map.magFilter = THREE.NearestFilter; m.map.minFilter = THREE.NearestFilter; m.map.generateMipmaps = false; }
          }
        }
      });
      applyRetroToObject(gltf.scene, { snap: 160, affine: true });
      const entry = { scene: gltf.scene, animations: gltf.animations || [] };
      this.cache.set(url, entry);
      return entry;
    } catch (err) {
      console.warn('[construction-game] asset load failed, using primitive', url, err);
      this.onWarn(`에셋 로드 실패: ${url.split('/').pop()} (기본 모델 사용)`);
      return null;
    }
  }

  // returns a fresh skinned-safe instance + its own mixer, or null on miss
  instance(entry) {
    if (!entry) return null;
    const obj = skeletonClone(entry.scene);
    const mixer = entry.animations.length ? new THREE.AnimationMixer(obj) : null;
    return { obj, mixer, animations: entry.animations };
  }
}
```

- [ ] **Step 2: 커밋** (아직 미사용; 독립 모듈)

```bash
git add public/construction-game/src/assets/AssetLoader.js
git commit -m "feat(construction): glTF AssetLoader with retro material + graceful fallback" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 24: 에셋 수급(수동) + Worker/Foreman 모델 연결 + CREDITS.md

> **이 태스크는 외부 수동 단계를 포함한다.** 게임은 에셋 없이도 완전 동작하므로, 에셋이 준비되지 않았다면 Step 1을 건너뛰고 Step 4(폴백 경로 확인)만 검증한 뒤 진행해도 된다.

**Files:**
- Create: `public/construction-game/assets/CREDITS.md`
- Create (manual): `public/construction-game/assets/*.glb`
- Modify: `public/construction-game/src/main.js`

- [ ] **Step 1 (수동): CC0 .glb 수급** — Quaternius에서 다음을 받아 `.glb`로 변환(필요 시 Blender 1회 export) 후 `public/construction-game/assets/`에 배치:
  - `worker.glb` (Quaternius RPG/Universal 캐릭터 1종 — 일꾼 공용)
  - `foreman.glb` (동 캐릭터 색 변형 또는 별도 1종 — 반장)
  - (선택) `building_stage.glb` 미사용; 본 MVP 건물은 프리미티브 박스로 충분.
  - **라이선스 위생:** CC0만 커밋. Mixamo 원본·비-CC0 Sketchfab 금지.

- [ ] **Step 2: CREDITS.md 작성**

```markdown
# Tantrum Tower — Asset Credits

All committed 3D assets are CC0 (public domain) unless noted otherwise.

| File | Source | Author | License |
|------|--------|--------|---------|
| worker.glb | https://quaternius.com/ | Quaternius | CC0 |
| foreman.glb | https://quaternius.com/ | Quaternius | CC0 |

Props, building, and UI are generated procedurally with Three.js primitives.
Audio is synthesised at runtime via the Web Audio API (no external files).

If an asset fails to load at runtime, the game falls back to a box/capsule
primitive so play is never blocked.
```

- [ ] **Step 3: main.js 수정** — AssetLoader로 모델 로드 후 엔티티에 주입(있을 때만)

import 추가:
```js
import { AssetLoader } from './assets/AssetLoader.js';
```
워커/반장 생성 이후, `startBtn` 핸들러 전에 (비동기, 폴백 안전):
```js
  const assets = new AssetLoader(showToast);
  (async () => {
    const workerEntry = await assets.load('./assets/worker.glb');
    const foremanEntry = await assets.load('./assets/foreman.glb');
    if (workerEntry) {
      for (const w of workers) {
        const inst = assets.instance(workerEntry);
        if (inst) { w.setModel(inst.obj); w.mixer = inst.mixer; }
      }
    }
    if (foremanEntry) {
      const inst = assets.instance(foremanEntry);
      if (inst) foreman.setModel(inst.obj);
    }
  })();
```

> 애니메이션 믹서를 매 프레임 업데이트하려면 `Worker.update`에 `if (this.mixer) this.mixer.update(dt);`를 추가(이미 setModel 시 `this.mixer` 보관). 애니 클립이 없으면 정적 모델로 표시(아이콘이 상태를 전달하므로 충분).

- [ ] **Step 4: 폴백 경로 확인** — 에셋이 없거나 일부러 잘못된 경로일 때: 콘솔 경고 + 토스트("에셋 로드 실패…") + 캡슐 프리미티브로 정상 플레이(무중단). 에셋이 있을 때: 모델 표시 + 정점 스냅이 스키닝과 공존(애니 있으면 흔들림+움직임 동시).

- [ ] **Step 5: 커밋** (에셋 파일은 있으면 함께, 없으면 CREDITS+코드만)

```bash
git add public/construction-game/assets/CREDITS.md public/construction-game/src/main.js
# .glb가 준비된 경우: git add public/construction-game/assets/*.glb
git commit -m "feat(construction): wire glTF models into workers/foreman (+CREDITS, primitive fallback)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 25: audio/AudioManager.js (Web Audio 합성)

**Files:**
- Create: `public/construction-game/src/audio/AudioManager.js`
- Modify: `public/construction-game/src/main.js`

- [ ] **Step 1: AudioManager.js 작성** (사막 AudioManager의 blip/앰비언트 패턴 응용)

```js
// public/construction-game/src/audio/AudioManager.js
export class AudioManager {
  constructor() { this.ctx = null; this.master = null; this.enabled = false; }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);

    // low ambient construction hum
    this.hum = this.ctx.createOscillator();
    this.hum.type = 'triangle';
    this.hum.frequency.value = 55;
    this.humGain = this.ctx.createGain();
    this.humGain.gain.value = 0.03;
    this.hum.connect(this.humGain).connect(this.master);
    this.hum.start();
    this.enabled = true;
  }

  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  blip(freq, dur = 0.12, type = 'square', gain = 0.25) {
    if (!this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(gain, this.ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g).connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur);
  }

  // tactic feedback
  shout(tacticId) {
    if (tacticId === 'bark') this.blip(180, 0.22, 'sawtooth', 0.35);
    else if (tacticId === 'taunt') this.blip(420, 0.16, 'square', 0.25);
    else this.blip(330, 0.2, 'sine', 0.22); // soothe
  }
  combo() { [660, 880, 1100].forEach((f, i) => setTimeout(() => this.blip(f, 0.12, 'triangle', 0.3), i * 70)); }
  floorUp() { [523, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'square', 0.3), i * 90)); }
  alarm() { this.blip(140, 0.4, 'sawtooth', 0.4); } // flee/riot
}
```

- [ ] **Step 2: main.js 수정** — 오디오 init + 이벤트 연결

import 추가:
```js
import { AudioManager } from './audio/AudioManager.js';
```
`const assets = ...` 부근에:
```js
  const audio = new AudioManager();
  game.audio = audio;
```
`startBtn` 핸들러 안:
```js
    audio.init();
    audio.resume();
```
이벤트 연결 (이미 있는 지점에 추가):
- 전술 적용 직후(Task 18 블록): `g.audio && g.audio.shout(tacticId); if (wasSlacking && g.combo >= 2) g.audio && g.audio.combo();`
- 층 완공 시(Task 17의 production 블록, `res.floorsCompletedThisStep > 0`일 때): `if (res.floorsCompletedThisStep > 0) g.audio && g.audio.floorUp();`
- 도주 발생 시(Task 17 incidents 블록, `w.justEscaped`): `g.audio && g.audio.alarm();`

- [ ] **Step 3: 확인** — `npm run dev` → 시작 시 낮은 앰비언트 험, 전술/콤보/층완공/도주에 각기 다른 효과음.

- [ ] **Step 4: 커밋**

```bash
git add public/construction-game/src/audio/AudioManager.js public/construction-game/src/main.js
git commit -m "feat(construction): Web Audio (ambient, shouts, combo, floor-up, alarm)" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 26: README + 최종 검증

**Files:**
- Modify: `README.md`

- [ ] **Step 1: README.md에 5번째 게임 추가** — 게임 목록/구조 섹션에 "Tantrum Tower (건설 관리, PS2 레트로)" 항목을 기존 4개 게임과 동일 양식으로 추가(라우트 `/construction-game`, 기술: 빌드리스 Three.js + Web Audio).

- [ ] **Step 2: 전체 게이트 통과 확인**

Run:
```bash
npm run lint
npm run type-check
npm run test
npm run test:e2e -- construction-game
```
Expected: 모두 통과. (lint: 건설 JS는 ignore / type-check: public 제외 / test: Phase 1 단위 전부 / e2e: 2 통과.)

- [ ] **Step 3: 수동 플레이 검증 체크리스트** — `npm run dev`:
  - [ ] PS2 룩(저해상도·디더·정점 흔들림·안개)이 일관되게 적용
  - [ ] 4종 폐급이 서로 다른 빈도로 농땡이, 상태 아이콘/빡침 게이지 가독
  - [ ] 윽박/비꼬기/달래기가 빡침을 의도대로 변동(다혈질 윽박 위험)
  - [ ] 태업(60)→도주(80, 출구로 이동 후 인력−1)→반란(95, 제자리) 단계 확인
  - [ ] 잡담러 인접 일꾼이 더 빨리 농땡이
  - [ ] 작업 인원에 따라 진척·층 상승, 5층 완공 시 승리
  - [ ] 콤보/사고/점수가 HUD·결과에 반영
  - [ ] 시비 시 카메라 푸시인 후 복귀
  - [ ] 에셋 없을 때 프리미티브로 무중단(콘솔 경고+토스트만)

- [ ] **Step 4: 커밋**

```bash
git add README.md
git commit -m "docs(construction): document Tantrum Tower in README" -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 마감 (구현 완료 후)

모든 태스크 완료 후 `superpowers:finishing-a-development-branch` 스킬로 마무리(브랜치 정리·PR 또는 main 병합 정책 확인). 배포는 `main` 푸시 시 Vercel(`mini-games`)이 프로덕션 자동 배포(메모리 `mini-games-deployment` 참조).

---

## 셀프 리뷰 결과 (writing-plans 체크리스트)

**1. 스펙 커버리지:** 스펙 §3 기능 ①전술시비→Task 3/18, ②빡침단계→Task 2/4/17, ③아키타입4종→Task 1/17, ④건물상승→Task 5/15/17, 🎥하이브리드카메라→Task 16/18, 🔊사운드→Task 25. §4 조작→Task 9(Input)/20(Esc·R). §5 아트(Quaternius통일·아이콘·PS2)→Task 21/22/24. §6.1~6.6 importmap/빌드리스/순수로직/PS2/에셋→Phase 1·5·6 전반. §6.7 확장 seam→config.js(Task 1)+InputState(Task 9)로 충족. §7 허브→Task 11(인라인 카드로 조정). §8 CI→Task 12. §9 테스트→Task 1–7(단위)·13(e2e). §10 리스크(WebGL/404폴백/스키닝)→Task 10/23/21. §12 상수→Task 1. **갭 없음**(스펙의 games.data.ts·.glb는 위 "조정 사항"에서 명시적으로 재정의).

**2. 플레이스홀더 스캔:** 모든 코드 단계에 완전한 코드 포함. "TBD/적절히 처리" 류 없음. 수동 에셋 수급(Task 24 Step 1)은 플레이스홀더가 아니라 명시된 외부 단계이며, 폴백으로 게임 동작이 보장됨.

**3. 타입 일관성:** 워커 로직 필드(id/archetypeId/state/activity/rage/slackTimer/boostMul/boostTimer/escaped)와 로직 API 시그니처를 "인터페이스 계약" 절에 고정하고 전 태스크에서 동일 사용. `advanceProgress`는 `{progress, floorsBuilt, floorsCompletedThisStep}` 반환을 Task 5 정의·Task 17 소비에서 일치. `applyTactic(worker,tacticId,sensitivity)`·`tacticByKey`·`getArchetype`·`crewOutputPerSecond`·`evaluate`·`computeScore` 시그니처 호출부 일치. `DioramaCamera.pushIn(object3d)`/`Worker.setModel(obj)`/`Building.sync(floors,progress01)`/`Game.pipeline.render/setSize` 명칭 일치 확인.
